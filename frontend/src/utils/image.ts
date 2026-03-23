type ResizeImageOptions = {
  maxWidth?: number;
  maxHeight?: number;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  quality?: number;
  backgroundColor?: string;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image.'));
    img.src = dataUrl;
  });
}

function clampNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && !Number.isNaN(n) ? n : fallback;
}

export async function resizeImageFileToDataUrl(file: File, options: ResizeImageOptions = {}): Promise<string> {
  const maxWidth = Math.max(1, Math.round(clampNumber(options.maxWidth, 512)));
  const maxHeight = Math.max(1, Math.round(clampNumber(options.maxHeight, 512)));
  const mimeType = options.mimeType || 'image/jpeg';
  const quality = Math.min(1, Math.max(0.4, clampNumber(options.quality, 0.86)));
  const backgroundColor = options.backgroundColor || '#ffffff';

  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(rawDataUrl);

  const inputWidth = Math.max(1, img.naturalWidth || img.width || 1);
  const inputHeight = Math.max(1, img.naturalHeight || img.height || 1);
  const scale = Math.min(1, maxWidth / inputWidth, maxHeight / inputHeight);

  const outputWidth = Math.max(1, Math.round(inputWidth * scale));
  const outputHeight = Math.max(1, Math.round(inputHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return rawDataUrl;

  if (mimeType === 'image/jpeg') {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, outputWidth, outputHeight);
  }

  ctx.drawImage(img, 0, 0, outputWidth, outputHeight);

  try {
    return canvas.toDataURL(mimeType, quality);
  } catch {
    return rawDataUrl;
  }
}

