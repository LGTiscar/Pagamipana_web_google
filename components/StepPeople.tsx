import React, { useState } from 'react';
import { Plus, X, User, Loader2, AlertCircle, Sparkles, CheckCircle } from 'lucide-react';
import { Button } from './Button';
import { Person, AVATAR_COLORS } from '../types';

interface StepPeopleProps {
  people: Person[];
  setPeople: React.Dispatch<React.SetStateAction<Person[]>>;
  onNext: () => void;
  isProcessingReceipt?: boolean;
  receiptError?: string | null;
  receiptThumbnail?: string | null;
}

export const StepPeople: React.FC<StepPeopleProps> = ({ 
  people, 
  setPeople, 
  onNext, 
  isProcessingReceipt, 
  receiptError,
  receiptThumbnail 
}) => {
  const [name, setName] = useState('');

  const addPerson = () => {
    if (!name.trim()) return;
    const newPerson: Person = {
      id: Date.now().toString(),
      name: name.trim(),
      color: AVATAR_COLORS[people.length % AVATAR_COLORS.length],
    };
    setPeople([...people, newPerson]);
    setName('');
  };

  const removePerson = (id: string) => setPeople(people.filter(p => p.id !== id));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addPerson();
  };

  const canContinue = people.length > 0 && !isProcessingReceipt && !receiptError;

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto w-full overflow-hidden">
      {/* Background process status bar - Fixed at top */}
      <div className="px-4 pt-4 shrink-0 z-10">
        {isProcessingReceipt && (
            <div className="p-3 bg-zinc-900 text-white rounded-2xl flex items-center justify-between shadow-xl animate-fade-in">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-lg">
                        <Loader2 size={16} className="animate-spin text-white" />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest">Analizando Ticket</p>
                        <p className="text-[10px] text-zinc-400">La IA está leyendo los precios...</p>
                    </div>
                </div>
                {receiptThumbnail && (
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/20">
                        <img src={receiptThumbnail} alt="Ticket" className="w-full h-full object-cover opacity-50" />
                    </div>
                )}
            </div>
        )}

        {!isProcessingReceipt && !receiptError && receiptThumbnail && (
            <div className="p-3 bg-green-500/90 backdrop-blur-md text-white rounded-2xl flex items-center gap-3 shadow-lg animate-fade-in border border-green-400/30">
                <div className="w-8 h-8 flex items-center justify-center bg-white/20 rounded-lg">
                    <CheckCircle size={18} />
                </div>
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest">¡Ticket Listo!</p>
                    <p className="text-[10px] text-white/80">Ya puedes asignar los gastos</p>
                </div>
            </div>
        )}

        {receiptError && (
            <div className="p-3 bg-red-500 text-white rounded-2xl flex items-center gap-3 shadow-lg animate-fade-in">
                <AlertCircle size={18} />
                <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-widest">Error de lectura</p>
                    <p className="text-[10px] text-white/80">Vuelve atrás e intenta otra foto</p>
                </div>
            </div>
        )}
      </div>

      {/* Main Content: Input and List */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-6 pb-4 shrink-0">
            <h2 className="text-3xl font-bold text-black tracking-tight leading-none">¿Quién participa?</h2>
            <p className="text-zinc-500 mt-2 text-sm">Añade a los panas que comparten la cuenta.</p>
            
            <div className="flex gap-2 mt-6">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nombre..."
                className="flex-1 rounded-2xl bg-white border border-zinc-200 text-black p-4 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-black/5 shadow-sm"
                autoFocus
              />
              <button
                onClick={addPerson}
                disabled={!name.trim()}
                className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center disabled:opacity-30 transition-all active:scale-95 shadow-lg shadow-black/10"
              >
                <Plus size={24} />
              </button>
            </div>
        </div>

        {/* Scrollable List Container */}
        <div className="flex-1 overflow-y-auto px-4 no-scrollbar pb-10">
          <div className="space-y-2">
            {people.map((person) => (
              <div key={person.id} className="flex items-center justify-between p-3 bg-white rounded-2xl shadow-sm border border-zinc-100 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm ${person.color}`}>
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold text-zinc-900">{person.name}</span>
                </div>
                <button onClick={() => removePerson(person.id)} className="p-2 text-zinc-300 hover:text-red-500 transition-colors"><X size={20} /></button>
              </div>
            ))}
            
            {people.length === 0 && (
              <div className="text-center py-10 opacity-30 border-2 border-dashed border-zinc-200 rounded-3xl bg-white/50">
                <User size={40} className="mx-auto mb-2 text-zinc-400" />
                <p className="text-xs font-bold uppercase text-zinc-400">Añade al primer pana</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer: Bottom Button - Non-fixed, integrated in Flex layout */}
      <div className="shrink-0 p-4 bg-white/80 backdrop-blur-xl border-t border-zinc-100 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
          <Button 
            fullWidth 
            onClick={onNext} 
            disabled={!canContinue}
            icon={isProcessingReceipt ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
            className="h-14 text-base shadow-xl shadow-black/10"
          >
            {isProcessingReceipt ? 'Esperando a la IA...' : `Continuar a Reparto (${people.length})`}
          </Button>
          {!isProcessingReceipt && !receiptError && people.length > 0 && (
             <p className="text-center text-[10px] text-zinc-400 mt-2 font-bold uppercase tracking-widest">
                IA Lista • {people.length} panas
             </p>
          )}
      </div>
    </div>
  );
};