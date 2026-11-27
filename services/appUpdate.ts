// Se entera de que hay un despliegue nuevo y lo aplica.
//
// Por qué: la webapp añadida a la pantalla de inicio del iPhone no recarga al abrirla. iOS
// retoma la página que tenía en memoria, así que sigue con el JS viejo aunque Amplify ya sirva
// la versión nueva (en Safari se nota menos porque la pestaña se recarga más a menudo).
//
// Cómo: cada build lleva su id (__APP_BUILD__, ver vite.config.ts) y publica el mismo id en
// /version.json. Al arrancar y cada vez que la app vuelve a primer plano pedimos ese fichero
// sin caché. Si el id publicado no es el nuestro, hay versión nueva:
//  - al arrancar, o al volver tras un rato largo fuera, recargamos sin preguntar: no hay nada
//    a medias que perder;
//  - si solo estuvo fuera un momento (p. ej. para hacer el bizum con una hoja abierta),
//    sacamos un aviso con "Actualizar" (UpdateBanner) en vez de recargar por sorpresa.
// En la app nativa (Capacitor), /version.json es el del propio paquete: siempre coincide.

const CURRENT_BUILD = __APP_BUILD__;
const CHECK_GAP_MS = 60 * 1000;          // como mucho una comprobación por minuto
const LONG_AWAY_MS = 30 * 60 * 1000;     // fuera más de 30 min → recarga directa
const RELOADED_KEY = 'pmp-reloaded-for'; // si tras recargar seguimos viejos, no insistir (bucle)
// Vuelta de un login (OAuth / magic-link): recargar ahora gastaría el código, que es de un solo uso.
const AUTH_RETURN_RE = /[?&#](code|error|access_token|token_hash)=/;

let available = false;
let lastCheck = 0;
let hiddenAt: number | null = null;
const listeners = new Set<() => void>();

// Para useSyncExternalStore (UpdateBanner).
export const subscribeUpdate = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
export const isUpdateAvailable = () => available;

export function applyUpdate() {
  window.location.reload();
}

function announce() {
  if (available) return;
  available = true;
  listeners.forEach(fn => fn());
}

async function publishedBuild(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.build === 'string' ? data.build : null;
  } catch {
    return null; // sin red o respuesta rara: ya lo intentaremos la próxima vez
  }
}

async function check(mayReload: boolean) {
  const now = Date.now();
  if (now - lastCheck < CHECK_GAP_MS) return;
  lastCheck = now;

  const published = await publishedBuild();
  if (!published || published === CURRENT_BUILD) return;

  let alreadyTried = false;
  try { alreadyTried = sessionStorage.getItem(RELOADED_KEY) === published; } catch { /* sin storage */ }
  const authReturn = AUTH_RETURN_RE.test(window.location.search + window.location.hash);

  if (mayReload && !alreadyTried && !authReturn) {
    try { sessionStorage.setItem(RELOADED_KEY, published); } catch { /* sin storage */ }
    applyUpdate();
    return;
  }
  announce();
}

export function startUpdateWatcher() {
  if (import.meta.env.DEV) return; // en `npm run dev` no hay version.json ni builds que comparar

  check(true);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    const away = hiddenAt == null ? 0 : Date.now() - hiddenAt;
    hiddenAt = null;
    check(away >= LONG_AWAY_MS);
  });

  // Safari puede devolver la página desde su caché de ida y vuelta sin pasar por lo anterior.
  window.addEventListener('pageshow', e => { if (e.persisted) check(false); });
}
