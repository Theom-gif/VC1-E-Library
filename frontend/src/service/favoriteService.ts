import apiClient from './apiClient';

export const favoriteService = {
  list: () => apiClient.get('/api/favorites'),

  add: (bookId: string) => apiClient.post('/api/favorites', {book_id: bookId}),

  remove: (bookId: string) => apiClient.delete(`/api/favorites/${encodeURIComponent(bookId)}`),
};

export default favoriteService;

