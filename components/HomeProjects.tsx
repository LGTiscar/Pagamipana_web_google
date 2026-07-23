import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Loader2, ScanLine, ChevronRight } from 'lucide-react';
import { Project, projectEmoji } from '../types';
import { listProjects } from '../services/projects';
import { UseAuth } from '../hooks/useAuth';
import { CreateProjectSheet } from './CreateProjectSheet';
import { LinkAccountSheet } from './LinkAccountSheet';

interface Props {
  auth: UseAuth;
  onOpenProject: (project: Project) => void;
  onQuickSplit: () => void;
}

export const HomeProjects: React.FC<Props> = ({ auth, onOpenProject, onQuickSplit }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showLink, setShowLink] = useState(false);

  const load = useCallback(async () => {
    try {
      setProjects(await listProjects());
    } catch (e: any) {
      setError(e.message ?? 'No se pudieron cargar los proyectos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="h-[100dvh] flex flex-col bg-zinc-50 relative">
      {/* Header */}
      <header className="px-5 pt-6 pb-2 flex items-center justify-between shrink-0">
        <div className="text-sm text-zinc-500 font-medium leading-tight">
          Buenas 👋
          <div className="text-zinc-900 font-bold text-base">
            {auth.isAnonymous ? 'Invitado' : (auth.user?.email ?? 'Tú')}
          </div>
        </div>
        {auth.isAnonymous ? (
          <button
            onClick={() => setShowLink(true)}
            className="flex items-center gap-2 bg-white border border-zinc-200 text-zinc-600 text-xs font-bold px-3 py-2 rounded-full hover:border-zinc-300"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" /> Vincular cuenta
          </button>
        ) : (
          <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
            {(auth.user?.email ?? '?').charAt(0).toUpperCase()}
          </div>
        )}
      </header>

      <h1 className="px-5 pt-2 pb-4 text-3xl font-extrabold tracking-tight text-zinc-900 shrink-0">Mis proyectos</h1>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-32 no-scrollbar">
        {loading ? (
          <div className="flex justify-center pt-16"><Loader2 className="animate-spin text-zinc-300" size={28} /></div>
        ) : error ? (
          <div className="text-center text-red-500 text-sm pt-10">{error}</div>
        ) : projects.length === 0 ? (
          <div className="text-center pt-16 px-6">
            <div className="text-5xl mb-4">🗂️</div>
            <p className="font-bold text-zinc-900 text-lg">Crea tu primer proyecto</p>
            <p className="text-zinc-500 text-sm mt-1">Un viaje, el piso, una cena… reúne todos los gastos del grupo en un sitio.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => onOpenProject(p)}
                className="w-full text-left bg-white border border-zinc-200 rounded-2xl p-4 hover:border-zinc-300 transition-all active:scale-[0.99] flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-xl shrink-0">{projectEmoji(p.type)}</div>
                  <div className="min-w-0">
                    <div className="font-bold text-zinc-900 truncate">{p.name}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">Sin gastos todavía</div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-zinc-300 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Reparto rápido (flujo actual de ticket, sin proyecto) */}
        <button
          onClick={onQuickSplit}
          className="w-full mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-900 py-3"
        >
          <ScanLine size={16} /> Reparto rápido de un ticket
        </button>
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowCreate(true)}
        className="absolute right-5 bottom-7 w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/40 hover:bg-blue-700 active:scale-95 transition-all"
        aria-label="Nuevo proyecto"
      >
        <Plus size={28} />
      </button>

      {showCreate && (
        <CreateProjectSheet
          onClose={() => setShowCreate(false)}
          onCreated={p => { setShowCreate(false); onOpenProject(p); }}
        />
      )}
      {showLink && <LinkAccountSheet auth={auth} onClose={() => setShowLink(false)} />}
    </div>
  );
};
