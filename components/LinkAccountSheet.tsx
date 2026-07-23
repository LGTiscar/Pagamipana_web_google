import React, { useState } from 'react';
import { X, Mail, CheckCircle2 } from 'lucide-react';
import { UseAuth } from '../hooks/useAuth';

interface Props {
  auth: UseAuth;
  onClose: () => void;
}

// Modal para "ascender" un usuario anónimo a cuenta permanente (o iniciar sesión).
export const LinkAccountSheet: React.FC<Props> = ({ auth, onClose }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submitEmail = async () => {
    if (!email.trim()) return;
    setStatus('sending');
    const { error } = await auth.linkEmail(email.trim());
    if (error) {
      setStatus('error');
      setMessage(error.message);
    } else {
      setStatus('sent');
    }
  };

  const submitGoogle = async () => {
    const { error } = await auth.linkGoogle();
    if (error) {
      setStatus('error');
      setMessage(
        'Google aún no está configurado en el proyecto. Usa el email por ahora.',
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-zinc-900">Vincula tu cuenta</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900"><X size={20} /></button>
        </div>
        <p className="text-sm text-zinc-500 mb-5 leading-relaxed">
          Guarda tus proyectos y accede desde cualquier dispositivo. No pierdes nada de lo que ya tienes.
        </p>

        {status === 'sent' ? (
          <div className="flex flex-col items-center text-center py-4">
            <CheckCircle2 className="text-blue-600 mb-3" size={40} />
            <p className="font-semibold text-zinc-900">Revisa tu correo</p>
            <p className="text-sm text-zinc-500 mt-1">Te hemos enviado un enlace a <b>{email}</b> para confirmar.</p>
          </div>
        ) : (
          <>
            <button
              onClick={submitGoogle}
              className="w-full flex items-center justify-center gap-3 border border-zinc-200 rounded-2xl py-3.5 font-semibold text-zinc-800 hover:bg-zinc-50 transition-all mb-3"
            >
              <span className="w-5 h-5 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-[13px] font-bold text-[#4285F4]">G</span>
              Continuar con Google
            </button>

            <div className="relative flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-zinc-100" />
              <span className="text-xs text-zinc-400 font-medium">o con tu email</span>
              <div className="flex-1 h-px bg-zinc-100" />
            </div>

            <div className="flex items-center gap-2 border border-zinc-200 rounded-2xl px-3 py-1 mb-3 focus-within:ring-2 focus-within:ring-blue-500">
              <Mail size={18} className="text-zinc-400" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitEmail()}
                placeholder="tu@email.com"
                className="flex-1 py-2.5 bg-transparent outline-none text-zinc-900 font-medium"
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

            {status === 'error' && <p className="text-sm text-red-500 mt-3 text-center">{message}</p>}
          </>
        )}
      </div>
    </div>
  );
};
