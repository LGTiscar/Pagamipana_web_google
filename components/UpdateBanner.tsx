import React, { useSyncExternalStore } from 'react';
import { RefreshCw } from 'lucide-react';
import { subscribeUpdate, isUpdateAvailable, applyUpdate } from '../services/appUpdate';

// Aviso de versión nueva (ver services/appUpdate.ts). Flota arriba, en la columna de la app,
// por encima de cualquier pantalla; solo sale cuando no hemos podido recargar solos.
export const UpdateBanner: React.FC = () => {
  const available = useSyncExternalStore(subscribeUpdate, isUpdateAvailable);
  if (!available) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none">
      <div
        role="status"
        className="pointer-events-auto w-full max-w-md flex items-center gap-3 rounded-2xl bg-blue-600 text-white pl-4 pr-1.5 py-1.5 shadow-lg shadow-blue-600/30 animate-fade-in"
      >
        <span className="flex-1 min-w-0 text-sm font-semibold">Hay una versión nueva</span>
        <button
          onClick={applyUpdate}
          className="shrink-0 flex items-center gap-1.5 rounded-full bg-white text-blue-700 px-3.5 py-2 text-sm font-bold hover:bg-blue-50 active:scale-95"
        >
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>
    </div>
  );
};
