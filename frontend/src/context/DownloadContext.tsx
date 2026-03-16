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

function pickString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
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
  try {
    return new URL(trimmed, API_BASE_URL).toString();
  } catch {
    return trimmed;
  }
}

function sameOrigin(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.origin === ub.origin;
  } catch {
    return false;
  }
}

async function resolveDownloadUrl(bookId: string): Promise<string> {
  const payload = (await bookService.download(bookId)) as any;
  const url = pickString(
    payload?.download_url,
    payload?.stream_url,
    payload?.url,
    payload?.data?.download_url,
    payload?.data?.stream_url,
    payload?.data?.url,
  );

  if (!url) {
    throw new Error('Backend did not return a download URL. Expected `download_url` in JSON response.');
  }

  return ensureAbsoluteUrl(url);
}

async function fetchBlobWithProgress(
  url: string,
  controller: AbortController,
  onProgress: (snapshot: {receivedBytes: number; totalBytes: number | null; speedBytesPerSec: number}) => void,
): Promise<{blob: Blob; mimeType: string; fileName: string}> {
  const token = readAuthToken();
  const headers: Record<string, string> = {};

  if (token && sameOrigin(url, API_BASE_URL)) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {method: 'GET', headers, signal: controller.signal});
  if (!response.ok) {
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
    (bookId: string) => completed.some((entry) => entry.bookId === bookId),
    [completed],
  );

  const activeById = useCallback(
    (bookId: string) => activeByBookId[bookId] || null,
    [activeByBookId],
  );

  const startDownload = useCallback(
    async (book: BookType) => {
      const bookId = String(book?.id || '').trim();
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
    const controller = controllersRef.current.get(bookId);
    if (controller) controller.abort();
  }, []);

  const resume = useCallback(
    async (book: BookType) => {
      const bookId = String(book?.id || '').trim();
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
    const controller = controllersRef.current.get(bookId);
    if (controller) controller.abort();
    controllersRef.current.delete(bookId);
    setActiveByBookId((prev) => {
      const next = {...prev};
      delete next[bookId];
      return next;
    });
  }, []);

  const remove = useCallback(
    async (bookId: string) => {
      await deleteDownload(bookId);
      await refresh();
    },
    [refresh],
  );

  const openOffline = useCallback(async (bookId: string) => {
    const record = await getDownload(bookId);
    if (!record) throw new Error('This book is not downloaded on this device.');
    const url = URL.createObjectURL(record.blob);
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      URL.revokeObjectURL(url);
      throw new Error('Popup blocked. Please allow popups to open offline book.');
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
