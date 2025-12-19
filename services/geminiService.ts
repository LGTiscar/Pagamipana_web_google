import { ReceiptItem } from "../types";

const base64ToBlob = async (base64Data: string): Promise<Blob> => {
  const response = await fetch(base64Data);
  return await response.blob();
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
        // CORRECCIÓN SyntaxError: Algunos servidores devuelven saltos de línea literales (\n reales) 
        // dentro de cadenas JSON, lo cual es inválido para JSON.parse().
        // Limpiamos la cadena reemplazando saltos de línea reales por el carácter de escape \n.
        const sanitizedText = rawData.text
          .replace(/\r?\n/g, '\\n') // Reemplaza saltos de línea literales por \n escapado
          .trim();
        
        processedData = JSON.parse(sanitizedText);
      } catch (e) {
        console.error('Error parseando text (incluso tras saneamiento):', e);
        // Intentar parsear el original por si acaso
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