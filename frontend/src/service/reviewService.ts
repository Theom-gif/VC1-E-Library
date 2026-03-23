import apiClient from './apiClient';
import {withQuery} from './queryString';

export type ListReviewsParams = {
  page?: number;
  per_page?: number;
  sort?: 'newest' | 'top';
};

export type CreateReviewPayload = {
  text: string;
  rating: number;
};

function buildReviewBody(payload: Partial<CreateReviewPayload>) {
  const text = String(payload?.text ?? '').trim();
  const rating = payload?.rating;

  // Support backend variants:
  // - Some APIs expect `text`
  // - Others expect `content`
  // Send both to maximize compatibility.
  const body: Record<string, unknown> = {};
  if (text) {
    body.text = text;
    body.content = text;
  }
  if (rating !== undefined) {
    body.rating = rating;
    body.stars = rating;
  }
  return body;
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
  throw lastError || new Error('Review endpoint not found.');
}

export const reviewService = {
  listForBook: async (bookId: string, params?: ListReviewsParams) => {
    const paths = [
      withQuery(`/api/books/${encodeURIComponent(bookId)}/comments`, params),
      withQuery(`/api/books/${encodeURIComponent(bookId)}/reviews`, params),
    ];

    // Prefer unauthenticated requests first to avoid CORS preflight failures when a token exists.
    try {
      return await withAliasFallback(paths, (path) =>
        apiClient.get(path, {auth: false, headers: {Accept: 'application/json'}}),
      );
    } catch (error: any) {
      const status = Number(error?.status);
      if (status !== 401 && status !== 403) throw error;
    }

    // If the backend requires auth for listing, retry with the bearer token.
    return withAliasFallback(paths, (path) => apiClient.get(path, {headers: {Accept: 'application/json'}}));
  },

  createForBook: (bookId: string, payload: CreateReviewPayload) =>
    withAliasFallback(
      [
        `/api/books/${encodeURIComponent(bookId)}/comments`,
        `/api/books/${encodeURIComponent(bookId)}/reviews`,
      ],
      (path) => apiClient.post(path, buildReviewBody(payload), {headers: {Accept: 'application/json'}}),
    ),

  update: (reviewId: string, payload: Partial<CreateReviewPayload>) =>
    withAliasFallback(
      [
        `/api/reviews/${encodeURIComponent(reviewId)}`,
        `/api/comments/${encodeURIComponent(reviewId)}`,
      ],
      (path) => apiClient.patch(path, buildReviewBody(payload), {headers: {Accept: 'application/json'}}),
    ),

  remove: (reviewId: string) =>
    withAliasFallback(
      [
        `/api/reviews/${encodeURIComponent(reviewId)}`,
        `/api/comments/${encodeURIComponent(reviewId)}`,
      ],
      (path) => apiClient.delete(path, {headers: {Accept: 'application/json'}}),
    ),

  like: (reviewId: string) =>
    withAliasFallback(
      [
        `/api/reviews/${encodeURIComponent(reviewId)}/like`,
        `/api/comments/${encodeURIComponent(reviewId)}/like`,
      ],
      (path) => apiClient.post(path, undefined, {headers: {Accept: 'application/json'}}),
    ),

  unlike: (reviewId: string) =>
    withAliasFallback(
      [
        `/api/reviews/${encodeURIComponent(reviewId)}/unlike`,
        `/api/comments/${encodeURIComponent(reviewId)}/unlike`,
      ],
      (path) => apiClient.post(path, undefined, {headers: {Accept: 'application/json'}}),
    ),
};

export default reviewService;

