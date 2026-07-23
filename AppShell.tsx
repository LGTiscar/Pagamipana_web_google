import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import App from './App';
import { HomeProjects } from './components/HomeProjects';
import { ProjectDetail } from './components/ProjectDetail';
import { ProjectPeopleStep } from './components/ProjectPeopleStep';
import { LoginScreen } from './components/LoginScreen';
import { JoinScreen } from './components/JoinScreen';
import { useAuth } from './hooks/useAuth';
import { Project } from './types';

// Raíz de la app. Gestiona la sesión (identidad híbrida) y decide qué mostrar:
//  - ?session=xxx → wizard de ticket en vivo (links de invitación existentes).
//  - ?join=xxx    → unirse a un proyecto por enlace y abrirlo.
//  - resto        → login / "Mis proyectos" / detalle / reparto rápido.
export default function AppShell() {
  const auth = useAuth();
  const [view, setView] = useState<'home' | 'quick'>('home');
  const [openProject, setOpenProject] = useState<Project | null>(null);
  const [peopleStep, setPeopleStep] = useState(false);
  const [pendingJoin, setPendingJoin] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('join'),
  );

  const hasLiveSession = useMemo(
    () => new URLSearchParams(window.location.search).has('session'),
    [],
  );

  const stripJoin = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete('join');
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
  };

  if (hasLiveSession) return <App />;

  if (auth.loading) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-zinc-50">
        <Loader2 className="w-9 h-9 text-blue-600 animate-spin" />
        <p className="text-sm text-zinc-400 mt-3">Cargando…</p>
      </div>
    );
  }

  // Sin sesión → pantalla de login (Google / email / probar sin cuenta).
  if (!auth.session) return <LoginScreen auth={auth} />;

  // Enlace de invitación ?join=<id> → pedir nombre y unirse.
  if (pendingJoin) {
    return (
      <JoinScreen
        projectId={pendingJoin}
        auth={auth}
        onJoined={p => { setOpenProject(p); setPeopleStep(false); setPendingJoin(null); stripJoin(); }}
        onCancel={() => { setPendingJoin(null); stripJoin(); }}
      />
    );
  }

  if (view === 'quick') return <App />;

  if (openProject) {
    if (peopleStep) {
      return <ProjectPeopleStep project={openProject} onDone={() => setPeopleStep(false)} />;
    }
    return (
      <ProjectDetail
        project={openProject}
        myProfileId={auth.user?.id}
        onBack={() => setOpenProject(null)}
      />
    );
  }

  return (
    <HomeProjects
      auth={auth}
      onOpenProject={(p, isNew = false) => { setOpenProject(p); setPeopleStep(isNew); }}
      onQuickSplit={() => setView('quick')}
    />
  );
}
