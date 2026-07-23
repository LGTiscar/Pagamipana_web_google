import React, { useState } from 'react';
import { UseAuth } from '../hooks/useAuth';
import { joinProject } from '../services/projects';
import { Project } from '../types';

interface Props {
  projectId: string;
  auth: UseAuth;
  onJoined: (p: Project) => void;
  onCancel: () => void;
}

// Al abrir un enlace de invitación: pide el nombre antes de unirse (estilo Tricount).
export const JoinScreen: React.FC<Props> = ({ projectId, auth, onJoined, onCancel }) => {
  const [name, setName] = useState(auth.displayName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await auth.saveName(name.trim());
      const p = await joinProject(projectId, name.trim());
      onJoined(p);
    } catch (e: any) {
      setError(e.message ?? 'No se pudo unir al proyecto.');
      setBusy(false);
    }
  };

  return (
    <div className="h-[100dvh] w-full flex justify-center bg-zinc-100">
      <div className="w-full max-w-md h-full flex flex-col items-center justify-center bg-zinc-50 shadow-sm px-7">
        <div className="w-full max-w-[320px] text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-3xl shadow-lg shadow-blue-600/40 mx-auto">🎉</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 mt-4">Te han invitado</h1>
          <p className="text-zinc-500 leading-relaxed mt-2">¿Cómo te llamas? Así tus panas te reconocen en el grupo.</p>

          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && join()}
            placeholder="Tu nombre"
            className="w-full mt-6 px-4 py-3 rounded-2xl border border-zinc-200 bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium text-zinc-900 text-center"
            autoFocus
          />
          <button
            onClick={join}
            disabled={!name.trim() || busy}
            className="w-full mt-3 bg-blue-600 text-white rounded-2xl py-3.5 font-bold hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            {busy ? 'Uniéndote…' : 'Unirme al proyecto'}
          </button>
          <button onClick={onCancel} className="w-full text-zinc-500 font-semibold py-3 mt-1">Ahora no</button>
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );
};
