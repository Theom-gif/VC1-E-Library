import apiClient, {API_BASE_URL} from './apiClient';
import {withQuery} from './queryString';
import bookService from './bookService';

export type AuthorType = {
  id: string;
  name: string;
  bio?: string;
  photo?: string;
  followers?: number;
  avg_rating?: number;
  books_count?: number;
};

export type ListAuthorsParams = {
  q?: string;
  page?: number;
  per_page?: number;
};

export type AuthorListSource = 'authors-endpoint' | 'users-role-fallback' | 'books-fallback';

type ApiListMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  meta?: ApiListMeta;
};

type AuthorListEndpoint = {
  path: string;
  auth?: boolean;
  source: Exclude<AuthorListSource, 'books-fallback'>;
  extraQuery?: Record<string, string | number>;
};

const AUTHOR_ROLE_ID = '2';

const AUTHOR_LIST_ENDPOINTS: AuthorListEndpoint[] = [
  {path: '/api/users', auth: false, source: 'users-role-fallback', extraQuery: {role_id: AUTHOR_ROLE_ID}},
  {path: '/api/users', auth: false, source: 'users-role-fallback', extraQuery: {role: 'author'}},
  {path: '/api/users', auth: true, source: 'users-role-fallback', extraQuery: {role_id: AUTHOR_ROLE_ID}},
  {path: '/api/users', auth: true, source: 'users-role-fallback', extraQuery: {role: 'author'}},
  {path: '/api/admin/users', auth: true, source: 'users-role-fallback', extraQuery: {role_id: AUTHOR_ROLE_ID}},
  {path: '/api/admin/users', auth: true, source: 'users-role-fallback', extraQuery: {role: 'author'}},
  {path: '/api/auth/users', auth: true, source: 'users-role-fallback', extraQuery: {role_id: AUTHOR_ROLE_ID}},
  {path: '/api/auth/users', auth: true, source: 'users-role-fallback', extraQuery: {role: 'author'}},
  {path: '/api/authors', auth: false, source: 'authors-endpoint'},
  {path: '/api/authors', auth: true, source: 'authors-endpoint'},
];

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'object') continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return '';
}

function pickMediaString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).replace(/\\/g, '/').trim();
    if (!normalized || normalized === '[object Object]') return '';
    return normalized;
  }

  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return pickString(
      source?.url,
      source?.src,
      source?.path,
      source?.href,
      source?.original_url,
      source?.secure_url,
      source?.avatar,
      source?.photo,
      source?.image,
      source?.location,
      source?.value,
      (source?.data as any)?.url,
      (source?.data as any)?.path,
      (source?.attributes as any)?.url,
      (source?.attributes as any)?.path,
    );
  }

  return '';
}

function toNonNegativeNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return undefined;
  return numeric;
}

function asAbsoluteAssetUrl(value: unknown): string {
  const raw = pickMediaString(value);
  if (!raw) return '';
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;

  const base = String(API_BASE_URL || '').replace(/\/+$/, '');
  const normalized = raw.replace(/^\/+/, '');

  if (!base) return raw.startsWith('/') ? raw : `/${normalized}`;
  if (raw.startsWith('/')) return `${base}/${normalized}`;
  if (normalized.startsWith('storage/')) return `${base}/${normalized}`;
  if (
    normalized.startsWith('uploads/') ||
    normalized.startsWith('images/') ||
    normalized.startsWith('assets/') ||
    normalized.startsWith('avatars/') ||
    normalized.startsWith('profile/') ||
    normalized.startsWith('api/')
  ) {
    return `${base}/${normalized}`;
  }
  return `${base}/storage/${normalized}`;
}

function normalizeRoleName(raw: any): string {
  const userRoleName =
    raw?.user && typeof raw.user === 'object'
      ? pickString(raw?.user?.role_name, raw?.user?.roleName, raw?.user?.role?.name)
      : '';
  const roleObjectName =
    raw?.role && typeof raw.role === 'object'
      ? pickString(raw?.role?.name, raw?.role?.title, raw?.role?.label)
      : '';
  const roleDirect = typeof raw?.role === 'string' ? raw.role : '';
  return pickString(raw?.role_name, raw?.roleName, roleDirect, roleObjectName, userRoleName).toLowerCase();
}

