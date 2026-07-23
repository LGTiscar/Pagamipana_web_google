import React, { useMemo, useRef, useState } from 'react';
import { ChevronLeft, Camera, Loader2, Plus, X, RotateCcw, Share2 } from 'lucide-react';
import { AVATAR_COLORS } from '../types';
import { processImageFile } from '../services/imageProcessor';
import { ocrReceipt } from '../services/ocr';
import { formatMoney } from '../services/format';
import { SplitLine, linesFromReceipt, linesTotal, unassignedUnits, allAssigned, totalsByParticipant } from '../services/itemSplit';
import { ItemAssigner } from './ItemAssigner';

interface Person { id: string; name: string; color: string; }

const initials = (n: string) => n.trim().charAt(0).toUpperCase() || '?';
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${performance.now()}`);

// Definido a nivel de módulo (no dentro de QuickSplit) para que NO se remonte en
// cada render; si no, el estado interno de los hijos (ItemAssigner) se reiniciaría.
const QuickShell: React.FC<{ title: string; onBack: () => void; footer?: React.ReactNode; children: React.ReactNode }> = ({ title, onBack, footer, children }) => (
  <div className="h-[100dvh] w-full flex justify-center bg-zinc-100 dark:bg-black">
    <div className="w-full max-w-md h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 shadow-sm">
      <header className="px-4 pt-6 pb-3 flex items-center gap-3 shrink-0">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 active:scale-95"><ChevronLeft size={20} /></button>
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{title}</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-5 pb-4 no-scrollbar">{children}</div>
      {footer && <div className="p-5 pt-2 border-t border-zinc-100 dark:border-zinc-800 shrink-0">{footer}</div>}
    </div>
  </div>
);

// Reparto rápido: escanear un ticket y repartirlo en un solo móvil, sin cuenta
// ni proyecto. Todo en memoria; nada se guarda.
export const QuickSplit: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const [step, setStep] = useState<'people' | 'scan' | 'loading' | 'assign' | 'result'>('people');
  const [people, setPeople] = useState<Person[]>([]);
  const [name, setName] = useState('');
  const [lines, setLines] = useState<SplitLine[]>([]);
  const [payer, setPayer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addPerson = () => {
    if (!name.trim()) return;
    setPeople(prev => [...prev, { id: uid(), name: name.trim(), color: AVATAR_COLORS[prev.length % AVATAR_COLORS.length] }]);
    setName('');
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setStep('loading');
    try {
      const base64 = await processImageFile(file);
      const items = await ocrReceipt(base64);
      setLines(linesFromReceipt(items));
      setStep('assign');
    } catch (err: any) {
      setError(err.message ?? 'No se pudo leer el ticket.');
      setStep('scan');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const unassigned = unassignedUnits(lines);
  const done = allAssigned(lines);
  const total = useMemo(() => linesTotal(lines), [lines]);
  const totals = useMemo(() => totalsByParticipant(lines), [lines]);

  const payerName = people.find(p => p.id === payer)?.name ?? '';
  const debts = people.filter(p => p.id !== payer && (totals[p.id] || 0) > 0.005);

  const share = async () => {
    let text = `🧾 PagaMiPana · Reparto rápido (Total ${formatMoney(total)})\nPagó: ${payerName}\n\n`;
    debts.forEach(p => { text += `${p.name} debe a ${payerName}: ${formatMoney(totals[p.id])}\n`; });
    if (navigator.share) {
      try { await navigator.share({ title: 'PagaMiPana', text }); } catch { /* cancelado */ }
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const goResult = () => { if (!payer) setPayer(people[0]?.id ?? ''); setStep('result'); };

  const btn = 'w-full bg-blue-600 text-white rounded-full py-3.5 font-bold hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] transition-all';

  if (step === 'people') {
    return (
      <QuickShell title="Reparto rápido" onBack={onExit}
        footer={<button onClick={() => setStep('scan')} disabled={people.length < 2} className={btn}>Continuar</button>}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">¿Quién sois? Añade al menos 2 personas. No hace falta cuenta.</p>
        <div className="flex items-center gap-2 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-3 bg-white dark:bg-zinc-900 mb-4 focus-within:ring-2 focus-within:ring-blue-500">
          <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPerson()} placeholder="Nombre" className="flex-1 py-3 bg-transparent outline-none font-medium text-zinc-900 dark:text-zinc-50" autoFocus />
          <button onClick={addPerson} disabled={!name.trim()} className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center disabled:opacity-40"><Plus size={18} /></button>
        </div>
        <div className="space-y-2">
          {people.map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-2.5">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${p.color}`}>{initials(p.name)}</span>
              <span className="flex-1 font-semibold text-zinc-900 dark:text-zinc-50">{p.name}</span>
              <button onClick={() => setPeople(prev => prev.filter(x => x.id !== p.id))} className="text-zinc-300 dark:text-zinc-600 hover:text-red-500"><X size={16} /></button>
            </div>
          ))}
        </div>
      </QuickShell>
    );
  }

  if (step === 'scan' || step === 'loading') {
    return (
      <QuickShell title="Escanear ticket" onBack={() => setStep('people')}>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
        {step === 'loading' ? (
          <div className="py-16 flex flex-col items-center text-center">
            <Loader2 className="animate-spin text-blue-600" size={34} />
            <p className="font-semibold text-zinc-900 dark:text-zinc-50 mt-4">Leyendo el ticket…</p>
          </div>
        ) : (
          <div className="text-center pt-2">
            <div className="rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 py-10 px-4">
              <Camera className="mx-auto text-zinc-400 dark:text-zinc-500" size={36} />
              <p className="font-bold text-zinc-900 dark:text-zinc-50 mt-3">Haz una foto del ticket</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Sacamos los productos automáticamente.</p>
              <button onClick={() => fileRef.current?.click()} className="mt-5 inline-flex items-center gap-2 bg-blue-600 text-white rounded-full px-6 py-3 font-bold hover:bg-blue-700 active:scale-95 transition-all"><Camera size={18} /> Hacer foto / elegir</button>
            </div>
            {error && <p className="text-sm text-red-500 dark:text-red-400 mt-3">{error}</p>}
          </div>
        )}
      </QuickShell>
    );
  }

  if (step === 'assign') {
    return (
      <QuickShell title="Asignad los productos" onBack={() => setStep('scan')}
        footer={
          <div className="flex items-center gap-3">
            <div className="flex-1 text-sm">
              {unassigned > 0 ? <span className="text-red-500 dark:text-red-400 font-semibold">{unassigned} sin asignar</span>
                : <span className="text-zinc-500 dark:text-zinc-400">Total <b className="text-zinc-900 dark:text-zinc-50">{formatMoney(total)}</b></span>}
            </div>
            <button onClick={goResult} disabled={!done} className="bg-blue-600 text-white rounded-full px-6 py-3 font-bold disabled:opacity-50 active:scale-[0.98]">Ver resultado</button>
          </div>
        }>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Toca quién tomó cada cosa</span>
          <button onClick={() => { setLines([]); setStep('scan'); }} className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 flex items-center gap-1"><RotateCcw size={12} /> Otra foto</button>
        </div>
        <ItemAssigner people={people} lines={lines} setLines={setLines} currency="EUR" />
      </QuickShell>
    );
  }

  // result
  return (
    <QuickShell title="Resultado" onBack={() => setStep('assign')}
      footer={
        <div className="space-y-2">
          <button onClick={share} className={`${btn} flex items-center justify-center gap-2`}><Share2 size={18} /> {copied ? 'Copiado' : 'Compartir'}</button>
          <button onClick={onExit} className="w-full text-zinc-500 dark:text-zinc-400 font-semibold py-2 text-sm">Guardar y llevar cuentas → crea una cuenta</button>
        </div>
      }>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 mb-5">
        <div className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Total del ticket</div>
        <div className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-1 tabular-nums">{formatMoney(total)}</div>
        <div className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mt-4 mb-2">Pagó</div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {people.map(p => (
            <button key={p.id} onClick={() => setPayer(p.id)} className={`flex items-center gap-2 px-3 py-2 rounded-full border whitespace-nowrap text-sm font-semibold ${payer === p.id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${p.color}`}>{initials(p.name)}</span>{p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">Quién debe a {payerName}</div>
      {debts.length === 0 ? (
        <div className="text-sm text-zinc-400 dark:text-zinc-500 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-5 text-center">Nadie debe nada 🎉</div>
      ) : (
        <div className="space-y-2">
          {debts.map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${p.color}`}>{initials(p.name)}</span>
              <span className="flex-1 font-semibold text-zinc-900 dark:text-zinc-50">{p.name}</span>
              <span className="font-extrabold text-blue-700 dark:text-blue-400 tabular-nums">{formatMoney(totals[p.id])}</span>
            </div>
          ))}
        </div>
      )}
    </QuickShell>
  );
};
