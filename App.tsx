import React, { useState, useEffect, useRef } from 'react';
import { StepUpload } from './components/StepUpload';
import { StepPeople } from './components/StepPeople';
import { StepAssign } from './components/StepAssign';
import { StepResults } from './components/StepResults';
import { parseReceiptImage } from './services/geminiService';
import { AppStep, ReceiptItem, SplitItem, Person, Assignment, SyncPayload } from './types';
import { Loader2, AlertCircle, Receipt, ArrowRight, Hash, ChevronLeft } from 'lucide-react';
import mqtt from 'mqtt';
import { Button } from './components/Button';

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

// --- MQTT CONFIGURATION ---
// Using HiveMQ Public Broker (Secure WebSockets)
const MQTT_BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';
const TOPIC_PREFIX = 'pagamipana/v1/session';

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
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [manualSessionCode, setManualSessionCode] = useState('');
  
  const isRemoteUpdate = useRef(false);
  const clientRef = useRef<mqtt.MqttClient | null>(null);
  
  // Refs to hold current state for callbacks to avoid stale closures
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

  // --- MQTT CONNECTION LOGIC ---
  const initSession = (id: string) => {
    setSessionId(id);
    setIsSyncing(true);

    const topic = `${TOPIC_PREFIX}/${id}`;
    
    // Connect to MQTT Broker
    const client = mqtt.connect(MQTT_BROKER_URL, {
        clientId: `user-${Math.random().toString(16).substring(2, 8)}`,
        keepalive: 60,
        clean: true,
        reconnectPeriod: 2000,
    });

    clientRef.current = client;

    client.on('connect', () => {
        console.log('Connected to MQTT Broker');
        setIsSyncing(false);
        client.subscribe(topic, (err) => {
            if (!err) {
                // Request current state from other peers
                const helloPayload: SyncPayload = { type: 'REQUEST_SYNC' };
                client.publish(topic, JSON.stringify({ senderId: client.options.clientId, ...helloPayload }));
            }
        });
    });

    client.on('message', (receivedTopic, message) => {
        if (receivedTopic !== topic) return;

        try {
            const data = JSON.parse(message.toString());
            // Ignore messages sent by ourselves
            if (data.senderId === client.options.clientId) return;

            const msg = data as SyncPayload;

            if (msg.type === 'SYNC_STATE') {
                console.log('Received State Sync');
                isRemoteUpdate.current = true;
                setSplitItems(msg.payload.items);
                setPeople(msg.payload.people);
                setAssignments(msg.payload.assignments);
                setStep(msg.payload.step);
                // Assume if we receive state, there is at least one other peer
                setPeerCount(prev => Math.max(prev, 2));
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
                // Someone joined. If we have meaningful data (items), we act as host and send state.
                setPeerCount(prev => prev + 1); 
                const currentState = stateRef.current;
                
                if (currentState.splitItems.length > 0) {
                     const response: SyncPayload = {
                         type: 'SYNC_STATE',
                         payload: {
                             items: currentState.splitItems,
                             people: currentState.people,
                             assignments: currentState.assignments,
                             step: currentState.step
                         }
                     };
                     client.publish(topic, JSON.stringify({ senderId: client.options.clientId, ...response }));
                }
            }
        } catch (e) {
            console.error('Error parsing MQTT message', e);
        }
    });

    client.on('error', (err) => {
        console.error('MQTT Error:', err);
    });

    return () => {
        if (client.connected) {
            client.end();
        }
    };
  };

  // Helper to publish messages
  const broadcast = (payload: SyncPayload) => {
      if (clientRef.current && clientRef.current.connected && sessionId) {
          const topic = `${TOPIC_PREFIX}/${sessionId}`;
          const message = JSON.stringify({ 
              senderId: clientRef.current.options.clientId, 
              ...payload 
          });
          clientRef.current.publish(topic, message);
      }
  };

  // Helper to generate 5 digit code
  const generateCode = () => Math.floor(10000 + Math.random() * 90000).toString();

  // Initialize Session on Load if URL has param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSession = params.get('session');
    
    if (urlSession) {
        initSession(urlSession);
    } else {
        const newId = generateCode();
        setSessionId(newId);
        initSession(newId);
    }
  }, []); 

  // Broadcast Assignments Changes
  useEffect(() => {
    if (!isRemoteUpdate.current && step === AppStep.ASSIGN) {
        broadcast({
            type: 'UPDATE_ASSIGNMENTS',
            payload: assignments
        });
    }
  }, [assignments, step]);

  // Broadcast People Changes
  useEffect(() => {
    if (!isRemoteUpdate.current && people.length > 0) {
         broadcast({
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
      
      // Broadcast initial state once we have items
      setTimeout(() => {
          broadcast({
            type: 'SYNC_STATE',
            payload: {
                items: flattenItems(items),
                people: [],
                assignments: {},
                step: AppStep.PEOPLE
            }
          });
      }, 500);

    } catch (err) {
      console.error(err);
      setError("No pudimos leer el ticket. Inténtalo de nuevo con mejor iluminación o fondo oscuro.");
      setStep(AppStep.UPLOAD);
    } finally {
      setLoading(false);
    }
  };

  // Function to switch session without page reload
  const switchSession = (newId: string) => {
    // 1. Disconnect previous session
    if (clientRef.current) {
        try { clientRef.current.end(true); } catch (e) { console.error(e); }
        clientRef.current = null;
    }

    // 2. Update URL without triggering restricted navigation
    const url = new URL(window.location.href);
    url.searchParams.set('session', newId);
    window.history.pushState({}, '', url.toString());

    // 3. Reset Local State completely
    setSessionId(newId);
    setStep(AppStep.UPLOAD);
    setReceiptImage(null);
    setRawItems([]);
    setSplitItems([]);
    setPeople([]);
    setAssignments({});
    setLoading(false);
    setError(null);
    setPeerCount(1);
    setShowJoinInput(false);
    setManualSessionCode('');
    isRemoteUpdate.current = false;

    // 4. Initialize new session connection
    initSession(newId);
  };

  const handleReset = () => {
    const newId = generateCode();
    switchSession(newId);
  };

  const handleManualJoin = () => {
      if (!manualSessionCode.trim()) return;
      switchSession(manualSessionCode.trim());
  };

  const handleBack = () => {
      if (step === AppStep.PEOPLE) setStep(AppStep.UPLOAD);
      if (step === AppStep.ASSIGN) setStep(AppStep.PEOPLE);
      if (step === AppStep.RESULTS) setStep(AppStep.ASSIGN);
  };

  // Helper logic for Step Header
  const getStepInfo = () => {
      switch(step) {
          case AppStep.PEOPLE: return { title: 'Participantes', current: 1, total: 3 };
          case AppStep.ASSIGN: return { title: 'Asignar', current: 2, total: 3 };
          case AppStep.RESULTS: return { title: 'Resultados', current: 3, total: 3 };
          default: return null;
      }
  };
  const stepInfo = getStepInfo();

  if (showJoinInput) {
      return (
        <div className="h-[100dvh] flex flex-col items-center justify-center font-sans px-6 bg-zinc-50 relative">
             <button 
                onClick={() => setShowJoinInput(false)}
                className="absolute top-6 left-6 text-sm text-zinc-500 hover:text-black font-medium"
             >
                 ← Volver
             </button>
             
             <div className="w-full max-w-sm">
                 <div className="mb-6 text-center">
                    <h2 className="text-2xl font-bold text-black mb-2">Unirse a una sesión</h2>
                    <p className="text-zinc-500">Introduce el código numérico de 5 dígitos</p>
                 </div>
                 
                 <input 
                    type="number"
                    value={manualSessionCode}
                    onChange={(e) => setManualSessionCode(e.target.value)}
                    placeholder="Ej: 84921"
                    className="w-full p-4 rounded-2xl bg-white border border-zinc-200 text-center text-2xl font-mono tracking-widest uppercase mb-4 focus:ring-2 focus:ring-black outline-none"
                    autoFocus
                 />
                 
                 <Button fullWidth onClick={handleManualJoin} disabled={!manualSessionCode.trim()}>
                     Entrar <ArrowRight className="ml-2" size={18} />
                 </Button>
             </div>
        </div>
      );
  }

  if (isSyncing) {
      return (
        <div className="h-[100dvh] flex flex-col items-center justify-center font-sans bg-zinc-50 px-6 text-center">
             <div className="relative mb-6">
                <div className="absolute inset-0 bg-black blur-xl opacity-10 rounded-full"></div>
                <Loader2 className="w-12 h-12 text-black animate-spin relative z-10" />
            </div>
            <h2 className="text-xl font-bold mb-2">Conectando...</h2>
            <p className="text-sm text-zinc-500 max-w-xs">
                Estableciendo conexión segura con la sesión {sessionId}...
            </p>
        </div>
      );
  }

  return (
    // Changed h-screen to h-[100dvh] to correctly handle mobile browser address bars
    <div className="h-[100dvh] flex flex-col font-sans overflow-hidden">
      {/* Header / Navbar - Only visible after upload step to avoid duplicate branding */}
      {step !== AppStep.UPLOAD && (
        <header className="px-4 py-4 shrink-0 z-50 animate-fade-in bg-white/50 backdrop-blur-md border-b border-white/50">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Logic: If in steps, show Back arrow + Step Info. If not (shouldn't happen here due to outer condition), show Logo */}
              <button 
                onClick={handleBack}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-zinc-200 text-zinc-600 hover:text-black hover:border-zinc-300 transition-all active:scale-95 shadow-sm"
              >
                  <ChevronLeft size={20} />
              </button>
              
              {stepInfo && (
                  <div className="flex flex-col ml-1">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider leading-none">
                          Paso {stepInfo.current} de {stepInfo.total}
                      </span>
                      <span className="text-sm font-bold text-zinc-900 leading-tight">
                          {stepInfo.title}
                      </span>
                  </div>
              )}

              {!stepInfo && (
                  <div className="flex items-center gap-2">
                     <div className="bg-black text-white rounded-xl p-1.5 shadow-lg shadow-black/20">
                        <Receipt size={16} strokeWidth={2} />
                    </div>
                    <span className="font-bold text-zinc-900">PagaMiPana</span>
                  </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
               {/* Display Session ID in Header */}
               <div className="hidden sm:flex flex-col items-end mr-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Código</span>
                    <span className="font-mono text-sm font-bold text-zinc-900 leading-none">{sessionId}</span>
               </div>
               {/* Mobile Session Badge */}
               <div className="sm:hidden bg-white/60 backdrop-blur-sm px-2 py-1 rounded-md border border-zinc-200 shadow-sm flex items-center gap-1">
                    <Hash size={10} className="text-zinc-400" />
                    <span className="font-mono text-xs font-bold text-zinc-700">{sessionId}</span>
               </div>

               <button onClick={handleReset} className="text-xs font-semibold text-zinc-500 hover:text-red-600 transition-colors bg-white/50 px-3 py-1.5 rounded-full border border-zinc-200">
                  Salir
               </button>
            </div>
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
          <StepUpload 
            onImageSelected={handleImageSelected} 
            onJoinSession={() => setShowJoinInput(true)}
            sessionId={sessionId}
          />
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