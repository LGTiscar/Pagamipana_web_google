import React, { useState, useEffect, useRef } from 'react';
import { StepUpload } from './components/StepUpload';
import { StepPeople } from './components/StepPeople';
import { StepAssign } from './components/StepAssign';
import { StepResults } from './components/StepResults';
import { parseReceiptImage } from './services/geminiService';
import { AppStep, ReceiptItem, SplitItem, Person, Assignment, SyncPayload } from './types';
import { Loader2, AlertCircle, Receipt } from 'lucide-react';
import { joinRoom } from 'trystero';

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

  // Sync State
  const [sessionId, setSessionId] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [peerCount, setPeerCount] = useState(1); // Self is 1
  const isRemoteUpdate = useRef(false);
  
  // Refs to hold current state for P2P callbacks to avoid stale closures
  const stateRef = useRef({
    step,
    splitItems,
    people,
    assignments
  });

  // Keep state ref updated
  useEffect(() => {
    stateRef.current = { step, splitItems, people, assignments };
  }, [step, splitItems, people, assignments]);

  const sendPayloadRef = useRef<((data: SyncPayload, target?: string) => void) | null>(null);

  // Initialize Session & P2P Room
  useEffect(() => {
    // 1. Get or Create Session ID
    const params = new URLSearchParams(window.location.search);
    const urlSession = params.get('session');
    // If URL has session, use it, otherwise generate one
    const currentSession = urlSession || Math.random().toString(36).substring(2, 9);
    setSessionId(currentSession);

    if (urlSession) {
        setIsSyncing(true);
    }

    // 2. Connect to P2P Room (Trystero)
    // We use a specific appId to namespace our app in the torrent swarm
    const config = { appId: 'pagamipana_v1' };
    const room = joinRoom(config, currentSession);

    // Create action for syncing
    const [sendPayload, getPayload] = room.makeAction<SyncPayload>('sync');
    sendPayloadRef.current = sendPayload;

    // Handle Peers
    room.onPeerJoin(peerId => {
        setPeerCount(prev => prev + 1);
        
        // If I am a host (have items), I should welcome the new peer with the state
        const currentState = stateRef.current;
        if (currentState.splitItems.length > 0) {
            console.log('Peer joined, sending state...');
            sendPayload({
                type: 'SYNC_STATE',
                payload: {
                    items: currentState.splitItems,
                    people: currentState.people,
                    assignments: currentState.assignments,
                    step: currentState.step === AppStep.UPLOAD ? AppStep.PROCESSING : currentState.step
                }
            }, peerId); // Send directly to the new peer
        }
    });

    room.onPeerLeave(() => {
        setPeerCount(prev => Math.max(1, prev - 1));
    });

    // Handle Incoming Data
    getPayload((msg, peerId) => {
        if (msg.type === 'SYNC_STATE') {
            console.log('Received State Sync');
            isRemoteUpdate.current = true;
            setSplitItems(msg.payload.items);
            setPeople(msg.payload.people);
            setAssignments(msg.payload.assignments);
            setStep(msg.payload.step);
            setIsSyncing(false); 
            setTimeout(() => isRemoteUpdate.current = false, 100);
        } else if (msg.type === 'UPDATE_ASSIGNMENTS') {
            isRemoteUpdate.current = true;
            setAssignments(msg.payload);
            setTimeout(() => isRemoteUpdate.current = false, 100);
        } else if (msg.type === 'UPDATE_PEOPLE') {
             isRemoteUpdate.current = true;
             setPeople(msg.payload);
             setTimeout(() => isRemoteUpdate.current = false, 100);
        } else if (msg.type === 'REQUEST_SYNC') {
            // Someone asked for sync explicitly
            const currentState = stateRef.current;
            if (currentState.splitItems.length > 0) {
                 sendPayload({
                     type: 'SYNC_STATE',
                     payload: {
                         items: currentState.splitItems,
                         people: currentState.people,
                         assignments: currentState.assignments,
                         step: currentState.step
                     }
                 }, peerId);
            }
        }
    });

    // Explicitly ask for sync if we are a guest
    if (urlSession) {
        // Trystero needs a moment to connect. We can try broadcasting a request.
        // But usually the host 'onPeerJoin' covers it.
        // We add a fallback timeout just in case.
        const timer = setTimeout(() => {
            if (stateRef.current.splitItems.length === 0) {
                 sendPayload({ type: 'REQUEST_SYNC' });
            }
        }, 2000);
        return () => clearTimeout(timer);
    }

    return () => {
        room.leave();
    };
  }, []); // Run once on mount

  // Broadcast Assignments Changes
  useEffect(() => {
    if (!isRemoteUpdate.current && sendPayloadRef.current && step === AppStep.ASSIGN) {
        sendPayloadRef.current({
            type: 'UPDATE_ASSIGNMENTS',
            payload: assignments
        });
    }
  }, [assignments, step]);

  // Broadcast People Changes
  useEffect(() => {
    if (!isRemoteUpdate.current && sendPayloadRef.current && people.length > 0) {
         sendPayloadRef.current({
            type: 'UPDATE_PEOPLE',
            payload: people
        });
    }
  }, [people]);


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
    // Clear URL param without reload
    window.history.pushState({}, '', window.location.pathname);
    // Gen new session
    const newId = Math.random().toString(36).substring(2, 9);
    setSessionId(newId);
    setPeerCount(1);
    
    setStep(AppStep.UPLOAD);
    setReceiptImage(null);
    setPeople([]);
    setAssignments({});
    setSplitItems([]);
    
    // We would technically want to leave the old room and join a new one, 
    // but a full page reload is often cleaner for "Reset" in P2P apps.
    // For now, we just reset local state. The Room is still the old one until refresh.
    window.location.reload(); 
  };

  if (isSyncing) {
      return (
        <div className="h-[100dvh] flex flex-col items-center justify-center font-sans bg-zinc-50 px-6 text-center">
             <div className="relative mb-6">
                <div className="absolute inset-0 bg-black blur-xl opacity-10 rounded-full"></div>
                <Loader2 className="w-12 h-12 text-black animate-spin relative z-10" />
            </div>
            <h2 className="text-xl font-bold mb-2">Buscando sesión...</h2>
            <p className="text-sm text-zinc-500 max-w-xs">
                Conectando con el anfitrión mediante P2P seguro. Esto puede tardar unos segundos.
            </p>
        </div>
      );
  }

  return (
    // Changed h-screen to h-[100dvh] to correctly handle mobile browser address bars
    <div className="h-[100dvh] flex flex-col font-sans overflow-hidden">
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
               Salir
            </button>
          </div>
        </header>
      )}

      {/* Main Content Area */}
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
            sessionId={sessionId}
            peerCount={peerCount}
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