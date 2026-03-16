import apiClient from './apiClient';

export const notificationService = {
  list: () => apiClient.get('/api/notifications'),

  markAllRead: () => apiClient.post('/api/notifications/read-all'),

  markRead: (id: string) => apiClient.patch(`/api/notifications/${encodeURIComponent(id)}/read`),

  remove: (id: string) => apiClient.delete(`/api/notifications/${encodeURIComponent(id)}`),
};

export default notificationService;

