import apiClient from './apiClient';
import {withQuery} from './queryString';
import type {BookType} from '../types';

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

function pickString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function pickNumber(...values: unknown[]): number {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && !Number.isNaN(n)) return n;
  }
  return 0;
}

function toBookType(raw: any): BookType {
  const id = pickString(raw?.id, raw?.book_id, raw?._id, raw?.uuid);
  const title = pickString(raw?.title, raw?.name);
  const author = pickString(raw?.author?.name, raw?.author_name, raw?.author);
  const category = pickString(raw?.category?.name, raw?.category_name, raw?.category, 'Uncategorized');
  const cover = pickString(
    raw?.cover,
    raw?.cover_url,
    raw?.cover_image,
    raw?.cover_image_url,
    raw?.image,
    raw?.image_url,
    raw?.thumbnail,
    raw?.thumbnail_url,
  );

  const safeCover = cover || (id ? `https://picsum.photos/seed/${encodeURIComponent(id)}/400/600` : 'https://picsum.photos/seed/book/400/600');

  return {
    id: id || `book_${Date.now()}`,
    title: title || 'Untitled',
    author: author || 'Unknown',
    cover: safeCover,
    category,
    rating: pickNumber(raw?.rating, raw?.avg_rating, raw?.average_rating),
    pages: raw?.pages !== undefined ? pickNumber(raw?.pages, raw?.page_count) : undefined,
    description: pickString(raw?.description, raw?.summary, raw?.about),
    reviews: raw?.reviews !== undefined ? pickNumber(raw?.reviews, raw?.reviews_count) : undefined,
  };
}

export const bookService = {
  list: async (params?: ListBooksParams) => {
    const payload = (await apiClient.get(withQuery('/api/books', params), {
      headers: {Accept: 'application/json'},
    })) as ApiEnvelope<any>;

    const items = Array.isArray(payload?.data) ? payload.data.map(toBookType) : [];

    return {
      items,
      meta: payload?.meta,
      message: payload?.message,
      success: payload?.success,
      raw: payload,
    };
  },

  getById: async (id: string) => {
    const payload = (await apiClient.get(`/api/books/${encodeURIComponent(id)}`, {
      headers: {Accept: 'application/json'},
    })) as ApiEnvelope<any>;

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
};

export default bookService;
