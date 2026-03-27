import React, {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';
import type {BookType} from '../types';
import {API_BASE_URL} from '../service/apiClient';
import bookService from '../service/bookService';
import {
  deleteDownload,
  getDownload,
  listDownloads,
  putDownload,
  storageUsedBytes,
  type StoredDownload,
} from '../offline/downloadsDb';
import {openReaderTab} from '../utils/openReaderTab';

type ActiveDownloadStatus = 'downloading' | 'paused' | 'error';

export type ActiveDownload = {
  bookId: string;
  book: BookType;
  status: ActiveDownloadStatus;
  progress: number;
  receivedBytes: number;
  totalBytes: number | null;
  speedBytesPerSec: number;
  error: string | null;
  downloadUrl?: string;
  startedAt: number;
  updatedAt: number;
};

type DownloadState = {
  active: ActiveDownload[];
  completed: StoredDownload[];
  storageUsed: number;
  startDownload: (book: BookType) => Promise<void>;
  pause: (bookId: string) => void;
  resume: (book: BookType) => Promise<void>;
  cancel: (bookId: string) => void;
  remove: (bookId: string) => Promise<void>;
  openOffline: (bookId: string) => Promise<void>;
  isDownloaded: (bookId: string) => boolean;
  activeById: (bookId: string) => ActiveDownload | null;
  refresh: () => Promise<void>;
};

const DownloadContext = createContext<DownloadState | null>(null);

function safeLocalStorageGet(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readAuthToken(): string | null {
  return safeLocalStorageGet('token');
}

function hasAuthToken(): boolean {
  return Boolean(readAuthToken());
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function normalizeBackendBookId(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw.startsWith('api-') ? raw.slice(4) : raw;
}

function legacyBackendBookId(value: unknown): string {
  const normalized = normalizeBackendBookId(value);
  return normalized ? `api-${normalized}` : '';
}

function parseContentDispositionFilename(contentDisposition: string | null): string {
  const raw = String(contentDisposition || '');
  if (!raw) return '';
  const match = raw.match(/filename\\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i);
  const value = (match?.[1] || match?.[2] || '').trim();
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function ensureAbsoluteUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;

  const origin = currentWindowOrigin();
  if (trimmed.startsWith('/') && origin) return `${origin}${trimmed}`;

  const base = String(API_BASE_URL || '').trim() || origin;
  try {
    if (!base) return trimmed;
    return new URL(trimmed, base).toString();
  } catch {
    return trimmed;
  }
}

function sameOrigin(a: string, b: string): boolean {
  try {
    const ub = new URL(b);
    const ua = new URL(a, ub.origin);
    return ua.origin === ub.origin;
  } catch {
    return false;
  }
}

function currentWindowOrigin(): string {
  try {
    return String(window.location.origin || '').trim();
  } catch {
    return '';
  }
}

function shouldAttachDownloadAuthHeader(url: string): boolean {
  const origin = currentWindowOrigin();
  if (!origin) return false;
  if (sameOrigin(url, origin)) return true;

  const apiBaseUrl = String(API_BASE_URL || '').trim();
  if (!apiBaseUrl) return false;
  try {
    const apiOrigin = new URL(apiBaseUrl, origin).origin;
    const resolved = new URL(url, origin);
    return resolved.origin === apiOrigin;
  } catch {
    return false;
  }
}

async function resolveDownloadUrl(bookId: string): Promise<string> {
  const normalizedBookId = normalizeBackendBookId(bookId);
  const payload = (await bookService.download(normalizedBookId)) as any;
  const url = pickString(
    payload?.download_url,
    payload?.stream_url,
    payload?.url,
    payload?.read_url,
    payload?.data?.download_url,
    payload?.data?.stream_url,
    payload?.data?.url,
    payload?.data?.read_url,
  );

  if (!url) {
    throw new Error('Backend did not return a download URL. Expected `download_url`, `stream_url`, `url`, or `read_url`.');
  }

  return ensureAbsoluteUrl(url);
}

async function syncDownloadRecordToBackend(
  bookId: string,
  payload?: Parameters<typeof bookService.createDownloadRecord>[1],
): Promise<void> {
  const normalizedBookId = normalizeBackendBookId(bookId);
  if (!normalizedBookId || !hasAuthToken()) return;
  try {
    await bookService.createDownloadRecord(normalizedBookId, payload);
  } catch (error: any) {
    const status = Number(error?.status);
    // The backend may already log via POST /api/books/{id}/download.
    // Keep the local download successful even if the optional sync endpoint rejects or duplicates.
    if ([400, 401, 403, 404, 405, 409, 422, 500].includes(status)) return;
    throw error;
  }
}

function diagnoseFetchFailure(url: string): string {
  const origin = currentWindowOrigin();
  const apiBaseUrl = String(API_BASE_URL || '').trim();

  let resolved: URL | null = null;
  try {
    resolved = new URL(url, origin || 'http://localhost');
  } catch {
    resolved = null;
  }

  if (resolved && origin && origin.startsWith('https:') && resolved.protocol === 'http:') {
    return 'Download blocked: file URL is http on an https site (mixed content).';
  }

  if (resolved && origin) {
    let apiOrigin = '';
    try {
      apiOrigin = apiBaseUrl ? new URL(apiBaseUrl, origin).origin : '';
    } catch {
      apiOrigin = '';
    }

    if (resolved.origin !== origin && apiOrigin && resolved.origin !== apiOrigin) {
      return `Download blocked by CORS: file host ${resolved.origin} does not allow this app origin (${origin}). Ask the backend to return a signed public URL or enable CORS for file downloads.`;
    }

    if (resolved.origin !== origin && apiOrigin && resolved.origin === apiOrigin) {
      return `Download blocked by CORS: backend origin ${apiOrigin} does not allow this app origin (${origin}). Enable CORS (and allow Authorization header if needed).`;
    }
  }

  return 'Failed to fetch download file. Check your internet, backend availability, and CORS settings.';
}

async function fetchBlobWithProgress(
  url: string,
  controller: AbortController,
  onProgress: (snapshot: {receivedBytes: number; totalBytes: number | null; speedBytesPerSec: number}) => void,
): Promise<{blob: Blob; mimeType: string; fileName: string}> {
  const token = readAuthToken();
  const requestDownload = async (useAuthHeader: boolean) => {
    const headers: Record<string, string> = {};
    if (useAuthHeader && token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return fetch(url, {method: 'GET', headers, signal: controller.signal});
  };

  const canUseAuthHeader = Boolean(token && shouldAttachDownloadAuthHeader(url));

  let response: Response;
  try {
    response = await requestDownload(canUseAuthHeader);
  } catch (error: any) {
    if (canUseAuthHeader) {
      response = await requestDownload(false);
    } else if (token) {
      response = await requestDownload(true);
    } else {
      const debug = Boolean((import.meta as any)?.env?.DEV);
      const message = diagnoseFetchFailure(url);
      throw new Error(debug && error?.message ? `${message} (${error.message})` : message);
    }
  }

  // If the backend requires auth for file URLs and we didn't attach it, retry once with the bearer token.
  if (!response.ok && !canUseAuthHeader && token && (response.status === 401 || response.status === 403)) {
    try {
      response = await requestDownload(true);
    } catch {
      // Keep the original response for error messaging below.
    }
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Download rejected (401/403). The backend must return a signed public URL or allow token-based downloads with correct CORS.');
    }
    throw new Error(`Download failed with status ${response.status}`);
  }

  const mimeType = String(response.headers.get('content-type') || 'application/octet-stream');
  const fileName = parseContentDispositionFilename(response.headers.get('content-disposition'));
  const totalBytesHeader = response.headers.get('content-length');
  const totalBytes = totalBytesHeader ? Number(totalBytesHeader) : NaN;
  const total = Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : null;

  if (!response.body) {
    const blob = await response.blob();
    onProgress({receivedBytes: blob.size, totalBytes: total, speedBytesPerSec: 0});
    return {blob, mimeType, fileName};
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  const startedAt = performance.now();
  let lastEmitAt = startedAt;

  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
    }

    const now = performance.now();
    const elapsed = Math.max(1, now - startedAt);
    const speedBytesPerSec = Math.round((received / elapsed) * 1000);

    if (now - lastEmitAt >= 150) {
      onProgress({receivedBytes: received, totalBytes: total, speedBytesPerSec});
      lastEmitAt = now;
    }
  }

  const elapsed = Math.max(1, performance.now() - startedAt);
  const finalSpeedBytesPerSec = Math.round((received / elapsed) * 1000);
  onProgress({receivedBytes: received, totalBytes: total, speedBytesPerSec: finalSpeedBytesPerSec});

  const blob = new Blob(chunks, {type: mimeType});
  return {blob, mimeType, fileName};
}

export function DownloadProvider({children}: {children: React.ReactNode}) {
  const controllersRef = useRef(new Map<string, AbortController>());
  const [activeByBookId, setActiveByBookId] = useState<Record<string, ActiveDownload>>({});
  const [completed, setCompleted] = useState<StoredDownload[]>([]);
  const [storageUsed, setStorageUsed] = useState(0);

  const refresh = useCallback(async () => {
    const [items, used] = await Promise.all([listDownloads(), storageUsedBytes()]);
    const sorted = [...items].sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));
    setCompleted(sorted);
    setStorageUsed(used);
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const isDownloaded = useCallback(
    (bookId: string) => {
      const normalized = normalizeBackendBookId(bookId);
      const legacy = legacyBackendBookId(bookId);
      return completed.some((entry) => {
        const entryId = normalizeBackendBookId(entry.bookId);
        return entryId === normalized || entry.bookId === legacy;
      });
    },
    [completed],
  );

  const activeById = useCallback(
    (bookId: string) => {
      const normalized = normalizeBackendBookId(bookId);
      const legacy = legacyBackendBookId(bookId);
      return activeByBookId[normalized] || activeByBookId[legacy] || null;
    },
    [activeByBookId],
  );

  const startDownload = useCallback(
    async (book: BookType) => {
      const bookId = normalizeBackendBookId(book?.id);
      if (!bookId) throw new Error('Cannot download: missing book id.');
      if (controllersRef.current.has(bookId)) return;

      const controller = new AbortController();
      controllersRef.current.set(bookId, controller);

      const now = Date.now();
      setActiveByBookId((prev) => ({
        ...prev,
        [bookId]: {
          bookId,
          book,
          status: 'downloading',
          progress: 0,
          receivedBytes: 0,
          totalBytes: null,
          speedBytesPerSec: 0,
          error: null,
          startedAt: now,
          updatedAt: now,
        },
      }));

      try {
        const downloadUrl = await resolveDownloadUrl(bookId);
        setActiveByBookId((prev) => {
          const current = prev[bookId];
          if (!current) return prev;
          return {
            ...prev,
            [bookId]: {
              ...current,
              downloadUrl,
              updatedAt: Date.now(),
            },
          };
        });
        void syncDownloadRecordToBackend(bookId, {status: 'started'});
        const {blob, mimeType, fileName} = await fetchBlobWithProgress(downloadUrl, controller, (snapshot) => {
          setActiveByBookId((prev) => {
            const current = prev[bookId];
            if (!current) return prev;
            const progress =
              snapshot.totalBytes && snapshot.totalBytes > 0
                ? Math.min(100, Math.round((snapshot.receivedBytes / snapshot.totalBytes) * 100))
                : current.progress;
            return {
              ...prev,
              [bookId]: {
                ...current,
                receivedBytes: snapshot.receivedBytes,
                totalBytes: snapshot.totalBytes,
                speedBytesPerSec: snapshot.speedBytesPerSec,
                progress,
                updatedAt: Date.now(),
              },
            };
          });
        });

        const record: StoredDownload = {
          bookId,
          book,
          blob,
          mimeType,
          sizeBytes: blob.size,
          createdAt: now,
          updatedAt: Date.now(),
          fileName: fileName || undefined,
        };

        await putDownload(record);
        await syncDownloadRecordToBackend(bookId, {
          status: 'completed',
          size_bytes: blob.size,
          file_name: fileName || undefined,
          mime_type: mimeType,
        });
        await refresh();
      } catch (error: any) {
        const aborted = controller.signal.aborted;
        const message = aborted ? null : error?.message || 'Download failed.';
        setActiveByBookId((prev) => {
          const current = prev[bookId];
          if (!current) return prev;
          return {
            ...prev,
            [bookId]: {
              ...current,
              status: aborted ? 'paused' : 'error',
              error: message,
              updatedAt: Date.now(),
            },
          };
        });
        return;
      } finally {
        controllersRef.current.delete(bookId);
      }

      setActiveByBookId((prev) => {
        const next = {...prev};
        delete next[bookId];
        return next;
      });
    },
    [refresh],
  );

  const pause = useCallback((bookId: string) => {
    const normalized = normalizeBackendBookId(bookId);
    const legacy = legacyBackendBookId(bookId);
    const controller = controllersRef.current.get(normalized) || controllersRef.current.get(legacy);
    if (controller) controller.abort();
  }, []);

  const resume = useCallback(
    async (book: BookType) => {
      const bookId = normalizeBackendBookId(book?.id);
      if (!bookId) return;
      setActiveByBookId((prev) => {
        const current = prev[bookId];
        if (!current) return prev;
        return {
          ...prev,
          [bookId]: {
            ...current,
            status: 'downloading',
            error: null,
            progress: 0,
            receivedBytes: 0,
            totalBytes: null,
            speedBytesPerSec: 0,
            updatedAt: Date.now(),
          },
        };
      });
      await startDownload(book);
    },
    [startDownload],
  );

  const cancel = useCallback((bookId: string) => {
    const normalized = normalizeBackendBookId(bookId);
    const legacy = legacyBackendBookId(bookId);
    const controller = controllersRef.current.get(normalized) || controllersRef.current.get(legacy);
    if (controller) controller.abort();
    controllersRef.current.delete(normalized);
    if (legacy) controllersRef.current.delete(legacy);
    setActiveByBookId((prev) => {
      const next = {...prev};
      delete next[normalized];
      if (legacy) delete next[legacy];
      return next;
    });
  }, []);

  const remove = useCallback(
    async (bookId: string) => {
      const normalized = normalizeBackendBookId(bookId);
      const legacy = legacyBackendBookId(bookId);
      await deleteDownload(normalized);
      if (legacy && legacy !== normalized) {
        await deleteDownload(legacy);
      }
      await refresh();
    },
    [refresh],
  );

  const openOffline = useCallback(async (bookId: string) => {
    const normalized = normalizeBackendBookId(bookId);
    const legacy = legacyBackendBookId(bookId);
    const record = (await getDownload(normalized)) || (legacy ? await getDownload(legacy) : null);
    if (!record) throw new Error('This book is not downloaded on this device.');
    const url = URL.createObjectURL(record.blob);
    try {
      openReaderTab({
        title: record.book?.title || 'Offline Read',
        url,
        tracking: {
          bookId: normalized,
          source: 'offline',
        },
      });
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  }, []);

  const value = useMemo<DownloadState>(
    () => ({
      active: Object.values(activeByBookId).sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt)),
      completed,
      storageUsed,
      startDownload,
      pause,
      resume,
      cancel,
      remove,
      openOffline,
      isDownloaded,
      activeById,
      refresh,
    }),
    [activeByBookId, completed, storageUsed, startDownload, pause, resume, cancel, remove, openOffline, isDownloaded, activeById, refresh],
  );

  return <DownloadContext.Provider value={value}>{children}</DownloadContext.Provider>;
}

export function useDownloads() {
  const value = useContext(DownloadContext);
  if (!value) throw new Error('useDownloads must be used within <DownloadProvider>.');
  return value;
}
