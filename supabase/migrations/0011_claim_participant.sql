-- ============================================================================
-- PagaMiPana · Reclamar un participante existente al unirse por enlace
-- Si en el proyecto ya hay gente "sin cuenta" (profile_id NULL), quien se une
-- por enlace puede identificarse como una de esas personas (vinculando su
-- profile_id y conservando sus gastos) en vez de entrar como participante nuevo.
--
-- Ambas funciones son SECURITY DEFINER: quien abre el enlace todavía NO es
-- miembro, así que RLS le bloquearía el SELECT/UPDATE. El UUID del proyecto
-- actúa de secreto del enlace, igual que en join_project.
-- ============================================================================

-- Participantes SIN cuenta (reclamables) de un proyecto.
create or replace function public.list_joinable_participants(p_project_id uuid)
returns table (id uuid, display_name text, color text)
language sql
security definer
set search_path = public
as $$
  select pa.id, pa.display_name, pa.color
  from public.participants pa
  where pa.project_id = p_project_id
    and pa.profile_id is null
    and auth.uid() is not null
  order by pa.created_at;
$$;

-- El usuario actual se identifica como un participante existente sin cuenta.
create or replace function public.claim_participant(
  p_project_id     uuid,
  p_participant_id uuid,
  p_display_name   text default null
)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  proj public.projects;
  part public.participants;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select * into proj from public.projects where id = p_project_id;
  if proj.id is null then
    raise exception 'Proyecto no encontrado';
  end if;

  -- Si ya soy miembro de este proyecto, no reclamo (evita duplicar identidad).
  if exists (
    select 1 from public.participants
    where project_id = p_project_id and profile_id = auth.uid()
  ) then
    return proj;
  end if;

  select * into part from public.participants
   where id = p_participant_id and project_id = p_project_id;
  if part.id is null then
    raise exception 'Participante no encontrado';
  end if;
  if part.profile_id is not null then
    raise exception 'Esa persona ya tiene una cuenta vinculada';
  end if;

  update public.participants
     set profile_id   = auth.uid(),
         display_name = coalesce(nullif(p_display_name, ''), display_name)
   where id = p_participant_id;

  return proj;
end;
$$;

grant execute on function public.list_joinable_participants(uuid) to authenticated;
grant execute on function public.claim_participant(uuid, uuid, text) to authenticated;
