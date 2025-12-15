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

// Sync types for BroadcastChannel
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