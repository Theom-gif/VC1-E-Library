import apiClient, {API_BASE_URL} from './apiClient';
import {withQuery} from './queryString';
import bookService from './bookService';

export type AuthorType = {
  id: string;
  name: string;
  bio?: string;
  photo?: string;
  followers?: number;
  avg_rating?: number;
  books_count?: number;
};

export type ListAuthorsParams = {
  q?: string;
  page?: number;
  per_page?: number;
};

type ApiListMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  meta?: ApiListMeta;
};

function pickString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function toNonNegativeNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return undefined;
  return numeric;
}

function asAbsoluteAssetUrl(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^(https?:|data:)/i.test(raw)) return raw;

  const base = String(API_BASE_URL || '').replace(/\/+$/, '');
  const normalized = raw.replace(/^\/+/, '');

  if (!base) return raw.startsWith('/') ? raw : `/${normalized}`;
  if (raw.startsWith('/')) return `${base}/${normalized}`;
  if (normalized.startsWith('storage/')) return `${base}/${normalized}`;
  return `${base}/storage/${normalized}`;
}

function normalizeAuthor(raw: any, index: number): AuthorType | null {
  const name = pickString(raw?.name, raw?.author_name, raw?.title);
  if (!name) return null;

  const id = pickString(raw?.id, raw?.author_id, raw?.slug) || `author-${index + 1}`;
  return {
    id,
    name,
    bio: pickString(raw?.bio, raw?.description) || undefined,
    photo: asAbsoluteAssetUrl(raw?.photo ?? raw?.avatar ?? raw?.image_url) || undefined,
    followers: toNonNegativeNumber(raw?.followers),
    avg_rating: toNonNegativeNumber(raw?.avg_rating ?? raw?.average_rating),
    books_count: toNonNegativeNumber(raw?.books_count ?? raw?.book_count),
  };
}

function extractAuthorList(payload: any): AuthorType[] {
  const list =
    (Array.isArray(payload?.data) && payload.data) ||
    (Array.isArray(payload?.data?.data) && payload.data.data) ||
    (Array.isArray(payload?.authors) && payload.authors) ||
    (Array.isArray(payload) && payload) ||
    [];

  return list
    .map((item: any, index: number) => normalizeAuthor(item, index))
    .filter(Boolean) as AuthorType[];
}

function mapAuthorsFromBooks(books: Array<{author?: string; rating?: number}>): AuthorType[] {
  const map = new Map<string, {name: string; books_count: number; rating_total: number}>();
  for (const book of books) {
    const name = pickString(book?.author, 'Unknown Author');
    if (!map.has(name)) {
      map.set(name, {name, books_count: 0, rating_total: 0});
    }
    const item = map.get(name)!;
    item.books_count += 1;
    item.rating_total += Number(book?.rating || 0);
  }

  return Array.from(map.values())
    .map((item, index) => ({
      id: `books-${index + 1}`,
      name: item.name,
      books_count: item.books_count,
      avg_rating: item.books_count > 0 ? Number((item.rating_total / item.books_count).toFixed(1)) : undefined,
      bio: `${item.name} appears in the current library catalog.`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const authorService = {
  list: async (params?: ListAuthorsParams) => {
    const path = withQuery('/api/authors', params);
    try {
      const payload = (await apiClient.get(path, {headers: {Accept: 'application/json'}, auth: false})) as ApiEnvelope<any>;
      return {
        items: extractAuthorList(payload),
        meta: payload?.meta,
        message: payload?.message,
        success: payload?.success,
        source: 'authors-endpoint' as const,
      };
    } catch (error: any) {
      const status = Number(error?.status);
      if (![401, 403, 404, 405].includes(status)) throw error;
    }

    const fallbackBooks = await bookService.list({
      q: params?.q,
      page: params?.page,
      per_page: params?.per_page || 50,
    });

    return {
      items: mapAuthorsFromBooks(fallbackBooks.items),
      meta: fallbackBooks.meta,
      message: 'Authors endpoint unavailable. Derived authors from books list.',
      success: true,
      source: 'books-fallback' as const,
    };
  },
};

export default authorService;

