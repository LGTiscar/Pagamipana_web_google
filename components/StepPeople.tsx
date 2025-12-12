import React, { useState } from 'react';
import { Plus, X, User } from 'lucide-react';
import { Button } from './Button';
import { Person, AVATAR_COLORS } from '../types';

interface StepPeopleProps {
  people: Person[];
  setPeople: React.Dispatch<React.SetStateAction<Person[]>>;
  onNext: () => void;
}

export const StepPeople: React.FC<StepPeopleProps> = ({ people, setPeople, onNext }) => {
  const [name, setName] = useState('');

  const addPerson = () => {
    if (!name.trim()) return;
    const newPerson: Person = {
      id: Date.now().toString(),
      name: name.trim(),
      // Use modulus to cycle through the custom palette
      color: AVATAR_COLORS[people.length % AVATAR_COLORS.length],
    };
    setPeople([...people, newPerson]);
    setName('');
  };

  const removePerson = (id: string) => {
    setPeople(people.filter(p => p.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addPerson();
  };

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto w-full">
      {/* Scrollable container including footer */}
      <div className="flex-1 overflow-y-auto px-4 no-scrollbar flex flex-col">
        <div className="mb-8 mt-2 shrink-0">
            <h2 className="text-3xl font-bold text-black tracking-tight">¿Quiénes participan?</h2>
            <p className="text-zinc-500 mt-1">Añade a los panas que van a compartir gastos.</p>
        </div>
        
        <div className="space-y-4 mb-8 shrink-0">
          <div className="flex gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nombre (ej: Ana)"
              // Updated Styles: Semi-transparent grey background, no border, integrates with gradient
              className="flex-1 block w-full rounded-2xl bg-zinc-200/50 backdrop-blur-md text-zinc-900 shadow-inner sm:text-sm p-4 placeholder-zinc-500 outline-none focus:bg-white/60 focus:ring-2 focus:ring-black/5 transition-all"
              autoFocus
            />
            <button
              onClick={addPerson}
              disabled={!name.trim()}
              className="inline-flex items-center justify-center w-14 rounded-2xl border border-transparent shadow-lg shadow-black/10 text-white bg-black hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={24} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 flex-1">
          {people.map((person) => (
            <div 
              key={person.id} 
              className="flex items-center justify-between p-3 pl-4 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-zinc-100 hover:border-zinc-200 transition-colors animate-fade-in"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm ${person.color}`}>
                  {person.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-semibold text-zinc-900 text-lg">{person.name}</span>
              </div>
              <button 
                onClick={() => removePerson(person.id)}
                className="text-zinc-400 hover:text-red-500 p-3 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          ))}
          
          {people.length === 0 && (
            <div className="text-center py-16 text-zinc-400 border-2 border-dashed border-zinc-300/50 rounded-3xl bg-white/20">
              <User size={48} className="mx-auto mb-4 opacity-30" />
              <p className="font-medium">Lista vacía</p>
            </div>
          )}
        </div>

        {/* Footer inline at the bottom */}
        <div className="mt-8 mb-8 shrink-0">
          <Button 
            fullWidth 
            onClick={onNext} 
            disabled={people.length === 0}
          >
            Continuar ({people.length})
          </Button>
        </div>
      </div>
    </div>
  );
};