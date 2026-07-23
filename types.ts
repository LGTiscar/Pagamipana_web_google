export interface ReceiptItem {
  id: string;
  description: string;
  quantity: number;
  priceTotal: number;
  originalIndex: number; // To keep order
}

// A flattened item represents a single unit of a line item.
// E.g., "2x Beers" becomes 2 FlattenedItems.
export interface SplitItem {
  id: string;
  description: string;
  price: number;
  originalReceiptItemId: string;
  indexInGroup: number; // 1 of 2, 2 of 2
  totalInGroup: number;
}

export interface Person {
  id: string;
  name: string;
  color: string;
  avatar?: string;
}

export interface Assignment {
  [itemId: string]: string[]; // itemId -> array of person IDs
}

export enum AppStep {
  UPLOAD = 'UPLOAD',
  PROCESSING = 'PROCESSING',
  PEOPLE = 'PEOPLE',
  ASSIGN = 'ASSIGN',
  RESULTS = 'RESULTS',
}

// Sync types for MQTT
export type SyncPayload =
  | {
      type: 'SYNC_STATE';
      payload: {
        items: SplitItem[];
        people: Person[];
        assignments: Assignment;
        step: AppStep;
      };
    }
  | {
      type: 'UPDATE_ASSIGNMENTS';
      payload: Assignment;
    }
  // Delta sync: only the changed unit keys travel. Merged with `...prev` on
  // receipt, so simultaneous edits to *different* lines don't clobber each other.
  | {
      type: 'PATCH_ASSIGNMENT';
      payload: Assignment;
    }
  | {
      type: 'UPDATE_PEOPLE';
      payload: Person[];
    }
  | {
      type: 'REQUEST_SYNC';
    };

// Custom pastel palette from user request
// All backgrounds are light, so we use dark text (zinc-900) for contrast
export const AVATAR_COLORS = [
  'bg-[#ffadad] text-zinc-900', // Powder Blush
  'bg-[#ffd6a5] text-zinc-900', // Apricot Cream
  'bg-[#fdffb6] text-zinc-900', // Cream
  'bg-[#caffbf] text-zinc-900', // Tea Green
  'bg-[#9bf6ff] text-zinc-900', // Electric Aqua
  'bg-[#a0c4ff] text-zinc-900', // Baby Blue Ice
  'bg-[#bdb2ff] text-zinc-900', // Periwinkle
  'bg-[#ffc6ff] text-zinc-900', // Mauve
  'bg-[#fffffc] text-zinc-900'  // Porcelain
];

// ---------------------------------------------------------------------------
// Proyectos (fase Tricount) — persistidos en Supabase
// ---------------------------------------------------------------------------
export type ProjectType = 'trip' | 'couple' | 'friends' | 'flat' | 'event' | 'other';

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  currency: string;
  created_by: string;
  created_at: string;
  archived_at: string | null;
}

export interface Participant {
  id: string;
  project_id: string;
  profile_id: string | null; // null = participante "virtual" (sin cuenta)
  display_name: string;
  color: string | null;
  created_at: string;
}

// Resumen por proyecto para la home (mi saldo + avatares).
export interface ProjectOverview {
  id: string;
  name: string;
  type: ProjectType;
  currency: string;
  created_at: string;
  my_net: number;
  member_count: number;
  avatars: { name: string; color: string | null }[];
}

export const PROJECT_TYPES: { value: ProjectType; label: string; emoji: string }[] = [
  { value: 'trip',    label: 'Viaje',  emoji: '✈️' },
  { value: 'couple',  label: 'Pareja', emoji: '💑' },
  { value: 'friends', label: 'Amigos', emoji: '🍻' },
  { value: 'flat',    label: 'Piso',   emoji: '🏠' },
  { value: 'event',   label: 'Evento', emoji: '🎉' },
  { value: 'other',   label: 'Otro',   emoji: '📁' },
];

export const projectEmoji = (t: ProjectType): string =>
  PROJECT_TYPES.find(p => p.value === t)?.emoji ?? '📁';

// ---------------------------------------------------------------------------
// Gastos (fase 2) — dentro de un proyecto
// ---------------------------------------------------------------------------
export type SplitType = 'equal' | 'shares' | 'exact' | 'percent' | 'by_item';
export type ExpenseSource = 'manual' | 'ocr';

export interface Expense {
  id: string;
  project_id: string;
  description: string;
  amount_total: number;
  currency: string;
  paid_by: string;          // participant id
  split_type: SplitType;
  source: ExpenseSource;
  receipt_path: string | null;
  created_by: string;
  created_at: string;
}

export interface ExpenseShare {
  id: string;
  expense_id: string;
  participant_id: string;
  amount: number;           // importe resuelto que debe este participante
}

// Balance neto por participante (calculado en BD).
export interface Balance {
  participant_id: string;
  display_name: string;
  paid: number;
  owed: number;
  net: number;              // paid - owed  (>0 le deben, <0 debe)
}

export interface Settlement {
  from: string;             // participant id que paga
  to: string;               // participant id que cobra
  amount: number;
}

export const SPLIT_TYPES: { value: SplitType; label: string }[] = [
  { value: 'equal',   label: 'Igual' },
  { value: 'shares',  label: 'Partes' },
  { value: 'percent', label: '%' },
  { value: 'exact',   label: 'Exacto' },
];
