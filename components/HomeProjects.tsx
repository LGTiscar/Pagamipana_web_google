import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Loader2, ScanLine, LogOut } from 'lucide-react';
import { Project, ProjectOverview, projectEmoji } from '../types';
import { listProjectsOverview } from '../services/projects';
import { formatMoney } from '../services/format';
import { UseAuth } from '../hooks/useAuth';
import { CreateProjectSheet } from './CreateProjectSheet';
import { LinkAccountSheet } from './LinkAccountSheet';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  auth: UseAuth;
  onOpenProject: (project: Project, isNew?: boolean) => void;
  onQuickSplit: () => void;
}

const initials = (n: string) => n.trim().charAt(0).toUpperCase() || '?';

const toProject = (o: ProjectOverview): Project => ({
  id: o.id, name: o.name, type: o.type, currency: o.currency,
  created_at: o.created_at, created_by: '', archived_at: null,
});

export const HomeProjects: React.FC<Props> = ({ auth, onOpenProject, onQuickSplit }) => {
  const [projects, setProjects] = useState<ProjectOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await listProjectsOverview());
    } catch (e: any) {
      setError(e.message ?? 'No se pudieron cargar los proyectos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, auth.user?.id]);

  return (
    <div className="h-[100dvh] w-full flex justify-center bg-zinc-100 dark:bg-black">
    <div className="w-full max-w-md h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 relative shadow-sm">
      {/* Header */}
      <header className="px-5 pt-6 pb-2 flex items-center justify-between shrink-0">
        <div className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-tight">
          Buenas 👋
          <div className="text-zinc-900 dark:text-zinc-50 font-bold text-base">
            {auth.displayName || (auth.isAnonymous ? 'Invitado' : 'Tú')}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {auth.isAnonymous ? (
            <button
              onClick={() => setShowLink(true)}
              className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold px-3 py-2 rounded-full hover:border-zinc-300"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" /> Vincular cuenta
            </button>
          ) : (
            <div className="relative">
              <button onClick={() => setShowMenu(v => !v)} className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold active:scale-95">
                {(auth.displayName ?? '?').charAt(0).toUpperCase()}
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-20 overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                      <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-semibold">Sesión iniciada</div>
                      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50 truncate">{auth.user?.email ?? auth.displayName ?? 'Cuenta'}</div>
                    </div>
                    <button onClick={async () => { setShowMenu(false); await auth.signOut(); }} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40">
                      <LogOut size={16} /> Cerrar sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <h1 className="px-5 pt-2 pb-4 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 shrink-0">Mis proyectos</h1>

      {auth.authError && (
        <div className="mx-5 mb-3 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 text-sm font-medium shrink-0">
          {auth.authError}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-32 no-scrollbar">
        {loading ? (
          <div className="flex justify-center pt-16"><Loader2 className="animate-spin text-zinc-300 dark:text-zinc-600" size={28} /></div>
        ) : error ? (
          <div className="text-center text-red-500 dark:text-red-400 text-sm pt-10">{error}</div>
        ) : projects.length === 0 ? (
          <div className="text-center pt-16 px-6">
            <div className="text-5xl mb-4">🗂️</div>
            <p className="font-bold text-zinc-900 dark:text-zinc-50 text-lg">Crea tu primer proyecto</p>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Un viaje, el piso, una cena… reúne todos los gastos del grupo en un sitio.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-6 inline-flex items-center gap-2 bg-blue-600 text-white rounded-full px-6 py-3.5 font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/30"
            >
              <Plus size={20} /> Crear proyecto
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map(o => {
              const pos = o.my_net > 0.005;
              const neg = o.my_net < -0.005;
              return (
                <button
                  key={o.id}
                  onClick={() => onOpenProject(toProject(o))}
                  className="w-full text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 flex items-center justify-center text-xl shrink-0">{projectEmoji(o.type)}</div>
                      <div className="min-w-0">
                        <div className="font-bold text-zinc-900 dark:text-zinc-50 truncate">{o.name}</div>
                        <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{o.member_count} {o.member_count === 1 ? 'persona' : 'personas'}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">{pos ? 'Te deben' : neg ? 'Le debes' : 'En paz'}</div>
                      <div className={`text-base font-extrabold tabular-nums ${pos ? 'text-blue-700 dark:text-blue-400' : neg ? 'text-red-500 dark:text-red-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
                        {Math.abs(o.my_net) < 0.005 ? '✓' : `${pos ? '+' : ''}${formatMoney(o.my_net, o.currency)}`}
                      </div>
                    </div>
                  </div>
                  {o.avatars.length > 0 && (
                    <div className="flex -space-x-2 mt-3">
                      {o.avatars.slice(0, 5).map((a, i) => (
                        <span key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-white dark:ring-zinc-900 ${a.color ?? 'bg-zinc-200 text-zinc-700'}`}>{initials(a.name)}</span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Reparto rápido (flujo actual de ticket, sin proyecto) */}
        <button
          onClick={onQuickSplit}
          className="w-full mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 py-3"
        >
          <ScanLine size={16} /> Reparto rápido de un ticket
        </button>
      </div>

      {/* FAB — solo con proyectos ya creados; el primero se crea desde el centro */}
      {projects.length > 0 && (
        <button
          onClick={() => setShowCreate(true)}
          className="absolute right-5 bottom-7 w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/40 hover:bg-blue-700 active:scale-95 transition-all"
          aria-label="Nuevo proyecto"
        >
          <Plus size={28} />
        </button>
      )}

      {showCreate && (
        <CreateProjectSheet
          defaultName={auth.displayName ?? ''}
          onSaveName={auth.saveName}
          onClose={() => setShowCreate(false)}
          onCreated={p => { setShowCreate(false); onOpenProject(p, true); }}
        />
      )}
      {showLink && <LinkAccountSheet auth={auth} preserveData={projects.length > 0} onClose={() => setShowLink(false)} />}
    </div>
    </div>
  );
};
