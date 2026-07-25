import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ChevronLeft, Loader2, Plus, Trash2, Receipt, Pencil, Scale, Users, Camera, ChevronDown } from 'lucide-react';
import { Participant, Project, Expense, Balance, Settlement, projectEmoji } from '../types';
import { listParticipants, deleteProject } from '../services/projects';
import { listExpenses, getBalances, deleteExpense, computeSettlements, recordSettlement, listExpenseShares, listExpenseItems } from '../services/expenses';
import { SplitLine, linesFromItems, totalsByParticipant, lineShareFor, lineUnitsFor } from '../services/itemSplit';
import { formatMoney } from '../services/format';
import { AddExpenseSheet } from './AddExpenseSheet';
import { ScanExpenseSheet } from './ScanExpenseSheet';
import { InvitePanel } from './InvitePanel';

const num = (s: string) => { const v = parseFloat((s ?? '').replace(',', '.')); return isNaN(v) ? 0 : v; };
const r2 = (n: number) => Math.round(n * 100) / 100;

interface Props {
  project: Project;
  myProfileId?: string;
  onBack: () => void;
}

const initials = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

export const ProjectDetail: React.FC<Props> = ({ project, myProfileId, onBack }) => {
  const [tab, setTab] = useState<'gastos' | 'balances' | 'miembros'>('gastos');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Edición de gastos (prefill cargado de BD)
  const [editManual, setEditManual] = useState<{ expense: Expense; shares: { participant_id: string; amount: number }[] } | null>(null);
  const [editOcr, setEditOcr] = useState<{ expense: Expense; lines: SplitLine[] } | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  // Borrado de gasto (con confirmación)
  const [confirmExpense, setConfirmExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState(false);
  // Reembolso (importe editable, pagos parciales)
  const [settleTarget, setSettleTarget] = useState<{ s: Settlement; idx: number } | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settling, setSettling] = useState(false);
  // Desglose por-ítem de gastos de ticket (desplegable en la lista)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsCache, setItemsCache] = useState<Record<string, SplitLine[]>>({});
  const [loadingItemsId, setLoadingItemsId] = useState<string | null>(null);

  const cur = project.currency;

  const load = useCallback(async () => {
    try {
      const [pa, ex, ba] = await Promise.all([
        listParticipants(project.id),
        listExpenses(project.id),
        getBalances(project.id),
      ]);
      setParticipants(pa);
      setExpenses(ex);
      setBalances(ba);
      setItemsCache({});      // datos frescos: invalida el desglose cacheado
      setExpandedId(null);
    } catch (e: any) {
      setError(e.message ?? 'No se pudo cargar el proyecto.');
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const nameOf = useCallback(
    (pid: string) => participants.find(p => p.id === pid)?.display_name ?? '—',
    [participants],
  );
  const colorOf = useCallback(
    (pid: string) => participants.find(p => p.id === pid)?.color ?? 'bg-zinc-200 text-zinc-700',
    [participants],
  );

  const myParticipant = useMemo(
    () => participants.find(p => p.profile_id && p.profile_id === myProfileId),
    [participants, myProfileId],
  );
  const myNet = balances.find(b => b.participant_id === myParticipant?.id)?.net ?? 0;
  const settlements = useMemo(() => computeSettlements(balances), [balances]);
  const maxAbs = useMemo(() => Math.max(1, ...balances.map(b => Math.abs(b.net))), [balances]);

  // Despliega/pliega el desglose por-ítem de un gasto de ticket (carga perezosa).
  const toggleExpand = async (e: Expense) => {
    if (expandedId === e.id) { setExpandedId(null); return; }
    setExpandedId(e.id);
    if (!itemsCache[e.id]) {
      setLoadingItemsId(e.id);
      try {
        const items = await listExpenseItems(e.id);
        setItemsCache(prev => ({ ...prev, [e.id]: linesFromItems(items) }));
      } catch (err: any) {
        setError(err.message ?? 'No se pudo cargar el detalle del ticket.');
      } finally {
        setLoadingItemsId(null);
      }
    }
  };

  // Abre el gasto en modo edición, cargando sus datos (shares o líneas del ticket).
  const openEdit = async (e: Expense) => {
    setOpeningId(e.id);
    setError(null);
    try {
      if (e.source === 'ocr') {
        const items = await listExpenseItems(e.id);
        setEditOcr({ expense: e, lines: linesFromItems(items) });
      } else {
        const shares = await listExpenseShares(e.id);
        setEditManual({ expense: e, shares });
      }
    } catch (err: any) {
      setError(err.message ?? 'No se pudo abrir el gasto para editar.');
    } finally {
      setOpeningId(null);
    }
  };

  const doDeleteExpense = async () => {
    if (!confirmExpense) return;
    setDeletingExpense(true);
    try {
      await deleteExpense(confirmExpense.id);
      setConfirmExpense(null);
      await load();
    } catch (e: any) {
      setError(e.message ?? 'No se pudo eliminar el gasto.');
    } finally {
      setDeletingExpense(false);
    }
  };

  // Abre el modal de reembolso con el importe sugerido por defecto (editable).
  const openSettle = (s: Settlement, idx: number) => {
    setSettleTarget({ s, idx });
    setSettleAmount(s.amount.toFixed(2));
  };

  const doSettle = async () => {
    if (!settleTarget) return;
    const amount = r2(num(settleAmount));
    if (amount <= 0) { setError('Introduce un importe mayor que 0.'); return; }
    setSettling(true);
    setError(null);
    try {
      await recordSettlement(project.id, settleTarget.s.from, settleTarget.s.to, amount);
      setBalances(await getBalances(project.id));
      setSettleTarget(null);
    } catch (e: any) {
      setError(e.message ?? 'No se pudo registrar el pago.');
    } finally {
      setSettling(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await deleteProject(project.id);
      onBack();
    } catch (e: any) {
      setError(e.message ?? 'No se pudo eliminar el proyecto.');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="h-[100dvh] w-full flex justify-center bg-zinc-100 dark:bg-black">
    <div className="w-full max-w-md h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 shadow-sm relative">
      {/* Header */}
      <header className="px-4 pt-6 pb-3 flex items-center gap-3 shrink-0">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white active:scale-95">
          <ChevronLeft size={20} />
        </button>
        <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center text-lg">{projectEmoji(project.type)}</div>
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 truncate flex-1">{project.name}</h1>
        {!loading && participants.length > 0 && (
          <div className="flex -space-x-2">
            {participants.slice(0, 4).map(p => (
              <span key={p.id} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-zinc-50 dark:ring-zinc-950 ${p.color ?? 'bg-zinc-200 text-zinc-700'}`}>{initials(p.display_name)}</span>
            ))}
          </div>
        )}
      </header>

      {/* Balance band (en Gastos y Balances) */}
      {!loading && tab !== 'miembros' && (
        <div className="mx-4 mb-3 rounded-2xl px-4 py-3 shrink-0 bg-blue-50 dark:bg-blue-950/40">
          {Math.abs(myNet) < 0.01 ? (
            <div className="text-blue-700 dark:text-blue-300 font-bold">Estás en paz 🎉</div>
          ) : myNet > 0 ? (
            <><div className="text-xs font-bold text-blue-700 dark:text-blue-300">En total, te deben</div>
              <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 tabular-nums">+{formatMoney(myNet, cur)}</div></>
          ) : (
            <><div className="text-xs font-bold text-red-500 dark:text-red-400">En total, debes</div>
              <div className="text-2xl font-extrabold text-red-500 dark:text-red-400 tabular-nums">{formatMoney(myNet, cur)}</div></>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-28 no-scrollbar">
        {loading ? (
          <div className="flex justify-center pt-10"><Loader2 className="animate-spin text-zinc-300 dark:text-zinc-600" size={26} /></div>
        ) : error ? (
          <div className="text-center text-red-500 dark:text-red-400 text-sm pt-8">{error}</div>
        ) : tab === 'gastos' ? (
          expenses.length === 0 ? (
            <div className="text-center pt-14 px-6">
              <div className="text-4xl mb-3">🧾</div>
              <p className="font-bold text-zinc-900 dark:text-zinc-50">Aún no hay gastos</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Añade el primero con el botón +.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map(e => {
                const isOcr = e.source === 'ocr';
                const open = expandedId === e.id;
                return (
                <div key={e.id} className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 p-3">
                    <button
                      onClick={isOcr ? () => toggleExpand(e) : undefined}
                      className={`flex items-center gap-3 flex-1 min-w-0 text-left ${isOcr ? '' : 'cursor-default'}`}
                    >
                      <span className="w-9 h-9 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 shrink-0">
                        {isOcr ? <Receipt size={17} /> : <Pencil size={16} />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-bold text-zinc-900 dark:text-zinc-50 text-sm truncate">{e.description}</span>
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 flex items-center gap-1.5">
                          <span className={`text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded ${isOcr ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>
                            {isOcr ? 'Ticket' : 'Manual'}
                          </span>
                          Pagó {nameOf(e.paid_by)}
                        </span>
                      </span>
                    </button>
                    <div className="font-extrabold text-zinc-900 dark:text-zinc-50 tabular-nums">{formatMoney(Number(e.amount_total), cur)}</div>
                    {isOcr && (
                      <button onClick={() => toggleExpand(e)} className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-300 shrink-0" aria-label={open ? 'Ocultar detalle' : 'Ver detalle'}>
                        {loadingItemsId === e.id ? <Loader2 size={15} className="animate-spin" /> : <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />}
                      </button>
                    )}
                    <button onClick={() => openEdit(e)} disabled={openingId === e.id} className="text-zinc-300 dark:text-zinc-600 hover:text-blue-600 dark:hover:text-blue-400 shrink-0 disabled:opacity-50" aria-label="Editar gasto">
                      {openingId === e.id ? <Loader2 size={16} className="animate-spin" /> : <Pencil size={15} />}
                    </button>
                    <button onClick={() => setConfirmExpense(e)} className="text-zinc-300 dark:text-zinc-600 hover:text-red-500 shrink-0" aria-label="Borrar gasto"><Trash2 size={16} /></button>
                  </div>

                  {isOcr && open && itemsCache[e.id] && (
                    <div className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 px-3 py-2.5 space-y-2.5">
                      {(() => {
                        const lines = itemsCache[e.id];
                        const totals = totalsByParticipant(lines);
                        const consumers = participants.filter(p => (totals[p.id] || 0) > 0.005);
                        if (consumers.length === 0) return <div className="text-[11px] text-zinc-400 dark:text-zinc-500">Sin detalle de productos.</div>;
                        return consumers.map(p => {
                          const its = lines
                            .map(l => ({ l, share: lineShareFor(l, p.id), units: lineUnitsFor(l, p.id) }))
                            .filter(x => x.share > 0.005);
                          return (
                            <div key={p.id}>
                              <div className="flex items-center gap-2">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${colorOf(p.id)}`}>{initials(nameOf(p.id))}</span>
                                <span className="flex-1 text-sm font-bold text-zinc-800 dark:text-zinc-100">{nameOf(p.id)}</span>
                                <span className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50 tabular-nums">{formatMoney(totals[p.id], cur)}</span>
                              </div>
                              <div className="pl-8 mt-1 space-y-0.5">
                                {its.map(({ l, share, units }) => (
                                  <div key={l.id} className="flex items-center justify-between text-[12px]">
                                    <span className="text-zinc-500 dark:text-zinc-400 min-w-0 truncate">
                                      {units > 1 && <span className="font-semibold">{units}× </span>}{l.description || 'Producto'}
                                    </span>
                                    <span className="text-zinc-400 dark:text-zinc-500 tabular-nums shrink-0 ml-2">{formatMoney(share, cur)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )
        ) : tab === 'balances' ? (
          <div>
            <div className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">Saldo de cada uno</div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl divide-y divide-zinc-100 dark:divide-zinc-800 mb-5">
              {balances.map(b => {
                const pct = Math.min(50, (Math.abs(b.net) / maxAbs) * 50);
                return (
                  <div key={b.participant_id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${colorOf(b.participant_id)}`}>{initials(b.display_name)}</span>
                      <span className="flex-1 font-semibold text-zinc-900 dark:text-zinc-50">{b.display_name}</span>
                      <span className={`font-extrabold tabular-nums ${b.net > 0.005 ? 'text-blue-700 dark:text-blue-400' : b.net < -0.005 ? 'text-red-500 dark:text-red-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
                        {b.net > 0.005 ? '+' : ''}{formatMoney(b.net, cur)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full mt-2 relative overflow-hidden">
                      {b.net > 0.005 && <div className="absolute top-0 bottom-0 rounded-full bg-blue-500" style={{ left: '50%', width: `${pct}%` }} />}
                      {b.net < -0.005 && <div className="absolute top-0 bottom-0 rounded-full bg-red-400" style={{ right: '50%', width: `${pct}%` }} />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">
              Cómo saldar {settlements.length > 0 && `· ${settlements.length} pago${settlements.length > 1 ? 's' : ''}`}
            </div>
            {settlements.length === 0 ? (
              <div className="text-sm text-zinc-400 dark:text-zinc-500 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-5 text-center">Todo saldado ✓</div>
            ) : (
              <div className="space-y-2">
                {settlements.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-3 py-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${colorOf(s.from)}`}>{initials(nameOf(s.from))}</span>
                    <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex-1 min-w-0 truncate">{nameOf(s.from)} <span className="text-zinc-300 dark:text-zinc-600">→</span> {nameOf(s.to)}</span>
                    <span className="font-extrabold text-zinc-900 dark:text-zinc-50 tabular-nums">{formatMoney(s.amount, cur)}</span>
                    <button
                      onClick={() => openSettle(s, i)}
                      className="ml-1 shrink-0 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded-full px-3 py-1.5 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-950"
                    >Pagar</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ---- Miembros: invitar + gente + eliminar ---- */
          <div>
            <InvitePanel
              project={project}
              participants={participants}
              onAdded={p => { setParticipants(prev => [...prev, p]); getBalances(project.id).then(setBalances).catch(() => {}); }}
            />
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full mt-6 flex items-center justify-center gap-2 text-red-600 dark:text-red-400 font-bold border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 rounded-2xl py-3 hover:bg-red-100 dark:hover:bg-red-950/60 transition-all"
            >
              <Trash2 size={16} /> Eliminar proyecto
            </button>
          </div>
        )}
      </div>

      {/* FAB con menú (solo en Gastos) */}
      {tab === 'gastos' && !loading && (
        <>
          {fabOpen && <div className="absolute inset-0 z-30" onClick={() => setFabOpen(false)} />}
          <div className="absolute right-5 bottom-24 z-40 flex flex-col items-end gap-2.5">
            {fabOpen && (
              <>
                <button onClick={() => { setFabOpen(false); setShowScan(true); }} className="flex items-center gap-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 font-bold text-sm rounded-full pl-4 pr-2 py-2 shadow-lg animate-fade-in">
                  Escanear ticket
                  <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center"><Camera size={16} /></span>
                </button>
                <button onClick={() => { setFabOpen(false); setShowAdd(true); }} className="flex items-center gap-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 font-bold text-sm rounded-full pl-4 pr-2 py-2 shadow-lg animate-fade-in">
                  Gasto manual
                  <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center"><Pencil size={15} /></span>
                </button>
              </>
            )}
            <button
              onClick={() => setFabOpen(v => !v)}
              className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/40 hover:bg-blue-700 active:scale-95 transition-all"
              aria-label="Añadir gasto"
            ><Plus size={28} className={`transition-transform ${fabOpen ? 'rotate-45' : ''}`} /></button>
          </div>
        </>
      )}

      {/* Bottom nav */}
      <nav className="shrink-0 flex bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 px-2 pt-2 pb-5">
        <button onClick={() => setTab('gastos')} className={`flex-1 flex flex-col items-center gap-1 text-[11px] font-bold ${tab === 'gastos' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
          <Receipt size={18} /> Gastos
        </button>
        <button onClick={() => setTab('balances')} className={`flex-1 flex flex-col items-center gap-1 text-[11px] font-bold ${tab === 'balances' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
          <Scale size={18} /> Balances
        </button>
        <button onClick={() => setTab('miembros')} className={`flex-1 flex flex-col items-center gap-1 text-[11px] font-bold ${tab === 'miembros' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
          <Users size={18} /> Miembros
        </button>
      </nav>

      {showAdd && (
        <AddExpenseSheet
          projectId={project.id}
          currency={cur}
          participants={participants}
          defaultPaidBy={myParticipant?.id}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); load(); }}
        />
      )}

      {showScan && (
        <ScanExpenseSheet
          projectId={project.id}
          currency={cur}
          participants={participants}
          defaultPaidBy={myParticipant?.id}
          onClose={() => setShowScan(false)}
          onAdded={() => { setShowScan(false); load(); }}
        />
      )}

      {editManual && (
        <AddExpenseSheet
          projectId={project.id}
          currency={cur}
          participants={participants}
          expense={editManual.expense}
          initialShares={editManual.shares}
          onClose={() => setEditManual(null)}
          onAdded={() => { setEditManual(null); load(); }}
        />
      )}

      {editOcr && (
        <ScanExpenseSheet
          projectId={project.id}
          currency={cur}
          participants={participants}
          expense={editOcr.expense}
          initialLines={editOcr.lines}
          onClose={() => setEditOcr(null)}
          onAdded={() => { setEditOcr(null); load(); }}
        />
      )}

      {confirmExpense && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => !deletingExpense && setConfirmExpense(null)}>
          <div className="w-full sm:max-w-sm bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">¿Eliminar este gasto?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
              «{confirmExpense.description}» · {formatMoney(Number(confirmExpense.amount_total), cur)}. Se recalcularán los balances. No se puede deshacer.
            </p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirmExpense(null)} disabled={deletingExpense} className="flex-1 rounded-full py-3 font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 disabled:opacity-50">Cancelar</button>
              <button onClick={doDeleteExpense} disabled={deletingExpense} className="flex-1 rounded-full py-3 font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">{deletingExpense ? 'Eliminando…' : 'Eliminar'}</button>
            </div>
          </div>
        </div>
      )}

      {settleTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => !settling && setSettleTarget(null)}>
          <div className="w-full sm:max-w-sm bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Registrar pago</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              <b className="text-zinc-900 dark:text-zinc-50">{nameOf(settleTarget.s.from)}</b> paga a <b className="text-zinc-900 dark:text-zinc-50">{nameOf(settleTarget.s.to)}</b>. Puedes abonar todo o solo una parte.
            </p>
            <div className="text-center py-3">
              <input
                value={settleAmount}
                onChange={e => setSettleAmount(e.target.value)}
                inputMode="decimal"
                autoFocus
                className="w-full text-center text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 outline-none bg-transparent"
              />
              <div className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold mt-1">
                Importe ({cur}) · sugerido {formatMoney(settleTarget.s.amount, cur)}
              </div>
            </div>
            <button
              onClick={() => setSettleAmount(settleTarget.s.amount.toFixed(2))}
              className="w-full text-xs font-bold text-blue-600 dark:text-blue-400 mb-4"
            >Saldar todo ({formatMoney(settleTarget.s.amount, cur)})</button>
            <div className="flex gap-3">
              <button onClick={() => setSettleTarget(null)} disabled={settling} className="flex-1 rounded-full py-3 font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 disabled:opacity-50">Cancelar</button>
              <button onClick={doSettle} disabled={settling || num(settleAmount) <= 0} className="flex-1 rounded-full py-3 font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{settling ? 'Guardando…' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => !deleting && setConfirmDelete(false)}>
          <div className="w-full sm:max-w-sm bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">¿Eliminar «{project.name}»?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">Se borrarán todos sus gastos y participantes. Esta acción no se puede deshacer.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirmDelete(false)} disabled={deleting} className="flex-1 rounded-full py-3 font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 disabled:opacity-50">Cancelar</button>
              <button onClick={doDelete} disabled={deleting} className="flex-1 rounded-full py-3 font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">{deleting ? 'Eliminando…' : 'Eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};
