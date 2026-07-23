import React, { useState } from 'react';
import { X } from 'lucide-react';
import { PROJECT_TYPES, ProjectType, Project } from '../types';
import { createProject } from '../services/projects';

interface Props {
  onClose: () => void;
  onCreated: (p: Project) => void;
}

export const CreateProjectSheet: React.FC<Props> = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>('trip');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const project = await createProject({ name: name.trim(), type });
      onCreated(project);
    } catch (e: any) {
      setError(e.message ?? 'No se pudo crear el proyecto.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-zinc-900">Nuevo proyecto</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900"><X size={20} /></button>
        </div>

        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Nombre</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Viaje a Lisboa"
          className="w-full mt-2 mb-4 px-4 py-3 rounded-2xl border border-zinc-200 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-zinc-900"
          autoFocus
        />

        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Tipo</label>
        <div className="grid grid-cols-3 gap-2 mt-2 mb-5">
          {PROJECT_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`rounded-2xl py-3 text-sm font-semibold border transition-all ${
                type === t.value
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
              }`}
            >
              <span className="block text-xl mb-1">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <button
          onClick={submit}
          disabled={!name.trim() || saving}
          className="w-full bg-blue-600 text-white rounded-full py-3.5 font-bold hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-[0.98]"
        >
          {saving ? 'Creando…' : 'Crear proyecto'}
        </button>
      </div>
    </div>
  );
};
