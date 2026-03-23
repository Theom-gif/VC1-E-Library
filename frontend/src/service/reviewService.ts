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
  listForBook: (bookId: string, params?: ListReviewsParams) =>
    withAliasFallback(
      [
        withQuery(`/api/books/${encodeURIComponent(bookId)}/comments`, params),
        withQuery(`/api/books/${encodeURIComponent(bookId)}/reviews`, params),
      ],
      (path) => apiClient.get(path),
    ),

  createForBook: (bookId: string, payload: CreateReviewPayload) =>
    withAliasFallback(
      [
        `/api/books/${encodeURIComponent(bookId)}/comments`,
        `/api/books/${encodeURIComponent(bookId)}/reviews`,
      ],
      (path) => apiClient.post(path, payload),
    ),

  update: (reviewId: string, payload: Partial<CreateReviewPayload>) =>
    withAliasFallback(
      [
        `/api/reviews/${encodeURIComponent(reviewId)}`,
        `/api/comments/${encodeURIComponent(reviewId)}`,
      ],
      (path) => apiClient.patch(path, payload),
    ),

  remove: (reviewId: string) =>
    withAliasFallback(
      [
        `/api/reviews/${encodeURIComponent(reviewId)}`,
        `/api/comments/${encodeURIComponent(reviewId)}`,
      ],
      (path) => apiClient.delete(path),
    ),

  like: (reviewId: string) =>
    withAliasFallback(
      [
        `/api/reviews/${encodeURIComponent(reviewId)}/like`,
        `/api/comments/${encodeURIComponent(reviewId)}/like`,
      ],
      (path) => apiClient.post(path),
    ),

  unlike: (reviewId: string) =>
    withAliasFallback(
      [
        `/api/reviews/${encodeURIComponent(reviewId)}/unlike`,
        `/api/comments/${encodeURIComponent(reviewId)}/unlike`,
      ],
      (path) => apiClient.post(path),
    ),
};

export default reviewService;

