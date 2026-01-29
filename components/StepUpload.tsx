import React, { useRef, useState } from 'react';
import { Camera, Upload, Sparkles, Image as ImageIcon, Users, CheckCircle, Share2, Hash } from 'lucide-react';
import { Button } from './Button';
import { Logo } from './Logo';

interface StepUploadProps {
  onImageSelected: (base64: string) => void;
  onJoinSession: () => void;
  sessionId: string;
}

export const StepUpload: React.FC<StepUploadProps> = ({ onImageSelected, onJoinSession, sessionId }) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (e.target) e.target.value = '';
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleConfirm = () => {
    if (previewUrl) onImageSelected(previewUrl);
  };

  const handleRetake = () => {
    setPreviewUrl(null);
  };

  const copySessionId = () => {
      navigator.clipboard.writeText(sessionId).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      });
  };

  const handleInvite = async () => {
    const url = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'PagaMiPana', url: url }); } catch (err) {}
    } else {
      navigator.clipboard.writeText(url).then(() => {
          setLinkCopied(true);
          setTimeout(() => setLinkCopied(false), 2000);
      });
    }
  };

  if (previewUrl) {
    return (
      <div className="flex flex-col h-full w-full animate-fade-in">
        <div className="flex-1 overflow-y-auto px-4 no-scrollbar flex flex-col pt-6">
          <div className="text-center mb-6">
             <h2 className="text-2xl font-bold text-black tracking-tight">Revisar Ticket</h2>
             <p className="text-zinc-500 text-sm">Asegúrate de que los items se lean bien</p>
          </div>
          <div className="relative w-full max-w-sm mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-zinc-200 shrink-0">
             <img src={previewUrl} alt="Preview" className="w-full h-auto object-contain block" />
          </div>
          <div className="max-w-md mx-auto w-full flex flex-col gap-3 mt-8 mb-8 shrink-0">
             <Button fullWidth variant="primary" icon={<Sparkles size={20} />} onClick={handleConfirm} className="h-14 text-base shadow-xl shadow-black/10">
              Analizar con IA
            </Button>
            <Button fullWidth variant="ghost" onClick={handleRetake} className="text-zinc-500 hover:text-red-500">
              Repetir foto
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col animate-fade-in bg-transparent relative">
      <div className="flex-1 overflow-y-auto no-scrollbar w-full">
          <div className="w-full max-w-sm mx-auto px-4 min-h-full flex flex-col items-center justify-center py-4">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-[1.5rem] bg-black text-white shadow-2xl mb-3">
                    <Logo size={44} strokeWidth={1.5} />
                </div>
                <h2 className="text-3xl font-bold text-black tracking-tight mb-0.5">PagaMiPana</h2>
                <p className="text-zinc-500 text-sm font-medium">La IA hace el trabajo sucio</p>
                <div className="flex items-center justify-center gap-4 mt-3">
                    <button onClick={copySessionId} className="group flex items-center gap-2 transition-all active:scale-95">
                         <Hash size={12} className="text-zinc-300 group-hover:text-black transition-colors" />
                         <span className="text-lg font-mono font-bold text-zinc-900 tracking-widest border-b border-dashed border-zinc-300 pb-0.5">{sessionId}</span>
                         {copied && <CheckCircle size={14} className="text-green-500 animate-fade-in" />}
                    </button>
                    <div className="w-px h-4 bg-zinc-300/50"></div>
                    <button onClick={handleInvite} className={`text-xs font-bold transition-all flex items-center gap-1 ${linkCopied ? 'text-green-600' : 'text-blue-500'}`}>
                        {linkCopied ? 'Copiado' : 'Invitar'}
                    </button>
                </div>
              </div>

              <div onClick={() => setShowOptions(true)} className="w-full p-6 sm:p-10 border-2 border-dashed border-zinc-300 bg-white/30 backdrop-blur-sm rounded-3xl transition-all flex flex-col items-center justify-center space-y-3 cursor-pointer hover:bg-white/50 active:scale-[0.98] group mb-6">
                <div className="w-14 h-14 bg-white/60 group-hover:bg-white transition-colors rounded-full flex items-center justify-center text-zinc-400">
                    <Camera size={28} />
                </div>
                <p className="text-zinc-500 font-semibold text-sm">Toca para subir el ticket</p>
              </div>

              <div className="w-full space-y-2">
                <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} className="hidden" onChange={handleFileChange} />
                <input type="file" accept="image/*" ref={galleryInputRef} className="hidden" onChange={handleFileChange} />
                <Button fullWidth variant="primary" icon={<Camera size={18} />} onClick={() => cameraInputRef.current?.click()} className="h-12">Hacer Foto</Button>
                <Button fullWidth variant="outline" icon={<Upload size={18} />} onClick={() => galleryInputRef.current?.click()} className="h-12 bg-white/50">Subir desde galería</Button>
                <Button fullWidth variant="ghost" icon={<Users size={18} />} onClick={onJoinSession} className="h-10 text-zinc-400">Unirse a sesión</Button>
              </div>
          </div>
      </div>

      {showOptions && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowOptions(false)} />
          <div className="relative w-full max-w-sm bg-transparent flex flex-col gap-2 animate-fade-in">
             <div className="bg-white/95 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl">
                 <button onClick={() => { setShowOptions(false); cameraInputRef.current?.click(); }} className="w-full py-4 flex items-center justify-center gap-2 text-lg text-blue-600 active:bg-zinc-100 border-b border-zinc-100">
                    <Camera size={20} /> Hacer Foto
                 </button>
                 <button onClick={() => { setShowOptions(false); galleryInputRef.current?.click(); }} className="w-full py-4 flex items-center justify-center gap-2 text-lg text-blue-600 active:bg-zinc-100">
                    <ImageIcon size={20} /> Galería
                 </button>
             </div>
             <button onClick={() => setShowOptions(false)} className="w-full py-4 bg-white rounded-2xl text-lg font-bold text-blue-600 shadow-xl">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
};