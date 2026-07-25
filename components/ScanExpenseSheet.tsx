import React, { useMemo, useRef, useState } from 'react';
import { X, Camera, Loader2, Image as ImageIcon } from 'lucide-react';
import { Participant, Expense } from '../types';
import { processImageFile } from '../services/imageProcessor';
import { ocrReceipt } from '../services/ocr';
import { addOcrExpense, updateOcrExpense } from '../services/expenses';
import { formatMoney } from '../services/format';
import { SplitLine, linesFromReceipt, linesTotal, unassignedUnits, allAssigned as allAssignedFn, sharesFor, itemsFor } from '../services/itemSplit';
import { ItemAssigner } from './ItemAssigner';

interface Props {
  projectId: string;
  currency: string;
  participants: Participant[];
  defaultPaidBy?: string;
  // Modo edición: gasto OCR existente + sus líneas reconstruidas (salta la captura).
  expense?: Expense;
  initialLines?: SplitLine[];
  onClose: () => void;
  onAdded: (e: Expense) => void;
}

const initials = (n: string) => n.trim().charAt(0).toUpperCase() || '?';

export const ScanExpenseSheet: React.FC<Props> = ({
  projectId, currency, participants, defaultPaidBy, expense, initialLines, onClose, onAdded,
}) => {
  const editing = !!expense;
  const [phase, setPhase] = useState<'capture' | 'loading' | 'assign'>(editing ? 'assign' : 'capture');
  const [lines, setLines] = useState<SplitLine[]>(initialLines ?? []);
  const [description, setDescription] = useState(expense?.description ?? 'Ticket');
  const [paidBy, setPaidBy] = useState(expense?.paid_by ?? defaultPaidBy ?? participants[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const people = useMemo(() => participants.map(p => ({ id: p.id, name: p.display_name, color: p.color })), [participants]);
  const total = linesTotal(lines);
  const unassigned = unassignedUnits(lines);
  const done = allAssignedFn(lines);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPhase('loading');
    try {
      const base64 = await processImageFile(file);
      const items = await ocrReceipt(base64);
      setLines(linesFromReceipt(items));
      setPhase('assign');
    } catch (err: any) {
      setError(err.message ?? 'No se pudo leer el ticket.');
      setPhase('capture');
    } finally {
      if (cameraRef.current) cameraRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  const save = async () => {
    if (!done || !paidBy || total <= 0) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        description: description.trim() || 'Ticket', amount: total, paidBy,
        shares: sharesFor(lines), items: itemsFor(lines),
      };
      const e = editing
        ? await updateOcrExpense({ id: expense!.id, ...payload })
        : await addOcrExpense({ projectId, ...payload });
      onAdded(e);
    } catch (err: any) {
      setError(err.message ?? 'No se pudo guardar el gasto.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-sm bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl animate-fade-in max-h-[92dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 pb-2">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{editing ? 'Editar ticket' : 'Escanear ticket'}</h2>
          <button onClick={onClose} className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X size={20} /></button>
        </div>

        {/* Cámara (capture) y galería (sin capture) — en móvil son flujos distintos */}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

        {phase === 'capture' ? (
          <div className="px-5 pb-6 pt-2 text-center">
            <div className="rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 py-10 px-4">
              <Camera className="mx-auto text-zinc-400 dark:text-zinc-500" size={36} />
              <p className="font-bold text-zinc-900 dark:text-zinc-50 mt-3">Foto del ticket</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Sacamos los productos y repartís quién tomó qué.</p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center mt-5">
                <button onClick={() => cameraRef.current?.click()} className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white rounded-full px-5 py-3 font-bold hover:bg-blue-700 active:scale-95 transition-all"><Camera size={18} /> Hacer foto</button>
                <button onClick={() => galleryRef.current?.click()} className="inline-flex items-center justify-center gap-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 rounded-full px-5 py-3 font-bold hover:bg-zinc-50 dark:hover:bg-zinc-700 active:scale-95 transition-all"><ImageIcon size={18} /> Elegir de galería</button>
              </div>
            </div>
            {error && <p className="text-sm text-red-500 dark:text-red-400 mt-3">{error}</p>}
          </div>
        ) : phase === 'loading' ? (
          <div className="px-5 py-16 flex flex-col items-center text-center">
            <Loader2 className="animate-spin text-blue-600" size={34} />
            <p className="font-semibold text-zinc-900 dark:text-zinc-50 mt-4">Leyendo el ticket…</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Un momento, extrayendo los productos.</p>
          </div>
        ) : (
          <>
            <div className="px-5 pb-4 overflow-y-auto no-scrollbar">
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Nombre del gasto"
                className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-transparent outline-none focus:ring-2 focus:ring-blue-500 font-medium text-zinc-900 dark:text-zinc-50"
              />

              <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mt-5 mb-2">Pagado por</div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {participants.map(p => (
                  <button key={p.id} onClick={() => setPaidBy(p.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full border whitespace-nowrap text-sm font-semibold transition-all ${paidBy === p.id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${p.color ?? 'bg-zinc-200 text-zinc-700'}`}>{initials(p.display_name)}</span>
                    {p.display_name}
                  </button>
                ))}
              </div>

              <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mt-5 mb-2">Asignad los productos</div>
              <ItemAssigner people={people} lines={lines} setLines={setLines} currency={currency} />

              {error && <p className="text-sm text-red-500 dark:text-red-400 mt-2">{error}</p>}
            </div>

            <div className="p-5 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
              <div className="flex-1 text-sm">
                {unassigned > 0
                  ? <span className="text-red-500 dark:text-red-400 font-semibold">{unassigned} sin asignar</span>
                  : <span className="text-zinc-500 dark:text-zinc-400">Total <b className="text-zinc-900 dark:text-zinc-50">{formatMoney(total, currency)}</b></span>}
              </div>
              <button onClick={save} disabled={!done || !paidBy || saving} className="bg-blue-600 text-white rounded-full px-6 py-3 font-bold hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-[0.98]">
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
