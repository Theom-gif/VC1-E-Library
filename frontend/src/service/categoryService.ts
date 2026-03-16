import apiClient from './apiClient';
import {withQuery} from './queryString';

export type ListCategoryBooksParams = {
  q?: string;
  page?: number;
  per_page?: number;
};

export const categoryService = {
  list: () => apiClient.get('/api/categories'),

  getById: (id: string) => apiClient.get(`/api/categories/${encodeURIComponent(id)}`),

  books: (categoryId: string, params?: ListCategoryBooksParams) =>
    apiClient.get(withQuery(`/api/categories/${encodeURIComponent(categoryId)}/books`, params)),
};

export default categoryService;

