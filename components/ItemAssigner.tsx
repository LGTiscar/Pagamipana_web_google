import React, { useState } from 'react';
import { Layers, ChevronUp, RotateCcw, Lock, Pencil } from 'lucide-react';
import {
  SplitLine, unitPrice, isUniform, lineOwners,
  toggleAll, toggleUnit, resetLine, setPrice, totalsByParticipant,
} from '../services/itemSplit';
import { formatMoney } from '../services/format';

interface P { id: string; name: string; color: string | null; }

const initials = (n: string) => n.trim().charAt(0).toUpperCase() || '?';

interface Props {
  people: P[];
  lines: SplitLine[];
  setLines: React.Dispatch<React.SetStateAction<SplitLine[]>>;
  currency: string;
}

// Asignación de un ticket con reparto por línea o por unidades + editar precio.
export const ItemAssigner: React.FC<Props> = ({ people, lines, setLines, currency }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [priceVal, setPriceVal] = useState('');

  const nameOf = (id: string) => people.find(p => p.id === id)?.name ?? '';
  const colorOf = (id: string) => people.find(p => p.id === id)?.color ?? 'bg-zinc-200 text-zinc-700';
  const update = (id: string, fn: (l: SplitLine) => SplitLine) => setLines(prev => prev.map(l => (l.id === id ? fn(l) : l)));

  const startEdit = (l: SplitLine) => { setEditingId(l.id); setPriceVal(l.price.toFixed(2)); };
  const saveEdit = (l: SplitLine) => {
    const v = parseFloat(priceVal.replace(',', '.'));
    if (!isNaN(v) && v >= 0) update(l.id, x => setPrice(x, v));
    setEditingId(null);
  };

  const avatar = (pid: string, name: string, on: boolean, onClick: () => void, offsetDark = 'zinc-900') => (
    <button
      onClick={onClick}
      title={name}
      className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold ${colorOf(pid)} ${on ? `ring-2 ring-blue-600 ring-offset-1 ring-offset-white dark:ring-offset-${offsetDark}` : 'opacity-30'}`}
    >{initials(name)}</button>
  );

  return (
    <div className="space-y-2">
      {lines.map(l => {
        const uniform = isUniform(l);
        const owners = lineOwners(l);
        const open = expanded === l.id;
        const up = unitPrice(l);
        const assignedUnits = l.units.filter(u => u.length > 0).length;
        const shares = totalsByParticipant([l]);
        const editing = editingId === l.id;

        return (
          <div key={l.id} className={`rounded-2xl border p-3 bg-white dark:bg-zinc-900 ${assignedUnits < l.quantity ? 'border-dashed border-red-300 dark:border-red-800' : 'border-zinc-200 dark:border-zinc-800'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
                {l.quantity > 1 && <span className="text-xs font-bold bg-zinc-100 dark:bg-zinc-700 rounded px-1.5 py-0.5 mr-1.5">{l.quantity}×</span>}
                {l.description}
              </span>
              {editing ? (
                <span className="flex items-center gap-1 shrink-0">
                  <input
                    value={priceVal}
                    onChange={e => setPriceVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(l); if (e.key === 'Escape') setEditingId(null); }}
                    onBlur={() => saveEdit(l)}
                    inputMode="decimal"
                    autoFocus
                    className="w-16 text-right px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold text-zinc-900 dark:text-zinc-50"
                  />
                  <span className="text-xs font-bold text-zinc-400">€</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="font-extrabold text-zinc-900 dark:text-zinc-50 tabular-nums">{formatMoney(l.price, currency)}</span>
                  <button onClick={() => startEdit(l)} className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-300" aria-label="Editar precio"><Pencil size={13} /></button>
                </span>
              )}
            </div>
            {l.quantity > 1 && <div className="text-[10px] text-zinc-400 dark:text-zinc-500 text-right mt-0.5">{formatMoney(up, currency)}/ud</div>}

            {/* Colapsado y uniforme → chips que reparten la línea entera */}
            {!open && uniform && (
              <div className="flex gap-2 mt-2.5 flex-wrap">
                {people.map(p => avatar(p.id, p.name, owners.includes(p.id), () => update(l.id, x => toggleAll(x, p.id))))}
                {owners.length > 1 && <span className="text-[11px] text-zinc-400 dark:text-zinc-500 self-center ml-1">{formatMoney(l.price / owners.length, currency)} c/u</span>}
              </div>
            )}

            {/* Colapsado y divergente → resumen bloqueado por unidades */}
            {!open && !uniform && (
              <div className="flex items-center flex-wrap gap-2 mt-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2.5 py-2">
                <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 dark:text-zinc-400"><Lock size={11} /> Por unidades</span>
                {people.filter(p => (shares[p.id] || 0) > 0).map(p => (
                  <span key={p.id} className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full pl-0.5 pr-2 py-0.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${colorOf(p.id)}`}>{initials(nameOf(p.id))}</span>
                    <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-50">{formatMoney(shares[p.id], currency)}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Controles por unidades (solo cantidad > 1) */}
            {l.quantity > 1 && (
              <div className="flex items-center justify-between mt-2.5">
                <button onClick={() => setExpanded(open ? null : l.id)} className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                  {open ? <><ChevronUp size={13} /> Cerrar unidades</> : <><Layers size={13} /> {uniform ? 'Repartir por unidades' : 'Editar por unidades'}</>}
                </button>
                {assignedUnits > 0 && (
                  <button onClick={() => update(l.id, resetLine)} className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500"><RotateCcw size={11} /> Restablecer</button>
                )}
              </div>
            )}

            {/* Editor por unidad */}
            {open && l.quantity > 1 && (
              <div className="mt-2.5 space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-2.5">
                {l.units.map((uOwners, idx) => (
                  <div key={idx} className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Unidad #{idx + 1}</span>
                      <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-50">
                        {uOwners.length ? (uOwners.length === 1 ? formatMoney(up, currency) : `${formatMoney(up / uOwners.length, currency)} c/u`) : <span className="text-zinc-400 dark:text-zinc-500 font-semibold">Sin asignar</span>}
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {people.map(p => avatar(p.id, p.name, uOwners.includes(p.id), () => update(l.id, x => toggleUnit(x, idx, p.id)), 'zinc-800'))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
