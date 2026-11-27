export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxDataUrlLength?: number;
}

const DEFAULT_MAX_DATA_URL_LENGTH = 360_000;

function readBlobAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Format gambar tidak didukung oleh browser.'));
    img.src = src;
  });
}

export function compressCanvasToJpegDataUrl(
  canvas: HTMLCanvasElement,
  initialQuality = 0.75,
  maxDataUrlLength = DEFAULT_MAX_DATA_URL_LENGTH
): string {
  const candidates = Array.from(
    new Set([initialQuality, 0.65, 0.55, 0.45, 0.35].filter(q => q <= initialQuality && q > 0))
  );
  let output = canvas.toDataURL('image/jpeg', candidates[0] ?? 0.75);
  for (const q of candidates.slice(1)) {
    if (output.length <= maxDataUrlLength) break;
    output = canvas.toDataURL('image/jpeg', q);
  }
  if (!output.startsWith('data:image/jpeg;base64,/')) {
    throw new Error('Hasil kompresi gambar tidak valid.');
  }
  return output;
}

/**
 * Compresses camera / gallery photos client-side before upload:
 * resizes longest edge to max 1024px and encodes JPEG at quality ~0.75
 * so mobile 4G uploads shrink from ~2-5MB down to ~80-220KB.
 */
export async function compressImageToJpeg(
  source: File | Blob | string,
  options: ImageCompressionOptions = {}
): Promise<string> {
  const {
    maxWidth = 1024,
    maxHeight = 1024,
    quality = 0.75,
    maxDataUrlLength = DEFAULT_MAX_DATA_URL_LENGTH
  } = options;

  const rawDataUrl = typeof source === 'string' ? source : await readBlobAsDataUrl(source);
  if (!rawDataUrl) {
    throw new Error('Data gambar kosong.');
  }

  const img = await loadImageElement(rawDataUrl);
  const srcWidth = img.naturalWidth || img.width || 800;
  const srcHeight = img.naturalHeight || img.height || 600;
  const scale = Math.min(1, maxWidth / srcWidth, maxHeight / srcHeight);
  const targetWidth = Math.max(160, Math.round(srcWidth * scale));
  const targetHeight = Math.max(160, Math.round(srcHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Kanvas pemrosesan foto tidak tersedia.');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  return compressCanvasToJpegDataUrl(canvas, quality, maxDataUrlLength);
}

/**
 * Exports a compact signature image from a canvas (1x logical size) so 4-signature
 * departure forms stay lightweight (~15-30KB each instead of hundreds of KB).
 */
export function exportCompactSignatureDataUrl(canvas: HTMLCanvasElement): string {
  const maxWidth = 360;
  if (canvas.width <= maxWidth) {
    return canvas.toDataURL('image/png');
  }
  const ratio = maxWidth / canvas.width;
  const out = document.createElement('canvas');
  out.width = maxWidth;
  out.height = Math.max(80, Math.round(canvas.height * ratio));
  const ctx = out.getContext('2d', { alpha: false });
  if (!ctx) return canvas.toDataURL('image/png');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}
