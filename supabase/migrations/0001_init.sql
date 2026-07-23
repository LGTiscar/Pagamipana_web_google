-- ============================================================================
-- PagaMiPana · Fase 1 — Fundación
-- Tablas: profiles, projects, participants  +  RLS  +  triggers/RPC
-- Idempotente donde es razonable, pensada para correr una vez.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles: 1:1 con auth.users (incluye usuarios anónimos)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_color text,
  created_at   timestamptz not null default now()
);

-- Crea el perfil automáticamente al dar de alta un usuario (anónimo o no).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data->>'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- projects: el contenedor persistente tipo Tricount
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null default 'other',   -- trip | couple | friends | flat | event | other
  currency    text not null default 'EUR',
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

-- ---------------------------------------------------------------------------
-- participants: gente entre la que se reparte (profile_id NULL = sin cuenta)
-- ---------------------------------------------------------------------------
create table if not exists public.participants (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  profile_id   uuid references public.profiles(id) on delete set null,
  display_name text not null,
  color        text,
  created_at   timestamptz not null default now()
);
create index if not exists participants_project_id_idx on public.participants (project_id);
create index if not exists participants_profile_id_idx on public.participants (profile_id);

-- ---------------------------------------------------------------------------
-- Helper (SECURITY DEFINER): ¿el usuario actual es participante del proyecto?
-- Se salta la RLS de participants → evita recursión entre políticas.
-- ---------------------------------------------------------------------------
create or replace function public.is_project_member(pid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.participants
    where project_id = pid and profile_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- RPC atómico: crea el proyecto y añade al creador como participante.
-- Resuelve el bootstrap de RLS (no eres "miembro" hasta insertarte).
-- ---------------------------------------------------------------------------
create or replace function public.create_project(
  p_name         text,
  p_type         text default 'other',
  p_currency     text default 'EUR',
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

  insert into public.projects (name, type, currency, created_by)
  values (p_name, coalesce(p_type, 'other'), coalesce(p_currency, 'EUR'), auth.uid())
  returning * into proj;

  insert into public.participants (project_id, profile_id, display_name)
  values (
    proj.id,
    auth.uid(),
    coalesce(
      nullif(p_display_name, ''),
      (select display_name from public.profiles where id = auth.uid()),
      'Yo'
    )
  );

  return proj;
end;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles     enable row level security;
alter table public.projects     enable row level security;
alter table public.participants enable row level security;

-- profiles: cada quien ve y edita el suyo
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- projects: los miembros ven; el creador inserta/borra; los miembros actualizan
drop policy if exists "projects_select_member" on public.projects;
create policy "projects_select_member" on public.projects
  for select using (public.is_project_member(id) or created_by = auth.uid());

drop policy if exists "projects_insert_creator" on public.projects;
create policy "projects_insert_creator" on public.projects
  for insert with check (created_by = auth.uid());

drop policy if exists "projects_update_member" on public.projects;
create policy "projects_update_member" on public.projects
  for update using (public.is_project_member(id)) with check (public.is_project_member(id));

drop policy if exists "projects_delete_creator" on public.projects;
create policy "projects_delete_creator" on public.projects
  for delete using (created_by = auth.uid());

-- participants: los miembros (o el creador del proyecto, para el primer insert) gestionan
drop policy if exists "participants_select_member" on public.participants;
create policy "participants_select_member" on public.participants
  for select using (
    public.is_project_member(project_id)
    or exists (select 1 from public.projects p where p.id = project_id and p.created_by = auth.uid())
  );

drop policy if exists "participants_insert_member" on public.participants;
create policy "participants_insert_member" on public.participants
  for insert with check (
    public.is_project_member(project_id)
    or exists (select 1 from public.projects p where p.id = project_id and p.created_by = auth.uid())
  );

drop policy if exists "participants_update_member" on public.participants;
create policy "participants_update_member" on public.participants
  for update using (public.is_project_member(project_id));

drop policy if exists "participants_delete_member" on public.participants;
create policy "participants_delete_member" on public.participants
  for delete using (public.is_project_member(project_id));

-- ============================================================================
-- Grants (el rol operativo tras signInAnonymously / login es "authenticated")
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.projects, public.participants to authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.create_project(text, text, text, text) to authenticated;
