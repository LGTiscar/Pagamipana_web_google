import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Check, Users, ChevronDown, ChevronUp, Lock, Layers,
  CheckCircle, Share, Edit2, RotateCcw
} from 'lucide-react';
import { Button } from './Button';
import { SplitItem, Person, Assignment } from '../types';

interface StepAssignProps {
  items: SplitItem[];
  setItems: React.Dispatch<React.SetStateAction<SplitItem[]>>;
  people: Person[];
  assignments: Assignment;
  /** Merge-and-broadcast a partial assignment (delta). Provided by App.tsx. */
  patchAssignments: (delta: Assignment) => void;
  onNext: () => void;
  sessionId: string;
  peerCount: number;
}

const formatPrice = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount || 0);

const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

// Sorted key for an owner list, so two units with the same owners compare equal
// regardless of insertion order.
const ownersKey = (ids: string[]) => [...ids].sort().join(',');

export const StepAssign: React.FC<StepAssignProps> = ({
  items,
  setItems,
  people,
  assignments,
  patchAssignments,
  onNext,
  sessionId,
  peerCount,
}) => {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // ---- Group flattened units by their original receipt line ----
  const groupedItems = useMemo(() => {
    const groups: Record<string, SplitItem[]> = {};
    items.forEach(item => {
      const key = item.originalReceiptItemId;
      (groups[key] ||= []).push(item);
    });
    return Object.values(groups);
  }, [items]);

  const ownersOf = (unitId: string): string[] => assignments[unitId] || [];

  // A group is "uniform" when every unit shares the exact same set of owners.
  // Uniform  -> the simple chip selector is the source of truth (split equally).
  // Divergent -> the simple selector is locked; editing happens per unit.
  const isUniform = (group: SplitItem[]) => {
    const first = ownersKey(ownersOf(group[0].id));
    return group.every(u => ownersKey(ownersOf(u.id)) === first);
  };

  // ---- Mutations (App.tsx broadcasts assignments via MQTT on change) ----

  // Simple selector: add/remove a person across ALL units in the group.
  // Everyone selected shares the whole line equally.
  const toggleSimple = (group: SplitItem[], personId: string) => {
    if (!isUniform(group)) return; // guarded; the UI also disables this while locked
    const has = ownersOf(group[0].id).includes(personId);
    const delta: Assignment = {};
    group.forEach(u => {
      const set = new Set(ownersOf(u.id));
      has ? set.delete(personId) : set.add(personId);
      delta[u.id] = [...set];
    });
    patchAssignments(delta); // one message carrying only the affected unit keys
  };

  // Per-unit selector: toggle a person on a single unit.
  const toggleUnit = (unitId: string, personId: string) => {
    const set = new Set(ownersOf(unitId));
    set.has(personId) ? set.delete(personId) : set.add(personId);
    patchAssignments({ [unitId]: [...set] });
  };

  // Clear every unit in the group -> returns to a clean uniform (empty) state,
  // re-enabling the simple selector.
  const resetGroup = (group: SplitItem[]) => {
    const delta: Assignment = {};
    group.forEach(u => { delta[u.id] = []; });
    patchAssignments(delta);
  };

  // ---- Derived money ----

  // Per-person cost for a single group (sum of unit.price / owners over the units).
  const sharesForGroup = (group: SplitItem[]): Record<string, number> => {
    const totals: Record<string, number> = {};
    group.forEach(u => {
      const owners = ownersOf(u.id);
      if (owners.length) {
        const per = u.price / owners.length;
        owners.forEach(pid => { totals[pid] = (totals[pid] || 0) + per; });
      }
    });
    return totals;
  };

  // Per-person grand totals across the whole bill (mirrors StepResults logic).
  const grandTotals = useMemo(() => {
    const t: Record<string, number> = {};
    people.forEach(p => { t[p.id] = 0; });
    items.forEach(it => {
      const owners = assignments[it.id] || [];
      if (owners.length) {
        const per = it.price / owners.length;
        owners.forEach(pid => { if (t[pid] != null) t[pid] += per; });
      }
    });
    return t;
  }, [items, assignments, people]);

  // ---- Progress (by unit) ----
  const totalUnits = items.length;
  const assignedUnits = items.filter(i => (assignments[i.id]?.length || 0) > 0).length;
  const progress = totalUnits > 0 ? (assignedUnits / totalUnits) * 100 : 0;
  const allAssigned = totalUnits > 0 && assignedUnits === totalUnits;
  const grandAssigned = Object.values(grandTotals).reduce((a, v) => a + v, 0);
  const billTotal = items.reduce((a, it) => a + it.price, 0);

  // ---- Price edit (writes unit price across the group; App syncs items) ----
  const startEditingPrice = (e: React.MouseEvent, groupId: string, currentTotal: number) => {
    e.stopPropagation();
    setEditingGroupId(groupId);
    setEditPriceValue(currentTotal.toFixed(2));
  };
  const saveEditedPrice = () => {
    if (editingGroupId) {
      const newTotal = parseFloat(editPriceValue);
      if (!isNaN(newTotal)) {
        setItems(prev => {
          const qty = prev.filter(i => i.originalReceiptItemId === editingGroupId).length;
          const newUnit = newTotal / Math.max(1, qty);
          return prev.map(item =>
            item.originalReceiptItemId === editingGroupId ? { ...item, price: newUnit } : item
          );
        });
      }
    }
    setEditingGroupId(null);
  };
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEditedPrice();
    if (e.key === 'Escape') setEditingGroupId(null);
  };
  useEffect(() => {
    if (editingGroupId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingGroupId]);

  // ---- Invite ----
  const handleInvite = async () => {
    const url = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'PagaMiPana', text: '¡Entra a dividir la cuenta conmigo!', url });
      } catch { /* dismissed */ }
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      });
    }
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full relative">
      {/* Sticky header */}
      <div className="bg-white/90 backdrop-blur-md border-b border-zinc-100 sticky top-0 z-10 pb-3 pt-2 shadow-sm shrink-0">
        <div className="flex justify-between items-center mb-2 px-4">
          <h2 className="text-xl font-bold text-black tracking-tight">Asignar gastos</h2>
          <div className="flex items-center gap-2">
            {peerCount > 1 && (
              <span className="flex items-center text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                {peerCount} online
              </span>
            )}
            <button
              onClick={handleInvite}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                copiedLink ? 'bg-green-100 text-green-700 border-green-200'
                           : 'bg-black text-white border-black active:scale-95 shadow-sm'
              }`}
            >
              {copiedLink ? <CheckCircle size={14} /> : <Share size={14} />}
              {copiedLink ? 'Copiado!' : 'Invitar'}
            </button>
          </div>
        </div>
        <div className="px-4">
          <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-black h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[11px] text-zinc-400 font-medium mt-1.5">
            Reparte en grupo, o entra a <span className="font-bold text-zinc-500">unidades</span> para dividir cada una.
            Al editar unidades, el selector simple se bloquea.
          </p>
        </div>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto pt-4 px-4 no-scrollbar flex flex-col">
        <div className="space-y-3 flex-1">
          {groupedItems.map(group => {
            const rep = group[0];
            const qty = group.length;
            const groupId = rep.originalReceiptItemId;
            const open = expandedGroup === groupId;
            const editing = editingGroupId === groupId;
            const uniform = isUniform(group);
            const locked = !uniform;
            const simpleOwners = uniform ? ownersOf(group[0].id) : [];

            const assignedInGroup = group.filter(u => ownersOf(u.id).length > 0).length;
            const fully = assignedInGroup === qty;
            const partial = assignedInGroup > 0 && !fully;

            const shares = sharesForGroup(group);
            const groupTotal = group.reduce((a, u) => a + u.price, 0);

            const showChips = !open && uniform;
            const showLock = !open && locked;

            return (
              <div
                key={groupId}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm ${
                  fully ? 'border-zinc-300' : 'border-zinc-200'
                }`}
              >
                {/* Header */}
                <div className="p-4 flex items-start gap-3">
                  <div className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${
                    fully ? 'bg-green-500' : partial ? 'bg-amber-400' : 'bg-zinc-300'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-medium text-base leading-tight break-words text-zinc-900">
                        {qty > 1 && (
                          <span className="font-bold text-black mr-2 bg-zinc-100 px-1.5 py-0.5 rounded text-sm">{qty}×</span>
                        )}
                        {rep.description}
                      </span>
                      <div className="text-right flex flex-col items-end">
                        {editing ? (
                          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
                            <input
                              ref={editInputRef}
                              type="number"
                              value={editPriceValue}
                              onChange={e => setEditPriceValue(e.target.value)}
                              onKeyDown={handleEditKeyDown}
                              onBlur={saveEditedPrice}
                              className="w-16 bg-transparent text-right font-bold text-zinc-900 outline-none p-0"
                              step="0.01"
                            />
                            <span className="text-xs font-bold mr-1">€</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-zinc-900">{formatPrice(groupTotal)}</span>
                            <button
                              onClick={e => startEditingPrice(e, groupId, groupTotal)}
                              className="p-1 rounded-md text-zinc-400 hover:text-black hover:bg-zinc-100 transition-all"
                              title="Editar precio"
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>
                        )}
                        {qty > 1 && (
                          <span className="text-xs text-zinc-400">{formatPrice(rep.price)}/ud</span>
                        )}
                      </div>
                    </div>

                    {/* Simple selector — only when uniform & collapsed */}
                    {showChips && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {people.map(person => {
                          const sel = simpleOwners.includes(person.id);
                          return (
                            <button
                              key={person.id}
                              onClick={() => toggleSimple(group, person.id)}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all text-sm ${
                                sel ? 'bg-black border-black text-white' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400'
                              }`}
                            >
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${person.color}`}>
                                {getInitials(person.name)}
                              </span>
                              <span className="font-semibold">{person.name}</span>
                              {sel && simpleOwners.length > 0 && (
                                <span className="text-xs font-bold">{formatPrice(groupTotal / simpleOwners.length)}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Locked summary — who pays what (when divergent & collapsed) */}
                    {showLock && (
                      <div className="flex items-center flex-wrap gap-2 mt-3 bg-zinc-100 border border-zinc-200 rounded-xl px-2.5 py-2">
                        <span className="flex items-center gap-1 text-[11px] font-bold text-zinc-500 whitespace-nowrap">
                          <Lock size={11} /> Por unidades
                        </span>
                        {people.filter(p => (shares[p.id] || 0) > 0).map(p => (
                          <span key={p.id} className="flex items-center gap-1.5 bg-white border border-zinc-200 rounded-full pl-0.5 pr-2.5 py-0.5">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${p.color}`}>
                              {getInitials(p.name)}
                            </span>
                            <span className="text-xs font-bold text-zinc-900">{formatPrice(shares[p.id])}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Per-unit controls */}
                    {qty > 1 && (
                      <div className="flex items-center justify-between mt-3">
                        <button
                          onClick={() => setExpandedGroup(open ? null : groupId)}
                          className="flex items-center gap-1 text-xs font-bold text-black hover:text-zinc-600"
                        >
                          {open ? <><ChevronUp size={14} /> Cerrar unidades</>
                                : <><Layers size={14} /> {locked ? 'Editar por unidades' : 'Repartir por unidades'}</>}
                        </button>
                        {assignedInGroup > 0 && (
                          <button
                            onClick={() => resetGroup(group)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-zinc-600"
                          >
                            <RotateCcw size={11} /> Restablecer
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Unit editor */}
                {open && qty > 1 && (
                  <div className="border-t border-zinc-100 bg-zinc-50/60 p-3 space-y-2 animate-fade-in">
                    {group.map((unit, idx) => {
                      const owners = ownersOf(unit.id);
                      const ownerPeople = owners.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];
                      return (
                        <div key={unit.id} className="bg-white rounded-xl border border-zinc-200 p-3">
                          <div className="flex items-center justify-between mb-2.5">
                            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Unidad #{idx + 1}</span>
                            {owners.length > 0 ? (
                              <span className="text-xs font-bold text-zinc-900">
                                {ownerPeople.map(p => p.name).join(' + ')}
                                {' · '}
                                {owners.length === 1 ? formatPrice(unit.price) : `${formatPrice(unit.price / owners.length)} c/u`}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-300 font-semibold">Sin asignar</span>
                            )}
                          </div>
                          <div className="flex gap-2.5">
                            {people.map(person => {
                              const sel = owners.includes(person.id);
                              return (
                                <button
                                  key={person.id}
                                  onClick={() => toggleUnit(unit.id, person.id)}
                                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${person.color} ${
                                    sel ? 'ring-2 ring-black ring-offset-1' : 'opacity-30'
                                  }`}
                                >
                                  {getInitials(person.name)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="py-6 shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowBreakdown(v => !v)}
              className="flex items-center gap-1.5 text-xs font-bold text-zinc-500"
            >
              <Users size={14} /> {showBreakdown ? 'Ocultar desglose' : 'Ver desglose por persona'}
              {showBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <span className="text-sm font-bold text-zinc-400">
              <span className="text-black">{formatPrice(grandAssigned)}</span> / {formatPrice(billTotal)}
            </span>
          </div>

          {showBreakdown && (
            <div className="bg-white rounded-2xl border border-zinc-100 divide-y divide-zinc-50 animate-fade-in">
              {people.map(person => (
                <div key={person.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${person.color}`}>
                      {getInitials(person.name)}
                    </span>
                    <span className="text-sm font-semibold text-zinc-800">{person.name}</span>
                  </div>
                  <span className="text-sm font-bold text-zinc-900">{formatPrice(grandTotals[person.id])}</span>
                </div>
              ))}
            </div>
          )}

          <Button onClick={onNext} className="w-full h-14 text-base" disabled={!allAssigned}>
            {allAssigned ? 'Finalizar reparto' : `Asigna todo (${assignedUnits}/${totalUnits})`}
          </Button>
        </div>
      </div>
    </div>
  );
};
