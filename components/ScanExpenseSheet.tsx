import React, { useMemo, useRef, useState } from 'react';
import { X, Camera, Loader2, RotateCcw } from 'lucide-react';
import { Participant, Expense } from '../types';
import { processImageFile } from '../services/imageProcessor';
import { ocrReceipt } from '../services/ocr';
import { addOcrExpense } from '../services/expenses';
import { formatMoney } from '../services/format';

interface Props {
  projectId: string;
  currency: string;
  participants: Participant[];
  defaultPaidBy?: string;
  onClose: () => void;
  onAdded: (e: Expense) => void;
}

interface Line { id: string; description: string; quantity: number; priceTotal: number; owners: string[]; }

const initials = (n: string) => n.trim().charAt(0).toUpperCase() || '?';
const r2 = (n: number) => Math.round(n * 100) / 100;

export const ScanExpenseSheet: React.FC<Props> = ({
  projectId, currency, participants, defaultPaidBy, onClose, onAdded,
}) => {
  const [phase, setPhase] = useState<'capture' | 'loading' | 'assign'>('capture');
  const [lines, setLines] = useState<Line[]>([]);
  const [description, setDescription] = useState('Ticket');
  const [paidBy, setPaidBy] = useState(defaultPaidBy ?? participants[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPhase('loading');
    try {
      const base64 = await processImageFile(file);
      const items = await ocrReceipt(base64);
      setLines(items.map(it => ({ id: it.id, description: it.description, quantity: it.quantity, priceTotal: it.priceTotal, owners: [] })));
      setPhase('assign');
    } catch (err: any) {
      setError(err.message ?? 'No se pudo leer el ticket.');
      setPhase('capture');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggle = (lineId: string, pid: string) => {
    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      const has = l.owners.includes(pid);
      return { ...l, owners: has ? l.owners.filter(o => o !== pid) : [...l.owners, pid] };
    }));
  };

  const amount = useMemo(() => r2(lines.reduce((a, l) => a + l.priceTotal, 0)), [lines]);
  const unassigned = lines.filter(l => l.owners.length === 0).length;
  const allAssigned = lines.length > 0 && unassigned === 0;

  const shares = useMemo(() => {
    const raw: Record<string, number> = {};
    lines.forEach(l => {
      if (l.owners.length) {
        const per = l.priceTotal / l.owners.length;
        l.owners.forEach(o => { raw[o] = (raw[o] || 0) + per; });
      }
    });
    const out = Object.entries(raw).map(([participant_id, amt]) => ({ participant_id, amount: r2(amt) }));
    const sum = r2(out.reduce((a, s) => a + s.amount, 0));
    const diff = r2(amount - sum);
    if (out.length) out[0].amount = r2(out[0].amount + diff);
    return out;
  }, [lines, amount]);

  const save = async () => {
    if (!allAssigned || !paidBy || amount <= 0) return;
    setSaving(true);
    setError(null);
    try {
      const e = await addOcrExpense({
        projectId, description: description.trim() || 'Ticket', amount, paidBy, shares,
        items: lines.map(l => ({
          description: l.description,
          quantity: l.quantity,
          unit_price: r2(l.priceTotal / (l.quantity || 1)),
          owner_ids: l.owners,
        })),
      });
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
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Escanear ticket</h2>
          <button onClick={onClose} className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X size={20} /></button>
        </div>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />

        {phase === 'capture' ? (
          <div className="px-5 pb-6 pt-2 text-center">
            <div className="rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 py-10 px-4">
              <Camera className="mx-auto text-zinc-400 dark:text-zinc-500" size={36} />
              <p className="font-bold text-zinc-900 dark:text-zinc-50 mt-3">Haz una foto del ticket</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Sacamos los productos y repartes quién tomó qué.</p>
              <button
                onClick={() => fileRef.current?.click()}
                className="mt-5 inline-flex items-center gap-2 bg-blue-600 text-white rounded-full px-6 py-3 font-bold hover:bg-blue-700 active:scale-95 transition-all"
              >
                <Camera size={18} /> Hacer foto / elegir
              </button>
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
                  <button
                    key={p.id}
                    onClick={() => setPaidBy(p.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full border whitespace-nowrap text-sm font-semibold transition-all ${
                      paidBy === p.id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${p.color ?? 'bg-zinc-200 text-zinc-700'}`}>{initials(p.display_name)}</span>
                    {p.display_name}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between mt-5 mb-2">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Asignad los productos</span>
                <button onClick={() => { setLines([]); setPhase('capture'); }} className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 flex items-center gap-1"><RotateCcw size={12} /> Otra foto</button>
              </div>

              <div className="space-y-2">
                {lines.map(l => (
                  <div key={l.id} className={`rounded-2xl border p-3 ${l.owners.length === 0 ? 'border-dashed border-red-300 dark:border-red-800' : 'border-zinc-200 dark:border-zinc-700'} bg-white dark:bg-zinc-800/50`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
                        {l.quantity > 1 && <span className="text-xs font-bold bg-zinc-100 dark:bg-zinc-700 rounded px-1.5 py-0.5 mr-1.5">{l.quantity}×</span>}
                        {l.description}
                      </span>
                      <span className="font-extrabold text-zinc-900 dark:text-zinc-50 tabular-nums">{formatMoney(l.priceTotal, currency)}</span>
                    </div>
                    <div className="flex gap-2 mt-2.5 flex-wrap">
                      {participants.map(p => {
                        const on = l.owners.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => toggle(l.id, p.id)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${p.color ?? 'bg-zinc-200 text-zinc-700'} ${on ? 'ring-2 ring-blue-600 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900' : 'opacity-30'}`}
                            title={p.display_name}
                          >{initials(p.display_name)}</button>
                        );
                      })}
                      {l.owners.length > 1 && (
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 self-center ml-1">{formatMoney(l.priceTotal / l.owners.length, currency)} c/u</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {error && <p className="text-sm text-red-500 dark:text-red-400 mt-2">{error}</p>}
            </div>

            <div className="p-5 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
              <div className="flex-1 text-sm">
                {unassigned > 0
                  ? <span className="text-red-500 dark:text-red-400 font-semibold">{unassigned} sin asignar</span>
                  : <span className="text-zinc-500 dark:text-zinc-400">Total <b className="text-zinc-900 dark:text-zinc-50">{formatMoney(amount, currency)}</b></span>}
              </div>
              <button
                onClick={save}
                disabled={!allAssigned || !paidBy || saving}
                className="bg-blue-600 text-white rounded-full px-6 py-3 font-bold hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-[0.98]"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
