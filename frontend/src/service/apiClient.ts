import {readStoredAuthToken} from '../utils/authToken';

type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiClientOptions = Omit<RequestInit, 'method' | 'body'> & {
  timeoutMs?: number;
  body?: unknown;
  auth?: boolean;
};

export class ApiClientError extends Error {
  status?: number;
  data?: unknown;
  method?: ApiMethod;
  url?: string;
}

const PRODUCTION_HOSTNAME = 'elibrary.pncproject.site';
const PRODUCTION_BASE_URL = `https://${PRODUCTION_HOSTNAME}`;
const VITE_ENV = (import.meta as any)?.env || {};

function hasNonEmptyValue(value: unknown): boolean {
  return String(value ?? '').trim().length > 0;
}

const HAS_EXPLICIT_API_BASE_URL = hasNonEmptyValue(VITE_ENV?.VITE_API_URL) || hasNonEmptyValue(VITE_ENV?.VITE_API_BASE_URL);

function defaultBaseUrl(): string {
  const viteEnv = (import.meta as any)?.env;
  if (viteEnv?.DEV) {
    // In dev, prefer same-origin + Vite proxy to avoid CORS failures.
    return '';
  }

  if (typeof globalThis !== 'undefined' && globalThis.location) {
    const protocol = String(globalThis.location.protocol || 'https:');
    const hostname = String(globalThis.location.hostname || '');
    const port = String(globalThis.location.port || '');

    const safeProtocol = protocol === 'http:' || protocol === 'https:' ? protocol : 'https:';
    const origin = `${safeProtocol}//${hostname}${port ? `:${port}` : ''}`;
    const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);

    // In dev (Vite), prefer same-origin so the Vite proxy can forward /api and /storage
    // without CORS headaches. Override with VITE_API_URL (or VITE_API_BASE_URL) if your backend is elsewhere.
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') return origin;
    if ((import.meta as any)?.env?.DEV && isIpv4) return origin;

    if (hostname) {
      if (hostname === PRODUCTION_HOSTNAME) return PRODUCTION_BASE_URL;

      // If the frontend is hosted on a raw IP in production, it's usually a static host without `/api` routes.
      // Default to the known backend domain instead of calling the same IP (which would 404).
      if (!(import.meta as any)?.env?.DEV && isIpv4) return PRODUCTION_BASE_URL;

      if (port && port !== '80' && port !== '443') return origin;
      return `${safeProtocol}//${hostname}`;
    }
  }

  return PRODUCTION_BASE_URL;
}

const API_BASE_URL = String(
  String(import.meta.env.VITE_API_URL || '').trim() ||
    String(import.meta.env.VITE_API_BASE_URL || '').trim() ||
    defaultBaseUrl(),
).replace(/\/+$/, '');

