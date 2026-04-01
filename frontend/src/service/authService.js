import apiClient from './apiClient';
import {normalizeAuthToken, readStoredAuthToken} from '../utils/authToken';

const TOKEN_KEYS = new Set([
  'token',
  'access_token',
  'accessToken',
  'auth_token',
  'jwt',
  'bearer_token',
  'plainTextToken',
  'plain_text_token',
]);

const pickString = (value) => {
  if (typeof value !== 'string') return '';
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : '';
};

const normalizeEmail = (value) => pickString(value).trim().toLowerCase();

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
  const normalized = normalizeAuthToken(token);
  if (normalized) {
    localStorage.setItem('token', normalized);
    try {
      window.dispatchEvent(new CustomEvent('elibrary-token-changed', {detail: normalized}));
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
  localStorage.removeItem('plainTextToken');
  localStorage.removeItem('plain_text_token');
  try {
    window.dispatchEvent(new CustomEvent('elibrary-token-changed', {detail: null}));
  } catch {
    // ignore
  }
};

export const authService = {
  login: async (credentials) => {
    const normalizedCredentials =
      credentials && typeof credentials === 'object'
        ? {...credentials, email: normalizeEmail(credentials.email)}
        : credentials;
    const loginPaths = ['/api/auth/login', '/api/login', '/login'];
    let lastError;

    for (const path of loginPaths) {
      try {
        const data = await apiClient.post(path, normalizedCredentials);
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
    const normalizedPayload =
      payload && typeof payload === 'object'
        ? {...payload, email: normalizeEmail(payload.email)}
        : payload;
    const registerPaths = [
      '/api/auth/register',
      '/api/auth/user_registration',
      '/api/register',
      '/register',
    ];
    let lastError;

    for (const path of registerPaths) {
      try {
        const data = await apiClient.post(path, normalizedPayload);
        storeToken(extractToken(data));
        return data;
      } catch (error) {
        if (error?.status !== 404) throw error;
        lastError = error;
      }
    }

    throw lastError || new Error('Registration endpoint not found');
  },

  authorRegister: async (payload) => {
    const normalizedPayload =
      payload && typeof payload === 'object'
        ? {...payload, email: normalizeEmail(payload.email)}
        : payload;
    const authorRegisterPaths = [
      '/api/auth/author_registration',
      '/api/auth/author-registration',
      '/api/auth/author_register',
    ];
    let lastError;

    for (const path of authorRegisterPaths) {
      try {
        return await apiClient.post(path, normalizedPayload);
      } catch (error) {
        if (error?.status !== 404) throw error;
        lastError = error;
      }
    }

    throw lastError || new Error('Author registration endpoint not found');
  },

  logout: async () => {
    try {
      await apiClient.post('/api/logout');
    } finally {
      clearToken();
    }
  },

  me: async () => {
    const paths = ['/api/me', '/api/me/profile', '/api/profile', '/me'];
    let lastError;
    for (const path of paths) {
      try {
        return await apiClient.get(path);
      } catch (error) {
        if (error?.status === 404 || error?.status === 401 || error?.status === 403) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }
    throw lastError || new Error('Profile endpoint not found');
  },

  getToken: () => readStoredAuthToken(),

  setToken: (token) => storeToken(token),

  clearToken,
};

export default authService;
