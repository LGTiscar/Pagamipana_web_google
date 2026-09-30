import { useEffect, useState } from 'react';

export interface ViewportBox { top: number; height: number }

// Zona realmente visible de la pantalla. En iOS (Safari/PWA) el teclado NO encoge
// el layout viewport: se superpone y tapa lo que esté `fixed` abajo. Encajando un
// overlay en esta caja, la hoja inferior queda siempre justo encima del teclado.
export function useVisualViewport(active = true): ViewportBox | null {
  const [box, setBox] = useState<ViewportBox | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) { setBox(null); return; }
    const update = () => setBox({ top: vv.offsetTop, height: vv.height });
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [active]);

  return box;
}
