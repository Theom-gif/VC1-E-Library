import apiClient, {API_BASE_URL} from './apiClient';
import {withQuery} from './queryString';
import type {BookType} from '../types';
import {isApprovedBook, toBookType} from './bookMapper';

export type ApiListMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  meta?: ApiListMeta;
};

export type ListBooksParams = {
  q?: string;
  category?: string;
  page?: number;
  per_page?: number;
  sort?: 'newest' | 'rating' | 'popular';
};

async function with404Fallback<T>(paths: string[], fn: (path: string) => Promise<T>): Promise<T> {
  let lastError: any;
  for (const path of paths) {
    try {
      return await fn(path);
    } catch (error: any) {
      if (Number(error?.status) !== 404) throw error;
      lastError = error;
    }
  }
  throw lastError || new Error('Books endpoint not found.');
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function asAbsoluteAssetUrl(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(https?:|data:)/i.test(raw)) return raw;

  const base = String(API_BASE_URL || '').replace(/\/+$/, '');
  const normalized = raw.replace(/^\/+/, '');

  if (!base) return raw.startsWith('/') ? raw : `/${normalized}`;
  if (raw.startsWith('/')) return `${base}/${normalized}`;
  if (normalized.startsWith('storage/')) return `${base}/${normalized}`;
  if (normalized.startsWith('uploads/') || normalized.startsWith('images/') || normalized.startsWith('assets/')) {
    return `${base}/${normalized}`;
  }
  return `${base}/storage/${normalized}`;
}

function asAbsoluteMaybeUrl(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^(https?:|data:)/i.test(raw)) return raw;
  return asAbsoluteAssetUrl(raw);
}

function pickUrlFromObject(obj: any): string {
  const direct = pickString(
    obj?.read_url,
    obj?.stream_url,
    obj?.download_url,
    obj?.file_url,
    obj?.book_file_url,
    obj?.pdf_url,
    obj?.epub_url,
    obj?.url,
    obj?.file,
    obj?.path,
    obj?.file_path,
  );
  return asAbsoluteMaybeUrl(direct);
}

// book mapping lives in ./bookMapper

export const bookService = {
  list: async (params?: ListBooksParams) => {
    const requestList = async (path: string) =>
      (await apiClient.get(withQuery(path, params), {
        headers: {Accept: 'application/json'},
      })) as ApiEnvelope<any>;

    const payload = await with404Fallback<ApiEnvelope<any>>(
      ['/api/books', '/api/auth/books', '/api/reader/books'],
      requestList,
    );

    const rawList =
      (Array.isArray((payload as any)?.data) && (payload as any).data) ||
      (Array.isArray((payload as any)?.data?.data) && (payload as any).data.data) ||
      (Array.isArray((payload as any)?.books) && (payload as any).books) ||
      (Array.isArray((payload as any)?.results) && (payload as any).results) ||
      [];

    const items = Array.isArray(rawList) ? rawList.filter(isApprovedBook).map(toBookType) : [];

    return {
      items,
      meta: payload?.meta,
      message: payload?.message,
      success: payload?.success,
      raw: payload,
    };
  },

  getById: async (id: string) => {
    const encodedId = encodeURIComponent(id);
    const payload = (await with404Fallback<ApiEnvelope<any>>(
      [`/api/books/${encodedId}`, `/api/auth/books/${encodedId}`, `/api/reader/books/${encodedId}`],
      (path) => apiClient.get(path, {headers: {Accept: 'application/json'}}) as any,
    )) as ApiEnvelope<any>;

    const rawBook = (payload as any)?.data ?? payload;
    return {
      item: rawBook ? toBookType(rawBook) : null,
      message: (payload as any)?.message,
      success: (payload as any)?.success,
      raw: payload,
    };
  },

  similar: (id: string) => apiClient.get(`/api/books/${encodeURIComponent(id)}/similar`),

  download: (id: string) => apiClient.post(`/api/books/${encodeURIComponent(id)}/download`),

  /**
   * Returns a URL that can be opened in a new tab for "Read Now".
   * Prefers a backend-provided `read_url`/`stream_url`/`download_url`.
   */
  readUrl: async (id: string) => {
    const encodedId = encodeURIComponent(id);

    // 1) Try book details first (some APIs include `file_url` etc).
    try {
      const details = await apiClient.get(`/api/books/${encodedId}`, {headers: {Accept: 'application/json'}});
      const urlFromDetails = pickUrlFromObject((details as any)?.data ?? details);
      if (urlFromDetails) return urlFromDetails;
    } catch {
      // Ignore and try download endpoint.
    }

    // 2) Fallback: use the download endpoint (expected to return a public/signed URL).
    const payload = await apiClient.post(`/api/books/${encodedId}/download`);
    const urlFromDownload = pickUrlFromObject((payload as any)?.data ?? payload);
    if (urlFromDownload) return urlFromDownload;

    throw new Error('Backend did not return a readable URL. Expected `read_url`, `stream_url`, or `download_url`.');
  },
};

export default bookService;
