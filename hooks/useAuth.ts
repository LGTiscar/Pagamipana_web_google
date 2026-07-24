import { useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

// Evita bucles en el fallback link→sign-in tras el redirect de OAuth.
const FALLBACK_KEY = 'pmp_google_signin_fallback';

function readOAuthError(): { code: string | null; desc: string | null } {
  if (typeof window === 'undefined') return { code: null, desc: null };
  const q = new URLSearchParams(window.location.search);
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return {
    code: q.get('error_code') ?? h.get('error_code') ?? q.get('error') ?? h.get('error'),
    desc: q.get('error_description') ?? h.get('error_description'),
  };
}

function cleanUrl() {
  try { window.history.replaceState(null, '', window.location.pathname); } catch { /* noop */ }
}

// Identidad híbrida: al arrancar, si no hay sesión se crea una ANÓNIMA (fricción
// cero). El anónimo es un usuario real, ascendible a cuenta permanente con
// Google / magic-link sin perder datos. Si el email ya tiene cuenta, en vez de
// fallar al vincular, iniciamos sesión en esa cuenta.
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // ¿Volvemos de un linkIdentity que falló? (p.ej. el email ya tiene cuenta)
      const err = readOAuthError();
      if (err.code || err.desc) {
        const alreadyExists =
          err.code === 'identity_already_exists' ||
          /already|exists|registered|linked/i.test(err.desc ?? '');

        if (alreadyExists && !sessionStorage.getItem(FALLBACK_KEY)) {
          // Ese email ya tiene cuenta → iniciamos sesión en ella en vez de vincular.
          sessionStorage.setItem(FALLBACK_KEY, '1');
          cleanUrl();
          await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin },
          });
          return; // el navegador va a redirigir
        }

        setAuthError(
          alreadyExists
            ? 'No se pudo iniciar sesión con Google. Vuelve a intentarlo.'
            : 'Se canceló o falló el inicio de sesión.',
        );
        cleanUrl();
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      // Sin sesión → dejamos null y AppShell muestra el login. La sesión anónima
      // se crea solo si el usuario elige "Probar sin cuenta" (continueAsGuest).
      setSession(data.session ?? null);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s && !s.user.is_anonymous) sessionStorage.removeItem(FALLBACK_KEY);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const user: User | null = session?.user ?? null;
  const isAnonymous = !!user?.is_anonymous;

  // Nombre visible del usuario (profiles.display_name), reutilizado al crear/unirse.
  const [profileName, setProfileName] = useState<string | null>(null);
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) { setProfileName(null); return; }
    let active = true;
    supabase.from('profiles').select('display_name').eq('id', uid).single()
      .then(({ data }) => { if (active) setProfileName(data?.display_name ?? null); });
    return () => { active = false; };
  }, [session?.user?.id]);

  const saveName = useCallback(async (name: string) => {
    const uid = session?.user?.id;
    if (!uid) return { error: new Error('No autenticado') as any };
    const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', uid);
    if (!error) setProfileName(name);
    return { error };
  }, [session?.user?.id]);

  // Nombre amigable a mostrar: perfil → nombre de Google → usuario del email.
  // Nunca el correo entero.
  const meta = (user?.user_metadata ?? {}) as Record<string, any>;
  const displayName: string | null =
    profileName ||
    meta.full_name ||
    meta.name ||
    (user?.email ? user.email.split('@')[0] : null) ||
    null;

  // Vincular email (envía enlace de confirmación; el anónimo pasa a permanente).
  const linkEmail = useCallback(async (email: string) => {
    return supabase.auth.updateUser({ email });
  }, []);

  // Vincular Google al usuario actual (upgrade in-place preservando datos).
  const linkGoogle = useCallback(async () => {
    return supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }, []);

  // Iniciar sesión con Google (entra en la cuenta si existe, o la crea).
  const signInGoogle = useCallback(async () => {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }, []);

  // Iniciar sesión con email (magic-link) sin usuario previo.
  const signInEmail = useCallback(async (email: string, captchaToken?: string) => {
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin, captchaToken },
    });
  }, []);

  // Entrar como invitado (sesión anónima, fricción cero).
  const continueAsGuest = useCallback(async (captchaToken?: string) =>
    supabase.auth.signInAnonymously(captchaToken ? { options: { captchaToken } } : undefined), []);

  // Cerrar sesión → sin sesión → vuelve a la pantalla de login.
  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);

  return {
    session, user, loading, isAnonymous, authError, profileName, displayName,
    linkEmail, linkGoogle, signInGoogle, signInEmail, continueAsGuest, signOut, saveName,
  };
}

export type UseAuth = ReturnType<typeof useAuth>;
