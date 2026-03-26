export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const ALLOWED_AVATAR_MIME = new Set(['image/png', 'image/jpeg']);
export const MAX_NAME_LENGTH = 80;
export const MAX_BIO_LENGTH = 280;

export function validateRequiredText(value: string, maxLen?: number): string {
  const normalized = String(value || '').trim();
  if (!normalized) return 'required';
  if (maxLen && normalized.length > maxLen) return 'too_long';
  return '';
}

export function validateBio(value: string): string {
  const normalized = String(value || '').trim();
  if (normalized.length > MAX_BIO_LENGTH) return 'too_long';
  return '';
}

export function validateHttpUrl(value: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'invalid';
    return '';
  } catch {
    return 'invalid';
  }
}

export function validateAvatarFile(file: File): string {
  if (!ALLOWED_AVATAR_MIME.has(String(file?.type || ''))) return 'invalid_type';
  if (Number(file?.size || 0) > MAX_AVATAR_BYTES) return 'too_large';
  return '';
}