function buildUrl(path: string): string {
  if (!path) return API_BASE_URL || '';
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function buildProductionUrl(path: string): string {
  if (!path) return PRODUCTION_BASE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${PRODUCTION_BASE_URL}${normalizedPath}`;
}

function shouldFallbackToProduction(path: string, url: string): boolean {
  const viteEnv = (import.meta as any)?.env;
  if (viteEnv?.DEV) return false;
  if (HAS_EXPLICIT_API_BASE_URL) return false;
  if (!path || /^https?:\/\//i.test(path)) return false;

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!/^\/(api|storage)(\/|$)/i.test(normalizedPath)) return false;

  try {
    const parsed = new URL(url);
    return parsed.hostname !== PRODUCTION_HOSTNAME;
  } catch {
    return true;
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  const hasJson = contentType.includes('application/json') || contentType.includes('+json');

  if (hasJson) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  const text = await response.text();
  return text || null;
}

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object';
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

async function request(method: ApiMethod, path: string, options: ApiClientOptions = {}) {
  const url = buildUrl(path);
  const shouldFallback = shouldFallbackToProduction(path, url);
  const fallbackUrl = shouldFallback ? buildProductionUrl(path) : '';
  const token = readStoredAuthToken();
  const {headers: optionHeaders, timeoutMs = 20000, body, signal, auth = true, ...restOptions} = options || {};

  const extraHeaders =
    typeof Headers !== 'undefined' && optionHeaders instanceof Headers
      ? Object.fromEntries(optionHeaders.entries())
      : (optionHeaders as Record<string, string> | undefined) || {};

  const headers: Record<string, string> = {
    ...(auth && token ? {Authorization: `Bearer ${token}`} : {}),
    ...extraHeaders,
  };

  const hasBody = body !== undefined && body !== null;
  const isBinaryBody = isFormData(body) || isBlob(body);
  const shouldJsonStringifyBody = hasBody && !isBinaryBody && typeof body !== 'string';

  if (hasBody && shouldJsonStringifyBody) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let didTimeout = false;
  const timeout = controller
    ? setTimeout(() => {
        didTimeout = true;
        controller.abort();
      }, Math.max(0, Number(timeoutMs) || 0))
    : null;

  let combinedSignal: AbortSignal | undefined = controller?.signal;
  if (signal && controller) {
    const onAbort = () => controller.abort();
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, {once: true});
    combinedSignal = controller.signal;
  } else if (signal) {
    combinedSignal = signal;
  }

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        ...(hasBody
          ? {
              body: isBinaryBody
                ? (body as any)
                : shouldJsonStringifyBody
                  ? JSON.stringify(body)
                  : (body as any),
            }
          : {}),
        signal: combinedSignal,
        ...restOptions,
          });
    } catch (fetchError: any) {
      if (shouldFallback) {
        try {
          response = await fetch(fallbackUrl, {
            method,
            headers,
            credentials: 'include',
            ...(hasBody
              ? {
                  body: isBinaryBody
                    ? (body as any)
                    : shouldJsonStringifyBody
                      ? JSON.stringify(body)
                      : (body as any),
                }
              : {}),
            signal: combinedSignal,
            ...restOptions,
          });
        } catch {
          // fall through to the default error handler below
          const isAbortError =
            fetchError?.name === 'AbortError' ||
            /aborted|aborterror|signal is aborted/i.test(String(fetchError?.message || ''));
          const error = new ApiClientError(
            didTimeout
              ? `Request timed out after ${Math.max(0, Number(timeoutMs) || 0)}ms`
              : isAbortError
                ? `Request was aborted (${method} ${url})`
                : fetchError?.message ||
                  `Failed to fetch (${method} ${url}). Check VITE_API_URL/VITE_API_BASE_URL, backend availability, and CORS/proxy settings.`,
          );
          if (didTimeout) error.status = 408;
          error.data = fetchError;
          error.method = method;
          error.url = url;
          throw error;
        }
      } else {
        const isAbortError =
          fetchError?.name === 'AbortError' || /aborted|aborterror|signal is aborted/i.test(String(fetchError?.message || ''));
        const error = new ApiClientError(
          didTimeout
            ? `Request timed out after ${Math.max(0, Number(timeoutMs) || 0)}ms`
            : isAbortError
              ? `Request was aborted (${method} ${url})`
              : fetchError?.message ||
                `Failed to fetch (${method} ${url}). Check VITE_API_URL/VITE_API_BASE_URL, backend availability, and CORS/proxy settings.`,
        );
        if (didTimeout) error.status = 408;
        error.data = fetchError;
        error.method = method;
        error.url = url;
        throw error;
      }
    }

    let data = await parseResponse(response);

    if (!response.ok && shouldFallback && response.url !== fallbackUrl && response.status === 404) {
      try {
        const retryResponse = await fetch(fallbackUrl, {
          method,
          headers,
          credentials: 'include',
          ...(hasBody
            ? {
                body: isBinaryBody
                  ? (body as any)
                  : shouldJsonStringifyBody
                    ? JSON.stringify(body)
                    : (body as any),
              }
            : {}),
          signal: combinedSignal,
          ...restOptions,
        });
        response = retryResponse;
        data = await parseResponse(response);
      } catch {
        // ignore retry errors and continue handling the original response
      }
    }

    // Some backends (including common Laravel conventions) return HTTP 200 with `{ success: false, ... }`.
    // Treat it as an error so callers can map validation messages consistently.
    if (response.ok && isObject(data) && (data as any).success === false) {
      const error = new ApiClientError((data as any)?.message || (data as any)?.error || 'Request failed');
      error.status = response.status;
      error.data = data;
      error.method = method;
      error.url = url;
      throw error;
    }

    if (!response.ok) {
      const error = new ApiClientError(
        (data as any)?.message || (data as any)?.error || `Request failed with status ${response.status}`,
      );
      error.status = response.status;
      error.data = data;
      error.method = method;
      error.url = response.url || url;
      throw error;
    }

    return data;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

const apiClient = {
  request,
  get: (path: string, options?: ApiClientOptions) => request('GET', path, options),
  post: (path: string, body?: unknown, options?: ApiClientOptions) => request('POST', path, {...options, body}),
  put: (path: string, body?: unknown, options?: ApiClientOptions) => request('PUT', path, {...options, body}),
  patch: (path: string, body?: unknown, options?: ApiClientOptions) => request('PATCH', path, {...options, body}),
  delete: (path: string, options?: ApiClientOptions) => request('DELETE', path, options),
};

export {API_BASE_URL};

export default apiClient;
