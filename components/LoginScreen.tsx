import React, { useState } from 'react';
import { Mail, CheckCircle2, ChevronLeft } from 'lucide-react';
import { UseAuth } from '../hooks/useAuth';
import { ThemeToggle } from './ThemeToggle';

// Pantalla de onboarding / login (mockup 01). Identidad híbrida:
// Google · email (magic-link) · "Probar sin cuenta" (anónimo).
export const LoginScreen: React.FC<{ auth: UseAuth; onQuickSplit: () => void }> = ({ auth, onQuickSplit }) => {
  const [mode, setMode] = useState<'choices' | 'email' | 'sent'>('choices');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const google = async () => {
    setError(null);
    const { error } = await auth.signInGoogle();
    if (error) setError('No se pudo iniciar sesión con Google.');
  };

  const sendEmail = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    const { error } = await auth.signInEmail(email.trim());
    setBusy(false);
    if (error) setError(error.message);
    else setMode('sent');
  };

  return (
    <div className="h-[100dvh] w-full flex justify-center bg-zinc-100 dark:bg-black">
      <div className="relative w-full max-w-md h-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 shadow-sm px-7">
        <ThemeToggle className="absolute top-5 right-5" />
        <div className="w-full max-w-[320px] flex flex-col items-center text-center">
          {/* Marca */}
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-3xl shadow-lg shadow-blue-600/40">🧾</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 mt-4">PagaMiPana</h1>
          <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mt-2">Cuentas compartidas entre panas.</p>

          {/* Acciones */}
          <div className="w-full mt-9">
            {mode === 'sent' ? (
              <div className="flex flex-col items-center text-center py-2">
                <CheckCircle2 className="text-blue-600 mb-3" size={40} />
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">Revisa tu correo</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Te enviamos un enlace a <b>{email}</b> para entrar.</p>
              </div>
            ) : mode === 'email' ? (
              <>
                <button onClick={() => setMode('choices')} className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400 font-semibold mb-3">
                  <ChevronLeft size={16} /> Volver
                </button>
                <div className="flex items-center gap-2 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-3 bg-white dark:bg-zinc-900 mb-3 focus-within:ring-2 focus-within:ring-blue-500">
                  <Mail size={18} className="text-zinc-400 dark:text-zinc-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendEmail()}
                    placeholder="tu@email.com"
                    className="flex-1 py-3 bg-transparent outline-none font-medium text-zinc-900 dark:text-zinc-50"
                    autoFocus
                  />
                </div>
                <button
                  onClick={sendEmail}
                  disabled={!email.trim() || busy}
                  className="w-full bg-blue-600 text-white rounded-2xl py-3.5 font-bold hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] transition-all"
                >
                  {busy ? 'Enviando…' : 'Enviarme el enlace'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={google}
                  className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white rounded-2xl py-3.5 font-bold hover:bg-blue-700 active:scale-[0.98] transition-all mb-3"
                >
                  <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[13px] font-bold text-[#4285F4]">G</span>
                  Continuar con Google
                </button>
                <button
                  onClick={() => setMode('email')}
                  className="w-full flex items-center justify-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-2xl py-3.5 font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.98] transition-all mb-3"
                >
                  <Mail size={18} /> Continuar con email
                </button>
                <button onClick={auth.continueAsGuest} className="w-full text-blue-600 dark:text-blue-400 font-bold py-2">
                  Probar sin cuenta →
                </button>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center mt-3 leading-relaxed">
                  Podrás vincular tu cuenta cuando quieras, sin perder tus proyectos.
                </p>

                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-semibold">o solo un ticket</span>
                  <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
                </div>
                <button onClick={onQuickSplit} className="w-full flex items-center justify-center gap-2 text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white py-2">
                  🧾 Reparto rápido, sin cuenta
                </button>
              </>
            )}
            {error && <p className="text-sm text-red-500 dark:text-red-400 mt-3 text-center">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
