import { ReceiptItem } from '../types';
import { supabase } from './supabaseClient';

// OCR de tickets: mismo backend (AWS Lambda) que usa el flujo de reparto rápido.
// Enviamos el JWT de Supabase para que el Lambda pueda autenticar la petición
// (ver SECURITY.md: verificación del token en el Lambda).
const OCR_URL = 'https://hj22ziwwpjtkdgzpkdgi3ez7ii0ddtkj.lambda-url.eu-north-1.on.aws/api/ocr/base64';

export async function ocrReceipt(base64: string): Promise<ReceiptItem[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(OCR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ image: base64 }),
  });
  if (!res.ok) throw new Error(`Error del servidor (${res.status}). Inténtalo de nuevo.`);

  const data2 = await res.json();
  let arr: any[] = [];
  if (Array.isArray(data2)) arr = data2;
  else if (data2.structured_data && Array.isArray(data2.structured_data.items)) arr = data2.structured_data.items;
  else if (data2.items && Array.isArray(data2.items)) arr = data2.items;
  else if (data2.receipt && Array.isArray(data2.receipt.items)) arr = data2.receipt.items;

  if (!arr || arr.length === 0) {
    throw new Error('No se encontraron productos en el ticket. ¿Está borrosa la foto?');
  }

  return arr.map((it: any, idx: number) => ({
    id: `item-${idx}-${Date.now()}`,
    description: it.description || it.name || 'Producto',
    quantity: Number(it.quantity) || 1,
    priceTotal: Number(it.priceTotal || it.price || it.total || 0),
    originalIndex: idx,
  }));
}
