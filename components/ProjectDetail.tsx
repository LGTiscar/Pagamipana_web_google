import React, { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, Loader2, UserPlus } from 'lucide-react';
import { Participant, AVATAR_COLORS } from '../types';
import { listParticipants, addParticipant } from '../services/projects';

interface Props {
  projectId: string;
  projectName?: string;
  onBack: () => void;
}

const initials = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

// Fase 1: cascarón navegable del proyecto — participantes + añadir a mano.
// Los gastos y el balance llegan en la Fase 2.
export const ProjectDetail: React.FC<Props> = ({ projectId, projectName, onBack }) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setParticipants(await listParticipants(projectId));
    } catch (e: any) {
      setError(e.message ?? 'No se pudieron cargar los participantes.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const color = AVATAR_COLORS[participants.length % AVATAR_COLORS.length];
      const p = await addParticipant(projectId, newName.trim(), color);
      setParticipants(prev => [...prev, p]);
      setNewName('');
    } catch (e: any) {
      setError(e.message ?? 'No se pudo añadir.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-zinc-50">
      <header className="px-4 pt-6 pb-4 flex items-center gap-3 shrink-0">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-600 hover:text-zinc-900 active:scale-95">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-zinc-900 truncate">{projectName ?? 'Proyecto'}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-10 no-scrollbar">
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-3">Participantes</p>

        {loading ? (
          <div className="flex justify-center pt-8"><Loader2 className="animate-spin text-zinc-300" size={24} /></div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-2xl divide-y divide-zinc-100">
            {participants.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${p.color ?? 'bg-zinc-200 text-zinc-700'}`}>
                  {initials(p.display_name)}
                </span>
                <span className="font-semibold text-zinc-900 flex-1">{p.display_name}</span>
                {!p.profile_id && <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-2 py-1 rounded-full">sin cuenta</span>}
              </div>
            ))}

            <div className="flex items-center gap-2 px-4 py-3">
              <span className="w-8 h-8 rounded-full border border-dashed border-blue-400 flex items-center justify-center text-blue-500"><UserPlus size={15} /></span>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && add()}
                placeholder="Añadir a alguien sin la app"
                className="flex-1 bg-transparent outline-none text-zinc-900 font-medium placeholder:text-zinc-400"
              />
              {newName.trim() && (
                <button onClick={add} disabled={adding} className="text-blue-600 font-bold text-sm disabled:opacity-50">
                  {adding ? '…' : 'Añadir'}
                </button>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

        {/* Placeholder honesto de lo que viene en Fase 2 */}
        <div className="mt-6 border border-dashed border-zinc-200 rounded-2xl p-6 text-center">
          <div className="text-3xl mb-2">🧾</div>
          <p className="font-bold text-zinc-700">Gastos y balances</p>
          <p className="text-sm text-zinc-400 mt-1">Próximamente: añade gastos (manual o por ticket) y mira quién debe a quién.</p>
        </div>
      </div>
    </div>
  );
};
