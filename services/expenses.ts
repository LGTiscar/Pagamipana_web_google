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

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
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
