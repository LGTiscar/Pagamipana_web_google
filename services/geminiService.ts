import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseReceiptImage = async (base64Image: string): Promise<ReceiptItem[]> => {
  try {
    // Remove header if present (data:image/jpeg;base64,)
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64,
            },
          },
          {
            text: `
            Eres un experto en OCR que se ocupa de analizar imagenes de ticket restaurante para extraer los nombres y cantidades de productos del ticket.
            Analiza esta imagen de un ticket de restaurante. 
            Extrae cada línea de producto.
            Si un producto tiene cantidad mayor a 1 (ej: "2x Cerveza"), devuélvelo como un solo producto con cantidad 2.
            Ignora subtotales, totales, impuestos o propinas, solo quiero los productos consumibles.
            Devuelve un JSON estricto.`,
          },
        ],
      },
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
                  description: { type: Type.STRING, description: "Nombre del producto" },
                  quantity: { type: Type.NUMBER, description: "Cantidad de unidades" },
                  priceTotal: { type: Type.NUMBER, description: "Precio TOTAL por esa línea (precio unitario * cantidad)" }
                },
                required: ["description", "quantity", "priceTotal"]
              }
            }
          }
        }
      },
    });

    const text = response.text;
    if (!text) throw new Error("No text returned from Gemini");

    const data = JSON.parse(text);
    
    // Transform into internal ReceiptItem structure with IDs
    return data.items.map((item: any, index: number) => ({
      id: `item-${Date.now()}-${index}`,
      description: item.description,
      quantity: item.quantity || 1,
      priceTotal: item.priceTotal,
      originalIndex: index
    }));

  } catch (error) {
    console.error("Error parsing receipt:", error);
    throw error;
  }
};