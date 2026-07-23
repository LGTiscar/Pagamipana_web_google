-- ============================================================================
-- PagaMiPana · Unirse a un proyecto por enlace de invitación
-- El UUID del proyecto actúa de "secreto" del enlace (?join=<uuid>).
-- ============================================================================

create or replace function public.join_project(
  p_project_id   uuid,
  p_display_name text default null
)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  proj public.projects;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select * into proj from public.projects where id = p_project_id;
  if proj.id is null then
    raise exception 'Proyecto no encontrado';
  end if;

  -- Alta como participante vinculado si aún no lo soy.
  if not exists (
    select 1 from public.participants
    where project_id = p_project_id and profile_id = auth.uid()
  ) then
    insert into public.participants (project_id, profile_id, display_name)
    values (
      p_project_id,
      auth.uid(),
      coalesce(
        nullif(p_display_name, ''),
        (select display_name from public.profiles where id = auth.uid()),
        'Yo'
      )
    );
  end if;

  return proj;
end;
$$;

grant execute on function public.join_project(uuid, text) to authenticated;
