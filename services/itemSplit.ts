// Modelo de reparto de un ticket con soporte de unidades.
// Cada línea tiene N unidades (quantity); cada unidad guarda sus "owners".
// - Uniforme: todas las unidades comparten owners → reparto simple de la línea.
// - Divergente: unidades con owners distintos → reparto "por unidades".

export interface SplitLine {
  id: string;
  description: string;
  quantity: number;
  price: number;       // total de la línea
  units: string[][];   // owners por unidad; length = quantity
}

export const r2 = (n: number) => Math.round(n * 100) / 100;

export function linesFromReceipt(
  items: { id: string; description: string; quantity: number; priceTotal: number }[],
): SplitLine[] {
  return items.map(it => {
    const q = Math.max(1, Math.round(it.quantity) || 1);
    return { id: it.id, description: it.description, quantity: q, price: it.priceTotal, units: Array.from({ length: q }, () => [] as string[]) };
  });
}

export const unitPrice = (l: SplitLine) => l.price / Math.max(1, l.quantity);

const key = (owners: string[]) => [...owners].sort().join(',');
export const isUniform = (l: SplitLine) => l.units.every(u => key(u) === key(l.units[0]));
export const lineOwners = (l: SplitLine) => (isUniform(l) ? l.units[0] : []);

export function totalsByParticipant(lines: SplitLine[]): Record<string, number> {
  const t: Record<string, number> = {};
  lines.forEach(l => {
    const up = unitPrice(l);
    l.units.forEach(owners => {
      if (owners.length) {
        const per = up / owners.length;
        owners.forEach(o => { t[o] = (t[o] || 0) + per; });
      }
    });
  });
  Object.keys(t).forEach(k => { t[k] = r2(t[k]); });
  return t;
}

export const linesTotal = (lines: SplitLine[]) => r2(lines.reduce((a, l) => a + l.price, 0));
export const unassignedUnits = (lines: SplitLine[]) =>
  lines.reduce((a, l) => a + l.units.filter(u => u.length === 0).length, 0);
export const allAssigned = (lines: SplitLine[]) =>
  lines.length > 0 && lines.every(l => l.units.every(u => u.length > 0));

// Shares por participante (reconciliadas para que sumen exactamente el total).
export function sharesFor(lines: SplitLine[]): { participant_id: string; amount: number }[] {
  const t = totalsByParticipant(lines);
  const out = Object.entries(t)
    .filter(([, a]) => a > 0.0001)
    .map(([participant_id, amount]) => ({ participant_id, amount: r2(amount) }));
  const total = linesTotal(lines);
  const sum = r2(out.reduce((a, s) => a + s.amount, 0));
  const diff = r2(total - sum);
  if (out.length) out[0].amount = r2(out[0].amount + diff);
  return out;
}

// Líneas para guardar (owner_ids = unión de owners de todas las unidades).
export function itemsFor(lines: SplitLine[]): { description: string; quantity: number; unit_price: number; owner_ids: string[] }[] {
  return lines.map(l => ({
    description: l.description,
    quantity: l.quantity,
    unit_price: r2(unitPrice(l)),
    owner_ids: Array.from(new Set(l.units.flat())),
  }));
}

// Mutadores puros (devuelven una línea nueva).
export function toggleAll(l: SplitLine, pid: string): SplitLine {
  const has = lineOwners(l).includes(pid);
  const owners = has ? lineOwners(l).filter(o => o !== pid) : [...lineOwners(l), pid];
  return { ...l, units: l.units.map(() => [...owners]) };
}
export function toggleUnit(l: SplitLine, idx: number, pid: string): SplitLine {
  return { ...l, units: l.units.map((u, i) => (i !== idx ? u : u.includes(pid) ? u.filter(o => o !== pid) : [...u, pid])) };
}
export const resetLine = (l: SplitLine): SplitLine => ({ ...l, units: l.units.map(() => []) });
export const setPrice = (l: SplitLine, price: number): SplitLine => ({ ...l, price });
