import apiClient from './apiClient';

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
  throw lastError || new Error('Favorites endpoint not found.');
}

export const favoriteService = {
  list: () =>
    with404Fallback(['/api/favorites', '/api/auth/favorites'], (path) =>
      apiClient.get(path, {headers: {Accept: 'application/json'}}),
    ),

  add: (bookId: string) =>
    with404Fallback(['/api/favorites', '/api/auth/favorites'], (path) =>
      apiClient.post(
        path,
        {
          book_id: bookId,
          bookId,
          id: bookId,
        },
        {headers: {Accept: 'application/json'}},
      ),
    ),

  remove: (bookId: string) =>
    with404Fallback(
      [`/api/favorites/${encodeURIComponent(bookId)}`, `/api/auth/favorites/${encodeURIComponent(bookId)}`],
      (path) => apiClient.delete(path, {headers: {Accept: 'application/json'}}),
    ),
};

export default favoriteService;

