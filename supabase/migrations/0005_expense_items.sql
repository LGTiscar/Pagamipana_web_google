-- ============================================================================
-- PagaMiPana · Fase 3 — Detalle de ítems de un gasto por ticket (OCR)
-- Guarda las líneas del ticket y quién consumió cada una (para el histórico).
-- Los balances siguen calculándose desde expense_shares (canónico).
-- ============================================================================

create table if not exists public.expense_items (
  id          uuid primary key default gen_random_uuid(),
  expense_id  uuid not null references public.expenses(id) on delete cascade,
  description text not null,
  quantity    numeric not null default 1,
  unit_price  numeric(12,2) not null default 0,
  owner_ids   uuid[] not null default '{}'::uuid[]  -- participantes que lo consumieron
);
create index if not exists expense_items_expense_id_idx on public.expense_items (expense_id);

-- ---------------------------------------------------------------------------
-- RPC atómico: crea el gasto (source=ocr) + shares + líneas del ticket.
-- ---------------------------------------------------------------------------
create or replace function public.add_ocr_expense(
  p_project_id  uuid,
  p_description text,
  p_amount      numeric,
  p_paid_by     uuid,
  p_shares      jsonb,
  p_items       jsonb
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
  it jsonb;
begin
  if not public.is_project_member(p_project_id) then
    raise exception 'No autorizado en este proyecto';
  end if;

  select currency into cur from public.projects where id = p_project_id;

  select coalesce(sum((s->>'amount')::numeric), 0) into total_shares
    from jsonb_array_elements(p_shares) s;
  if abs(total_shares - p_amount) > 0.01 then
    raise exception 'Las partes (%) no suman el total (%)', total_shares, p_amount;
  end if;

  insert into public.expenses
    (project_id, description, amount_total, currency, paid_by, split_type, source, created_by)
  values
    (p_project_id, p_description, p_amount, coalesce(cur, 'EUR'), p_paid_by, 'by_item', 'ocr', auth.uid())
  returning * into exp;

  for sh in select * from jsonb_array_elements(p_shares) loop
    insert into public.expense_shares (expense_id, participant_id, amount)
    values (exp.id, (sh->>'participant_id')::uuid, (sh->>'amount')::numeric);
  end loop;

  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.expense_items (expense_id, description, quantity, unit_price, owner_ids)
    values (
      exp.id,
      coalesce(it->>'description', 'Producto'),
      coalesce((it->>'quantity')::numeric, 1),
      coalesce((it->>'unit_price')::numeric, 0),
      coalesce(
        (select array_agg(value::uuid) from jsonb_array_elements_text(it->'owner_ids')),
        '{}'::uuid[]
      )
    );
  end loop;

  return exp;
end;
$$;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.expense_items enable row level security;

drop policy if exists "expense_items_select_member" on public.expense_items;
create policy "expense_items_select_member" on public.expense_items
  for select using (
    exists (select 1 from public.expenses e where e.id = expense_id and public.is_project_member(e.project_id))
  );

drop policy if exists "expense_items_insert_member" on public.expense_items;
create policy "expense_items_insert_member" on public.expense_items
  for insert with check (
    exists (select 1 from public.expenses e where e.id = expense_id and public.is_project_member(e.project_id))
  );

drop policy if exists "expense_items_delete_member" on public.expense_items;
create policy "expense_items_delete_member" on public.expense_items
  for delete using (
    exists (select 1 from public.expenses e where e.id = expense_id and public.is_project_member(e.project_id))
  );

grant select, insert, update, delete on public.expense_items to authenticated;
grant execute on function public.add_ocr_expense(uuid, text, numeric, uuid, jsonb, jsonb) to authenticated;
