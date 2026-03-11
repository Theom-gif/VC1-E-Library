import apiClient from './apiClient';

const extractToken = (data) =>
  data?.token ||
  data?.access_token ||
  data?.accessToken ||
  data?.data?.token ||
  data?.data?.access_token ||
  data?.data?.accessToken ||
  data?.data?.data?.token ||
  data?.data?.data?.access_token ||
  data?.data?.data?.accessToken;

const storeToken = (token) => {
  if (token) {
    localStorage.setItem('token', token);
    localStorage.setItem('access_token', token);
  }
};

const clearToken = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('access_token');
};

export const authService = {
  login: async (credentials) => {
    const loginPaths = ['/api/auth/login', '/api/login', '/login'];
    let lastError;

    for (const path of loginPaths) {
      try {
        const data = await apiClient.post(path, credentials);
        storeToken(extractToken(data));
        return data;
      } catch (error) {
        if (error?.status !== 404) throw error;
        lastError = error;
      }
    }

    throw lastError || new Error('Login endpoint not found');
  },

  register: async (payload) => {
    const registerPaths = [
      '/api/auth/user_registration',
      '/api/auth/register',
      '/api/register',
      '/register',
    ];
    let lastError;

    for (const path of registerPaths) {
      try {
        const data = await apiClient.post(path, payload);
        storeToken(extractToken(data));
        return data;
      } catch (error) {
        if (error?.status !== 404) throw error;
        lastError = error;
      }
    }

    throw lastError || new Error('Registration endpoint not found');
  },

  logout: async () => {
    try {
      await apiClient.post('/api/logout');
    } finally {
      clearToken();
    }
  },

  me: () => apiClient.get('/api/me'),

  getToken: () => localStorage.getItem('token'),

  setToken: (token) => storeToken(token),

  clearToken,
};

export default authService;
