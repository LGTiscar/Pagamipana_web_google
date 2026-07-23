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
