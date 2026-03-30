const DEFAULT_TOKEN_KEYS = [
  'token',
  'access_token',
  'accessToken',
  'auth_token',
  'jwt',
  'bearer_token',
  'plainTextToken',
  'plain_text_token',
];

export function normalizeAuthToken(raw: unknown): string {
  if (typeof raw !== 'string') return '';

  let token = raw.trim();
  if (!token) return '';

  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    token = token.slice(1, -1).trim();
  }

  token = token.replace(/^authorization\s*:\s*/i, '').trim();
  token = token.replace(/^bearer\s+/i, '').trim();

  return token;
}

export function readStoredAuthToken(keys: string[] = DEFAULT_TOKEN_KEYS): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    for (const key of keys) {
      const normalized = normalizeAuthToken(localStorage.getItem(key));
      if (normalized) return normalized;
    }
    return null;
  } catch {
    return null;
  }
}

