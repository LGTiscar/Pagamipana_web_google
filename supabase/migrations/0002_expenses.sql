-- ============================================================================
-- PagaMiPana · Fase 2 — Gastos y balances
-- Tablas: expenses, expense_shares  +  RLS  +  RPC add_expense / get_balances
-- ============================================================================

-- ---------------------------------------------------------------------------
-- expenses: un gasto (manual o por ticket/OCR) dentro de un proyecto
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  description  text not null,
  amount_total numeric(12,2) not null,
  currency     text not null default 'EUR',
  paid_by      uuid not null references public.participants(id) on delete restrict,
  split_type   text not null default 'equal',  -- equal | shares | exact | percent | by_item
  source       text not null default 'manual', -- manual | ocr
  receipt_path text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists expenses_project_id_idx on public.expenses (project_id);

-- ---------------------------------------------------------------------------
-- expense_shares: cuánto debe cada participante de ESE gasto (canónico)
-- ---------------------------------------------------------------------------
create table if not exists public.expense_shares (
  id             uuid primary key default gen_random_uuid(),
  expense_id     uuid not null references public.expenses(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  amount         numeric(12,2) not null
);
create index if not exists expense_shares_expense_id_idx on public.expense_shares (expense_id);
create index if not exists expense_shares_participant_id_idx on public.expense_shares (participant_id);

-- ---------------------------------------------------------------------------
-- RPC atómico: crea el gasto + sus shares en una transacción.
-- Valida membresía y que las partes cuadren con el total.
-- ---------------------------------------------------------------------------
create or replace function public.add_expense(
  p_project_id  uuid,
  p_description text,
  p_amount      numeric,
  p_paid_by     uuid,
  p_split_type  text default 'equal',
  p_source      text default 'manual',
  p_shares      jsonb default '[]'::jsonb
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  exp public.expenses;
  cur text;
  total_shares numeric;
  sh jsonb;
begin
  if not public.is_project_member(p_project_id) then
    raise exception 'No autorizado en este proyecto';
  end if;

  select currency into cur from public.projects where id = p_project_id;

  select coalesce(sum((s->>'amount')::numeric), 0)
    into total_shares
    from jsonb_array_elements(p_shares) s;

  if abs(total_shares - p_amount) > 0.01 then
    raise exception 'Las partes (%) no suman el total (%)', total_shares, p_amount;
  end if;

  insert into public.expenses
    (project_id, description, amount_total, currency, paid_by, split_type, source, created_by)
  values
    (p_project_id, p_description, p_amount, coalesce(cur, 'EUR'), p_paid_by,
     coalesce(p_split_type, 'equal'), coalesce(p_source, 'manual'), auth.uid())
  returning * into exp;

  for sh in select * from jsonb_array_elements(p_shares) loop
    insert into public.expense_shares (expense_id, participant_id, amount)
    values (exp.id, (sh->>'participant_id')::uuid, (sh->>'amount')::numeric);
  end loop;

  return exp;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_balances: saldo neto por participante (SECURITY INVOKER → respeta RLS,
-- solo devuelve datos si el usuario es miembro del proyecto).
-- ---------------------------------------------------------------------------
create or replace function public.get_balances(p_project_id uuid)
returns table (
  participant_id uuid,
  display_name   text,
  paid           numeric,
  owed           numeric,
  net            numeric
)
language sql
stable
set search_path = public
as $$
  select
    pa.id,
    pa.display_name,
    coalesce(paid.s, 0)                       as paid,
    coalesce(owed.s, 0)                       as owed,
    coalesce(paid.s, 0) - coalesce(owed.s, 0) as net
  from public.participants pa
  left join (
    select paid_by as pid, sum(amount_total) s
    from public.expenses
    where project_id = p_project_id
    group by paid_by
  ) paid on paid.pid = pa.id
  left join (
    select es.participant_id as pid, sum(es.amount) s
    from public.expense_shares es
    join public.expenses e on e.id = es.expense_id
    where e.project_id = p_project_id
    group by es.participant_id
  ) owed on owed.pid = pa.id
  where pa.project_id = p_project_id;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.expenses       enable row level security;
alter table public.expense_shares enable row level security;

-- expenses: los miembros del proyecto gestionan
drop policy if exists "expenses_select_member" on public.expenses;
create policy "expenses_select_member" on public.expenses
  for select using (public.is_project_member(project_id));

drop policy if exists "expenses_insert_member" on public.expenses;
create policy "expenses_insert_member" on public.expenses
  for insert with check (public.is_project_member(project_id));

drop policy if exists "expenses_update_member" on public.expenses;
create policy "expenses_update_member" on public.expenses
  for update using (public.is_project_member(project_id));

drop policy if exists "expenses_delete_member" on public.expenses;
create policy "expenses_delete_member" on public.expenses
  for delete using (public.is_project_member(project_id));

-- expense_shares: acceso vía el proyecto del gasto
drop policy if exists "expense_shares_select_member" on public.expense_shares;
create policy "expense_shares_select_member" on public.expense_shares
  for select using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and public.is_project_member(e.project_id)
    )
  );

drop policy if exists "expense_shares_insert_member" on public.expense_shares;
create policy "expense_shares_insert_member" on public.expense_shares
  for insert with check (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and public.is_project_member(e.project_id)
    )
  );

drop policy if exists "expense_shares_delete_member" on public.expense_shares;
create policy "expense_shares_delete_member" on public.expense_shares
  for delete using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and public.is_project_member(e.project_id)
    )
  );

-- ============================================================================
-- Grants
-- ============================================================================
grant select, insert, update, delete on public.expenses, public.expense_shares to authenticated;
grant execute on function public.add_expense(uuid, text, numeric, uuid, text, text, jsonb) to authenticated;
grant execute on function public.get_balances(uuid) to authenticated;
