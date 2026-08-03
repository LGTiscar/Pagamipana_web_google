import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { HomeProjects } from './components/HomeProjects';
import { ProjectDetail } from './components/ProjectDetail';
import { ProjectPeopleStep } from './components/ProjectPeopleStep';
import { LoginScreen } from './components/LoginScreen';
import { JoinScreen } from './components/JoinScreen';
import { QuickSplit } from './components/QuickSplit';
import { useAuth } from './hooks/useAuth';
import { Project } from './types';

// Raíz de la app. Gestiona la sesión (identidad híbrida) y decide qué mostrar:
//  - ?join=xxx → unirse a un proyecto por enlace y abrirlo.
//  - resto     → login / "Mis proyectos" / detalle / reparto rápido.
export default function AppShell() {
  const auth = useAuth();
  const [quickMode, setQuickMode] = useState(false);
  const [openProject, setOpenProject] = useState<Project | null>(null);
  const [peopleStep, setPeopleStep] = useState(false);
  // Persistimos la invitación en sessionStorage: al crear cuenta con Google/Apple/
  // magic-link hay un redirect que borra `?join=…` de la URL; así sobrevive y la
  // unión se completa al volver, sin tener que reabrir el enlace (bug alpha).
  const JOIN_KEY = 'pmp_pending_join';
  const [pendingJoin, setPendingJoin] = useState<string | null>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('join');
    const val = fromUrl ?? sessionStorage.getItem(JOIN_KEY);
    if (val) sessionStorage.setItem(JOIN_KEY, val);
    return val;
  });

  const clearPendingJoin = () => {
    sessionStorage.removeItem(JOIN_KEY);
    setPendingJoin(null);
  };

  const stripJoin = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete('join');
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
  };

  if (auth.loading) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-9 h-9 text-blue-600 animate-spin" />
        <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-3">Cargando…</p>
      </div>
    );
  }

  // Reparto rápido sin cuenta ni proyecto (efímero), accesible desde el login.
  if (quickMode) return <QuickSplit onExit={() => setQuickMode(false)} />;

  // Sin sesión → pantalla de login (Google / email / probar sin cuenta).
  if (!auth.session) return <LoginScreen auth={auth} onQuickSplit={() => setQuickMode(true)} />;

  // Enlace de invitación ?join=<id> → pedir nombre y unirse.
  if (pendingJoin) {
    return (
      <JoinScreen
        projectId={pendingJoin}
        auth={auth}
        onJoined={p => { setOpenProject(p); setPeopleStep(false); clearPendingJoin(); stripJoin(); }}
        onCancel={() => { clearPendingJoin(); stripJoin(); }}
      />
    );
  }

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
    />
  );
}
