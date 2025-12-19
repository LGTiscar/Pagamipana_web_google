import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: any, res: any) {
  // Solo permitimos POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  // Verificamos que la clave de API esté configurada en el entorno
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "TU_API_KEY_AQUI") {
    console.error("ERROR: API_KEY no configurada en las variables de entorno de AWS.");
    return res.status(500).json({ 
      error: 'El servidor no tiene configurada la API Key de Gemini. Configúrala en la consola de AWS Amplify.' 
    });
  }

  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = image.split(',')[1] || image;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64,
            },
          },
          {
            text: `Eres un experto en tickets. Extrae los items en formato JSON. 
            Incluye descripción, cantidad y precioTotal. Ignora totales y propinas.`,
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
                  description: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  priceTotal: { type: Type.NUMBER }
                },
                required: ["description", "quantity", "priceTotal"]
              }
            }
          }
        }
      },
    });

    if (!response.text) {
      throw new Error("Gemini devolvió una respuesta vacía.");
    }

    const result = JSON.parse(response.text);
    return res.status(200).json(result);

  } catch (error: any) {
    console.error("Error en la Edge Function:", error);
    return res.status(500).json({ 
      error: 'Error al procesar con IA',
      details: error.message 
    });
  }
}