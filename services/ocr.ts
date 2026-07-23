import { ReceiptItem } from '../types';

// OCR de tickets: mismo backend (AWS Lambda) que usa el flujo de reparto rápido.
const OCR_URL = 'https://hj22ziwwpjtkdgzpkdgi3ez7ii0ddtkj.lambda-url.eu-north-1.on.aws/api/ocr/base64';

export async function ocrReceipt(base64: string): Promise<ReceiptItem[]> {
  const res = await fetch(OCR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64 }),
  });
  if (!res.ok) throw new Error(`Error del servidor (${res.status}). Inténtalo de nuevo.`);

  const data = await res.json();
  let arr: any[] = [];
  if (Array.isArray(data)) arr = data;
  else if (data.structured_data && Array.isArray(data.structured_data.items)) arr = data.structured_data.items;
  else if (data.items && Array.isArray(data.items)) arr = data.items;
  else if (data.receipt && Array.isArray(data.receipt.items)) arr = data.receipt.items;

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
