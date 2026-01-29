import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const base64ToData = (base64Data: string): { data: string; mimeType: string } => {
  const [header, data] = base64Data.split(',');
  const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  return { data, mimeType };
};

export const parseReceiptImage = async (base64Image: string): Promise<ReceiptItem[]> => {
  try {
    const { data, mimeType } = base64ToData(base64Image);

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: data,
                mimeType: mimeType,
              },
            },
            {
              text: "Analiza este ticket de restaurante. Extrae todos los productos individuales. Para cada producto indica: descripción clara, cantidad y el precio total de esa línea. Ignora propinas, impuestos totales o descuentos generales. Si la cantidad no es clara, asume 1.",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { 
                    type: Type.STRING,
                    description: "Nombre del plato o bebida"
                  },
                  quantity: { 
                    type: Type.NUMBER,
                    description: "Cantidad de unidades"
                  },
                  priceTotal: { 
                    type: Type.NUMBER,
                    description: "Precio total de esta línea"
                  },
                },
                required: ["description", "quantity", "priceTotal"],
              },
            },
          },
          required: ["items"],
        },
      },
    });

    const textOutput = response.text || '{"items":[]}';
    const parsed = JSON.parse(textOutput);
    
    return (parsed.items || []).map((item: any, idx: number) => ({
      id: `item-${idx}-${Date.now()}`,
      description: item.description || "Producto desconocido",
      quantity: Number(item.quantity) || 1,
      priceTotal: Number(item.priceTotal) || 0,
      originalIndex: idx
    }));
  } catch (err) {
    console.error("Error parsing receipt with Gemini:", err);
    throw new Error("No pudimos procesar la imagen del ticket.");
  }
};
