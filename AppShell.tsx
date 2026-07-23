import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import App from './App';
import { HomeProjects } from './components/HomeProjects';
import { ProjectDetail } from './components/ProjectDetail';
import { useAuth } from './hooks/useAuth';
import { Project } from './types';

// Raíz de la app. Gestiona la sesión (identidad híbrida) y decide qué mostrar:
//  - ?session=xxx  → wizard de ticket en vivo (links de invitación existentes).
//  - resto         → "Mis proyectos", con acceso al reparto rápido (wizard) legacy.
export default function AppShell() {
  const auth = useAuth();
  const [view, setView] = useState<'home' | 'quick'>('home');
  const [openProject, setOpenProject] = useState<Project | null>(null);

  // Link de invitación a un reparto en vivo → directo al flujo actual, intacto.
  const hasLiveSession = useMemo(
    () => new URLSearchParams(window.location.search).has('session'),
    [],
  );
  if (hasLiveSession) return <App />;

  if (auth.loading) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-zinc-50">
        <Loader2 className="w-9 h-9 text-blue-600 animate-spin" />
        <p className="text-sm text-zinc-400 mt-3">Cargando…</p>
      </div>
    );
  }

  if (view === 'quick') return <App />;

  if (openProject) {
    return (
      <ProjectDetail
        projectId={openProject.id}
        projectName={openProject.name}
        onBack={() => setOpenProject(null)}
      />
    );
  }

  return (
    <HomeProjects
      auth={auth}
      onOpenProject={setOpenProject}
      onQuickSplit={() => setView('quick')}
    />
  );
}
