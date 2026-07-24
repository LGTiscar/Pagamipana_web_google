import React, { useEffect, useRef } from 'react';

// CAPTCHA de Cloudflare Turnstile, activo solo si hay VITE_TURNSTILE_SITE_KEY.
// Si no hay clave, no renderiza nada y la auth funciona sin captcha.
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

export const captchaEnabled = !!SITE_KEY;

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if ((window as any).turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('No se pudo cargar el captcha'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

// onToken se llama con el token al resolverse (o '' si expira).
// onError se llama si el desafío falla o no se completa a tiempo (p. ej. lo
// bloquea una extensión / cookies de terceros) → la UI ofrece Google + reintento.
export const Turnstile: React.FC<{ onToken: (t: string) => void; onError?: () => void }> = ({ onToken, onError }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    let solved = false;
    let widgetId: string | undefined;

    // Si en 10s no se ha resuelto, asumimos que el entorno lo bloquea.
    const timer = window.setTimeout(() => { if (!solved && !cancelled) onError?.(); }, 10000);

    loadScript()
      .then(() => {
        if (cancelled || !ref.current) return;
        const ts = (window as any).turnstile;
        widgetId = ts.render(ref.current, {
          sitekey: SITE_KEY,
          theme: 'auto',
          retry: 'auto',
          'retry-interval': 3000,
          callback: (token: string) => { solved = true; window.clearTimeout(timer); onToken(token); },
          'expired-callback': () => onToken(''),
          'error-callback': (code: string) => { console.warn('[Turnstile] error', code); onError?.(); return true; },
        });
      })
      .catch(() => { onError?.(); });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (widgetId && (window as any).turnstile) {
        try { (window as any).turnstile.remove(widgetId); } catch { /* noop */ }
      }
    };
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={ref} className="flex justify-center my-3 min-h-[65px]" />;
};
