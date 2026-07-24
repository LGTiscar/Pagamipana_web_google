-- ============================================================================
-- PagaMiPana · Limpieza automática de usuarios anónimos abandonados
-- Borra anónimos de >30 días SIN datos (no crearon proyectos ni son participantes).
-- Nunca toca anónimos con datos ni cuentas permanentes.
-- ============================================================================

-- pg_cron: si esto falla, actívalo antes en Dashboard → Database → Extensions.
create extension if not exists pg_cron;

create or replace function public.cleanup_anonymous_users()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer;
begin
  with del as (
    delete from auth.users u
    where u.is_anonymous = true
      and u.created_at < now() - interval '30 days'
      and not exists (select 1 from public.projects p where p.created_by = u.id)
      and not exists (select 1 from public.participants pa where pa.profile_id = u.id)
    returning 1
  )
  select count(*) into deleted from del;
  return deleted;
end;
$$;

-- Programa la limpieza a diario (03:00 UTC). Idempotente al reejecutar la migración.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-anonymous-users') then
    perform cron.unschedule('cleanup-anonymous-users');
  end if;
end $$;

select cron.schedule('cleanup-anonymous-users', '0 3 * * *', $$select public.cleanup_anonymous_users()$$);
