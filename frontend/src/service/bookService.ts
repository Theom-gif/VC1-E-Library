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

export type ApiDownloadRecord = {
  id?: string | number;
  book_id?: string | number;
  local_identifier?: string;
  sync_status?: string;
  status?: string;
  book?: any;
  read_url?: string;
  download_url?: string;
  stream_url?: string;
  url?: string;
  created_at?: string;
  updated_at?: string;
};

export type CreateDownloadRecordPayload = {
  status?: string;
  size_bytes?: number;
  file_name?: string;
  mime_type?: string;
  local_identifier?: string;
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

type BookListAttempt = {
  path: string;
  params?: ListBooksParams;
  auth?: boolean;
};

const FALLBACK_BOOKS_PER_PAGE = 15;
const BOOK_LIST_TIMEOUT_MS = 45000;
const BOOK_LIST_ENDPOINTS: Array<{path: string; auth?: boolean}> = [
  // Public list (preferred for Home browsing)
  {path: '/api/books', auth: false},
  {path: '/api/books', auth: true},
  // Some backends expose books only under authenticated namespaces
  {path: '/api/auth/books', auth: true},
  // Alternative reader namespace
  {path: '/api/reader/books', auth: false},
  {path: '/api/reader/books', auth: true},
];

function pickString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function normalizeBookId(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw.startsWith('api-') ? raw.slice(4) : raw;
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

function asAbsoluteApiUrl(path: string): string {
  const raw = String(path || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = String(API_BASE_URL || '').replace(/\/+$/, '');
  if (!base) return raw.startsWith('/') ? raw : `/${raw.replace(/^\/+/, '')}`;

  const normalized = raw.startsWith('/') ? raw : `/${raw.replace(/^\/+/, '')}`;
  return `${base}${normalized}`;
}

function clampPositiveInteger(value: unknown): number | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return Math.floor(numeric);
}

function normalizeListParams(params?: ListBooksParams): ListBooksParams | undefined {
  if (!params) return undefined;

  const next: ListBooksParams = {...params};
  const page = clampPositiveInteger(next.page);
  const perPage = clampPositiveInteger(next.per_page);

  if (page === undefined) delete next.page;
  else next.page = page;

  if (perPage === undefined) delete next.per_page;
  else next.per_page = perPage;

  return next;
}

function omitPerPage(params?: ListBooksParams): ListBooksParams | undefined {
  if (!params || params.per_page === undefined) return params;
  const next = {...params};
  delete next.per_page;
  return next;
}

function withFallbackPerPage(params?: ListBooksParams): ListBooksParams | undefined {
  if (!params || params.per_page === undefined || params.per_page <= FALLBACK_BOOKS_PER_PAGE) return undefined;
  const next = {...params};
  next.per_page = FALLBACK_BOOKS_PER_PAGE;
  return next;
}

function buildListAttempts(params?: ListBooksParams): BookListAttempt[] {
  const normalized = normalizeListParams(params);
  const fallbackPerPage = withFallbackPerPage(normalized);
  const withoutPerPage = omitPerPage(normalized);
  const attempts: BookListAttempt[] = [];
  const seen = new Set<string>();

  const primaryAttempts: BookListAttempt[] = [];

  for (const endpoint of BOOK_LIST_ENDPOINTS) {
    primaryAttempts.push({path: endpoint.path, params: normalized, auth: endpoint.auth});
    primaryAttempts.push({path: endpoint.path, params: fallbackPerPage, auth: endpoint.auth});
    primaryAttempts.push({path: endpoint.path, params: withoutPerPage, auth: endpoint.auth});
  }

  for (const attempt of primaryAttempts) {
    const signature = JSON.stringify([
      attempt.path,
      attempt.auth !== false,
      attempt.params?.q ?? null,
      attempt.params?.category ?? null,
      attempt.params?.page ?? null,
      attempt.params?.per_page ?? null,
      attempt.params?.sort ?? null,
    ]);
    if (seen.has(signature)) continue;
    seen.add(signature);
    attempts.push(attempt);
  }

  return attempts;
}

function shouldRetryPrimaryListRequest(error: any): boolean {
  const status = Number(error?.status);
  // Network errors (CORS/DNS/SSL/etc) don't have a status. Retry other fallbacks.
  if (!Number.isFinite(status)) return true;
  return [401, 403, 404, 405, 408, 422, 500, 502, 503, 504].includes(status);
}

async function withResolverFallback<T>(paths: string[], fn: (path: string) => Promise<T>): Promise<T> {
  let lastError: any;
  for (const path of paths) {
    try {
      return await fn(path);
    } catch (error: any) {
      const status = Number(error?.status);
      if (status !== 404 && status !== 405) throw error;
      lastError = error;
    }
  }
  throw lastError || new Error('Download endpoint not found.');
}

// book mapping lives in ./bookMapper

export const bookService = {
  list: async (params?: ListBooksParams) => {
    const requestList = async ({path, params: queryParams, auth = true}: BookListAttempt) =>
      (await apiClient.get(withQuery(path, queryParams), {
        headers: {Accept: 'application/json'},
        auth,
        timeoutMs: BOOK_LIST_TIMEOUT_MS,
      })) as ApiEnvelope<any>;
    let payload: ApiEnvelope<any> | null = null;
    let lastError: any = null;
    let preferredError: any = null;

    for (const attempt of buildListAttempts(params)) {
      try {
        payload = await requestList(attempt);
        break;
      } catch (error: any) {
        lastError = error;
        const status = Number(error?.status);
        if (!preferredError && Number.isFinite(status) && status >= 500) preferredError = error;
        if (!shouldRetryPrimaryListRequest(error)) throw error;
      }
    }

    if (!payload) {
      throw preferredError || lastError || new Error('Unable to load books.');
    }

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
    const encodedId = encodeURIComponent(normalizeBookId(id));
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

  similar: (id: string) => apiClient.get(`/api/books/${encodeURIComponent(normalizeBookId(id))}/similar`),

  download: (id: string) =>
    withResolverFallback(
      [
        `/api/books/${encodeURIComponent(normalizeBookId(id))}/download`,
        `/api/books/${encodeURIComponent(normalizeBookId(id))}/downloads`,
      ],
      (path) => apiClient.post(path),
    ),

  downloadFileUrl: (id: string) => asAbsoluteApiUrl(`/api/books/${encodeURIComponent(normalizeBookId(id))}/download-file`),

  listDownloads: async () =>
    (await apiClient.get('/api/downloads', {
      headers: {Accept: 'application/json'},
    })) as ApiEnvelope<ApiDownloadRecord[]>,

  createDownloadRecord: async (id: string, payload?: CreateDownloadRecordPayload) =>
    (await withResolverFallback<ApiEnvelope<ApiDownloadRecord>>(
      [
        `/api/books/${encodeURIComponent(normalizeBookId(id))}/downloads`,
        '/api/downloads',
      ],
      (path) => {
        const body =
          path === '/api/downloads'
            ? {
                book_id: normalizeBookId(id),
                ...(payload || {}),
              }
            : payload;
        return apiClient.post(path, body, {headers: {Accept: 'application/json'}}) as any;
      },
    )) as ApiEnvelope<ApiDownloadRecord>,

  /**
   * Returns a URL that can be opened in a new tab for "Read Now".
   * Prefers a backend-provided `read_url`/`stream_url`/`download_url`.
   */
  readUrl: async (id: string) => {
    const encodedId = encodeURIComponent(normalizeBookId(id));
    return asAbsoluteApiUrl(`/api/books/${encodedId}/read`);
  },
};

export default bookService;
