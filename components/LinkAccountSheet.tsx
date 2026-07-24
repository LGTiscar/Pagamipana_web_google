import React, { useState } from 'react';
import { X, Mail, CheckCircle2 } from 'lucide-react';
import { UseAuth } from '../hooks/useAuth';
import { AppleLogo, appleEnabled } from './AppleLogo';

interface Props {
  auth: UseAuth;
  preserveData?: boolean;
  onClose: () => void;
}

// Modal para "ascender" un usuario anónimo a cuenta permanente (o iniciar sesión).
export const LinkAccountSheet: React.FC<Props> = ({ auth, preserveData = false, onClose }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submitEmail = async () => {
    if (!email.trim()) return;
    setStatus('sending');
    const { error } = await auth.linkEmail(email.trim());
    if (error) { setStatus('error'); setMessage(error.message); }
    else setStatus('sent');
  };

  const submitGoogle = async () => {
    const { error } = preserveData ? await auth.linkGoogle() : await auth.signInGoogle();
    if (error) {
      setStatus('error');
      setMessage('Google aún no está configurado en el proyecto. Usa el email por ahora.');
    }
  };

  const submitApple = async () => {
    const { error } = preserveData ? await auth.linkApple() : await auth.signInApple();
    if (error) {
      setStatus('error');
      setMessage('No se pudo continuar con Apple. Prueba con Google o email.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-sm bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Vincula tu cuenta</h2>
          <button onClick={onClose} className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X size={20} /></button>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5 leading-relaxed">
          Guarda tus proyectos y accede desde cualquier dispositivo. No pierdes nada de lo que ya tienes.
        </p>

        {status === 'sent' ? (
          <div className="flex flex-col items-center text-center py-4">
            <CheckCircle2 className="text-blue-600 mb-3" size={40} />
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">Revisa tu correo</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Te hemos enviado un enlace a <b>{email}</b> para confirmar.</p>
          </div>
        ) : (
          <>
            <button
              onClick={submitGoogle}
              className="w-full flex items-center justify-center gap-3 border border-zinc-200 dark:border-zinc-700 rounded-2xl py-3.5 font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all mb-3"
            >
              <span className="w-5 h-5 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-[13px] font-bold text-[#4285F4]">G</span>
              Continuar con Google
            </button>
            {appleEnabled && (
              <button
                onClick={submitApple}
                className="w-full flex items-center justify-center gap-2 bg-black text-white dark:bg-white dark:text-black rounded-2xl py-3.5 font-bold active:scale-[0.98] transition-all mb-3"
              >
                <AppleLogo size={17} /> Continuar con Apple
              </button>
            )}

            <div className="relative flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
              <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">o con tu email</span>
              <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
            </div>

            <div className="flex items-center gap-2 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-3 py-1 mb-3 focus-within:ring-2 focus-within:ring-blue-500">
              <Mail size={18} className="text-zinc-400 dark:text-zinc-500" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitEmail()}
                placeholder="tu@email.com"
                className="flex-1 py-2.5 bg-transparent outline-none text-zinc-900 dark:text-zinc-50 font-medium placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                autoFocus
              />
            </div>

            <button
              onClick={submitEmail}
              disabled={!email.trim() || status === 'sending'}
              className="w-full bg-blue-600 text-white rounded-2xl py-3.5 font-bold hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-[0.98]"
            >
              {status === 'sending' ? 'Enviando…' : 'Enviarme el enlace'}
            </button>

            {status === 'error' && <p className="text-sm text-red-500 dark:text-red-400 mt-3 text-center">{message}</p>}
          </>
        )}
      </div>
    </div>
  );
};
