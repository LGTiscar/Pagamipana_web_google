import { supabase } from './supabaseClient';
import { Project, ProjectType, Participant } from '../types';

// Lista los proyectos accesibles para el usuario actual (RLS filtra por membresía).
export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Project[];
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
