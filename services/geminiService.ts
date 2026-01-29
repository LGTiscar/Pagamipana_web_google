import { ReceiptItem } from "../types";

const base64ToBlob = async (base64Data: string): Promise<Blob> => {
  const response = await fetch(base64Data);
  return await response.blob();
};

const cleanJsonString = (text: string): string => {
  // Remove markdown blocks if present
  let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  
  // Find boundaries of JSON object or array
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  const start = (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) ? firstBrace : firstBracket;

  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const end = (lastBrace !== -1 && (lastBracket === -1 || lastBrace > lastBracket)) ? lastBrace : lastBracket;

  if (start !== -1 && end !== -1 && end > start) {
    return cleaned.substring(start, end + 1);
  }
  return cleaned;
};

export const parseReceiptImage = async (base64Image: string): Promise<ReceiptItem[]> => {
  try {
    const blob = await base64ToBlob(base64Image);
    const formData = new FormData();
    formData.append('file', blob, 'ticket.jpg');

    const response = await fetch('https://hj22ziwwpjtkdgzpkdgi3ez7ii0ddtkj.lambda-url.eu-north-1.on.aws/api/ocr', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error(`Error servidor (${response.status})`);

    const rawData = await response.json();
    let processedData = rawData;

    if (rawData.text && typeof rawData.text === 'string') {
      try {
        const sanitizedText = cleanJsonString(rawData.text);
        processedData = JSON.parse(sanitizedText);
      } catch (e) {
        console.error('Error parseando JSON tras limpieza:', e);
        // Fallback simplified parse attempt
        try {
            processedData = JSON.parse(rawData.text);
        } catch(e2) {}
      }
    }

    const items = Array.isArray(processedData) ? processedData : (processedData.items || []);

    if (!items || items.length === 0) throw new Error("Ticket vacío o ilegible.");

    return items.map((item: any, index: number) => ({
      id: `item-${Date.now()}-${index}`,
      description: (item.description || item.nombre || item.text || 'Producto').toUpperCase(),
      quantity: Number(item.quantity || item.cantidad || 1),
      priceTotal: parseFloat(item.priceTotal || item.precioTotal || item.total || 0),
      originalIndex: index
    }));
  } catch (error: any) {
    console.error("OCR Error:", error);
    throw new Error(error.message || "Error al procesar el ticket.");
  }
};