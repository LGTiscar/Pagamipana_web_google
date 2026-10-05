-- ============================================================================
-- PagaMiPana · El creador puede eliminar participantes del proyecto
-- Solo si el participante NO tiene huella económica (misma regla que
-- leave_project): ni ha pagado, ni participa en gastos/líneas de ticket, ni
-- tiene liquidaciones. Así nunca se descuadran gastos ni balances.
--
-- Además se cierra el DELETE directo sobre participants: antes cualquier
-- miembro podía borrar a cualquiera vía API (y el cascade se llevaba sus
-- shares, descuadrando gastos). Ahora solo se borra por RPC (remove_participant
-- / leave_project, ambas SECURITY DEFINER).
-- ============================================================================

drop policy if exists "participants_delete_member" on public.participants;

create or replace function public.remove_participant(
  p_project_id     uuid,
  p_participant_id uuid
)
returns void
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
  if proj.created_by is distinct from auth.uid() then
    raise exception 'Solo quien creó el proyecto puede eliminar participantes';
  end if;

  select * into part from public.participants
   where id = p_participant_id and project_id = p_project_id;
  if part.id is null then
    raise exception 'Participante no encontrado';
  end if;
  if part.profile_id = auth.uid() then
    raise exception 'No puedes eliminarte a ti mismo: elimina el proyecto si ya no lo necesitas';
  end if;

  if exists (select 1 from public.expenses e where e.project_id = p_project_id and e.paid_by = part.id)
     or exists (
       select 1 from public.expense_shares es
       join public.expenses e on e.id = es.expense_id
       where e.project_id = p_project_id and es.participant_id = part.id)
     or exists (
       select 1 from public.expense_items ei
       join public.expenses e on e.id = ei.expense_id
       where e.project_id = p_project_id and part.id = any(ei.owner_ids))
     or exists (
       select 1 from public.settlements s
       where s.project_id = p_project_id and (s.from_participant = part.id or s.to_participant = part.id))
  then
    raise exception 'Tiene gastos o saldo en este proyecto. Quítalo de esos gastos antes de eliminarlo.';
  end if;

  delete from public.participants where id = part.id;
  -- Si tenía cuenta, su archivado personal de este proyecto ya no tiene sentido.
  if part.profile_id is not null then
    delete from public.project_archives where project_id = p_project_id and profile_id = part.profile_id;
  end if;
end;
$$;

grant execute on function public.remove_participant(uuid, uuid) to authenticated;
