import apiClient from './apiClient';

export const profileService = {
  me: () => apiClient.get('/api/me'),

  updateProfile: (payload: {name?: string; photo?: string}) => apiClient.patch('/api/me', payload),

  updateSettings: (payload: Record<string, unknown>) => apiClient.patch('/api/me/settings', payload),
};

export default profileService;

