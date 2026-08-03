import { supabase } from './supabaseClient';
import { Project, ProjectType, Participant, ProjectOverview } from '../types';

// Lista los proyectos accesibles para el usuario actual (RLS filtra por membresía).
export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Project[];
}

// Resumen para la home: por proyecto, mi saldo neto, nº de gente y avatares.
export async function listProjectsOverview(includeArchived = false): Promise<ProjectOverview[]> {
  const { data, error } = await supabase.rpc('list_projects_overview', { p_include_archived: includeArchived });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    currency: r.currency,
    created_at: r.created_at,
    archived_at: r.archived_at ?? null,
    my_net: Number(r.my_net),
    member_count: Number(r.member_count),
    avatars: r.avatars ?? [],
  })) as ProjectOverview[];
}

// Archiva / desarchiva un proyecto (RLS: solo miembros).
export async function archiveProject(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

// Crea el proyecto y añade al creador como participante (RPC atómico, evita el
// problema de bootstrap de RLS).
export async function createProject(input: {
  name: string;
  type: ProjectType;
  currency?: string;
  displayName?: string;
}): Promise<Project> {
  const { data, error } = await supabase.rpc('create_project', {
    p_name: input.name,
    p_type: input.type,
    p_currency: input.currency ?? 'EUR',
    p_display_name: input.displayName ?? null,
  });
  if (error) throw error;
  return data as Project;
}

// Unirse a un proyecto por enlace (?join=<id>). Añade al usuario como participante.
export async function joinProject(id: string, displayName?: string): Promise<Project> {
  const { data, error } = await supabase.rpc('join_project', {
    p_project_id: id,
    p_display_name: displayName ?? null,
  });
  if (error) throw error;
  return data as Project;
}

// Participantes sin cuenta (reclamables) de un proyecto, para el flujo de unión.
// Vía RPC SECURITY DEFINER porque aún no somos miembros (RLS nos bloquearía).
export async function listJoinableParticipants(
  projectId: string,
): Promise<{ id: string; display_name: string; color: string | null }[]> {
  const { data, error } = await supabase.rpc('list_joinable_participants', { p_project_id: projectId });
  if (error) throw error;
  return (data ?? []) as { id: string; display_name: string; color: string | null }[];
}

// Identificarse como un participante existente sin cuenta (vincula tu profile_id).
export async function claimParticipant(
  projectId: string,
  participantId: string,
  displayName?: string,
): Promise<Project> {
  const { data, error } = await supabase.rpc('claim_participant', {
    p_project_id: projectId,
    p_participant_id: participantId,
    p_display_name: displayName ?? null,
  });
  if (error) throw error;
  return data as Project;
}

// Elimina el proyecto (cascada: participantes, gastos y shares). RLS: solo el creador.
export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

export async function listParticipants(projectId: string): Promise<Participant[]> {
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Participant[];
}

// Añade un participante (por defecto "virtual", sin cuenta asociada).
export async function addParticipant(
  projectId: string,
  displayName: string,
  color?: string,
): Promise<Participant> {
  const { data, error } = await supabase
    .from('participants')
    .insert({ project_id: projectId, display_name: displayName, color: color ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as Participant;
}
