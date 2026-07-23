// Todas las divisas ISO 4217 que soporta el navegador, con nombre en español.
// Sin mantenimiento manual: sale de Intl.supportedValuesOf + Intl.DisplayNames.

export interface CurrencyOption { code: string; label: string; }

const POPULAR = ['EUR', 'USD', 'GBP', 'MXN', 'ARS', 'COP', 'CLP', 'BRL', 'CHF'];

// Fallback por si el runtime no soporta supportedValuesOf (navegadores viejos).
const FALLBACK = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'MXN', 'ARS', 'COP', 'CLP', 'BRL', 'CNY'];

let cache: { popular: CurrencyOption[]; rest: CurrencyOption[] } | null = null;

export function getCurrencies(): { popular: CurrencyOption[]; rest: CurrencyOption[] } {
  if (cache) return cache;

  let codes: string[];
  try {
    const sv = (Intl as any).supportedValuesOf;
    codes = typeof sv === 'function' ? sv('currency') : FALLBACK;
  } catch {
    codes = FALLBACK;
  }

  let names: any = null;
  try { names = new (Intl as any).DisplayNames(['es'], { type: 'currency' }); } catch { names = null; }

  const nameOf = (code: string): string => {
    const n = names?.of?.(code);
    const name = n && n !== code ? n : code;
    return name.charAt(0).toUpperCase() + name.slice(1);
  };
  const toOption = (code: string): CurrencyOption => ({ code, label: `${code} — ${nameOf(code)}` });

  const popular = POPULAR.filter(c => codes.includes(c)).map(toOption);
  const rest = codes
    .filter(c => !POPULAR.includes(c))
    .map(toOption)
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));

  cache = { popular, rest };
  return cache;
}
