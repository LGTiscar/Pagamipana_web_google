-- ============================================================================
-- PagaMiPana · Borrado solo del creador · salir del proyecto · archivado personal
--   (1) overview expone `created_by` para que la UI muestre "Eliminar" solo al creador.
--   (2) leave_project: un miembro (no creador) se sale, solo si NO tiene huella
--       económica (nada pagado, ninguna parte, ninguna liquidación).
--   (3) archivado PERSONAL: cada usuario archiva el proyecto solo para sí mismo,
--       vía project_archives (project_id, profile_id). Sustituye a projects.archived_at.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (3) Estado de archivado por-usuario
-- ---------------------------------------------------------------------------
create table if not exists public.project_archives (
  project_id  uuid not null references public.projects(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  archived_at timestamptz not null default now(),
  primary key (project_id, profile_id)
);

alter table public.project_archives enable row level security;

drop policy if exists "project_archives_select_own" on public.project_archives;
create policy "project_archives_select_own" on public.project_archives
  for select using (profile_id = auth.uid());

drop policy if exists "project_archives_insert_own" on public.project_archives;
create policy "project_archives_insert_own" on public.project_archives
  for insert with check (profile_id = auth.uid() and public.is_project_member(project_id));

drop policy if exists "project_archives_delete_own" on public.project_archives;
create policy "project_archives_delete_own" on public.project_archives
  for delete using (profile_id = auth.uid());

grant select, insert, delete on public.project_archives to authenticated;

-- Archivar / desarchivar para mí (upsert/delete de mi fila).
create or replace function public.set_project_archived(p_project_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_project_member(p_project_id) then
    raise exception 'No autorizado en este proyecto';
  end if;
  if p_archived then
    insert into public.project_archives (project_id, profile_id)
    values (p_project_id, auth.uid())
    on conflict (project_id, profile_id) do nothing;
  else
    delete from public.project_archives
     where project_id = p_project_id and profile_id = auth.uid();
  end if;
end;
$$;

grant execute on function public.set_project_archived(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- (2) Salir del proyecto (solo no-creador y sin huella económica)
-- ---------------------------------------------------------------------------
create or replace function public.leave_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  proj public.projects;
  me   public.participants;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select * into proj from public.projects where id = p_project_id;
  if proj.id is null then
    raise exception 'Proyecto no encontrado';
  end if;
  if proj.created_by = auth.uid() then
    raise exception 'Eres el creador: elimina el proyecto en vez de salir';
  end if;

  select * into me from public.participants
   where project_id = p_project_id and profile_id = auth.uid();
  if me.id is null then
    raise exception 'No estás en este proyecto';
  end if;

  if exists (select 1 from public.expenses e where e.project_id = p_project_id and e.paid_by = me.id)
     or exists (
       select 1 from public.expense_shares es
       join public.expenses e on e.id = es.expense_id
       where e.project_id = p_project_id and es.participant_id = me.id)
     or exists (
       select 1 from public.settlements s
       where s.project_id = p_project_id and (s.from_participant = me.id or s.to_participant = me.id))
  then
    raise exception 'Tienes gastos o saldo en este proyecto. Salda y quita tus gastos antes de salir.';
  end if;

  delete from public.participants where id = me.id;
  delete from public.project_archives where project_id = p_project_id and profile_id = auth.uid();
end;
$$;

grant execute on function public.leave_project(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- (1)+(3) overview: añade created_by y usa el archivado PERSONAL
-- ---------------------------------------------------------------------------
drop function if exists public.list_projects_overview(boolean);

create or replace function public.list_projects_overview(p_include_archived boolean default false)
returns table (
  id uuid, name text, type text, currency text, created_at timestamptz,
  created_by uuid, archived_at timestamptz,
  my_net numeric, member_count int, avatars jsonb
)
language sql
stable
set search_path = public
as $$
  select
    p.id, p.name, p.type, p.currency, p.created_at, p.created_by,
    ar.archived_at,
    coalesce(paid.s, 0) - coalesce(owed.s, 0) + coalesce(sf.amt, 0) - coalesce(st.amt, 0) as my_net,
    (select count(*) from public.participants pa where pa.project_id = p.id)::int as member_count,
    (select coalesce(jsonb_agg(jsonb_build_object('name', pa.display_name, 'color', pa.color) order by pa.created_at), '[]'::jsonb)
      from public.participants pa where pa.project_id = p.id) as avatars
  from public.projects p
  left join public.project_archives ar on ar.project_id = p.id and ar.profile_id = auth.uid()
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
  where (p_include_archived or ar.archived_at is null)
  order by p.created_at desc;
$$;

grant execute on function public.list_projects_overview(boolean) to authenticated;
