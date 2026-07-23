import { useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

// Identidad híbrida: al arrancar, si no hay sesión se crea una ANÓNIMA (fricción
// cero). El usuario anónimo es un usuario real (tiene auth.uid()), que luego se
// puede "ascender" a cuenta permanente con Google / magic-link sin perder datos.
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session) {
        setSession(data.session);
      } else {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) console.error('[auth] signInAnonymously falló:', error.message);
        // onAuthStateChange fijará la sesión resultante.
      }
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const user: User | null = session?.user ?? null;
  const isAnonymous = !!user?.is_anonymous;

  // Vincular email a un usuario (anónimo o no): envía un enlace de confirmación.
  // Al confirmarlo, el usuario anónimo pasa a permanente conservando su id.
  const linkEmail = useCallback(async (email: string) => {
    return supabase.auth.updateUser({ email });
  }, []);

  // Vincular Google (requiere el proveedor OAuth configurado en el dashboard).
  const linkGoogle = useCallback(async () => {
    return supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const signOut = useCallback(async () => supabase.auth.signOut(), []);

  return { session, user, loading, isAnonymous, linkEmail, linkGoogle, signOut };
}

export type UseAuth = ReturnType<typeof useAuth>;
