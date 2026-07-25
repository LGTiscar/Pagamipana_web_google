import { supabase } from './supabaseClient';
import { Expense, Balance, Settlement, SplitType, ExpenseSource } from '../types';

export async function listExpenses(projectId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
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
  const { data, error } = await supabase.rpc('add_expense', {
    p_project_id: input.projectId,
    p_description: input.description,
    p_amount: input.amount,
    p_paid_by: input.paidBy,
    p_split_type: input.splitType,
    p_source: input.source ?? 'manual',
    p_shares: input.shares,
  });
  if (error) throw error;
  return data as Expense;
}

// Gasto por ticket (OCR): crea el gasto + shares + líneas del ticket.
export async function addOcrExpense(input: {
  projectId: string;
  description: string;
  amount: number;
  paidBy: string;
  shares: { participant_id: string; amount: number }[];
  items: { description: string; quantity: number; unit_price: number; owner_ids: string[] }[];
}): Promise<Expense> {
  const { data, error } = await supabase.rpc('add_ocr_expense', {
    p_project_id: input.projectId,
    p_description: input.description,
    p_amount: input.amount,
    p_paid_by: input.paidBy,
    p_shares: input.shares,
    p_items: input.items,
  });
  if (error) throw error;
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
  const { data, error } = await supabase.rpc('update_expense', {
    p_expense_id: input.id,
    p_description: input.description,
    p_amount: input.amount,
    p_paid_by: input.paidBy,
    p_split_type: input.splitType,
    p_shares: input.shares,
  });
  if (error) throw error;
  return data as Expense;
}

// Edita un gasto por ticket: actualiza fila + shares + líneas del ticket (atómico).
export async function updateOcrExpense(input: {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  shares: { participant_id: string; amount: number }[];
  items: { description: string; quantity: number; unit_price: number; owner_ids: string[] }[];
}): Promise<Expense> {
  const { data, error } = await supabase.rpc('update_ocr_expense', {
    p_expense_id: input.id,
    p_description: input.description,
    p_amount: input.amount,
    p_paid_by: input.paidBy,
    p_shares: input.shares,
    p_items: input.items,
  });
  if (error) throw error;
  return data as Expense;
}

// Shares actuales de un gasto (para prefilar la edición).
export async function listExpenseShares(
  expenseId: string,
): Promise<{ participant_id: string; amount: number }[]> {
  const { data, error } = await supabase
    .from('expense_shares')
    .select('participant_id, amount')
    .eq('expense_id', expenseId);
  if (error) throw error;
  return (data ?? []).map((s: any) => ({ participant_id: s.participant_id, amount: Number(s.amount) }));
}

// Líneas del ticket de un gasto OCR (para prefilar la edición).
export async function listExpenseItems(
  expenseId: string,
): Promise<{ id: string; description: string; quantity: number; unit_price: number; owner_ids: string[] }[]> {
  const { data, error } = await supabase
    .from('expense_items')
    .select('id, description, quantity, unit_price, owner_ids')
    .eq('expense_id', expenseId);
  if (error) throw error;
  return (data ?? []).map((it: any) => ({
    id: it.id,
    description: it.description,
    quantity: Number(it.quantity),
    unit_price: Number(it.unit_price),
    owner_ids: (it.owner_ids ?? []) as string[],
  }));
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}

// Registra un pago entre participantes (liquidación). Reduce la deuda.
export async function recordSettlement(
  projectId: string,
  fromParticipant: string,
  toParticipant: string,
  amount: number,
): Promise<void> {
  const { error } = await supabase.from('settlements').insert({
    project_id: projectId,
    from_participant: fromParticipant,
    to_participant: toParticipant,
    amount,
  });
  if (error) throw error;
}

export async function getBalances(projectId: string): Promise<Balance[]> {
  const { data, error } = await supabase.rpc('get_balances', { p_project_id: projectId });
  if (error) throw error;
  // numeric puede llegar como string desde PostgREST → normalizamos a number.
  return (data ?? []).map((b: any) => ({
    participant_id: b.participant_id,
    display_name: b.display_name,
    paid: Number(b.paid),
    owed: Number(b.owed),
    net: Number(b.net),
  })) as Balance[];
}

// "Quién paga a quién" con el mínimo de transferencias (greedy).
export function computeSettlements(balances: Balance[]): Settlement[] {
  const creditors = balances
    .filter(b => b.net > 0.005)
    .map(b => ({ id: b.participant_id, amt: b.net }))
    .sort((a, b) => b.amt - a.amt);
  const debtors = balances
    .filter(b => b.net < -0.005)
    .map(b => ({ id: b.participant_id, amt: -b.net }))
    .sort((a, b) => b.amt - a.amt);

  const out: Settlement[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    out.push({ from: debtors[i].id, to: creditors[j].id, amount: Math.round(pay * 100) / 100 });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt < 0.005) i++;
    if (creditors[j].amt < 0.005) j++;
  }
  return out;
}
