import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Loader2, LogOut, MoreVertical, Trash2, Archive, ChevronDown, ChevronRight, DoorOpen } from 'lucide-react';
import { Project, ProjectOverview, projectEmoji } from '../types';
import { listProjectsOverview, deleteProject, archiveProject, leaveProject } from '../services/projects';
import { formatMoney } from '../services/format';
import { UseAuth } from '../hooks/useAuth';
import { CreateProjectSheet } from './CreateProjectSheet';
import { LinkAccountSheet } from './LinkAccountSheet';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  auth: UseAuth;
  onOpenProject: (project: Project, isNew?: boolean) => void;
}

const initials = (n: string) => n.trim().charAt(0).toUpperCase() || '?';

const toProject = (o: ProjectOverview): Project => ({
  id: o.id, name: o.name, type: o.type, currency: o.currency,
  created_at: o.created_at, created_by: o.created_by, archived_at: o.archived_at,
});

export const HomeProjects: React.FC<Props> = ({ auth, onOpenProject }) => {
  const [projects, setProjects] = useState<ProjectOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectOverview | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<ProjectOverview | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await listProjectsOverview(true)); // incluye archivados; separamos en la UI
    } catch (e: any) {
      setError(e.message ?? 'No se pudieron cargar los proyectos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, auth.user?.id]);

  const doDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProject(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      setError(e.message ?? 'No se pudo eliminar el proyecto.');
    } finally {
      setDeleting(false);
    }
  };

  const doArchive = async (o: ProjectOverview, archived: boolean) => {
    setMenuFor(null);
    try { await archiveProject(o.id, archived); await load(); }
    catch (e: any) { setError(e.message ?? 'No se pudo archivar.'); }
  };

  const doLeave = async () => {
    if (!leaveTarget) return;
    setLeaving(true);
    setLeaveError(null);
    try {
      await leaveProject(leaveTarget.id);
      setLeaveTarget(null);
      await load();
    } catch (e: any) {
      setLeaveError(e.message ?? 'No se pudo salir del proyecto.');
    } finally {
      setLeaving(false);
    }
  };

  const active = projects.filter(p => !p.archived_at);
  const archived = projects.filter(p => p.archived_at);
  const isEmpty = active.length === 0 && archived.length === 0;

  const renderCard = (o: ProjectOverview, isArchived: boolean) => {
    const pos = o.my_net > 0.005;
    const neg = o.my_net < -0.005;
    return (
      <div
        key={o.id}
        onClick={() => onOpenProject(toProject(o))}
        className={`relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer ${isArchived ? 'opacity-70' : ''}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 flex items-center justify-center text-xl shrink-0">{projectEmoji(o.type)}</div>
            <div className="min-w-0">
              <div className="font-bold text-zinc-900 dark:text-zinc-50 truncate">{o.name}</div>
              <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{o.member_count} {o.member_count === 1 ? 'persona' : 'personas'}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="text-right">
              <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">{pos ? 'Te deben' : neg ? 'Le debes' : 'En paz'}</div>
              <div className={`text-base font-extrabold tabular-nums ${pos ? 'text-blue-700 dark:text-blue-400' : neg ? 'text-red-500 dark:text-red-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
                {Math.abs(o.my_net) < 0.005 ? '✓' : `${pos ? '+' : ''}${formatMoney(o.my_net, o.currency)}`}
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); setMenuFor(menuFor === o.id ? null : o.id); }}
              className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Opciones del proyecto"
            ><MoreVertical size={18} /></button>
          </div>
        </div>
        {o.avatars.length > 0 && (
          <div className="flex -space-x-2 mt-3">
            {o.avatars.slice(0, 5).map((a, i) => (
              <span key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-white dark:ring-zinc-900 ${a.color ?? 'bg-zinc-200 text-zinc-700'}`}>{initials(a.name)}</span>
            ))}
          </div>
        )}
        {menuFor === o.id && (
          <>
            <div className="fixed inset-0 z-10" onClick={e => { e.stopPropagation(); setMenuFor(null); }} />
            <div className="absolute right-3 top-14 w-52 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-20 overflow-hidden" onClick={e => e.stopPropagation()}>
              <button onClick={() => doArchive(o, !isArchived)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <Archive size={16} /> {isArchived ? 'Desarchivar' : 'Archivar'}
              </button>
              {o.created_by === auth.user?.id ? (
                <button onClick={() => { setMenuFor(null); setDeleteTarget(o); }} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border-t border-zinc-100 dark:border-zinc-800">
                  <Trash2 size={16} /> Eliminar proyecto
                </button>
              ) : (
                <button onClick={() => { setMenuFor(null); setLeaveError(null); setLeaveTarget(o); }} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border-t border-zinc-100 dark:border-zinc-800">
                  <DoorOpen size={16} /> Salir del proyecto
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

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
            <>
              <button
                onClick={() => setShowLink(true)}
                className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold px-3 py-2 rounded-full hover:border-zinc-300"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" /> Vincular cuenta
              </button>
              <button
                onClick={() => setConfirmSignOut(true)}
                title="Cerrar sesión" aria-label="Cerrar sesión"
                className="w-9 h-9 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-red-500 active:scale-95"
              >
                <LogOut size={15} />
              </button>
            </>
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
        ) : isEmpty ? (
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
          <>
            {active.length > 0 ? (
              <div className="space-y-3">{active.map(o => renderCard(o, false))}</div>
            ) : (
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 pt-8">No tienes proyectos activos.</p>
            )}

            {archived.length > 0 && (
              <div className="mt-7">
                <button onClick={() => setShowArchived(v => !v)} className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
                  {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <Archive size={13} /> Archivados ({archived.length})
                </button>
                {showArchived && <div className="space-y-3 mt-3">{archived.map(o => renderCard(o, true))}</div>}
              </div>
            )}
          </>
        )}

      </div>

      {/* FAB — salvo en el estado totalmente vacío (ahí el CTA está centrado) */}
      {!isEmpty && (
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
      {showLink && <LinkAccountSheet auth={auth} preserveData={active.length > 0} onClose={() => setShowLink(false)} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="w-full sm:max-w-sm bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">¿Eliminar «{deleteTarget.name}»?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">Se borrarán todos sus gastos y participantes. Esta acción no se puede deshacer.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 rounded-full py-3 font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 disabled:opacity-50">Cancelar</button>
              <button onClick={doDelete} disabled={deleting} className="flex-1 rounded-full py-3 font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">{deleting ? 'Eliminando…' : 'Eliminar'}</button>
            </div>
          </div>
        </div>
      )}

      {leaveTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => !leaving && setLeaveTarget(null)}>
          <div className="w-full sm:max-w-sm bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">¿Salir de «{leaveTarget.name}»?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">Dejarás de ver este proyecto. Solo puedes salir si no tienes gastos ni saldo pendiente en él.</p>
            {leaveError && <p className="text-sm text-red-500 dark:text-red-400 mt-3">{leaveError}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setLeaveTarget(null)} disabled={leaving} className="flex-1 rounded-full py-3 font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 disabled:opacity-50">Cancelar</button>
              <button onClick={doLeave} disabled={leaving} className="flex-1 rounded-full py-3 font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">{leaving ? 'Saliendo…' : 'Salir'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmSignOut && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setConfirmSignOut(false)}>
          <div className="w-full sm:max-w-sm bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">¿Cerrar sesión?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">Estás como invitado. Perderás el acceso a los proyectos creados, salvo que <b>vincules una cuenta</b> antes.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirmSignOut(false)} className="flex-1 rounded-full py-3 font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200">Cancelar</button>
              <button onClick={async () => { setConfirmSignOut(false); await auth.signOut(); }} className="flex-1 rounded-full py-3 font-bold bg-red-600 text-white hover:bg-red-700">Cerrar sesión</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};
