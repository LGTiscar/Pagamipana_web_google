import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Share2, UserPlus } from 'lucide-react';
import { Project, Participant, AVATAR_COLORS } from '../types';
import { addParticipant } from '../services/projects';

const initials = (n: string) => n.trim().charAt(0).toUpperCase() || '?';

interface Props {
  project: Project;
  participants: Participant[];
  onAdded: (p: Participant) => void;
}

// Panel de invitación reutilizable (mockup 03): QR + enlace + participantes.
export const InvitePanel: React.FC<Props> = ({ project, participants, onAdded }) => {
  const inviteLink = `${window.location.origin}/?join=${project.id}`;
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: project.name, text: '¡Únete a nuestro proyecto en PagaMiPana!', url: inviteLink });
      } catch { /* cancelado */ }
    } else {
      copy();
    }
  };

  const add = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const color = AVATAR_COLORS[participants.length % AVATAR_COLORS.length];
      const p = await addParticipant(project.id, newName.trim(), color);
      onAdded(p);
      setNewName('');
    } catch (e: any) {
      setError(e.message ?? 'No se pudo añadir.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      {/* Invitar por enlace / QR */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 text-center">
        <div className="inline-flex p-2 bg-white rounded-xl border border-zinc-100">
          <QRCodeSVG value={inviteLink} size={124} bgColor="#ffffff" fgColor="#10131A" />
        </div>
        <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 mt-4">
          <span className="flex-1 text-xs text-zinc-500 font-medium truncate text-left">{inviteLink}</span>
          <button onClick={copy} className="text-blue-600 font-bold text-xs flex items-center gap-1 shrink-0">
            {copied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
          </button>
        </div>
        <button onClick={share} className="w-full mt-3 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-3 font-bold hover:bg-blue-700 active:scale-[0.98] transition-all">
          <Share2 size={17} /> Compartir enlace
        </button>
      </div>

      {/* Participantes */}
      <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide mt-6 mb-2">En el proyecto</div>
      <div className="bg-white border border-zinc-200 rounded-2xl divide-y divide-zinc-100">
        {participants.map(p => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${p.color ?? 'bg-zinc-200 text-zinc-700'}`}>{initials(p.display_name)}</span>
            <span className="flex-1 font-semibold text-zinc-900 text-sm">{p.display_name}</span>
            {!p.profile_id && <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">sin cuenta</span>}
          </div>
        ))}
        <div className="flex items-center gap-2 px-4 py-2.5">
          <span className="w-7 h-7 rounded-full border border-dashed border-blue-400 flex items-center justify-center text-blue-500"><UserPlus size={14} /></span>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Añadir a alguien sin la app"
            className="flex-1 bg-transparent outline-none text-zinc-900 font-medium text-sm placeholder:text-zinc-400"
          />
          {newName.trim() && <button onClick={add} disabled={adding} className="text-blue-600 font-bold text-sm disabled:opacity-50">{adding ? '…' : 'Añadir'}</button>}
        </div>
      </div>
      <p className="text-xs text-zinc-400 mt-2 leading-relaxed">Quien abra el enlace se une solo. Los que añadas a mano se reparten sus gastos aunque no tengan la app.</p>
      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
    </>
  );
};
