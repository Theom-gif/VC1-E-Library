import apiClient from './apiClient';
import {withQuery} from './queryString';
import {toBookType} from './bookMapper';
import type {BookType} from '../types';

export type ReadingActivityRange = '7d' | '30d' | '1y';

export type ReadingActivityBucket = {
  key: string;
  label: string;
  minutes: number;
};

export type ReadingActivitySummary = {
  data: ReadingActivityBucket[];
  meta: {
    range: ReadingActivityRange;
    unit: string;
    total_minutes: number;
  };
};

function pickArray<T = any>(...values: unknown[]): T[] {
  for (const value of values) {
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

function pickObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function pickNumber(...values: unknown[]): number {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && !Number.isNaN(n)) return n;
  }
  return 0;
}

function normalizeReadingActivityRange(value: unknown): ReadingActivityRange {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === '30d') return '30d';
  if (raw === '1y' || raw === 'year' || raw === '12m') return '1y';
  return '7d';
}

function normalizeReadingActivityBucket(raw: any, index: number): ReadingActivityBucket {
  return {
    key: pickString(raw?.key, raw?.date, raw?.bucket, `bucket-${index + 1}`),
    label: pickString(raw?.label, raw?.name, raw?.day, raw?.month, `#${index + 1}`),
    minutes: Math.max(
      0,
      Math.round(
        pickNumber(raw?.minutes, raw?.minutes_read, raw?.value, raw?.total_minutes, raw?.duration_minutes),
      ),
    ),
  };
}

function normalizeReadingActivityResponse(payload: any, requestedRange: ReadingActivityRange): ReadingActivitySummary {
  const source = pickObject(payload);
  const dataSource = pickArray(source?.data, source?.results, source?.items);
  const metaSource = pickObject(source?.meta);
  const data = dataSource.map((item, index) => normalizeReadingActivityBucket(item, index));
  const totalMinutes =
    pickNumber(metaSource?.total_minutes, source?.total_minutes) ||
    data.reduce((sum, item) => sum + item.minutes, 0);

  return {
    data,
    meta: {
      range: normalizeReadingActivityRange(metaSource?.range || requestedRange),
      unit: pickString(metaSource?.unit, 'minutes'),
      total_minutes: totalMinutes,
    },
  };
}

function normalizeCurrentlyReadingResponse(payload: any): BookType[] {
  const source = pickObject(payload);
  const items = pickArray(source?.data, source?.books, source?.results, source?.items);

  return items
    .map((item) => {
      const book = toBookType(item);
      const progress = Math.max(
        0,
        Math.min(100, Math.round(pickNumber(item?.progress, item?.progress_percent, item?.reading_progress))),
      );
      return {
        ...book,
        progress,
      };
    })
    .filter((book) => Boolean(book.id && book.title));
}

async function getWithAliasFallback<T>(paths: string[], fn: (path: string) => Promise<T>): Promise<T> {
  let lastError: any;
  for (const path of paths) {
    try {
      return await fn(path);
    } catch (error: any) {
      if (Number(error?.status) !== 404) throw error;
      lastError = error;
    }
  }
  throw lastError || new Error('Profile endpoint not found.');
}

export const profileService = {
  me: () => apiClient.get('/api/me'),

  updateProfile: (payload: {name?: string; photo?: string}) => apiClient.patch('/api/me', payload),

  updateSettings: (payload: Record<string, unknown>) => apiClient.patch('/api/me/settings', payload),

  getReadingActivity: async (range: ReadingActivityRange, timezone?: string): Promise<ReadingActivitySummary> => {
    const payload = await getWithAliasFallback(
      [
        '/api/me/reading-activity',
        '/api/reading-activity',
        '/api/profile/reading-activity',
      ],
      (path) =>
        apiClient.get(
          withQuery(path, {
            range,
            timezone: timezone || undefined,
          }),
        ),
    );
    return normalizeReadingActivityResponse(payload, range);
  },

  getCurrentlyReading: async (): Promise<BookType[]> => {
    const payload = await getWithAliasFallback(
      [
        '/api/me/currently-reading',
        '/api/currently-reading',
        '/api/profile/currently-reading',
      ],
      (path) => apiClient.get(path),
    );
    return normalizeCurrentlyReadingResponse(payload);
  },
};

export default profileService;

