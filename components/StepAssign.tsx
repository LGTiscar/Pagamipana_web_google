import React, { useState, useMemo } from 'react';
import { Check, Users, ChevronDown, ChevronUp, Plus, Minus, List, Layers, UserPlus, Link as LinkIcon, CheckCircle, Share } from 'lucide-react';
import { Button } from './Button';
import { SplitItem, Person, Assignment } from '../types';

interface StepAssignProps {
  items: SplitItem[];
  people: Person[];
  assignments: Assignment;
  setAssignments: React.Dispatch<React.SetStateAction<Assignment>>;
  onNext: () => void;
  sessionId: string;
  peerCount: number;
}

export const StepAssign: React.FC<StepAssignProps> = ({ 
  items, 
  people, 
  assignments, 
  setAssignments, 
  onNext,
  sessionId,
  peerCount
}) => {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [detailedMode, setDetailedMode] = useState(false);
  const [expandedSubItem, setExpandedSubItem] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleGroupToggle = (groupId: string) => {
    if (expandedGroup === groupId) {
        setExpandedGroup(null);
    } else {
        setExpandedGroup(groupId);
        setDetailedMode(false); 
        setExpandedSubItem(null);
    }
  };

  const handleInvite = async () => {
    const url = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
    
    // Use native sharing if available (Mobile phones mostly)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'PagaMiPana',
          text: '¡Entra a dividir la cuenta conmigo!',
          url: url,
        });
        // Don't show "Copied" state if share sheet was opened, as feedback is handled by OS
      } catch (err) {
        // Fallback if user cancels or error occurs
        console.log('Share dismissed', err);
      }
    } else {
      // Fallback for Desktop: Copy to clipboard
      navigator.clipboard.writeText(url).then(() => {
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2000);
      });
    }
  };

  const groupedItems = useMemo(() => {
    const groups: Record<string, SplitItem[]> = {};
    items.forEach(item => {
      const key = `${item.description}-${item.price}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.values(groups);
  }, [items]);

  const toggleAssignment = (itemId: string, personId: string) => {
    setAssignments(prev => {
      const currentAssigned = prev[itemId] || [];
      const isAssigned = currentAssigned.includes(personId);
      const newAssigned = isAssigned 
        ? currentAssigned.filter(id => id !== personId)
        : [...currentAssigned, personId];
      return { ...prev, [itemId]: newAssigned };
    });
  };

  const assignToAll = (itemId: string) => {
    setAssignments(prev => {
       const current = prev[itemId] || [];
       if (current.length === people.length) return { ...prev, [itemId]: [] };
       return { ...prev, [itemId]: people.map(p => p.id) };
    });
  };

  // UPDATED: "Winner Takes All" Logic for Quick Assignment
  const toggleGroupBulkAssignment = (groupItems: SplitItem[], personId: string) => {
    setAssignments(prev => {
      const next = { ...prev };
      
      // Check if this person ALREADY owns ALL items in the group exclusively
      // (This allows toggle off behavior)
      const isFullyOwnedByPerson = groupItems.every(item => {
        const assigned = next[item.id] || [];
        return assigned.length === 1 && assigned[0] === personId;
      });
      
      groupItems.forEach(item => {
        if (isFullyOwnedByPerson) {
          // If they have it all, clear it (deselect)
          next[item.id] = [];
        } else {
          // Otherwise, give them EVERYTHING (Exclusive assignment)
          // This removes any other people previously assigned to these items
          next[item.id] = [personId];
        }
      });
      return next;
    });
  };

  const modifyPersonCount = (groupItems: SplitItem[], personId: string, delta: 1 | -1) => {
    setAssignments(prev => {
      const next = { ...prev };
      if (delta === 1) {
        // Find an item in the group that has NO ONE assigned yet
        const availableItem = groupItems.find(item => (next[item.id] || []).length === 0);
        if (availableItem) next[availableItem.id] = [personId];
      } else {
        // Find an item assigned strictly to this person
        const targetItem = groupItems.find(item => {
            const assigned = next[item.id] || [];
            return assigned.length === 1 && assigned[0] === personId;
        }) || groupItems.find(item => (next[item.id] || []).includes(personId)); // Fallback if they are part of a group

        if (targetItem) {
             const current = next[targetItem.id] || [];
             next[targetItem.id] = current.filter(id => id !== personId);
        }
      }
      return next;
    });
  };

  const getPersonUnitCount = (groupItems: SplitItem[], personId: string) => {
    return groupItems.filter(item => (assignments[item.id] || []).includes(personId)).length;
  };

  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();
  const formatPrice = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

  const totalItemsCount = items.length;
  const assignedItemsCount = items.filter(i => (assignments[i.id]?.length || 0) > 0).length;
  const progress = totalItemsCount > 0 ? (assignedItemsCount / totalItemsCount) * 100 : 0;

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full relative">
      {/* Header - Sticky Progress Bar & Invite */}
      <div className="bg-white/90 backdrop-blur-md border-b border-zinc-100 sticky top-0 z-10 pb-4 pt-2 shadow-sm shrink-0">
        <div className="flex justify-between items-center mb-3 px-4">
            <h2 className="text-xl font-bold text-black tracking-tight">Asignar gastos</h2>
            
            <div className="flex items-center gap-2">
               {peerCount > 1 && (
                 <span className="flex items-center text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                    {peerCount} online
                 </span>
               )}
               <button 
                  onClick={handleInvite}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border
                    ${copiedLink ? 'bg-green-100 text-green-700 border-green-200' : 'bg-black text-white border-black active:scale-95 shadow-sm'}
                  `}
               >
                   {copiedLink ? <CheckCircle size={14} /> : <Share size={14} />}
                   {copiedLink ? 'Copiado!' : 'Invitar'}
               </button>
            </div>
        </div>
        <div className="w-full bg-zinc-100 h-1.5">
            <div 
                className="bg-black h-1.5 transition-all duration-500 ease-out" 
                style={{ width: `${progress}%` }}
            ></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-4 px-4 no-scrollbar flex flex-col">
        <div className="space-y-3 flex-1">
            {groupedItems.map((group) => {
                const representative = group[0];
                const quantity = group.length;
                const groupId = representative.id; 
                const isExpanded = expandedGroup === groupId;
                
                const fullyAssignedCount = group.filter(i => (assignments[i.id] || []).length > 0).length;
                const isFullyAssigned = fullyAssignedCount === quantity;
                const isPartiallyAssigned = fullyAssignedCount > 0 && fullyAssignedCount < quantity;
                
                const uniqueAssignedPeopleIds = Array.from(new Set(group.flatMap(i => assignments[i.id] || [])));
                const assignedPeople = people.filter(p => uniqueAssignedPeopleIds.includes(p.id));

                return (
                    <div 
                        key={groupId} 
                        className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm
                            ${isFullyAssigned ? 'border-zinc-300 ring-1 ring-zinc-100' : 'border-zinc-200 hover:border-zinc-300'}
                        `}
                    >
                        {/* Header Row */}
                        <div 
                            className="p-4 cursor-pointer active:bg-zinc-50 flex items-start gap-4"
                            onClick={() => handleGroupToggle(groupId)}
                        >
                            <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center border shrink-0 transition-colors
                                ${isFullyAssigned 
                                    ? 'bg-black border-black text-white' 
                                    : isPartiallyAssigned ? 'bg-zinc-200 border-zinc-300 text-zinc-700' : 'bg-transparent border-zinc-300 text-transparent'}
                            `}>
                                {isFullyAssigned && <Check size={14} strokeWidth={3} />}
                                {!isFullyAssigned && quantity > 1 && fullyAssignedCount > 0 && (
                                    <span className="text-[10px] font-bold">{fullyAssignedCount}</span>
                                )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-2">
                                    <span className={`font-medium text-lg leading-tight break-words ${isFullyAssigned ? 'text-zinc-500 line-through' : 'text-zinc-900'}`}>
                                        {quantity > 1 && <span className="font-bold text-black mr-2 bg-zinc-100 px-1.5 py-0.5 rounded text-sm">{quantity}x</span>}
                                        {representative.description}
                                    </span>
                                    <div className="text-right">
                                        <span className="font-bold text-zinc-900 block">
                                            {formatPrice(representative.price * quantity)}
                                        </span>
                                        {quantity > 1 && (
                                            <span className="text-xs text-zinc-400 font-normal">
                                                {formatPrice(representative.price)}/ud
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex items-center mt-2 flex-wrap gap-1 min-h-[20px]">
                                    {assignedPeople.length > 0 ? (
                                        <div className="flex -space-x-2 overflow-hidden py-1">
                                            {assignedPeople.map(p => (
                                                <div key={p.id} className={`w-6 h-6 rounded-full ring-2 ring-white flex items-center justify-center text-[10px] font-bold ${p.color}`}>
                                                    {getInitials(p.name)}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-xs text-zinc-400">Toca para asignar</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                            <div className="border-t border-zinc-100 bg-zinc-50/50 p-5 animate-fade-in">
                                
                                {quantity > 1 ? (
                                    <div className="space-y-6">
                                        
                                        {/* Toggle Tabs */}
                                        <div className="flex items-center justify-between bg-white p-1 rounded-xl border border-zinc-200 shadow-sm">
                                            <button
                                                onClick={() => setDetailedMode(false)}
                                                className={`flex-1 flex items-center justify-center py-2 text-xs font-semibold rounded-lg transition-all ${!detailedMode ? 'bg-black text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-50'}`}
                                            >
                                                <Layers size={14} className="mr-1.5" />
                                                Individuales
                                            </button>
                                            <button
                                                onClick={() => setDetailedMode(true)}
                                                className={`flex-1 flex items-center justify-center py-2 text-xs font-semibold rounded-lg transition-all ${detailedMode ? 'bg-black text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-50'}`}
                                            >
                                                <List size={14} className="mr-1.5" />
                                                Compartido
                                            </button>
                                        </div>

                                        {!detailedMode ? (
                                            // "Individuales" Mode (Formerly Counters)
                                            <>
                                                <div>
                                                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                                                        Asignación rápida (Todo a uno):
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {people.map(person => {
                                                            // Logic Update for UI: Check if person owns ALL items exclusively
                                                            const isOwner = group.every(i => {
                                                                const assigned = assignments[i.id] || [];
                                                                return assigned.length === 1 && assigned[0] === person.id;
                                                            });

                                                            return (
                                                                <button
                                                                    key={person.id}
                                                                    onClick={() => toggleGroupBulkAssignment(group, person.id)}
                                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-xs font-medium
                                                                        ${isOwner 
                                                                            ? `bg-zinc-900 border-black text-white` 
                                                                            : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400'
                                                                        }`}
                                                                >
                                                                    <div className={`w-2 h-2 rounded-full ${person.color}`} />
                                                                    {person.name}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                                
                                                <div className="h-px bg-zinc-200" />

                                                <div>
                                                    <div className="flex justify-between items-center mb-3">
                                                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                                                            Unidades por persona:
                                                        </p>
                                                        <span className="text-xs text-zinc-500 font-medium bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
                                                            {quantity - fullyAssignedCount} restantes
                                                        </span>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {people.map(person => {
                                                            const count = getPersonUnitCount(group, person.id);
                                                            return (
                                                                <div key={person.id} className="flex items-center justify-between bg-white p-2 rounded-xl border border-zinc-200 shadow-sm">
                                                                    <div className="flex items-center gap-3 pl-1">
                                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${person.color}`}>
                                                                            {getInitials(person.name)}
                                                                        </div>
                                                                        <span className="text-sm font-semibold text-zinc-800">{person.name}</span>
                                                                    </div>
                                                                    
                                                                    <div className="flex items-center gap-3">
                                                                        <button 
                                                                            onClick={() => modifyPersonCount(group, person.id, -1)}
                                                                            disabled={count === 0}
                                                                            className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                                        >
                                                                            <Minus size={14} />
                                                                        </button>
                                                                        <span className={`w-4 text-center font-bold ${count > 0 ? 'text-black' : 'text-zinc-300'}`}>
                                                                            {count}
                                                                        </span>
                                                                        <button 
                                                                            onClick={() => modifyPersonCount(group, person.id, 1)}
                                                                            // FIXED: Strictly disable if all items are assigned, regardless of user's current count
                                                                            disabled={fullyAssignedCount >= quantity}
                                                                            className="w-8 h-8 flex items-center justify-center rounded-full bg-black text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                                        >
                                                                            <Plus size={14} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            // "Compartido" Mode (Formerly Detailed)
                                            <div className="space-y-3">
                                                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                                                     Dividir cada unidad ({quantity}) entre varios:
                                                </p>
                                                {group.map((item, index) => {
                                                    const assignedToItem = (assignments[item.id] || []).map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];
                                                    const isSubExpanded = expandedSubItem === item.id;
                                                    
                                                    return (
                                                        <div key={item.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
                                                            <div 
                                                                className="p-3 flex items-center justify-between cursor-pointer active:bg-zinc-50"
                                                                onClick={() => setExpandedSubItem(isSubExpanded ? null : item.id)}
                                                            >
                                                                <div className="flex items-center gap-3 overflow-hidden">
                                                                    <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold border
                                                                        ${assignedToItem.length > 0 ? 'bg-black text-white border-black' : 'bg-zinc-100 text-zinc-400 border-zinc-200'}`}>
                                                                        #{index + 1}
                                                                    </div>
                                                                    <div className="flex -space-x-1">
                                                                        {assignedToItem.length > 0 ? assignedToItem.map(p => (
                                                                            <div key={p.id} className={`w-5 h-5 rounded-full ring-1 ring-white flex items-center justify-center text-[8px] font-bold ${p.color}`}>
                                                                                {getInitials(p.name)}
                                                                            </div>
                                                                        )) : <span className="text-xs text-zinc-400 ml-1">Sin asignar</span>}
                                                                    </div>
                                                                </div>
                                                                {isSubExpanded ? <ChevronUp size={16} className="text-zinc-400"/> : <ChevronDown size={16} className="text-zinc-400"/>}
                                                            </div>

                                                            {isSubExpanded && (
                                                                <div className="bg-zinc-50 p-3 border-t border-zinc-100 grid grid-cols-4 gap-2">
                                                                    {people.map(person => {
                                                                        const isSelected = (assignments[item.id] || []).includes(person.id);
                                                                        return (
                                                                            <button
                                                                                key={person.id}
                                                                                onClick={(e) => { e.stopPropagation(); toggleAssignment(item.id, person.id); }}
                                                                                className={`
                                                                                    flex flex-col items-center p-2 rounded-lg border transition-all
                                                                                    ${isSelected ? 'bg-white border-black shadow-md ring-1 ring-black/5' : 'bg-transparent border-transparent hover:bg-white hover:border-zinc-200'}
                                                                                `}
                                                                            >
                                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${person.color} ${isSelected ? 'scale-110 shadow-sm' : 'opacity-80'}`}>
                                                                                    {getInitials(person.name)}
                                                                                </div>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    // Single Item
                                    <div>
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Asignar a:</span>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); assignToAll(representative.id); }}
                                                className="text-xs font-bold text-black flex items-center hover:underline"
                                            >
                                                <Users size={12} className="mr-1" />
                                                {uniqueAssignedPeopleIds.length === people.length ? 'Nadie' : 'Todos'}
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                            {people.map(person => {
                                                const isSelected = (assignments[representative.id] || []).includes(person.id);
                                                return (
                                                    <button
                                                        key={person.id}
                                                        onClick={() => toggleAssignment(representative.id, person.id)}
                                                        className={`
                                                            relative flex flex-col items-center p-3 rounded-xl border transition-all
                                                            ${isSelected ? 'bg-zinc-900 border-black shadow-lg transform -translate-y-0.5' : 'bg-white border-zinc-200 hover:bg-zinc-50'}
                                                        `}
                                                    >
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-1 transition-transform ${isSelected ? 'scale-100' : 'opacity-90'} ${person.color}`}>
                                                            {getInitials(person.name)}
                                                            {isSelected && (
                                                                <div className="absolute -top-1 -right-1 bg-white text-black rounded-full p-0.5 border border-zinc-100 shadow-sm">
                                                                    <Check size={10} strokeWidth={4} />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className={`text-xs truncate w-full text-center mt-1 ${isSelected ? 'font-bold text-white' : 'text-zinc-600'}`}>
                                                            {person.name}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>

        {/* Footer inline at the bottom */}
        <div className="py-8 shrink-0 flex flex-col gap-3">
            <div className="flex items-center justify-between px-2">
                 <p className="text-xs font-medium text-zinc-400">
                    {totalItemsCount - assignedItemsCount} pendientes
                </p>
                <div className="h-1 bg-zinc-200 rounded-full w-1/2 overflow-hidden">
                    <div className="h-full bg-black" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
            <Button 
                onClick={onNext}
                className="w-full"
                disabled={progress < 100} 
            >
                Finalizar
            </Button>
        </div>
      </div>
    </div>
  );
};