// Normalizes a user-selected image into a compressed JPEG data URL that the OCR
// backend can reliably ingest. Solves two real-world failures:
//   1. Huge phone photos (10-20 MP) whose base64 blows the request size limit.
//   2. HEIC/HEIF images from iPhones, which most browsers and the backend can't
//      decode — we convert them to JPEG first.

const MAX_DIMENSION = 2000; // longest side, px — plenty for OCR, keeps payload small
const JPEG_QUALITY = 0.85;

const isHeic = (file: File): boolean => {
  const type = file.type.toLowerCase();
  if (type === 'image/heic' || type === 'image/heif') return true;
  // iOS frequently reports an empty MIME type for HEIC — fall back to extension.
  return /\.(heic|heif)$/i.test(file.name);
};

// Convert a HEIC/HEIF file to a JPEG blob using heic2any (lazy-loaded so the
// ~1.5 MB WASM decoder only downloads when a HEIC is actually selected).
const heicToJpegBlob = async (file: File): Promise<Blob> => {
  const mod: any = await import('heic2any');
  const heic2any = mod.default || mod;
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: JPEG_QUALITY });
  return Array.isArray(out) ? out[0] : (out as Blob);
};

// Decode a blob into something drawable, honoring EXIF orientation (iPhone
// photos are frequently rotated). Prefers createImageBitmap; falls back to an
// <img> element for browsers without it.
const decode = async (blob: Blob): Promise<ImageBitmap | HTMLImageElement> => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to <img> */
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode-failed')); };
    img.src = url;
  });
};

export async function processImageFile(file: File): Promise<string> {
  let source: Blob = file;

  if (isHeic(file)) {
    try {
      source = await heicToJpegBlob(file);
    } catch (e) {
      // Safari/iOS can decode HEIC natively in canvas, so if the conversion lib
      // fails we still try the raw file below before giving up.
      console.warn('heic2any conversion failed, trying native decode', e);
    }
  }

  let image: ImageBitmap | HTMLImageElement;
  try {
    image = await decode(source);
  } catch {
    // Last resort: if we'd swapped in a converted blob, retry with the original.
    if (source !== file) {
      image = await decode(file);
    } else {
      throw new Error('No se pudo leer la imagen. Prueba con una foto en formato JPG o PNG.');
    }
  }

  const w = (image as ImageBitmap).width || (image as HTMLImageElement).naturalWidth;
  const h = (image as ImageBitmap).height || (image as HTMLImageElement).naturalHeight;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(w, h));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen.');
  ctx.drawImage(image as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  if ('close' in image) image.close();

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
