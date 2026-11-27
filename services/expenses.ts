import { supabase, withJwtRetry } from './supabaseClient';
import { Expense, Balance, Settlement, SettlementRecord, SplitType, ExpenseSource } from '../types';

export async function listExpenses(projectId: string): Promise<Expense[]> {
  const data = await withJwtRetry(() => supabase
    .from('expenses')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false }));
  return (data ?? []) as Expense[];
}

export async function addExpense(input: {
  projectId: string;
  description: string;
  amount: number;
  paidBy: string;                 // participant id
  splitType: SplitType;
  source?: ExpenseSource;
  shares: { participant_id: string; amount: number }[];
}): Promise<Expense> {
  const data = await withJwtRetry(() => supabase.rpc('add_expense', {
    p_project_id: input.projectId,
    p_description: input.description,
    p_amount: input.amount,
    p_paid_by: input.paidBy,
    p_split_type: input.splitType,
    p_source: input.source ?? 'manual',
    p_shares: input.shares,
  }));
  return data as Expense;
}

// Gasto por ticket (OCR): crea el gasto + shares + líneas del ticket.
export async function addOcrExpense(input: {
  projectId: string;
  description: string;
  amount: number;
  paidBy: string;
  shares: { participant_id: string; amount: number }[];
  items: { description: string; quantity: number; unit_price: number; owner_ids: string[]; units: string[][] }[];
}): Promise<Expense> {
  const data = await withJwtRetry(() => supabase.rpc('add_ocr_expense', {
    p_project_id: input.projectId,
    p_description: input.description,
    p_amount: input.amount,
    p_paid_by: input.paidBy,
    p_shares: input.shares,
    p_items: input.items,
  }));
  return data as Expense;
}

// Edita un gasto manual: actualiza la fila y regenera sus shares (atómico).
export async function updateExpense(input: {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  splitType: SplitType;
  shares: { participant_id: string; amount: number }[];
}): Promise<Expense> {
  const data = await withJwtRetry(() => supabase.rpc('update_expense', {
    p_expense_id: input.id,
    p_description: input.description,
    p_amount: input.amount,
    p_paid_by: input.paidBy,
    p_split_type: input.splitType,
    p_shares: input.shares,
  }));
  return data as Expense;
}

// Edita un gasto por ticket: actualiza fila + shares + líneas del ticket (atómico).
export async function updateOcrExpense(input: {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  shares: { participant_id: string; amount: number }[];
  items: { description: string; quantity: number; unit_price: number; owner_ids: string[]; units: string[][] }[];
}): Promise<Expense> {
  const data = await withJwtRetry(() => supabase.rpc('update_ocr_expense', {
    p_expense_id: input.id,
    p_description: input.description,
    p_amount: input.amount,
    p_paid_by: input.paidBy,
    p_shares: input.shares,
    p_items: input.items,
  }));
  return data as Expense;
}

// Shares actuales de un gasto (para prefilar la edición).
export async function listExpenseShares(
  expenseId: string,
): Promise<{ participant_id: string; amount: number }[]> {
  const data = await withJwtRetry(() => supabase
    .from('expense_shares')
    .select('participant_id, amount')
    .eq('expense_id', expenseId));
  return (data ?? []).map((s: any) => ({ participant_id: s.participant_id, amount: Number(s.amount) }));
}

// Líneas del ticket de un gasto OCR (para prefilar la edición).
export async function listExpenseItems(
  expenseId: string,
): Promise<{ id: string; description: string; quantity: number; unit_price: number; owner_ids: string[]; units: string[][] | null }[]> {
  const data = await withJwtRetry(() => supabase
    .from('expense_items')
    .select('id, description, quantity, unit_price, owner_ids, units')
    .eq('expense_id', expenseId));
  return (data ?? []).map((it: any) => ({
    id: it.id,
    description: it.description,
    quantity: Number(it.quantity),
    unit_price: Number(it.unit_price),
    owner_ids: (it.owner_ids ?? []) as string[],
    units: (it.units ?? null) as string[][] | null,
  }));
}

export async function deleteExpense(id: string): Promise<void> {
  await withJwtRetry(() => supabase.from('expenses').delete().eq('id', id));
}

// Registra un pago entre participantes (liquidación). Reduce la deuda.
// Devuelve el id de la fila para poder deshacerlo justo después (aviso con "Deshacer").
// `createdBy` = mi perfil, para enseñar "lo apuntó X" en el historial.
export async function recordSettlement(
  projectId: string,
  fromParticipant: string,
  toParticipant: string,
  amount: number,
  createdBy?: string,
): Promise<string> {
  const row = await withJwtRetry(() => supabase.from('settlements').insert({
    project_id: projectId,
    from_participant: fromParticipant,
    to_participant: toParticipant,
    amount,
    created_by: createdBy ?? null,
  }).select('id').single());
  return (row as { id: string }).id;
}

// Pagos ya registrados del proyecto, del más reciente al más antiguo.
export async function listSettlements(projectId: string): Promise<SettlementRecord[]> {
  const data = await withJwtRetry(() => supabase
    .from('settlements')
    .select('id, from_participant, to_participant, amount, created_by, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false }));
  return (data ?? []).map((s: any) => ({ ...s, amount: Number(s.amount) })) as SettlementRecord[];
}

// Deshace un pago: los balances vuelven a contarlo como pendiente.
export async function deleteSettlement(id: string): Promise<void> {
  await withJwtRetry(() => supabase.from('settlements').delete().eq('id', id));
}

export async function getBalances(projectId: string): Promise<Balance[]> {
  const data = await withJwtRetry(() => supabase.rpc('get_balances', { p_project_id: projectId }));
  // numeric puede llegar como string desde PostgREST → normalizamos a number.
  return (data ?? []).map((b: any) => ({
    participant_id: b.participant_id,
    display_name: b.display_name,
    paid: Number(b.paid),
    owed: Number(b.owed),
    net: Number(b.net),
  })) as Balance[];
}

// "Quién paga a quién" (greedy en cadena: como mucho deudores + acreedores − 1 transferencias).
//
// ESTABILIDAD: el orden de emparejamiento NO puede depender de lo que queda por pagar (`net`),
// porque cambia con cada pago registrado y reordenaría todas las parejas: Julia salda lo que le
// tocaba con Luis y de repente aparece debiéndole a Luis otra vez y a otra persona. Por eso
// ordenamos por el saldo SOLO de gastos (`paid - owed`, que las liquidaciones no tocan), de mayor
// a menor, y desempatamos por id. Con un orden fijo, registrar un pago sugerido (entero o parcial)
// deja el resto de sugerencias exactamente igual. Un gasto nuevo sí puede recolocarlas.
export function computeSettlements(balances: Balance[]): Settlement[] {
  // En céntimos enteros: sin arrastre de coma flotante de un pago a otro.
  const side = (sign: 1 | -1) => balances
    .map(b => ({
      id: b.participant_id,
      cents: Math.round(sign * b.net * 100),
      weight: Math.round(Math.abs(b.paid - b.owed) * 100),
    }))
    .filter(x => x.cents > 0)
    .sort((a, b) => b.weight - a.weight || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const creditors = side(1);
  const debtors = side(-1);

  const out: Settlement[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].cents, creditors[j].cents);
    out.push({ from: debtors[i].id, to: creditors[j].id, amount: pay / 100 });
    debtors[i].cents -= pay;
    creditors[j].cents -= pay;
    if (debtors[i].cents === 0) i++;
    if (creditors[j].cents === 0) j++;
  }
  return out;
}
