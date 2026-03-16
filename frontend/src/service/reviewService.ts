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

export const reviewService = {
  listForBook: (bookId: string, params?: ListReviewsParams) =>
    apiClient.get(withQuery(`/api/books/${encodeURIComponent(bookId)}/reviews`, params)),

  createForBook: (bookId: string, payload: CreateReviewPayload) =>
    apiClient.post(`/api/books/${encodeURIComponent(bookId)}/reviews`, payload),

  update: (reviewId: string, payload: Partial<CreateReviewPayload>) =>
    apiClient.patch(`/api/reviews/${encodeURIComponent(reviewId)}`, payload),

  remove: (reviewId: string) => apiClient.delete(`/api/reviews/${encodeURIComponent(reviewId)}`),

  like: (reviewId: string) => apiClient.post(`/api/reviews/${encodeURIComponent(reviewId)}/like`),

  unlike: (reviewId: string) => apiClient.post(`/api/reviews/${encodeURIComponent(reviewId)}/unlike`),
};

export default reviewService;

