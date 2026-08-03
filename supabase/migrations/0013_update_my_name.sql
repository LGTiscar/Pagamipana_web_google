-- ============================================================================
-- PagaMiPana · Elegir/editar el nombre visible (perfil)
-- Un usuario con cuenta (Google, correo o invitado) puede fijar su nombre desde
-- la app. Actualiza su perfil Y su display_name como participante en TODOS sus
-- proyectos, para que el nombre sea coherente en toda la app.
-- SECURITY DEFINER: actúa solo sobre las filas del propio usuario (auth.uid()).
-- ============================================================================

create or replace function public.update_my_name(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if coalesce(nullif(btrim(p_name), ''), '') = '' then
    raise exception 'El nombre no puede estar vacío';
  end if;

  update public.profiles set display_name = btrim(p_name) where id = auth.uid();
  update public.participants set display_name = btrim(p_name) where profile_id = auth.uid();
end;
$$;

grant execute on function public.update_my_name(text) to authenticated;
