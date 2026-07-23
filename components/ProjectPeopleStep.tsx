import React, { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { Project, Participant, projectEmoji } from '../types';
import { listParticipants } from '../services/projects';
import { InvitePanel } from './InvitePanel';

// Paso posterior a crear un proyecto (mockup 03): invitar y añadir gente.
export const ProjectPeopleStep: React.FC<{ project: Project; onDone: () => void }> = ({ project, onDone }) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setParticipants(await listParticipants(project.id)); }
    finally { setLoading(false); }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="h-[100dvh] w-full flex justify-center bg-zinc-100 dark:bg-black">
      <div className="w-full max-w-md h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 shadow-sm">
        <header className="px-5 pt-7 pb-2 shrink-0 text-center">
          <div className="text-3xl mb-1">{projectEmoji(project.type)}</div>
          <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">Invita a tu gente</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">«{project.name}» está listo. Suma a tus panas.</p>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-4 no-scrollbar">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-zinc-300 dark:text-zinc-600" size={24} /></div>
          ) : (
            <InvitePanel project={project} participants={participants} onAdded={p => setParticipants(prev => [...prev, p])} />
          )}
        </div>

        <div className="p-5 pt-2 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
          <button onClick={onDone} className="w-full bg-blue-600 text-white rounded-full py-3.5 font-bold hover:bg-blue-700 active:scale-[0.98] transition-all">
            Listo, empezar
          </button>
        </div>
      </div>
    </div>
  );
};
