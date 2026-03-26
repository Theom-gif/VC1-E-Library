import apiClient, {API_BASE_URL} from './apiClient';
import {withQuery} from './queryString';
import {toBookType} from './bookMapper';
import type {BookType} from '../types';

export type ReadingActivityRange = '7d' | '30d' | '1y';
export type ProfileSummary = {
  id?: string;
  firstname?: string;
  lastname?: string;
  name: string;
  photo: string;
  bio?: string;
  facebookUrl?: string;
  memberSince?: string;
  membership?: string;
  stats?: {
    favoritesCount: number;
    downloadsCount: number;
    booksReadCount: number;
    readingDaysCount: number;
    totalReadingSeconds: number;
    totalReadingMinutes: number;
  };
};

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
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized) return normalized;
      continue;
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
      const normalized = String(value).trim();
      if (normalized) return normalized;
      continue;
    }
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

function asAbsoluteAssetUrl(value: string): string {
  const raw = String(value || '').trim().replace(/\\/g, '/');
  if (!raw) return '';
  if (/^(https?:|data:)/i.test(raw)) return raw;

  const base = String(API_BASE_URL || '').trim().replace(/\/+$/, '');

  // Laravel-ish paths we commonly see:
  // - public/storage/avatars/x.jpg
  // - /public/storage/avatars/x.jpg
  // - storage/app/public/avatars/x.jpg
  // - /storage/app/public/avatars/x.jpg
  // - avatars/x.jpg (meaning storage/avatars/x.jpg)
  const withoutPublicPrefix = raw.replace(/^\/?public\//, '');
  const withoutAppPublic = withoutPublicPrefix.replace(/^\/?storage\/app\/public\//, 'storage/');
  const withoutPublicStorage = withoutAppPublic.replace(/^\/?public\/storage\//, 'storage/');
  const normalized = withoutPublicStorage.replace(/^\/+/, '');

  if (!base) return raw.startsWith('/') ? raw : `/${normalized}`;
  if (raw.startsWith('/')) return `${base}/${normalized}`;
  if (normalized.startsWith('storage/')) return `${base}/${normalized}`;
  if (normalized.startsWith('uploads/') || normalized.startsWith('images/') || normalized.startsWith('assets/')) {
    return `${base}/${normalized}`;
  }
  return `${base}/storage/${normalized}`;
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

function normalizeProfileSummary(payload: any): ProfileSummary {
  const dataSource = pickObject(payload?.data || payload);
  const source = pickObject(dataSource?.user || payload?.user || payload?.profile || dataSource);
  const statsSource = pickObject(dataSource?.stats);
  const id = pickString(source?.id, source?.user_id, source?.uuid);
  const firstname = pickString(source?.firstname, source?.first_name);
  const lastname = pickString(source?.lastname, source?.last_name);
  return {
    id: id || undefined,
    firstname: firstname || undefined,
    lastname: lastname || undefined,
    name: pickString(source?.full_name, source?.name, `${firstname} ${lastname}`.trim(), source?.username, 'Library User'),
    photo: asAbsoluteAssetUrl(
      pickString(
        source?.photo_url,
        source?.photo_path,
        source?.photo?.url,
        source?.photo?.path,
        source?.photo,
        source?.profile_photo_url,
        source?.profile_photo_path,
        source?.profile_photo?.url,
        source?.profile_photo?.path,
        source?.profile_photo,
        source?.profilePhotoUrl,
        source?.profilePhoto?.url,
        source?.profilePhoto?.path,
        source?.profilePhoto,
        source?.avatar_url,
        source?.avatar_path,
        source?.avatar?.url,
        source?.avatar?.path,
        source?.avatarPath,
        source?.avatar,
        source?.image_url,
        source?.image_path,
        source?.image?.url,
        source?.image?.path,
        source?.imagePath,
        source?.image,
        // Some avatar upload endpoints only return `{ path }` or `{ url }`.
        source?.url,
        source?.path,
      ),
    ),
    bio: pickString(source?.bio) || undefined,
    facebookUrl: pickString(source?.facebook_url, source?.facebookUrl) || undefined,
    memberSince: pickString(source?.member_since, source?.created_at, source?.joined_at) || undefined,
    membership: pickString(source?.membership, source?.membership_label) || undefined,
    stats: Object.keys(statsSource).length
      ? {
          favoritesCount: pickNumber(statsSource?.favorites_count),
          downloadsCount: pickNumber(statsSource?.downloads_count),
          booksReadCount: pickNumber(statsSource?.books_read_count),
          readingDaysCount: pickNumber(statsSource?.reading_days_count),
          totalReadingSeconds: pickNumber(statsSource?.total_reading_seconds),
          totalReadingMinutes: pickNumber(statsSource?.total_reading_minutes),
        }
      : undefined,
  };
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

function buildProfileJsonPayload(payload: {
  name?: string;
  firstname?: string;
  lastname?: string;
  bio?: string;
  facebook_url?: string;
  avatar?: string | null;
  photo?: string | null;
}) {
  const body: Record<string, string> = {};
  const name = pickString(payload?.name);
  const firstname = pickString(payload?.firstname);
  const lastname = pickString(payload?.lastname);
  const bio = String(payload?.bio || '').trim();
  const facebookUrl = String(payload?.facebook_url || '').trim();
  const avatar = String(payload?.avatar || '').trim();
  const photo = String(payload?.photo || '').trim();

  if (name) body.name = name;
  if (firstname) body.firstname = firstname;
  if (lastname) body.lastname = lastname;
  if (bio) body.bio = bio;
  if (facebookUrl) body.facebook_url = facebookUrl;
  if (avatar) body.avatar = avatar;
  if (photo) body.photo = photo;

  return body;
}

function buildProfileFormData(payload: {
  name?: string;
  firstname?: string;
  lastname?: string;
  bio?: string;
  facebook_url?: string;
  avatar?: string | null;
  photo?: string | null;
  avatarFile?: File | null;
  methodOverride?: 'PATCH' | 'PUT';
}) {
  const form = new FormData();
  const name = pickString(payload?.name);
  const firstname = pickString(payload?.firstname);
  const lastname = pickString(payload?.lastname);
  const bio = String(payload?.bio || '').trim();
  const facebookUrl = String(payload?.facebook_url || '').trim();
  const avatar = String(payload?.avatar || '').trim();
  const photo = String(payload?.photo || '').trim();
  const methodOverride = payload?.methodOverride;

  if (methodOverride) form.append('_method', methodOverride);
  if (name) form.append('name', name);
  if (firstname) form.append('firstname', firstname);
  if (lastname) form.append('lastname', lastname);
  if (bio) form.append('bio', bio);
  if (facebookUrl) form.append('facebook_url', facebookUrl);
  if (avatar) form.append('avatar', avatar);
  if (photo) form.append('photo', photo);

  if (payload?.avatarFile instanceof File) {
    // Common backend conventions: accept either `avatar` or `photo` for a profile image file.
    form.append('avatar', payload.avatarFile, payload.avatarFile.name);
    form.append('photo', payload.avatarFile, payload.avatarFile.name);
  }

  return form;
}

async function updateProfileWithFallback(payload: {
  name?: string;
  firstname?: string;
  lastname?: string;
  bio?: string;
  facebook_url?: string;
  avatar?: string | null;
  photo?: string | null;
  avatarFile?: File | null;
}) {
  const paths = ['/api/me/profile', '/api/me'];
  let lastError: any;

  const hasAvatarFile = payload?.avatarFile instanceof File;
  const body = hasAvatarFile ? null : buildProfileJsonPayload(payload);

  for (const path of paths) {
    try {
      return await apiClient.patch(
        path,
        hasAvatarFile ? buildProfileFormData(payload) : body,
        {headers: {Accept: 'application/json'}},
      );
    } catch (error: any) {
      const status = Number(error?.status);
      if (status === 404) {
        lastError = error;
        continue;
      }
      // Laravel/PHP commonly does not parse multipart bodies for PATCH/PUT, so retry as POST with _method override.
      if (hasAvatarFile && (status === 405 || status === 415)) {
        try {
          return await apiClient.post(
            path,
            buildProfileFormData({...payload, methodOverride: 'PATCH'}),
            {headers: {Accept: 'application/json'}},
          );
        } catch (postError: any) {
          const postStatus = Number(postError?.status);
          if (postStatus === 404) {
            lastError = postError;
            continue;
          }
          lastError = postError;
        }
      }
      if (status !== 405) {
        throw error;
      }
      lastError = error;
    }
  }

  for (const path of paths) {
    try {
      return await apiClient.put(
        path,
        hasAvatarFile ? buildProfileFormData(payload) : body,
        {headers: {Accept: 'application/json'}},
      );
    } catch (error: any) {
      const status = Number(error?.status);
      if (status === 404) {
        lastError = error;
        continue;
      }
      if (hasAvatarFile && (status === 405 || status === 415)) {
        try {
          return await apiClient.post(
            path,
            buildProfileFormData({...payload, methodOverride: 'PUT'}),
            {headers: {Accept: 'application/json'}},
          );
        } catch (postError: any) {
          if (Number(postError?.status) !== 404) throw postError;
          lastError = postError;
        }
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('Profile update endpoint not found.');
}

async function meImpl(): Promise<ProfileSummary> {
  const payload = await getWithAliasFallback(
    [
      '/api/me/profile',
      '/api/me',
      '/api/profile',
    ],
    (path) => apiClient.get(path),
  );
  return normalizeProfileSummary(payload);
}

export const profileService = {
  me: async (): Promise<ProfileSummary> => {
    return meImpl();
  },

  updateProfile: async (payload: {
    name?: string;
    firstname?: string;
    lastname?: string;
    bio?: string;
    facebook_url?: string;
    avatar?: string | null;
    photo?: string | null;
    avatarFile?: File | null;
  }): Promise<ProfileSummary> => {
    const response = await updateProfileWithFallback(payload);
    return normalizeProfileSummary(response);
  },

  uploadAvatar: async (file: File): Promise<ProfileSummary> => {
    if (!(file instanceof File)) {
      throw new Error('Avatar file is required.');
    }

    const form = new FormData();
    form.append('avatar', file, file.name);
    form.append('photo', file, file.name);

    try {
      const payload = await getWithAliasFallback(
        [
          '/api/me/avatar',
          '/api/me/profile/avatar',
          '/api/profile/avatar',
        ],
        (path) =>
          apiClient.post(path, form, {
            headers: {Accept: 'application/json'},
          }),
      );
      const saved = normalizeProfileSummary(payload);
      if (saved.photo) return saved;
      try {
        return await meImpl();
      } catch {
        return saved;
      }
    } catch (error: any) {
      const status = Number(error?.status);
      if (status && status !== 404 && status !== 405 && status !== 415) throw error;

      // Fallback: some backends only accept avatar uploads as part of the profile update payload.
      const response = await updateProfileWithFallback({avatarFile: file});
      const saved = normalizeProfileSummary(response);
      if (saved.photo) return saved;
      try {
        return await meImpl();
      } catch {
        return saved;
      }
    }
  },

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

