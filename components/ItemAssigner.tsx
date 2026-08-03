import React, { useState } from 'react';
import { Layers, ChevronUp, RotateCcw, Lock, Pencil, Trash2, Plus, Minus, Check } from 'lucide-react';
import {
  SplitLine, unitPrice, isUniform, lineOwners,
  toggleAll, toggleUnit, resetLine, setPrice, setDescription, setQuantity, newLine, totalsByParticipant,
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

// Asignación de un ticket con reparto por línea o por unidades.
// Además, corrección del OCR: editar nombre/cantidad/precio, borrar y añadir líneas.
export const ItemAssigner: React.FC<Props> = ({ people, lines, setLines, currency }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [priceVal, setPriceVal] = useState('');

  const nameOf = (id: string) => people.find(p => p.id === id)?.name ?? '';
  const colorOf = (id: string) => people.find(p => p.id === id)?.color ?? 'bg-zinc-200 text-zinc-700';
  const update = (id: string, fn: (l: SplitLine) => SplitLine) => setLines(prev => prev.map(l => (l.id === id ? fn(l) : l)));

  const startEdit = (l: SplitLine) => { setEditingId(l.id); setPriceVal(l.price.toFixed(2)); };
  const commitPrice = (l: SplitLine) => {
    const v = parseFloat(priceVal.replace(',', '.'));
    if (!isNaN(v) && v >= 0) update(l.id, x => setPrice(x, v));
  };
  const closeEdit = (l: SplitLine) => { commitPrice(l); setEditingId(null); };
  const removeLine = (id: string) => { setLines(prev => prev.filter(l => l.id !== id)); if (editingId === id) setEditingId(null); };
  const addLine = () => {
    const l = newLine();
    setLines(prev => [...prev, l]);
    setEditingId(l.id);
    setPriceVal('0.00');
  };

  // Chip con avatar + NOMBRE completo (evita confundir iniciales, p. ej. Ana/Andrea).
  const avatar = (pid: string, name: string, on: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      title={name}
      className={`flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 border transition-all ${
        on ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40' : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 opacity-70'
      }`}
    >
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${colorOf(pid)}`}>{initials(name)}</span>
      <span className={`text-xs font-semibold whitespace-nowrap ${on ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-500 dark:text-zinc-400'}`}>{name}</span>
    </button>
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
            {editing ? (
              /* ---- Corregir la línea (nombre · cantidad · precio · borrar) ---- */
              <div className="space-y-3">
                <input
                  value={l.description}
                  onChange={e => update(l.id, x => setDescription(x, e.target.value))}
                  placeholder="Nombre del producto"
                  autoFocus
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm text-zinc-900 dark:text-zinc-50"
                />
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Cantidad</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => update(l.id, x => setQuantity(x, l.quantity - 1))} disabled={l.quantity <= 1} className="w-7 h-7 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 disabled:opacity-30"><Minus size={13} /></button>
                      <span className="w-6 text-center font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">{l.quantity}</span>
                      <button onClick={() => update(l.id, x => setQuantity(x, l.quantity + 1))} className="w-7 h-7 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300"><Plus size={13} /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Total</span>
                    <input
                      value={priceVal}
                      onChange={e => setPriceVal(e.target.value)}
                      onBlur={() => commitPrice(l)}
                      onKeyDown={e => { if (e.key === 'Enter') closeEdit(l); }}
                      inputMode="decimal"
                      className="w-20 text-right px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold text-zinc-900 dark:text-zinc-50"
                    />
                    <span className="text-xs font-bold text-zinc-400">{currency === 'EUR' ? '€' : ''}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <button onClick={() => removeLine(l.id)} className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-bold text-sm border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 rounded-xl px-3 py-2 hover:bg-red-100 dark:hover:bg-red-950/60">
                    <Trash2 size={14} /> Eliminar
                  </button>
                  <button onClick={() => closeEdit(l)} className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white font-bold text-sm rounded-xl px-3 py-2 hover:bg-blue-700">
                    <Check size={15} /> Hecho
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-50 min-w-0">
                    {l.quantity > 1 && <span className="text-xs font-bold bg-zinc-100 dark:bg-zinc-700 rounded px-1.5 py-0.5 mr-1.5">{l.quantity}×</span>}
                    {l.description || <span className="text-zinc-400 dark:text-zinc-500 italic">Sin nombre</span>}
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className="font-extrabold text-zinc-900 dark:text-zinc-50 tabular-nums">{formatMoney(l.price, currency)}</span>
                    <button onClick={() => startEdit(l)} className="text-zinc-300 dark:text-zinc-600 hover:text-blue-600 dark:hover:text-blue-400" aria-label="Corregir producto"><Pencil size={13} /></button>
                  </span>
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
                          {people.map(p => avatar(p.id, p.name, uOwners.includes(p.id), () => update(l.id, x => toggleUnit(x, idx, p.id))))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      <button
        onClick={addLine}
        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 py-3 text-sm font-bold text-zinc-500 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
      >
        <Plus size={16} /> Añadir producto
      </button>
    </div>
  );
};
