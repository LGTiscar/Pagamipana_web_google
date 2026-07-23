import { useCallback, useEffect, useState } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'pmp-theme';

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && systemDark());
  document.documentElement.classList.toggle('dark', dark);
}

// Tema con preferencia persistida: 'system' (por defecto) sigue al dispositivo,
// o forzado a 'light' / 'dark'.
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(
    () => (localStorage.getItem(KEY) as ThemePref) || 'system',
  );

  useEffect(() => { apply(pref); }, [pref]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (((localStorage.getItem(KEY) as ThemePref) || 'system') === 'system') apply('system'); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((p: ThemePref) => {
    localStorage.setItem(KEY, p);
    setPref(p);
  }, []);

  return { pref, setTheme };
}