function normalizeRoleId(raw: any): string {
  return pickString(raw?.role_id, raw?.roleId, raw?.role?.id, raw?.user?.role_id, raw?.user?.role?.id);
}

function hasRoleHint(raw: any): boolean {
  return Boolean(normalizeRoleName(raw) || normalizeRoleId(raw));
}

function isAuthorRole(raw: any): boolean {
  const roleName = normalizeRoleName(raw);
  if (roleName.includes('author')) return true;
  const roleId = normalizeRoleId(raw);
  return roleId === AUTHOR_ROLE_ID;
}

function buildDisplayName(raw: any): string {
  const user = raw?.user && typeof raw?.user === 'object' ? raw.user : {};
  const first = pickString(raw?.firstname, raw?.first_name, raw?.given_name);
  const last = pickString(raw?.lastname, raw?.last_name, raw?.family_name);
  const fullName = [first, last].filter(Boolean).join(' ').trim();
  const userFirst = pickString(user?.firstname, user?.first_name, user?.given_name);
  const userLast = pickString(user?.lastname, user?.last_name, user?.family_name);
  const userFullName = [userFirst, userLast].filter(Boolean).join(' ').trim();
  return pickString(raw?.name, raw?.author_name, fullName, raw?.username, raw?.title, user?.name, userFullName, user?.username);
}

function normalizeAuthor(raw: any, index: number): AuthorType | null {
  const user = raw?.user && typeof raw?.user === 'object' ? raw.user : {};
  const name = buildDisplayName(raw);
  if (!name) return null;

  const id = pickString(raw?.id, raw?.author_id, raw?.user_id, user?.id, raw?.slug) || `author-${index + 1}`;
  return {
    id,
    name,
    bio: pickString(raw?.bio, raw?.about, raw?.description, user?.bio, user?.about, user?.description) || undefined,
    photo:
      asAbsoluteAssetUrl(
        raw?.photo ??
          raw?.avatar ??
          raw?.avatar_url ??
          raw?.profile_photo_path ??
          raw?.profile_photo_url ??
          raw?.profile_photo ??
          raw?.image_url ??
          raw?.photo_url ??
          raw?.image ??
          user?.photo ??
          user?.avatar ??
          user?.avatar_url ??
          user?.profile_photo_path ??
          user?.profile_photo_url ??
          user?.profile_photo ??
          user?.image_url ??
          user?.photo_url ??
          user?.image,
      ) ||
      undefined,
    followers: toNonNegativeNumber(raw?.followers ?? raw?.followers_count ?? raw?.follower_count ?? user?.followers_count),
    avg_rating: toNonNegativeNumber(raw?.avg_rating ?? raw?.average_rating ?? user?.avg_rating),
    books_count: toNonNegativeNumber(raw?.books_count ?? raw?.book_count ?? user?.books_count),
  };
}

function extractRawAuthorList(payload: any): any[] {
  const list =
    (Array.isArray(payload?.data?.data) && payload.data.data) ||
    (Array.isArray(payload?.data?.items) && payload.data.items) ||
    (Array.isArray(payload?.data?.users) && payload.data.users) ||
    (Array.isArray(payload?.data) && payload.data) ||
    (Array.isArray(payload?.items) && payload.items) ||
    (Array.isArray(payload?.authors) && payload.authors) ||
    (Array.isArray(payload?.users) && payload.users) ||
    (Array.isArray(payload?.results) && payload.results) ||
    (Array.isArray(payload) && payload) ||
    [];
  return Array.isArray(list) ? list : [];
}

