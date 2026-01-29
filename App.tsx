import React, { useState, useEffect, useRef } from 'react';
import { StepUpload } from './components/StepUpload';
import { StepPeople } from './components/StepPeople';
import { StepAssign } from './components/StepAssign';
import { StepResults } from './components/StepResults';
import { AppStep, ReceiptItem, SplitItem, Person, Assignment, SyncPayload } from './types';
import { Loader2, AlertCircle, ArrowRight, Hash, ChevronLeft } from 'lucide-react';
import mqtt from 'mqtt';
import { Button } from './components/Button';

const flattenItems = (items: ReceiptItem[]): SplitItem[] => {
  const flattened: SplitItem[] = [];
  items.forEach(item => {
    const qty = Math.max(1, Math.round(item.quantity));
    const unitPrice = item.priceTotal / qty;
    for (let i = 0; i < qty; i++) {
      flattened.push({
        id: `${item.id}_${i}`,
        originalReceiptItemId: item.id,
        description: item.description,
        price: unitPrice,
        indexInGroup: i + 1,
        totalInGroup: qty
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
  const [loadingItems, setLoadingItems] = useState(false);
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
        client.subscribe(topic, (err) => {
            if (!err) {
                const helloPayload: SyncPayload = { type: 'REQUEST_SYNC' };
                client.publish(topic, JSON.stringify({ senderId: client.options.clientId, ...helloPayload }));
            }
        });
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
        } catch (e) {
            console.error('Error parsing MQTT message', e);
        }
    });

    return () => { if (client.connected) client.end(); };
  };

  const broadcast = (payload: SyncPayload) => {
      if (clientRef.current?.connected && sessionId) {
          const topic = `${TOPIC_PREFIX}/${sessionId}`;
          clientRef.current.publish(topic, JSON.stringify({ senderId: clientRef.current.options.clientId, ...payload }));
      }
  };

  const generateCode = () => Math.floor(10000 + Math.random() * 90000).toString();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSession = params.get('session');
    if (urlSession) initSession(urlSession);
    else {
        const newId = generateCode();
        setSessionId(newId);
        initSession(newId);
    }
  }, []); 

  useEffect(() => {
    if (!isRemoteUpdate.current && step === AppStep.ASSIGN) {
        broadcast({ type: 'UPDATE_ASSIGNMENTS', payload: assignments });
    }
  }, [assignments, step]);

  useEffect(() => {
    if (!isRemoteUpdate.current && splitItems.length > 0 && step === AppStep.ASSIGN) {
        broadcast({ 
          type: 'SYNC_STATE', 
          payload: { 
            items: splitItems, 
            people: stateRef.current.people, 
            assignments: stateRef.current.assignments, 
            step: stateRef.current.step 
          } 
        });
    }
  }, [splitItems]);

  useEffect(() => {
    if (!isRemoteUpdate.current && people.length > 0) {
         broadcast({ type: 'UPDATE_PEOPLE', payload: people });
    }
  }, [people]);

  const handleImageSelected = async (base64: string) => {
    setReceiptImage(base64);
    setLoadingItems(true);
    setStep(AppStep.PEOPLE);
    setError(null);
    try {
      console.log('Enviando imagen al backend de AWS Lambda...');
      
      // Llamada al backend CORRECTO con el endpoint específico para base64
      const response = await fetch('https://hj22ziwwpjtkdgzpkdgi3ez7ii0ddtkj.lambda-url.eu-north-1.on.aws/api/ocr/base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });

      if (!response.ok) {
          throw new Error(`Error del servidor (${response.status}). Inténtalo de nuevo.`);
      }
      
      const data = await response.json();
      console.log('Respuesta COMPLETA del backend:', data); 

      // Intento robusto de encontrar los items
      let itemsArray = [];
      if (Array.isArray(data)) {
          itemsArray = data;
      } else if (data.structured_data && Array.isArray(data.structured_data.items)) {
          // Caso específico para tu respuesta actual
          itemsArray = data.structured_data.items;
      } else if (data.items && Array.isArray(data.items)) {
          itemsArray = data.items;
      } else if (data.receipt && data.receipt.items && Array.isArray(data.receipt.items)) {
          itemsArray = data.receipt.items;
      }
      
      if (!itemsArray || itemsArray.length === 0) {
          throw new Error("No se encontraron productos en el ticket. ¿Está borrosa la foto?");
      }

      const items: ReceiptItem[] = itemsArray.map((item: any, idx: number) => ({
        id: `item-${idx}-${Date.now()}`,
        description: item.description || item.name || "Producto sin nombre",
        quantity: Number(item.quantity) || 1,
        priceTotal: Number(item.priceTotal || item.price || item.total || 0),
        originalIndex: idx
      }));

      setRawItems(items);
      const flattened = flattenItems(items);
      setSplitItems(flattened);
      setLoadingItems(false);
      
      broadcast({
        type: 'SYNC_STATE',
        payload: { 
          items: flattened, 
          people: stateRef.current.people, 
          assignments: {}, 
          step: AppStep.PEOPLE 
        }
      });
    } catch (err: any) {
      console.error("Error al procesar ticket:", err);
      setError(err.message || "Error de conexión con el servidor.");
      setLoadingItems(false);
    }
  };

  const switchSession = (newId: string) => {
    if (clientRef.current) {
        try { clientRef.current.end(true); } catch (e) {}
        clientRef.current = null;
    }
    
    const params = new URLSearchParams(window.location.search);
    params.set('session', newId);
    try {
        window.history.pushState(null, '', '?' + params.toString());
    } catch (e) {
        console.warn('Historial bloqueado por seguridad del navegador, ignorando...', e);
    }

    setSessionId(newId);
    setStep(AppStep.UPLOAD);
    setReceiptImage(null);
    setRawItems([]);
    setSplitItems([]);
    setPeople([]);
    setAssignments({});
    setLoadingItems(false);
    setError(null);
    setPeerCount(1);
    setShowJoinInput(false);
    setManualSessionCode('');
    isRemoteUpdate.current = false;
    initSession(newId);
  };

  const handleReset = () => switchSession(generateCode());
  const handleManualJoin = () => manualSessionCode.trim() && switchSession(manualSessionCode.trim());
  const handleBack = () => {
      if (step === AppStep.PEOPLE) setStep(AppStep.UPLOAD);
      if (step === AppStep.ASSIGN) setStep(AppStep.PEOPLE);
      if (step === AppStep.RESULTS) setStep(AppStep.ASSIGN);
  };

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
             <button onClick={() => setShowJoinInput(false)} className="absolute top-6 left-6 text-sm text-zinc-500 hover:text-black font-medium">← Volver</button>
             <div className="w-full max-sm">
                 <div className="mb-6 text-center">
                    <h2 className="text-2xl font-bold text-black mb-2">Unirse a una sesión</h2>
                    <p className="text-zinc-500">Introduce el código numérico de 5 dígitos</p>
                 </div>
                 <input type="number" value={manualSessionCode} onChange={(e) => setManualSessionCode(e.target.value)} placeholder="Ej: 84921" className="w-full p-4 rounded-2xl bg-white border border-zinc-200 text-center text-2xl font-mono tracking-widest uppercase mb-4 focus:ring-2 focus:ring-black outline-none" autoFocus />
                 <Button fullWidth onClick={handleManualJoin} disabled={!manualSessionCode.trim()}>Entrar <ArrowRight className="ml-2" size={18} /></Button>
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
            <p className="text-sm text-zinc-500">Sesión {sessionId}</p>
        </div>
      );
  }

  return (
    <div className="h-[100dvh] flex flex-col font-sans overflow-hidden">
      {step !== AppStep.UPLOAD && (
        <header className="px-4 py-4 shrink-0 z-50 animate-fade-in bg-white/50 backdrop-blur-md border-b border-white/50">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={handleBack} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-zinc-200 text-zinc-600 hover:text-black transition-all active:scale-95 shadow-sm"><ChevronLeft size={20} /></button>
              {stepInfo && (
                  <div className="flex flex-col ml-1">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider leading-none">Paso {stepInfo.current} / {stepInfo.total}</span>
                      <span className="text-sm font-bold text-zinc-900 leading-tight">{stepInfo.title}</span>
                  </div>
              )}
            </div>
            <div className="flex items-center gap-3">
               <div className="sm:hidden bg-white/60 px-2 py-1 rounded-md border border-zinc-200 shadow-sm flex items-center gap-1">
                    <Hash size={10} className="text-zinc-400" />
                    <span className="font-mono text-xs font-bold text-zinc-700">{sessionId}</span>
               </div>
               <button onClick={handleReset} className="text-xs font-semibold text-zinc-500 bg-white/50 px-3 py-1.5 rounded-full border border-zinc-200">Salir</button>
            </div>
          </div>
        </header>
      )}

      <main className="flex-1 w-full max-w-3xl mx-auto relative overflow-hidden flex flex-col">
        {step === AppStep.UPLOAD && <StepUpload onImageSelected={handleImageSelected} onJoinSession={() => setShowJoinInput(true)} sessionId={sessionId} />}
        
        {step === AppStep.PEOPLE && (
          <StepPeople 
            people={people} 
            setPeople={setPeople} 
            onNext={() => setStep(AppStep.ASSIGN)} 
            isProcessingReceipt={loadingItems}
            receiptError={error}
            receiptThumbnail={receiptImage}
          />
        )}
        
        {step === AppStep.ASSIGN && (
          <StepAssign 
            items={splitItems} 
            setItems={setSplitItems}
            people={people} 
            assignments={assignments} 
            setAssignments={setAssignments} 
            onNext={() => setStep(AppStep.RESULTS)} 
            sessionId={sessionId} 
            peerCount={peerCount} 
          />
        )}
        {step === AppStep.RESULTS && <StepResults items={splitItems} people={people} assignments={assignments} onReset={handleReset} />}
      </main>
    </div>
  );
}
