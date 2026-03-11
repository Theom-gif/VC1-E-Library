import axios from 'axios';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '');

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const relativeClient = axios.create({
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const getAuthToken = () =>
  localStorage.getItem('token') ||
  localStorage.getItem('access_token') ||
  localStorage.getItem('auth_token') ||
  localStorage.getItem('jwt');

client.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

relativeClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const request = async (method, path, body, options = {}) => {
  try {
    const response = await client.request({
      method,
      url: path,
      ...(body !== undefined ? { data: body } : {}),
      ...options,
    });
    return response.data ?? null;
  } catch (rawError) {
    if (!axios.isAxiosError(rawError)) throw rawError;

    const isNetworkError = !rawError.response && rawError.code === 'ERR_NETWORK';
    const canRetryRelative = typeof path === 'string' && path.startsWith('/');

    // If configured host is unreachable/CORS-blocked, retry same-origin path.
    if (isNetworkError && canRetryRelative) {
      try {
        const fallbackResponse = await relativeClient.request({
          method,
          url: path,
          ...(body !== undefined ? { data: body } : {}),
          ...options,
        });
        return fallbackResponse.data ?? null;
      } catch (fallbackError) {
        if (!axios.isAxiosError(fallbackError)) throw fallbackError;
      }
    }

    const status = rawError.response?.status ?? 0;
    const data = rawError.response?.data ?? null;
    const message =
      data?.message ||
      data?.error ||
      (isNetworkError
        ? `Network error: API unreachable or blocked (base URL: ${API_BASE_URL || 'same-origin'}).`
        : rawError.message) ||
      `Request failed with status ${status}`;

    const error = new Error(message);
    error.status = status;
    error.data = data;
    throw error;
  }
};

const apiClient = {
  get: (path, options) => request('GET', path, undefined, options),
  post: (path, body, options) => request('POST', path, body, options),
  put: (path, body, options) => request('PUT', path, body, options),
  patch: (path, body, options) => request('PATCH', path, body, options),
  delete: (path, options) => request('DELETE', path, undefined, options),
};

export { API_BASE_URL };
export default apiClient;