function extractListMeta(payload: any): ApiListMeta | undefined {
  const candidates = [
    payload?.meta,
    payload?.data?.meta,
    payload?.data?.pagination,
    payload?.pagination,
    payload?.data,
    payload,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;

    const currentPage = Number(candidate?.current_page ?? candidate?.currentPage ?? candidate?.page);
    const lastPage = Number(candidate?.last_page ?? candidate?.lastPage ?? candidate?.total_pages ?? candidate?.totalPages);
    const perPage = Number(candidate?.per_page ?? candidate?.perPage ?? candidate?.limit);
    const total = Number(candidate?.total ?? candidate?.count ?? candidate?.total_items ?? candidate?.totalItems);

    if (Number.isFinite(currentPage) && currentPage >= 1 && Number.isFinite(lastPage) && lastPage >= 1) {
      return {
        current_page: currentPage,
        last_page: lastPage,
        per_page: Number.isFinite(perPage) && perPage > 0 ? perPage : 0,
        total: Number.isFinite(total) && total >= 0 ? total : 0,
      };
    }
  }

  return undefined;
}

function dedupeAuthors(items: AuthorType[]): AuthorType[] {
  const unique = new Map<string, AuthorType>();
  for (const item of items) {
    const key = `${item.id.toLowerCase()}::${item.name.toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function extractSingleAuthor(payload: any): AuthorType | null {
  const source = payload?.data ?? payload;
  return normalizeAuthor(source, 0);
}

function mapAuthorsFromBooks(books: Array<{author?: string; rating?: number}>): AuthorType[] {
  const map = new Map<string, {name: string; books_count: number; rating_total: number}>();
  for (const book of books) {
    const name = pickString(book?.author, 'Unknown Author');
    if (!map.has(name)) {
      map.set(name, {name, books_count: 0, rating_total: 0});
    }
    const item = map.get(name)!;
    item.books_count += 1;
    item.rating_total += Number(book?.rating || 0);
  }

  return Array.from(map.values())
    .map((item, index) => ({
      id: `books-${index + 1}`,
      name: item.name,
      books_count: item.books_count,
      avg_rating: item.books_count > 0 ? Number((item.rating_total / item.books_count).toFixed(1)) : undefined,
      bio: `${item.name} appears in the current library catalog.`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function shouldRetryListRequest(error: any): boolean {
  const status = Number(error?.status);
  if (!Number.isFinite(status)) return true;
  return [401, 403, 404, 405, 408, 422, 429, 500, 502, 503, 504].includes(status);
}

function buildListPath(endpoint: AuthorListEndpoint, params?: ListAuthorsParams): string {
  const query = {
    ...(params || {}),
    ...(endpoint.extraQuery || {}),
  };
  return withQuery(endpoint.path, query);
}

function filterAuthorRoleRecords(
  records: any[],
  source: Exclude<AuthorListSource, 'books-fallback'>,
): any[] {
  // /api/authors is already an author-scoped endpoint; keep all returned items.
  if (source === 'authors-endpoint') return records;

  // For user-list fallbacks, only exclude records that are explicitly non-author.
  // Keep records with missing role hints because some backends don't return role fields
  // even when the request itself is already filtered by role.
  return records.filter((item) => !hasRoleHint(item) || isAuthorRole(item));
}

function isRetryableGetError(error: any): boolean {
  const status = Number(error?.status);
  if (!Number.isFinite(status)) return true;
  return [401, 403, 404, 405, 408, 422, 429, 500, 502, 503, 504].includes(status);
}

export const authorService = {
  list: async (params?: ListAuthorsParams) => {
    let emptyResult:
      | {
          items: AuthorType[];
          meta: ApiListMeta | undefined;
          message: string | undefined;
          success: boolean | undefined;
          source: Exclude<AuthorListSource, 'books-fallback'>;
        }
      | null = null;

    let lastError: any = null;

    for (const endpoint of AUTHOR_LIST_ENDPOINTS) {
      try {
        const payload = (await apiClient.get(buildListPath(endpoint, params), {
          headers: {Accept: 'application/json'},
          auth: endpoint.auth !== false,
        })) as ApiEnvelope<any>;

        const payloads: ApiEnvelope<any>[] = [payload];
        const firstMeta = extractListMeta(payload);
        const hasExplicitPage = Number.isFinite(Number(params?.page)) && Number(params?.page) > 0;
        const maxAutoPages = 50;

        if (!hasExplicitPage && firstMeta && firstMeta.last_page > firstMeta.current_page) {
          const from = Math.max(2, firstMeta.current_page + 1);
          const to = Math.min(firstMeta.last_page, maxAutoPages);

          for (let page = from; page <= to; page += 1) {
            try {
              const nextPayload = (await apiClient.get(
                buildListPath(endpoint, {
                  ...(params || {}),
                  page,
                }),
                {
                  headers: {Accept: 'application/json'},
                  auth: endpoint.auth !== false,
                },
              )) as ApiEnvelope<any>;
              payloads.push(nextPayload);
            } catch (error: any) {
              if (!shouldRetryListRequest(error)) throw error;
              break;
            }
          }
        }

        const rawRecords = payloads.flatMap((entry) => extractRawAuthorList(entry));
        const scopedRecords = filterAuthorRoleRecords(rawRecords, endpoint.source);
        const items = dedupeAuthors(
          scopedRecords
            .map((item: any, index: number) => normalizeAuthor(item, index))
            .filter(Boolean) as AuthorType[],
        );

        const result = {
          items,
          meta: extractListMeta(payload) || payload?.meta,
          message: payload?.message,
          success: payload?.success,
          source: endpoint.source,
        };

        if (items.length > 0) return result;
        if (!emptyResult) emptyResult = result;
      } catch (error: any) {
        lastError = error;
        if (!shouldRetryListRequest(error)) throw error;
      }
    }

    if (emptyResult) return emptyResult;

    const fallbackBooks = await bookService.list({
      q: params?.q,
      page: params?.page,
      per_page: params?.per_page || 50,
    });

    return {
      items: mapAuthorsFromBooks(fallbackBooks.items),
      meta: fallbackBooks.meta,
      message: lastError?.message || 'Authors endpoint unavailable. Derived authors from books list.',
      success: true,
      source: 'books-fallback' as const,
    };
  },

  getById: async (id: string): Promise<AuthorType | null> => {
    const normalized = encodeURIComponent(pickString(id));
    if (!normalized) return null;

    const attempts: Array<{path: string; auth: boolean; enforceRole: boolean}> = [
      {path: `/api/authors/${normalized}`, auth: false, enforceRole: false},
      {path: `/api/authors/${normalized}`, auth: true, enforceRole: false},
      {path: `/api/users/${normalized}`, auth: false, enforceRole: true},
      {path: `/api/users/${normalized}`, auth: true, enforceRole: true},
      {path: `/api/admin/users/${normalized}`, auth: true, enforceRole: true},
      {path: `/api/auth/users/${normalized}`, auth: true, enforceRole: true},
    ];

    for (const attempt of attempts) {
      try {
        const payload = (await apiClient.get(attempt.path, {
          headers: {Accept: 'application/json'},
          auth: attempt.auth,
        })) as ApiEnvelope<any>;
        const raw = payload?.data ?? payload;

        if (attempt.enforceRole && hasRoleHint(raw) && !isAuthorRole(raw)) continue;

        const item = extractSingleAuthor(payload);
        if (item) return item;
      } catch (error: any) {
        if (!isRetryableGetError(error)) throw error;
      }
    }

    const listed = await authorService.list({per_page: 200});
    const direct = listed.items.find((item) => item.id === pickString(id));
    return direct || null;
  },

  getByName: async (name: string): Promise<AuthorType | null> => {
    const normalizedName = pickString(name);
    if (!normalizedName) return null;
    const encodedName = encodeURIComponent(normalizedName);
    const byNamePath = `/api/authors/by-name/${encodedName}`;

    try {
      const payload = (await apiClient.get(byNamePath, {
        headers: {Accept: 'application/json'},
        auth: false,
      })) as ApiEnvelope<any>;
      const item = extractSingleAuthor(payload);
      if (item) return item;
    } catch (error: any) {
      if (!isRetryableGetError(error)) throw error;
    }

    const result = await authorService.list({q: normalizedName, per_page: 100});
    const exact = result.items.find((item) => item.name.trim().toLowerCase() === normalizedName.toLowerCase());
    return exact || result.items[0] || null;
  },
};

export default authorService;
