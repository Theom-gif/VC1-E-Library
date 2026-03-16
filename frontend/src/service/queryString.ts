export type QueryValue = string | number | boolean | null | undefined;

type QueryParams = Record<string, QueryValue | QueryValue[]>;

export function withQuery(path: string, params?: QueryParams): string {
  if (!params) return path;

  const entries: Array<[string, QueryValue]> = [];
  for (const [key, raw] of Object.entries(params)) {
    if (Array.isArray(raw)) {
      for (const value of raw) entries.push([key, value]);
      continue;
    }
    entries.push([key, raw]);
  }

  const parts = entries
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

  if (!parts.length) return path;
  return `${path}${path.includes('?') ? '&' : '?'}${parts.join('&')}`;
}

