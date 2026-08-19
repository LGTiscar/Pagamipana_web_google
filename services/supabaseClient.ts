import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  // Fail loud in dev; in prod the app simply won't authenticate.
  console.warn(
    '[supabase] Faltan variables de entorno. Define VITE_SUPABASE_URL y ' +
    'VITE_SUPABASE_PUBLISHABLE_KEY en .env.local (ver .env.example).'
  );
}

export const supabase = createClient(url, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Needed so magic-link / OAuth redirects are picked up on return.
    detectSessionInUrl: true,
  },
});

// ---------------------------------------------------------------------------
// Resiliencia ante errores de JWT (no son fallos de datos ni de permisos)
// ---------------------------------------------------------------------------
// PostgREST rechaza la petición antes de tocar la BD cuando el token no le vale
// "ahora mismo". Dos familias distintas, con arreglo distinto:
//
//  * DESFASE DE RELOJ (`JWT issued at future` / `not yet valid`): el `iat` del
//    token cae en el futuro para el reloj que lo valida. Basta un desfase de
//    segundos entre el reloj de Auth (que estampa el `iat`) y el de PostgREST, y
//    afecta justo al token recién emitido → al hacer login la home se quedaba
//    vacía. Aquí refrescar EMPEORA la cosa (un token nuevo tiene el `iat` aún más
//    adelantado): lo que toca es esperar un poco y reintentar el mismo token.
//  * TOKEN CADUCADO / INVÁLIDO (`PGRST301`, `JWT expired`, `bad_jwt`): ahí sí
//    hace falta pedir un token nuevo antes de reintentar.
//
// En ambos casos, un único reintento; si vuelve a fallar, propagamos.
const CLOCK_SKEW_RE = /issued at future|not yet valid|used before issued|immature/i;
const STALE_TOKEN_RE = /jwt expired|jwt is expired|bad_?jwt|invalid jwt|invalid claim|missing sub claim/i;

function errorText(error: any): string {
  return [error?.message, error?.details, error?.hint, error?.code].filter(Boolean).join(' ');
}

export function isClockSkewJwtError(error: any): boolean {
  return !!error && CLOCK_SKEW_RE.test(errorText(error));
}

export function isStaleTokenError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code ?? '');
  if (code === 'PGRST301' || code === 'PGRST302') return true;
  return STALE_TOKEN_RE.test(errorText(error));
}

const SKEW_RETRY_DELAY_MS = 2000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Envuelve una llamada a Supabase (`() => supabase.from(...)...` o `supabase.rpc(...)`):
// devuelve `data` y lanza el error, pero reintentando UNA vez si el fallo es de JWT.
export async function withJwtRetry<T>(run: () => PromiseLike<{ data: T; error: any }>): Promise<T> {
  const first = await run();
  if (!first.error) return first.data;

  const skew = isClockSkewJwtError(first.error);
  if (!skew && !isStaleTokenError(first.error)) throw first.error;

  if (skew) {
    // El token es demasiado "nuevo" para el servidor: dejamos que se ponga al día.
    await delay(SKEW_RETRY_DELAY_MS);
  } else {
    // Token caducado/inválido: pedimos uno nuevo (si falla, reintentamos igual).
    await supabase.auth.refreshSession();
  }

  const second = await run();
  if (!second.error) return second.data;

  if (isClockSkewJwtError(second.error)) {
    throw new Error(
      'No pudimos validar tu sesión por un desfase de hora. Comprueba que la fecha y ' +
      'hora del dispositivo sean automáticas y vuelve a intentarlo.',
      { cause: second.error },
    );
  }
  throw second.error;
}
