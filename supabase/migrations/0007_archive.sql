-- ============================================================================
-- PagaMiPana · Fase 4 — Archivar proyectos
-- El resumen filtra los archivados salvo que se pidan explícitamente, y expone
-- archived_at para poder separarlos en la UI. Archivar = update de archived_at
-- (lo hace el cliente vía RLS de update; no necesita RPC).
-- ============================================================================

drop function if exists public.list_projects_overview();

create or replace function public.list_projects_overview(p_include_archived boolean default false)
returns table (
  id uuid, name text, type text, currency text, created_at timestamptz, archived_at timestamptz,
  my_net numeric, member_count int, avatars jsonb
)
language sql
stable
set search_path = public
as $$
  select
    p.id, p.name, p.type, p.currency, p.created_at, p.archived_at,
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
  ) st on st.project_id = p.id
  where (p_include_archived or p.archived_at is null)
  order by p.created_at desc;
$$;

grant execute on function public.list_projects_overview(boolean) to authenticated;
