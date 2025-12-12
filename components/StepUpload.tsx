import React, { useRef, useState } from 'react';
import { Camera, Upload, Receipt, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from './Button';

interface StepUploadProps {
  onImageSelected: (base64: string) => void;
}

export const StepUpload: React.FC<StepUploadProps> = ({ onImageSelected }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
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
    if (fileInputRef.current) fileInputRef.current.value = '';
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

      <div 
        className="relative w-full max-w-sm p-10 border-2 border-dashed border-zinc-400/50 bg-white/30 backdrop-blur-sm rounded-3xl transition-all duration-300 flex flex-col items-center justify-center space-y-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
         <div className="w-16 h-16 bg-white/50 rounded-full flex items-center justify-center mx-auto text-zinc-500">
            <Camera size={32} />
         </div>
         <p className="text-zinc-600 font-medium px-4 text-center">
           Toma una foto o sube el ticket para empezar
         </p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
        />
        
        <Button 
          fullWidth 
          variant="primary" 
          icon={<Camera size={20} />}
          onClick={() => fileInputRef.current?.click()}
          className="h-14 text-base shadow-lg"
        >
          Hacer Foto
        </Button>
        
        <Button 
          fullWidth 
          variant="outline" 
          icon={<Upload size={20} />}
          onClick={() => fileInputRef.current?.click()}
          className="bg-white/50 border-white/50 backdrop-blur-md"
        >
          Subir desde galería
        </Button>
      </div>
    </div>
  );
};