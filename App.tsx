import React, { useState } from 'react';
import { StepUpload } from './components/StepUpload';
import { StepPeople } from './components/StepPeople';
import { StepAssign } from './components/StepAssign';
import { StepResults } from './components/StepResults';
import { parseReceiptImage } from './services/geminiService';
import { AppStep, ReceiptItem, SplitItem, Person, Assignment } from './types';
import { Loader2, AlertCircle, Receipt } from 'lucide-react';

// Utility to flatten receipt items into assignable units
const flattenItems = (items: ReceiptItem[]): SplitItem[] => {
  const flattened: SplitItem[] = [];
  
  items.forEach(item => {
    const unitPrice = item.priceTotal / item.quantity;
    for (let i = 0; i < item.quantity; i++) {
      flattened.push({
        id: `${item.id}_${i}`,
        originalReceiptItemId: item.id,
        description: item.description,
        price: unitPrice,
        indexInGroup: i + 1,
        totalInGroup: item.quantity
      });
    }
  });
  return flattened;
};

export default function App() {
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [rawItems, setRawItems] = useState<ReceiptItem[]>([]);
  const [splitItems, setSplitItems] = useState<SplitItem[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [assignments, setAssignments] = useState<Assignment>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageSelected = async (base64: string) => {
    setReceiptImage(base64);
    setLoading(true);
    setStep(AppStep.PROCESSING);
    setError(null);

    try {
      const items = await parseReceiptImage(base64);
      setRawItems(items);
      setSplitItems(flattenItems(items));
      setStep(AppStep.PEOPLE);
    } catch (err) {
      console.error(err);
      setError("No pudimos leer el ticket. Inténtalo de nuevo con mejor iluminación o fondo oscuro.");
      setStep(AppStep.UPLOAD);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(AppStep.UPLOAD);
    setReceiptImage(null);
    setPeople([]);
    setAssignments({});
    setSplitItems([]);
  };

  return (
    // CHANGED: min-h-screen to h-screen to strictly constrain height
    // This forces children with overflow-y-auto to actually scroll
    <div className="h-screen flex flex-col font-sans overflow-hidden">
      {/* Header / Navbar - Only visible after upload step to avoid duplicate branding */}
      {step !== AppStep.UPLOAD && (
        <header className="px-4 py-4 shrink-0 z-50 animate-fade-in">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="bg-black text-white rounded-xl p-1.5 shadow-lg shadow-black/20">
                  <Receipt size={20} strokeWidth={2} />
              </div>
              <h1 className="text-lg font-bold text-zinc-900 tracking-tight drop-shadow-sm">PagaMiPana</h1>
            </div>
            <button onClick={handleReset} className="text-xs font-semibold text-zinc-500 hover:text-red-600 transition-colors bg-white/50 px-3 py-1.5 rounded-full border border-zinc-200">
               Cancelar
            </button>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      {/* CHANGED: overflow-hidden ensures inner components manage their own scroll */}
      <main className="flex-1 w-full max-w-3xl mx-auto relative overflow-hidden flex flex-col">
        
        {step === AppStep.PROCESSING && (
           <div className="flex flex-col items-center justify-center h-full space-y-6 animate-pulse">
              <div className="relative">
                <div className="absolute inset-0 bg-black blur-xl opacity-20 rounded-full"></div>
                <Loader2 className="w-16 h-16 text-black animate-spin relative z-10" />
              </div>
              <div className="text-center">
                  <p className="text-xl font-bold text-black mb-1">Leyendo ticket...</p>
                  <p className="text-sm text-zinc-500">Nuestra IA está identificando los items</p>
              </div>
           </div>
        )}

        {error && step === AppStep.UPLOAD && (
            <div className="mx-4 mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 shadow-sm z-50 relative mt-4">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{error}</p>
            </div>
        )}

        {step === AppStep.UPLOAD && (
          <StepUpload onImageSelected={handleImageSelected} />
        )}

        {step === AppStep.PEOPLE && (
          <StepPeople 
            people={people} 
            setPeople={setPeople} 
            onNext={() => setStep(AppStep.ASSIGN)} 
          />
        )}

        {step === AppStep.ASSIGN && (
          <StepAssign 
            items={splitItems}
            people={people}
            assignments={assignments}
            setAssignments={setAssignments}
            onNext={() => setStep(AppStep.RESULTS)}
          />
        )}

        {step === AppStep.RESULTS && (
          <StepResults 
            items={splitItems}
            people={people}
            assignments={assignments}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
}