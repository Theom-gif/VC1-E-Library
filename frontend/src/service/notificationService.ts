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

  listAuthor: (params?: ListNotificationsParams) =>
    withAliasFallback(['/api/author/notifications', '/api/notifications'], (path) =>
      apiClient.get(withQuery(path, params as any), {headers: {Accept: 'application/json'}}),
    ),

  listAdmin: (params?: ListNotificationsParams) =>
    withAliasFallback(['/api/admin/notifications', '/api/notifications'], (path) =>
      apiClient.get(withQuery(path, params as any), {headers: {Accept: 'application/json'}}),
    ),

  send: (payload: {title: string; message: string; type?: string; audience?: string; action_url?: string; user_id?: string}) =>
    apiClient.post('/api/admin/notifications/send', payload, {headers: {Accept: 'application/json'}}),

  create: (payload: {type?: string; title: string; message: string; action_url?: string; payload?: any; audience?: string}) =>
    withAliasFallback(['/api/user/notifications', '/api/notifications'], (path) =>
      apiClient.post(path, payload, {headers: {Accept: 'application/json'}}),
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

