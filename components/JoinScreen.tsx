import React, { useEffect, useState } from 'react';
import { Loader2, Check, UserPlus } from 'lucide-react';
import { UseAuth } from '../hooks/useAuth';
import { joinProject, listJoinableParticipants, claimParticipant } from '../services/projects';
import { Project } from '../types';

interface Props {
  projectId: string;
  auth: UseAuth;
  onJoined: (p: Project) => void;
  onCancel: () => void;
}

const initials = (n: string) => n.trim().charAt(0).toUpperCase() || '?';
type Joinable = { id: string; display_name: string; color: string | null };

// Al abrir un enlace de invitación: pide el nombre antes de unirse (estilo Tricount).
// Si el proyecto ya tiene gente sin cuenta, permite identificarte como una de ellas
// (reclamar, conservando sus gastos) o unirte como participante nuevo.
export const JoinScreen: React.FC<Props> = ({ projectId, auth, onJoined, onCancel }) => {
  const [joinable, setJoinable] = useState<Joinable[]>([]);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<string | 'new' | null>(null); // id de participante | 'new'
  const [name, setName] = useState(auth.displayName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listJoinableParticipants(projectId)
      .then(list => { if (!active) return; setJoinable(list); setChoice(list.length ? null : 'new'); })
      .catch(() => { if (active) setChoice('new'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId]);

  const selectExisting = (p: Joinable) => { setChoice(p.id); setName(p.display_name); };
  const selectNew = () => { setChoice('new'); setName(auth.displayName ?? ''); };

  const canConfirm = choice === 'new' ? !!name.trim() : !!choice;

  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      if (name.trim()) await auth.saveName(name.trim());
      const p = choice === 'new'
        ? await joinProject(projectId, name.trim())
        : await claimParticipant(projectId, choice as string, name.trim());
      onJoined(p);
    } catch (e: any) {
      setError(e.message ?? 'No se pudo unir al proyecto.');
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const hasPeople = joinable.length > 0;

  return (
    <div className="h-[100dvh] w-full flex justify-center bg-zinc-100 dark:bg-black">
      <div className="w-full max-w-md h-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 shadow-sm px-7">
        <div className="w-full max-w-[340px] text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-3xl shadow-lg shadow-blue-600/40 mx-auto">🎉</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 mt-4">Te han invitado</h1>
          <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mt-2">
            {hasPeople
              ? '¿Ya estabas en el grupo? Elige quién eres, o únete como alguien nuevo.'
              : '¿Cómo te llamas? Así tus panas te reconocen en el grupo.'}
          </p>

          {hasPeople && (
            <div className="mt-5 space-y-2 text-left">
              {joinable.map(p => {
                const on = choice === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => selectExisting(p)}
                    className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
                      on ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50' : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${p.color ?? 'bg-zinc-200 text-zinc-700'}`}>{initials(p.display_name)}</span>
                    <span className="flex-1 font-semibold text-zinc-900 dark:text-zinc-50">Soy {p.display_name}</span>
                    {on && <Check size={18} className="text-blue-600 dark:text-blue-400" />}
                  </button>
                );
              })}
              <button
                onClick={selectNew}
                className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
                  choice === 'new' ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50' : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                }`}
              >
                <span className="w-8 h-8 rounded-full border border-dashed border-blue-400 flex items-center justify-center text-blue-500 shrink-0"><UserPlus size={15} /></span>
                <span className="flex-1 font-semibold text-zinc-900 dark:text-zinc-50 text-left">Me uno como alguien nuevo</span>
                {choice === 'new' && <Check size={18} className="text-blue-600 dark:text-blue-400" />}
              </button>
            </div>
          )}

          {choice !== null && (
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirm()}
              placeholder="Tu nombre"
              className="w-full mt-4 px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-zinc-900 dark:text-zinc-50 text-center"
              autoFocus={!hasPeople}
            />
          )}

          <button
            onClick={confirm}
            disabled={!canConfirm || busy}
            className="w-full mt-3 bg-blue-600 text-white rounded-2xl py-3.5 font-bold hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            {busy ? 'Uniéndote…' : choice && choice !== 'new' ? 'Confirmar' : 'Unirme al proyecto'}
          </button>
          <button onClick={onCancel} className="w-full text-zinc-500 dark:text-zinc-400 font-semibold py-3 mt-1">Ahora no</button>
          {error && <p className="text-sm text-red-500 dark:text-red-400 mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );
};
