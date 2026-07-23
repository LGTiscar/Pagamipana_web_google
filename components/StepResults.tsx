import React, { useState, useEffect } from 'react';
import { RefreshCw, Share2, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { SplitItem, Person, Assignment } from '../types';
import { Logo } from './Logo';

interface StepResultsProps {
  items: SplitItem[];
  people: Person[];
  assignments: Assignment;
  onReset: () => void;
}

export const StepResults: React.FC<StepResultsProps> = ({ 
  items, 
  people, 
  assignments, 
  onReset 
}) => {
  const [payerId, setPayerId] = useState<string>(people[0]?.id || '');

  useEffect(() => {
    if (!payerId && people.length > 0) {
        setPayerId(people[0].id);
    }
  }, [people, payerId]);
  
  const calculateTotals = () => {
    const totals: Record<string, { total: number; items: { desc: string, amount: number }[] }> = {};
    people.forEach(p => { totals[p.id] = { total: 0, items: [] }; });

    items.forEach(item => {
      const assignedIds = assignments[item.id] || [];
      if (assignedIds.length > 0) {
        const costPerPerson = item.price / assignedIds.length;
        assignedIds.forEach(personId => {
          if (totals[personId]) {
            totals[personId].total += costPerPerson;
            totals[personId].items.push({
              desc: item.description + (item.totalInGroup > 1 ? ` (${item.indexInGroup}/${item.totalInGroup})` : ''),
              amount: costPerPerson
            });
          }
        });
      }
    });
    return totals;
  };

  const totals = calculateTotals();
  const grandTotal = Object.values(totals).reduce((acc, curr) => acc + curr.total, 0);

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getPayerName = () => people.find(p => p.id === payerId)?.name || 'Pagador';

  const handleShare = async () => {
    let text = `🧾 PagaMiPana (Total: ${formatPrice(grandTotal)})\n`;
    text += `Pagó: ${getPayerName()}\n\n`;
    
    text += `--- Ajuste de Cuentas ---\n`;
    people.forEach(p => {
        if (p.id === payerId) return;
        const amount = totals[p.id].total;
        if (amount > 0) {
            text += `${p.name} debe a ${getPayerName()}: ${formatPrice(amount)}\n`;
        }
    });

    text += `\n--- Detalle ---\n`;
    people.forEach(p => {
        const t = totals[p.id];
        if (t.total > 0) {
            text += `${p.name}: ${formatPrice(t.total)}\n`;
        }
    });

    if (navigator.share) {
        try {
            await navigator.share({
                title: 'PagaMiPana',
                text: text,
            });
        } catch (err) {
            console.log('Share aborted', err);
        }
    } else {
        await navigator.clipboard.writeText(text);
        alert('Resumen copiado al portapapeles');
    }
  };

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto w-full">
      
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-4 no-scrollbar animate-fade-in flex flex-col">
        
        {/* Payer Card - Minimal */}
        <div className="bg-white border border-zinc-200 p-6 rounded-3xl shadow-sm mb-8 mt-2 shrink-0">
           <div className="flex justify-between items-start mb-6">
               <div>
                  <p className="text-zinc-500 text-sm font-medium uppercase tracking-wide">Total a pagar</p>
                  <h2 className="text-4xl font-extrabold text-black mt-1">{formatPrice(grandTotal)}</h2>
               </div>
               <div className="p-3 bg-zinc-100 rounded-2xl text-black">
                  <Logo size={24} />
               </div>
           </div>
           
           <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 block">
                  Pagado por
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {people.map(person => (
                      <button
                          key={person.id}
                          onClick={() => setPayerId(person.id)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all whitespace-nowrap
                              ${payerId === person.id 
                                  ? 'bg-black border-black text-white shadow-md' 
                                  : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                              }`}
                      >
                          <div className={`w-2 h-2 rounded-full ${person.color}`} />
                          <span className="font-semibold text-sm">{person.name}</span>
                      </button>
                  ))}
              </div>
           </div>
        </div>

        {/* Debts Section */}
        <div className="mb-8 shrink-0">
          <h3 className="text-lg font-bold text-black mb-4 px-1">Ajuste de Cuentas</h3>
          <div className="space-y-3">
              {people.filter(p => p.id !== payerId && totals[p.id].total > 0).map(person => (
                  <div key={person.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-zinc-100 shadow-sm">
                      <div className="flex items-center gap-3">
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${person.color}`}>
                              {person.name.charAt(0)}
                          </div>
                          <span className="text-zinc-900 font-semibold">{person.name}</span>
                      </div>
                      
                      <div className="flex items-center text-zinc-300">
                          <ArrowRight size={20} strokeWidth={1.5} />
                      </div>

                      <div className="flex items-center gap-3">
                           <span className="text-zinc-600 font-medium text-right text-sm">{getPayerName()}</span>
                           <span className="bg-black text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm">
                              {formatPrice(totals[person.id].total)}
                           </span>
                      </div>
                  </div>
              ))}
              
              {people.length > 1 && people.filter(p => p.id !== payerId && totals[p.id].total > 0).length === 0 && (
                  <div className="p-8 text-center text-zinc-400 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                      <p className="font-medium">Cuentas saldadas o pagador único</p>
                  </div>
              )}
          </div>
        </div>

        {/* Breakdown Details */}
        <div className="flex-1">
          <h3 className="text-lg font-bold text-black mb-4 px-1">Desglose Detallado</h3>
          <div className="space-y-4 px-1">
            {people.map(person => {
              const personData = totals[person.id];
              if (personData.total === 0) return null;

              return (
                <div key={person.id} className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                  <div className="p-4 flex items-center justify-between bg-zinc-50/50 border-b border-zinc-100">
                    <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${person.color}`}>
                            {person.name.charAt(0)}
                        </div>
                        <span className="font-bold text-zinc-900">{person.name}</span>
                    </div>
                    <span className="text-zinc-900 font-bold">{formatPrice(personData.total)}</span>
                  </div>
                  
                  <div className="p-4 bg-white">
                    <ul className="space-y-3">
                        {personData.items.map((item, idx) => (
                            <li key={idx} className="flex justify-between text-sm text-zinc-600">
                                <span className="truncate pr-4">{item.desc}</span>
                                <span className="whitespace-nowrap font-medium text-zinc-900">{formatPrice(item.amount)}</span>
                            </li>
                        ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer inline */}
        <div className="py-8 mt-4 flex gap-4 justify-center shrink-0">
            <Button 
                variant="outline"
                onClick={onReset}
                className="flex-1"
                icon={<RefreshCw size={18} />}
            >
                Inicio
            </Button>
            <Button 
                onClick={handleShare}
                className="flex-[2]"
                icon={<Share2 size={18} />}
            >
                Compartir
            </Button>
        </div>

      </div>
    </div>
  );
};