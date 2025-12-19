import { ReceiptItem } from "../types";

export const parseReceiptImage = async (base64Image: string): Promise<ReceiptItem[]> => {
  // Creamos un controlador para poder cancelar la petición si tarda demasiado
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 40000); // 40 segundos de margen

  try {
    const response = await fetch('/api/parse-receipt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64Image }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = 'Error en el servidor';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.details || errorMessage;
      } catch (e) {
        if (response.status === 404) errorMessage = "No se encontró el endpoint /api/parse-receipt. Verifica la configuración de tu backend.";
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (!data.items || !Array.isArray(data.items)) {
      throw new Error("La respuesta del servidor no tiene el formato esperado.");
    }

    return data.items.map((item: any, index: number) => ({
      id: `item-${Date.now()}-${index}`,
      description: item.description,
      quantity: item.quantity || 1,
      priceTotal: item.priceTotal,
      originalIndex: index
    }));

  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error("El servidor tardó demasiado en responder. Inténtalo con una foto más ligera.");
    }
    console.error("Error en geminiService:", error);
    throw error;
  }
};