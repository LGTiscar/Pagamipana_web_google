import React, { useState, useEffect, useRef } from 'react';
import { StepUpload } from './components/StepUpload';
import { StepPeople } from './components/StepPeople';
import { StepAssign } from './components/StepAssign';
import { StepResults } from './components/StepResults';
import { parseReceiptImage } from './services/geminiService';
import { AppStep, ReceiptItem, SplitItem, Person, Assignment, SyncPayload } from './types';
import { Loader2, AlertCircle, ArrowRight, Hash, ChevronLeft } from 'lucide-react';
import { Logo } from './components/Logo';
import mqtt from 'mqtt';
import { Button } from './components/Button';

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
  const [sessionId, setSessionId] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [peerCount, setPeerCount] = useState(1);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [manualSessionCode, setManualSessionCode] = useState('');
  
  const isRemoteUpdate = useRef(false);
  const clientRef = useRef<mqtt.MqttClient | null>(null);
  const stateRef = useRef({ step, splitItems, people, assignments });

  useEffect(() => {
    stateRef.current = { step, splitItems, people, assignments };
  }, [step, splitItems, people, assignments]);

  const initSession = (id: string) => {
    setSessionId(id);
    setIsSyncing(true);
    const topic = `${TOPIC_PREFIX}/${id}`;
    const client = mqtt.connect(MQTT_BROKER_URL, {
        clientId: `user-${Math.random().toString(16).substring(2, 8)}`,
        keepalive: 60,
        clean: true,
        reconnectPeriod: 2000,
    });
    clientRef.current = client;

    client.on('connect', () => {
        setIsSyncing(false);
        client.subscribe(topic);
        const helloPayload: SyncPayload = { type: 'REQUEST_SYNC' };
        client.publish(topic, JSON.stringify({ senderId: client.options.clientId, ...helloPayload }));
    });

    client.on('message', (receivedTopic, message) => {
        if (receivedTopic !== topic) return;
        try {
            const data = JSON.parse(message.toString());
            if (data.senderId === client.options.clientId) return;
            const msg = data as SyncPayload;
            if (msg.type === 'SYNC_STATE') {
                isRemoteUpdate.current = true;
                setSplitItems(msg.payload.items);
                setPeople(msg.payload.people);
                setAssignments(msg.payload.assignments);
                setStep(msg.payload.step);
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
        } catch (e) { console.error(e); }
    });

    return () => { if (client.connected) client.end(); };
  };

  const broadcast = (payload: SyncPayload) => {
      if (clientRef.current?.connected && sessionId) {
          const topic = `${TOPIC_PREFIX}/${sessionId}`;
          clientRef.current.publish(topic, JSON.stringify({ senderId: clientRef.current.options.clientId, ...payload }));
      }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSession = params.get('session');
    const newId = urlSession || Math.floor(10000 + Math.random() * 90000).toString();
    initSession(newId);
  }, []); 

  useEffect(() => {
    if (!isRemoteUpdate.current && step === AppStep.ASSIGN) {
        broadcast({ type: 'UPDATE_ASSIGNMENTS', payload: assignments });
    }
  }, [assignments, step]);

  useEffect(() => {
    if (!isRemoteUpdate.current && people.length > 0) {
         broadcast({ type: 'UPDATE_PEOPLE', payload: people });
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
      setTimeout(() => {
          broadcast({
            type: 'SYNC_STATE',
            payload: { items: flattenItems(items), people: [], assignments: {}, step: AppStep.PEOPLE }
          });
      }, 500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error desconocido al procesar el ticket.");
      setStep(AppStep.UPLOAD);
    } finally {
      setLoading(false);
    }
  };

  const switchSession = (newId: string) => {
    if (clientRef.current) clientRef.current.end(true);
    const url = new URL(window.location.href);
    url.searchParams.set('session', newId);
    window.history.pushState({}, '', url.toString());
    setSessionId(newId);
    setStep(AppStep.UPLOAD);
    setReceiptImage(null);
    setSplitItems([]);
    setPeople([]);
    setAssignments({});
    setPeerCount(1);
    setShowJoinInput(false);
    initSession(newId);
  };

  const handleBack = () => {
      if (step === AppStep.PEOPLE) setStep(AppStep.UPLOAD);
      if (step === AppStep.ASSIGN) setStep(AppStep.PEOPLE);
      if (step === AppStep.RESULTS) setStep(AppStep.ASSIGN);
  };

  if (showJoinInput) {
      return (
        <div className="h-[100dvh] flex flex-col items-center justify-center font-sans px-6 bg-zinc-50 relative">
             <button onClick={() => setShowJoinInput(false)} className="absolute top-6 left-6 text-sm text-zinc-500 hover:text-black font-medium">← Volver</button>
             <div className="w-full max-w-sm">
                 <div className="mb-6 text-center">
                    <h2 className="text-2xl font-bold text-black mb-2">Unirse a una sesión</h2>
                    <p className="text-zinc-500">Introduce el código de 5 dígitos</p>
                 </div>
                 <input type="number" value={manualSessionCode} onChange={(e) => setManualSessionCode(e.target.value)} placeholder="Ej: 84921" className="w-full p-4 rounded-2xl bg-white border border-zinc-200 text-center text-2xl font-mono tracking-widest uppercase mb-4 focus:ring-2 focus:ring-black outline-none" autoFocus />
                 <Button fullWidth onClick={() => switchSession(manualSessionCode)} disabled={!manualSessionCode.trim()}>Entrar <ArrowRight className="ml-2" size={18} /></Button>
             </div>
        </div>
      );
  }

  return (
    <div className="h-[100dvh] flex flex-col font-sans overflow-hidden">
      {step !== AppStep.UPLOAD && (
        <header className="px-4 py-4 shrink-0 z-50 bg-white/50 backdrop-blur-md border-b border-white/50">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <button onClick={handleBack} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-zinc-200 text-zinc-600 hover:text-black shadow-sm"><ChevronLeft size={20} /></button>
            <div className="flex items-center gap-2">
               <div className="bg-black text-white rounded-xl p-1.5"><Logo size={16} /></div>
               <span className="font-bold text-zinc-900">PagaMiPana</span>
            </div>
            <button onClick={() => switchSession(Math.floor(10000 + Math.random() * 90000).toString())} className="text-xs font-semibold text-zinc-500 bg-white/50 px-3 py-1.5 rounded-full border border-zinc-200">Salir</button>
          </div>
        </header>
      )}

      <main className="flex-1 w-full max-w-3xl mx-auto relative overflow-hidden flex flex-col">
        {step === AppStep.PROCESSING && (
           <div className="flex flex-col items-center justify-center h-full space-y-6">
              <Loader2 className="w-16 h-16 text-black animate-spin" />
              <div className="text-center">
                  <p className="text-xl font-bold text-black mb-1">Leyendo ticket...</p>
                  <p className="text-sm text-zinc-500 px-6">Esto puede tardar unos segundos mientras la IA analiza los precios.</p>
              </div>
           </div>
        )}

        {error && step === AppStep.UPLOAD && (
            <div className="mx-4 my-4 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 shadow-sm animate-fade-in">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold">Algo salió mal:</p>
                  <p>{error}</p>
                </div>
            </div>
        )}

        {step === AppStep.UPLOAD && (
          <StepUpload onImageSelected={handleImageSelected} onJoinSession={() => setShowJoinInput(true)} sessionId={sessionId} />
        )}
        {step === AppStep.PEOPLE && <StepPeople people={people} setPeople={setPeople} onNext={() => setStep(AppStep.ASSIGN)} />}
        {step === AppStep.ASSIGN && <StepAssign items={splitItems} people={people} assignments={assignments} setAssignments={setAssignments} onNext={() => setStep(AppStep.RESULTS)} sessionId={sessionId} peerCount={peerCount} />}
        {step === AppStep.RESULTS && <StepResults items={splitItems} people={people} assignments={assignments} onReset={() => switchSession(Math.floor(10000 + Math.random() * 90000).toString())} />}
      </main>
    </div>
  );
}