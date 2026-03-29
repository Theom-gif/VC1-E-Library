import apiClient from './apiClient';

const TOKEN_KEYS = new Set([
  'token',
  'access_token',
  'accessToken',
  'auth_token',
  'jwt',
  'bearer_token',
]);

const pickString = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : '';
};

const findTokenDeep = (value, depth = 0) => {
  if (!value || depth > 6) return '';
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTokenDeep(item, depth + 1);
      if (found) return found;
    }
    return '';
  }
  if (typeof value !== 'object') return '';

  for (const [k, v] of Object.entries(value)) {
    if (TOKEN_KEYS.has(k)) {
      const found = pickString(v);
      if (found) return found;
    }
  }

  for (const v of Object.values(value)) {
    const found = findTokenDeep(v, depth + 1);
    if (found) return found;
  }

  return '';
};

const extractToken = (data) =>
  pickString(data?.token) ||
  pickString(data?.access_token) ||
  pickString(data?.data?.token) ||
  pickString(data?.data?.access_token) ||
  findTokenDeep(data);

const storeToken = (token) => {
  if (token) {
    localStorage.setItem('token', token);
    try {
      window.dispatchEvent(new CustomEvent('elibrary-token-changed', {detail: token}));
    } catch {
      // ignore
    }
  }
};

const clearToken = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('access_token');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('jwt');
  localStorage.removeItem('bearer_token');
  try {
    window.dispatchEvent(new CustomEvent('elibrary-token-changed', {detail: null}));
  } catch {
    // ignore
  }
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
      '/api/auth/register',
      '/api/auth/user_registration',
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

  getToken: () =>
    localStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('jwt') ||
    localStorage.getItem('bearer_token'),

  setToken: (token) => storeToken(token),

  clearToken,
};

export default authService;
