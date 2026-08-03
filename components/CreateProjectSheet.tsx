import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { PROJECT_TYPES, ProjectType, Project } from '../types';
import { createProject } from '../services/projects';
import { getCurrencies } from '../services/currencies';

interface Props {
  onClose: () => void;
  onCreated: (p: Project) => void;
  defaultName?: string;
  onSaveName?: (name: string) => Promise<{ error: any }>;
}

export const CreateProjectSheet: React.FC<Props> = ({ onClose, onCreated, defaultName = '', onSaveName }) => {
  const { popular, rest } = useMemo(() => getCurrencies(), []);
  const [yourName, setYourName] = useState(defaultName);
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>('trip');
  const [currency, setCurrency] = useState('EUR');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !yourName.trim()) return;
    // Cierra el teclado antes de navegar al paso de invitar (si no, en móvil se
    // arrastra y tapa el QR y las opciones del nuevo proyecto).
    (document.activeElement as HTMLElement | null)?.blur();
    setSaving(true);
    setError(null);
    try {
      if (onSaveName && yourName.trim() !== defaultName) await onSaveName(yourName.trim());
      const project = await createProject({ name: name.trim(), type, currency, displayName: yourName.trim() });
      onCreated(project);
    } catch (e: any) {
      setError(e.message ?? 'No se pudo crear el proyecto.');
      setSaving(false);
    }
  };

  const inputCls = 'w-full mt-2 mb-4 px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-transparent outline-none focus:ring-2 focus:ring-blue-500 font-medium text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500';
  const labelCls = 'text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Nuevo proyecto</h2>
          <button onClick={onClose} className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X size={20} /></button>
        </div>

        <label className={labelCls}>Tu nombre</label>
        <input value={yourName} onChange={e => setYourName(e.target.value)} placeholder="¿Cómo te llamas?" className={inputCls} />

        <label className={labelCls}>Nombre del proyecto</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Viaje a Lisboa"
          className={inputCls}
        />

        <label className={labelCls}>Tipo</label>
        <div className="grid grid-cols-3 gap-2 mt-2 mb-5">
          {PROJECT_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`rounded-2xl py-3 text-sm font-semibold border transition-all ${
                type === t.value
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600'
              }`}
            >
              <span className="block text-xl mb-1">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>

        <label className={labelCls}>Moneda</label>
        <select
          value={currency}
          onChange={e => setCurrency(e.target.value)}
          className="w-full mt-2 mb-5 px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-zinc-900 dark:text-zinc-50"
        >
          <optgroup label="Comunes">
            {popular.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </optgroup>
          <optgroup label="Todas">
            {rest.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </optgroup>
        </select>

        {error && <p className="text-sm text-red-500 dark:text-red-400 mb-3">{error}</p>}

        <button
          onClick={submit}
          disabled={!name.trim() || !yourName.trim() || saving}
          className="w-full bg-blue-600 text-white rounded-full py-3.5 font-bold hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-[0.98]"
        >
          {saving ? 'Creando…' : 'Crear proyecto'}
        </button>
      </div>
    </div>
  );
};
