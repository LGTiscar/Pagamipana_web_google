import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Participant, SplitType, SPLIT_TYPES, Expense } from '../types';
import { addExpense } from '../services/expenses';
import { formatMoney } from '../services/format';

interface Props {
  projectId: string;
  currency: string;
  participants: Participant[];
  defaultPaidBy?: string;
  onClose: () => void;
  onAdded: (e: Expense) => void;
}

const initials = (n: string) => n.trim().charAt(0).toUpperCase() || '?';
const num = (s: string) => {
  const v = parseFloat((s ?? '').replace(',', '.'));
  return isNaN(v) ? 0 : v;
};
const r2 = (n: number) => Math.round(n * 100) / 100;

export const AddExpenseSheet: React.FC<Props> = ({
  projectId, currency, participants, defaultPaidBy, onClose, onAdded,
}) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paidBy, setPaidBy] = useState(defaultPaidBy ?? participants[0]?.id ?? '');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [selected, setSelected] = useState<Record<string, boolean>>(
    () => Object.fromEntries(participants.map(p => [p.id, true])),
  );
  const [values, setValues] = useState<Record<string, string>>({}); // exact/percent/shares
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = num(amount);
  const sel = participants.filter(p => selected[p.id]);

  // Reparto resuelto en importes por participante.
  const shares = useMemo(() => {
    if (total <= 0 || sel.length === 0) return [] as { participant_id: string; amount: number }[];

    let out: { participant_id: string; amount: number }[] = [];
    if (splitType === 'equal') {
      const base = Math.floor((total / sel.length) * 100) / 100;
      out = sel.map(p => ({ participant_id: p.id, amount: base }));
      let remainderCents = Math.round((total - base * sel.length) * 100);
      for (let i = 0; i < out.length && remainderCents > 0; i++, remainderCents--) {
        out[i].amount = r2(out[i].amount + 0.01);
      }
      return out;
    }
    if (splitType === 'exact') {
      return sel.map(p => ({ participant_id: p.id, amount: r2(num(values[p.id])) }));
    }
    if (splitType === 'percent') {
      out = sel.map(p => ({ participant_id: p.id, amount: r2(total * num(values[p.id]) / 100) }));
    } else { // shares
      const totalW = sel.reduce((a, p) => a + (num(values[p.id]) || 1), 0) || 1;
      out = sel.map(p => ({ participant_id: p.id, amount: r2(total * (num(values[p.id]) || 1) / totalW) }));
    }
    // Reconciliar redondeo para que sume exactamente el total.
    const sum = out.reduce((a, s) => a + s.amount, 0);
    const diff = r2(total - sum);
    if (out.length) out[0].amount = r2(out[0].amount + diff);
    return out;
  }, [total, splitType, sel, values]);

  const sharesSum = r2(shares.reduce((a, s) => a + s.amount, 0));
  const remaining = r2(total - sharesSum);
  const exactBalanced = splitType !== 'exact' || Math.abs(remaining) < 0.01;
  const canSave = total > 0 && description.trim() !== '' && paidBy && sel.length > 0 && exactBalanced;

  const shareOf = (id: string) => shares.find(s => s.participant_id === id)?.amount ?? 0;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const e = await addExpense({
        projectId, description: description.trim(), amount: total,
        paidBy, splitType, source: 'manual', shares,
      });
      onAdded(e);
    } catch (err: any) {
      setError(err.message ?? 'No se pudo guardar el gasto.');
      setSaving(false);
    }
  };

  const needsInput = splitType !== 'equal';
  const inputSuffix = splitType === 'percent' ? '%' : splitType === 'shares' ? 'x' : currency === 'EUR' ? '€' : '';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl animate-fade-in max-h-[92dvh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-2">
          <h2 className="text-lg font-bold text-zinc-900">Nuevo gasto</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900"><X size={20} /></button>
        </div>

        <div className="px-5 pb-4 overflow-y-auto no-scrollbar">
          {/* Importe */}
          <div className="text-center py-2">
            <input
              value={amount}
              onChange={e => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="w-full text-center text-4xl font-extrabold tracking-tight text-zinc-900 outline-none placeholder:text-zinc-300 bg-transparent"
              autoFocus
            />
            <div className="text-xs text-zinc-400 font-semibold mt-1">Importe ({currency})</div>
          </div>

          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="¿En qué fue? (p.ej. Cena, Taxi…)"
            className="w-full mt-2 px-4 py-3 rounded-2xl border border-zinc-200 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-zinc-900"
          />

          {/* Pagado por */}
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wide mt-5 mb-2">Pagado por</div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {participants.map(p => (
              <button
                key={p.id}
                onClick={() => setPaidBy(p.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-full border whitespace-nowrap text-sm font-semibold transition-all ${
                  paidBy === p.id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-zinc-200 text-zinc-600'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${p.color ?? 'bg-zinc-200 text-zinc-700'}`}>{initials(p.display_name)}</span>
                {p.display_name}
              </button>
            ))}
          </div>

          {/* Reparto */}
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wide mt-5 mb-2">Cómo se reparte</div>
          <div className="flex bg-zinc-100 rounded-2xl p-1 gap-1">
            {SPLIT_TYPES.map(s => (
              <button
                key={s.value}
                onClick={() => setSplitType(s.value)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                  splitType === s.value ? 'bg-white text-blue-700 shadow-sm' : 'text-zinc-500'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="mt-3 border border-zinc-200 rounded-2xl divide-y divide-zinc-100">
            {participants.map(p => {
              const on = !!selected[p.id];
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <button
                    onClick={() => setSelected(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center text-[11px] font-bold shrink-0 ${
                      on ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 text-transparent'
                    }`}
                  >✓</button>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${p.color ?? 'bg-zinc-200 text-zinc-700'}`}>{initials(p.display_name)}</span>
                  <span className="flex-1 font-semibold text-zinc-900 text-sm">{p.display_name}</span>
                  {on && needsInput && (
                    <div className="flex items-center gap-1">
                      <input
                        value={values[p.id] ?? ''}
                        onChange={e => setValues(prev => ({ ...prev, [p.id]: e.target.value }))}
                        inputMode="decimal"
                        placeholder={splitType === 'shares' ? '1' : '0'}
                        className="w-14 text-right px-2 py-1 rounded-lg border border-zinc-200 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold"
                      />
                      <span className="text-xs text-zinc-400 w-3">{inputSuffix}</span>
                    </div>
                  )}
                  {on && (
                    <span className="text-sm font-bold text-zinc-900 w-16 text-right tabular-nums">{formatMoney(shareOf(p.id), currency)}</span>
                  )}
                </div>
              );
            })}
          </div>

          {splitType === 'exact' && total > 0 && Math.abs(remaining) >= 0.01 && (
            <p className={`text-sm mt-2 font-semibold ${remaining > 0 ? 'text-amber-600' : 'text-red-500'}`}>
              {remaining > 0 ? `Faltan ${formatMoney(remaining, currency)}` : `Te pasas ${formatMoney(-remaining, currency)}`}
            </p>
          )}
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        </div>

        <div className="p-5 pt-2 border-t border-zinc-100">
          <button
            onClick={submit}
            disabled={!canSave || saving}
            className="w-full bg-blue-600 text-white rounded-full py-3.5 font-bold hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            {saving ? 'Guardando…' : 'Guardar gasto'}
          </button>
        </div>
      </div>
    </div>
  );
};
