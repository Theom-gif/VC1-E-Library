import apiClient from './apiClient';
import {withQuery} from './queryString';

export type ListNotificationsParams = {
  page?: number;
  per_page?: number;
  unread?: 1 | 0 | boolean;
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
  throw lastError || new Error('Notification endpoint not found.');
}

export const notificationService = {
  list: (params?: ListNotificationsParams) =>
    withAliasFallback(['/api/user/notifications', '/api/notifications'], (path) =>
      apiClient.get(withQuery(path, params as any), {headers: {Accept: 'application/json'}}),
    ),

  markAllRead: () =>
    withAliasFallback(['/api/notifications/read-all', '/api/user/notifications/read-all'], (path) =>
      apiClient.post(path, undefined, {headers: {Accept: 'application/json'}}),
    ),

  markRead: (id: string) =>
    withAliasFallback(
      [`/api/user/notifications/${encodeURIComponent(id)}/read`, `/api/notifications/${encodeURIComponent(id)}/read`],
      (path) =>
        path.startsWith('/api/user/')
          ? apiClient.post(path, undefined, {headers: {Accept: 'application/json'}})
          : apiClient.patch(path, undefined, {headers: {Accept: 'application/json'}}),
    ),

  remove: (id: string) =>
    withAliasFallback(
      [`/api/user/notifications/${encodeURIComponent(id)}`, `/api/notifications/${encodeURIComponent(id)}`],
      (path) => apiClient.delete(path, {headers: {Accept: 'application/json'}}),
    ),
};

export default notificationService;

