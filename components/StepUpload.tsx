import React, { useRef, useState } from 'react';
import { Camera, Upload, Receipt, RefreshCw, Sparkles, Image as ImageIcon, Users } from 'lucide-react';
import { Button } from './Button';

interface StepUploadProps {
  onImageSelected: (base64: string) => void;
  onJoinSession: () => void;
}

export const StepUpload: React.FC<StepUploadProps> = ({ onImageSelected, onJoinSession }) => {
  // We need two refs for two different inputs behaviors
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    
    // Reset inputs so the same file can be selected again if needed
    if (e.target) e.target.value = '';
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirm = () => {
    if (previewUrl) {
      onImageSelected(previewUrl);
    }
  };

  const handleRetake = () => {
    setPreviewUrl(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  // --- LAYOUT: PREVIEW MODE ---
  if (previewUrl) {
    return (
      <div className="flex flex-col h-full w-full animate-fade-in">
        {/* Single Scrollable Container including Buttons */}
        {/* Added pt-10 to clear the notch/status bar area since header is hidden */}
        <div className="flex-1 overflow-y-auto px-2 no-scrollbar flex flex-col pt-10">
          <div className="text-center mb-6 shrink-0">
             <h2 className="text-2xl font-bold text-black tracking-tight">Revisar Ticket</h2>
             <p className="text-zinc-500">Asegúrate de que los items se lean bien</p>
          </div>

          <div className="relative w-full max-w-sm mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-zinc-200 shrink-0">
             <img 
               src={previewUrl} 
               alt="Ticket Preview" 
               className="w-full h-auto object-contain block"
             />
          </div>

          {/* Buttons at the end of the scroll flow */}
          <div className="max-w-md mx-auto w-full flex flex-col gap-3 mt-8 mb-8 shrink-0">
             <Button 
              fullWidth 
              variant="primary" 
              icon={<Sparkles size={20} />}
              onClick={handleConfirm}
              className="h-14 text-base shadow-xl shadow-black/10"
            >
              Analizar Gastos
            </Button>
            
            <Button 
              fullWidth 
              variant="ghost" 
              onClick={handleRetake}
              className="text-zinc-500 hover:text-red-500 hover:bg-red-50"
            >
              Repetir foto
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- LAYOUT: INITIAL UPLOAD MODE ---
  return (
    // Added pt-16 to ensure content clears the device notch
    <div className="flex flex-col items-center justify-center h-full space-y-8 animate-fade-in px-4 pb-12 pt-16">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-black text-white shadow-2xl mb-2">
            <Receipt size={40} strokeWidth={1.5} />
        </div>
        <div>
            <h2 className="text-4xl font-bold text-black tracking-tight mb-2">PagaMiPana</h2>
            <p className="text-zinc-600 text-lg font-medium">Deja que la IA haga el trabajo sucio</p>
        </div>
      </div>

      {/* Interactive Drop/Click Zone */}
      <div 
        onClick={() => setShowOptions(true)}
        className="relative w-full max-w-sm p-10 border-2 border-dashed border-zinc-400/50 bg-white/30 backdrop-blur-sm rounded-3xl transition-all duration-300 flex flex-col items-center justify-center space-y-4 cursor-pointer hover:bg-white/40 active:scale-[0.98] group"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
         <div className="w-16 h-16 bg-white/50 group-hover:bg-white/80 transition-colors rounded-full flex items-center justify-center mx-auto text-zinc-500">
            <Camera size={32} />
         </div>
         <p className="text-zinc-600 font-medium px-4 text-center">
           Toca para subir el ticket
         </p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {/* Input explicitly for Camera */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={cameraInputRef}
          className="hidden"
          onChange={handleFileChange}
        />
        
        {/* Input for Gallery (No capture attribute triggers standard picker) */}
        <input
          type="file"
          accept="image/*"
          ref={galleryInputRef}
          className="hidden"
          onChange={handleFileChange}
        />
        
        <Button 
          fullWidth 
          variant="primary" 
          icon={<Camera size={20} />}
          onClick={() => cameraInputRef.current?.click()}
          className="h-14 text-base shadow-lg"
        >
          Hacer Foto
        </Button>
        
        <Button 
          fullWidth 
          variant="outline" 
          icon={<Upload size={20} />}
          onClick={() => galleryInputRef.current?.click()}
          className="bg-white/50 border-white/50 backdrop-blur-md"
        >
          Subir desde galería
        </Button>

        <Button 
          fullWidth 
          variant="ghost" 
          icon={<Users size={20} />}
          onClick={onJoinSession}
          className="text-zinc-600 hover:bg-zinc-100/50 mt-2"
        >
          Unirse a sesión existente
        </Button>
      </div>

      {/* Action Sheet Modal */}
      {showOptions && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity"
            onClick={() => setShowOptions(false)}
          />
          <div className="relative w-full max-w-sm bg-transparent flex flex-col gap-2 animate-fade-in z-10">
             <div className="bg-white/90 backdrop-blur-xl rounded-2xl overflow-hidden shadow-xl">
                 <div className="py-3 text-center border-b border-zinc-200/50">
                    <p className="text-xs font-semibold text-zinc-500">Selecciona una opción</p>
                 </div>
                 <button 
                    onClick={() => { setShowOptions(false); cameraInputRef.current?.click(); }}
                    className="w-full py-3.5 flex items-center justify-center gap-2 text-lg text-blue-600 active:bg-zinc-100 transition-colors border-b border-zinc-200/50"
                 >
                    <Camera size={20} />
                    Hacer Foto
                 </button>
                 <button 
                    onClick={() => { setShowOptions(false); galleryInputRef.current?.click(); }}
                    className="w-full py-3.5 flex items-center justify-center gap-2 text-lg text-blue-600 active:bg-zinc-100 transition-colors"
                 >
                    <ImageIcon size={20} />
                    Galería
                 </button>
             </div>
             
             <button 
                onClick={() => setShowOptions(false)}
                className="w-full py-3.5 bg-white rounded-2xl text-lg font-semibold text-blue-600 shadow-xl active:scale-[0.98] transition-all"
            >
                Cancelar
            </button>
          </div>
        </div>
      )}

    </div>
  );
};