import apiClient from './apiClient';

export type BookRatingsDistribution = Record<string, number>;

export type BookRatingsSummary = {
  book_id: string;
  average_rating: number;
  total_ratings: number;
  distribution: BookRatingsDistribution;
  user_rating: number | null;
};

export type SubmitBookRatingPayload = {
  rating: number;
};

function normalizeBookId(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw.startsWith('api-') ? raw.slice(4) : raw;
}

function coerceInteger(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function coerceNumber(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n;
}

function normalizeDistribution(value: any): BookRatingsDistribution {
  const source = value && typeof value === 'object' ? value : {};
  return {
    '1': coerceInteger(source?.['1']),
    '2': coerceInteger(source?.['2']),
    '3': coerceInteger(source?.['3']),
    '4': coerceInteger(source?.['4']),
    '5': coerceInteger(source?.['5']),
  };
}

function normalizeSummary(payload: any, fallbackBookId: string): BookRatingsSummary {
  const source = payload?.data ?? payload;
  const normalizedBookId = String(source?.book_id ?? fallbackBookId ?? '').trim();
  const userRatingRaw = source?.user_rating;
  const userRating = userRatingRaw === null || userRatingRaw === undefined ? null : coerceInteger(userRatingRaw);

  return {
    book_id: normalizedBookId,
    average_rating: coerceNumber(source?.average_rating),
    total_ratings: coerceInteger(source?.total_ratings),
    distribution: normalizeDistribution(source?.distribution),
    user_rating: userRating && userRating >= 1 && userRating <= 5 ? userRating : null,
  };
}

async function withAliasFallback<T>(paths: string[], fn: (path: string) => Promise<T>): Promise<T> {
  let lastError: any;
  for (const path of paths) {
    try {
      return await fn(path);
    } catch (error: any) {
      if (Number(error?.status) !== 404) throw error;
      lastError = error;
    }
  }
  throw lastError || new Error('Ratings endpoint not found.');
}

export const ratingService = {
  getForBook: async (bookId: string): Promise<BookRatingsSummary> => {
    const normalizedBookId = normalizeBookId(bookId);
    const payload = await withAliasFallback(
      [
        `/api/books/${encodeURIComponent(normalizedBookId)}/ratings`,
        `/api/books/${encodeURIComponent(normalizedBookId)}/rating`,
        `/api/ratings/${encodeURIComponent(normalizedBookId)}`,
      ],
      (path) => apiClient.get(path, {headers: {Accept: 'application/json'}}),
    );

    return normalizeSummary(payload, normalizedBookId);
  },

  submitForBook: async (bookId: string, payload: SubmitBookRatingPayload): Promise<BookRatingsSummary> => {
    const normalizedBookId = normalizeBookId(bookId);
    const response = await withAliasFallback(
      [
        `/api/books/${encodeURIComponent(normalizedBookId)}/ratings`,
        `/api/books/${encodeURIComponent(normalizedBookId)}/rating`,
      ],
      (path) => apiClient.post(path, payload, {headers: {Accept: 'application/json'}}),
    );

    return normalizeSummary(response, normalizedBookId);
  },
};

export default ratingService;
