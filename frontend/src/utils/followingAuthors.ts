export type FollowingAuthorSnapshot = {
  id: string;
  name?: string;
  photo?: string;
  followers_count?: number;
};

type FollowingAuthorsStore = {
  byId: Record<string, FollowingAuthorSnapshot>;
};

const STORAGE_KEY = 'elibrary_following_authors_v1';
export const FOLLOWING_AUTHORS_EVENT = 'elibrary-following-authors-changed';

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function safeLocalStorageGet(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeLocalStorageRemove(key: string) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function normalizeId(value: unknown): string {
  const id = String(value ?? '').trim();
  return id.startsWith('api-') ? id.slice(4) : id;
}

function readStore(): FollowingAuthorsStore {
  const parsed = safeJsonParse<FollowingAuthorsStore>(safeLocalStorageGet(STORAGE_KEY), {byId: {}});
  const byId = parsed?.byId && typeof parsed.byId === 'object' ? parsed.byId : {};
  return {byId};
}

function writeStore(store: FollowingAuthorsStore) {
  if (!store || typeof store !== 'object') return;
  safeLocalStorageSet(STORAGE_KEY, JSON.stringify(store));
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(FOLLOWING_AUTHORS_EVENT));
    }
  } catch {
    // ignore
  }
}

export function isFollowingAuthor(authorId: string): boolean {
  const id = normalizeId(authorId);
  if (!id) return false;
  const store = readStore();
  return Boolean(store.byId?.[id]);
}

export function getFollowingAuthorSnapshot(authorId: string): FollowingAuthorSnapshot | null {
  const id = normalizeId(authorId);
  if (!id) return null;
  const store = readStore();
  return store.byId?.[id] || null;
}

export function setFollowingAuthor(
  author: FollowingAuthorSnapshot,
  isFollowing: boolean,
) {
  const id = normalizeId(author?.id);
  if (!id) return;

  const store = readStore();

  if (!isFollowing) {
    if (store.byId?.[id]) {
      const next = {...store.byId};
      delete next[id];
      if (!Object.keys(next).length) {
        safeLocalStorageRemove(STORAGE_KEY);
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(FOLLOWING_AUTHORS_EVENT));
          }
        } catch {
          // ignore
        }
        return;
      }
      writeStore({byId: next});
    }
    return;
  }

  const prev = store.byId?.[id] || {id};
  const next: FollowingAuthorSnapshot = {
    id,
    name: String(author?.name || prev.name || '').trim() || undefined,
    photo: String(author?.photo || prev.photo || '').trim() || undefined,
    followers_count:
      typeof author?.followers_count === 'number'
        ? author.followers_count
        : typeof prev.followers_count === 'number'
          ? prev.followers_count
          : undefined,
  };

  writeStore({byId: {...store.byId, [id]: next}});
}

export function listFollowingAuthorsFromCache(): FollowingAuthorSnapshot[] {
  const store = readStore();
  return Object.values(store.byId || {}).filter((item) => item && item.id);
}
