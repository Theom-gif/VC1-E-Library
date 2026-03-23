import * as React from 'react';
import type {BookType} from '../types';
import favoriteService from '../service/favoriteService';
import {toBookType} from '../service/bookMapper';
import {requestAuth} from '../utils/readerUpgrade';

type FavoritesState = {
  favorites: BookType[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isFavorite: (bookId: string) => boolean;
  add: (book: BookType) => Promise<void>;
  remove: (bookId: string) => Promise<void>;
  toggle: (book: BookType) => Promise<void>;
};

const FavoritesContext = React.createContext<FavoritesState | null>(null);

const STORAGE_KEY = 'elibrary_favorites_v1';

function normalizeBookId(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw.startsWith('api-') ? raw.slice(4) : raw;
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

function hasToken(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return Boolean(localStorage.getItem('token'));
  } catch {
    return false;
  }
}

function readLocalFavorites(): BookType[] {
  const raw = safeLocalStorageGet(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BookType[]) : [];
  } catch {
    return [];
  }
}

function writeLocalFavorites(favorites: BookType[]) {
  safeLocalStorageSet(STORAGE_KEY, JSON.stringify(favorites));
}

function extractArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.favorites)) return payload.favorites;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function uniqueById(books: BookType[]): BookType[] {
  const seen = new Set<string>();
  const out: BookType[] = [];
  for (const book of books) {
    const id = normalizeBookId(book?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(book);
  }
  return out;
}

function pickErrorMessage(error: any): string {
  const status = Number(error?.status);
  if (status === 401) {
    return 'Session expired. Favorites are saved locally on this device. Please login again to sync with your account.';
  }
  const message = error?.data?.message || error?.message || 'Unable to load favorites.';
  const method = String(error?.method || '').trim();
  const url = String(error?.url || '').trim();
  const statusLabel = error?.status !== undefined ? String(error.status).trim() : '';
  const details = [statusLabel && `status ${statusLabel}`, method, url].filter(Boolean).join(' ');
  return details ? `${message} (${details})` : message;
}

export function FavoritesProvider({children}: {children: React.ReactNode}) {
  const [favorites, setFavorites] = React.useState<BookType[]>(() => readLocalFavorites());
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const favoriteIds = React.useMemo(() => new Set(favorites.map((b) => normalizeBookId(b?.id))), [favorites]);

  const handleUnauthenticated = React.useCallback((requestError: any) => {
    const status = Number(requestError?.status);
    if (status !== 401) return false;
    // Token exists but backend rejects it. Treat as logged-out and keep local favorites.
    safeLocalStorageRemove('token');
    setError(pickErrorMessage(requestError));
    requestAuth('feature');
    return true;
  }, []);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!hasToken()) {
        const local = readLocalFavorites();
        setFavorites(local);
        writeLocalFavorites(local);
        return;
      }
      const payload = await favoriteService.list();
      const rawList = extractArray(payload);
      const mapped = uniqueById(rawList.map((item) => toBookType(item)));
      const local = readLocalFavorites();
      const merged = uniqueById([...mapped, ...local]);
      setFavorites(merged);
      writeLocalFavorites(merged);
    } catch (requestError: any) {
      const local = readLocalFavorites();
      setFavorites(local);
      if (handleUnauthenticated(requestError)) return;
      setError(pickErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [handleUnauthenticated]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    const handler = () => {
      void refresh();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('elibrary-token-changed', handler as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('elibrary-token-changed', handler as EventListener);
      }
    };
  }, [refresh]);

  const add = React.useCallback(async (book: BookType) => {
    const id = normalizeBookId(book?.id);
    if (!id) return;
    if (favoriteIds.has(id)) return;

    if (!hasToken()) {
      const next = uniqueById([book, ...favorites]);
      setFavorites(next);
      writeLocalFavorites(next);
      setError('Login required to save favorites to your account.');
      requestAuth('feature');
      return;
    }

    const next = uniqueById([book, ...favorites]);
    setFavorites(next);
    writeLocalFavorites(next);

    try {
      await favoriteService.add(id);
    } catch (requestError: any) {
      if (handleUnauthenticated(requestError)) return;
      setError(pickErrorMessage(requestError));
    }
  }, [favoriteIds, favorites, handleUnauthenticated]);

  const remove = React.useCallback(async (bookId: string) => {
    const id = normalizeBookId(bookId);
    if (!id) return;
    if (!favoriteIds.has(id)) return;

    if (!hasToken()) {
      const next = favorites.filter((b) => normalizeBookId(b?.id) !== id);
      setFavorites(next);
      writeLocalFavorites(next);
      setError('Login required to save favorites to your account.');
      requestAuth('feature');
      return;
    }

    const next = favorites.filter((b) => normalizeBookId(b?.id) !== id);
    setFavorites(next);
    writeLocalFavorites(next);

    try {
      await favoriteService.remove(id);
    } catch (requestError: any) {
      if (handleUnauthenticated(requestError)) return;
      setError(pickErrorMessage(requestError));
    }
  }, [favoriteIds, favorites, handleUnauthenticated]);

  const toggle = React.useCallback(async (book: BookType) => {
    const id = String(book?.id || '').trim();
    if (!id) return;
    if (favoriteIds.has(id)) return remove(id);
    return add(book);
  }, [add, favoriteIds, remove]);

  const value = React.useMemo<FavoritesState>(
    () => ({
      favorites,
      isLoading,
      error,
      refresh,
      isFavorite: (bookId: string) => favoriteIds.has(normalizeBookId(bookId)),
      add,
      remove,
      toggle,
    }),
    [favorites, isLoading, error, refresh, favoriteIds, add, remove, toggle],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const value = React.useContext(FavoritesContext);
  if (!value) throw new Error('useFavorites must be used within <FavoritesProvider>.');
  return value;
}
