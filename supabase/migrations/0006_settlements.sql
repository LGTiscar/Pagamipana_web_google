-- ============================================================================
-- PagaMiPana · Fase 4 — Liquidaciones (marcar pagos)
-- Registra pagos entre participantes. Los balances los descuentan.
-- ============================================================================

create table if not exists public.settlements (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  from_participant uuid not null references public.participants(id) on delete cascade,
  to_participant   uuid not null references public.participants(id) on delete cascade,
  amount           numeric(12,2) not null,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists settlements_project_id_idx on public.settlements (project_id);

-- ---------------------------------------------------------------------------
-- get_balances v2: net = pagado - debido + pagos_hechos - pagos_recibidos
-- ---------------------------------------------------------------------------
create or replace function public.get_balances(p_project_id uuid)
returns table (participant_id uuid, display_name text, paid numeric, owed numeric, net numeric)
language sql
stable
set search_path = public
as $$
  select
    pa.id,
    pa.display_name,
    coalesce(paid.s, 0) as paid,
    coalesce(owed.s, 0) as owed,
    coalesce(paid.s, 0) - coalesce(owed.s, 0) + coalesce(sf.amt, 0) - coalesce(st.amt, 0) as net
  from public.participants pa
  left join (
    select paid_by as pid, sum(amount_total) s from public.expenses
    where project_id = p_project_id group by paid_by
  ) paid on paid.pid = pa.id
  left join (
    select es.participant_id as pid, sum(es.amount) s
    from public.expense_shares es join public.expenses e on e.id = es.expense_id
    where e.project_id = p_project_id group by es.participant_id
  ) owed on owed.pid = pa.id
  left join (
    select from_participant as pid, sum(amount) amt from public.settlements
    where project_id = p_project_id group by from_participant
  ) sf on sf.pid = pa.id
  left join (
    select to_participant as pid, sum(amount) amt from public.settlements
    where project_id = p_project_id group by to_participant
  ) st on st.pid = pa.id
  where pa.project_id = p_project_id;
$$;

-- ---------------------------------------------------------------------------
-- list_projects_overview v2: my_net incluye las liquidaciones
-- ---------------------------------------------------------------------------
create or replace function public.list_projects_overview()
returns table (
  id uuid, name text, type text, currency text, created_at timestamptz,
  my_net numeric, member_count int, avatars jsonb
)
language sql
stable
set search_path = public
as $$
  select
    p.id, p.name, p.type, p.currency, p.created_at,
    coalesce(paid.s, 0) - coalesce(owed.s, 0) + coalesce(sf.amt, 0) - coalesce(st.amt, 0) as my_net,
    (select count(*) from public.participants pa where pa.project_id = p.id)::int as member_count,
    (select coalesce(jsonb_agg(jsonb_build_object('name', pa.display_name, 'color', pa.color) order by pa.created_at), '[]'::jsonb)
      from public.participants pa where pa.project_id = p.id) as avatars
  from public.projects p
  left join (
    select e.project_id, sum(e.amount_total) s from public.expenses e
    join public.participants me on me.id = e.paid_by and me.profile_id = auth.uid()
    group by e.project_id
  ) paid on paid.project_id = p.id
  left join (
    select e.project_id, sum(es.amount) s
    from public.expense_shares es join public.expenses e on e.id = es.expense_id
    join public.participants me on me.id = es.participant_id and me.profile_id = auth.uid()
    group by e.project_id
  ) owed on owed.project_id = p.id
  left join (
    select stl.project_id, sum(stl.amount) amt from public.settlements stl
    join public.participants me on me.id = stl.from_participant and me.profile_id = auth.uid()
    group by stl.project_id
  ) sf on sf.project_id = p.id
  left join (
    select stl.project_id, sum(stl.amount) amt from public.settlements stl
    join public.participants me on me.id = stl.to_participant and me.profile_id = auth.uid()
    group by stl.project_id
  ) st on st.project_id = p.id;
$$;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.settlements enable row level security;

drop policy if exists "settlements_select_member" on public.settlements;
create policy "settlements_select_member" on public.settlements
  for select using (public.is_project_member(project_id));

drop policy if exists "settlements_insert_member" on public.settlements;
create policy "settlements_insert_member" on public.settlements
  for insert with check (public.is_project_member(project_id));

drop policy if exists "settlements_delete_member" on public.settlements;
create policy "settlements_delete_member" on public.settlements
  for delete using (public.is_project_member(project_id));

grant select, insert, update, delete on public.settlements to authenticated;
