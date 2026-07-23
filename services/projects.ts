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
export async function listProjectsOverview(): Promise<ProjectOverview[]> {
  const { data, error } = await supabase.rpc('list_projects_overview');
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    currency: r.currency,
    created_at: r.created_at,
    my_net: Number(r.my_net),
    member_count: Number(r.member_count),
    avatars: r.avatars ?? [],
  })) as ProjectOverview[];
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
