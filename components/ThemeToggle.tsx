import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, ThemePref } from '../hooks/useTheme';

// Botón que cicla Sistema → Claro → Oscuro.
export const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { pref, setTheme } = useTheme();
  const next: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };
  const Icon = pref === 'dark' ? Moon : pref === 'light' ? Sun : Monitor;
  const label = pref === 'dark' ? 'Oscuro' : pref === 'light' ? 'Claro' : 'Sistema';

  return (
    <button
      onClick={() => setTheme(next[pref])}
      title={`Tema: ${label}`}
      aria-label={`Tema: ${label}. Cambiar.`}
      className={`w-9 h-9 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white active:scale-95 transition-all ${className ?? ''}`}
    >
      <Icon size={16} />
    </button>
  );
};
