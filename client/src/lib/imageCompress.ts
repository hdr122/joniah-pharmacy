/**
 * Resize and compress an image in the browser before uploading.
 *
 * Uploads are embedded in the database on self-hosted deployments, so the
 * payload has to stay small. This scales the image down to fit `maxSize` and
 * steps the JPEG quality down until the result fits `maxBytes`.
 */
export interface CompressedImage {
  /** Raw base64 (no data: prefix) — what the upload endpoints expect */
  base64: string;
  mimeType: string;
  bytes: number;
}

export async function compressImage(
  file: File,
  { maxSize = 512, maxBytes = 40_000 }: { maxSize?: number; maxBytes?: number } = {}
): Promise<CompressedImage> {
  const bitmap = await loadImage(file);

  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر معالجة الصورة");
  ctx.drawImage(bitmap, 0, 0, width, height);

  // Step quality down until the encoded image fits the budget
  for (const quality of [0.8, 0.65, 0.5, 0.4, 0.3]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const base64 = dataUrl.split(",")[1] ?? "";
    const bytes = Math.floor((base64.length * 3) / 4);
    if (bytes <= maxBytes) {
      return { base64, mimeType: "image/jpeg", bytes };
    }
  }

  // Last resort: shrink dimensions further at the lowest quality
  const smallCanvas = document.createElement("canvas");
  smallCanvas.width = Math.max(1, Math.round(width / 2));
  smallCanvas.height = Math.max(1, Math.round(height / 2));
  const smallCtx = smallCanvas.getContext("2d");
  if (!smallCtx) throw new Error("تعذر معالجة الصورة");
  smallCtx.drawImage(bitmap, 0, 0, smallCanvas.width, smallCanvas.height);
  const dataUrl = smallCanvas.toDataURL("image/jpeg", 0.4);
  const base64 = dataUrl.split(",")[1] ?? "";
  return { base64, mimeType: "image/jpeg", bytes: Math.floor((base64.length * 3) / 4) };
}

async function loadImage(file: File): Promise<HTMLImageElement | ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Safari/older browsers: fall through to the <img> path
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("تعذر قراءة الصورة"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
