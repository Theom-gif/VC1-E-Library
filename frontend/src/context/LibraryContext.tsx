import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';
import type {BookType} from '../types';
import bookService from '../service/bookService';

type LibrarySource = 'api' | 'mock';

type LibraryState = {
  books: BookType[];
  newArrivals: BookType[];
  isLoading: boolean;
  error: string | null;
  source: LibrarySource;
  refresh: () => Promise<void>;
};

const LibraryContext = createContext<LibraryState | null>(null);

const ALLOW_MOCK_LIBRARY =
  String(import.meta.env.VITE_ALLOW_MOCK_LIBRARY || '').trim().toLowerCase() === 'true';

function pickErrorMessage(error: any): string {
  const message = error?.data?.message || error?.message || 'Unable to load library data.';
  const method = String(error?.method || '').trim();
  const url = String(error?.url || '').trim();
  const status = error?.status !== undefined ? String(error.status).trim() : '';
  const details = [status && `status ${status}`, method, url].filter(Boolean).join(' ');
  return details ? `${message} (${details})` : message;
}

export function LibraryProvider({children}: {children: React.ReactNode}) {
  const [books, setBooks] = useState<BookType[]>(() => []);
  const [newArrivals, setNewArrivals] = useState<BookType[]>(() => []);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<LibrarySource>('api');

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await bookService.list({per_page: 60, sort: 'newest'});
      setBooks(response.items);
      setNewArrivals(response.items.slice(0, 20));
      setSource('api');
    } catch (requestError: any) {
      if (ALLOW_MOCK_LIBRARY) {
        try {
          const mock = await import('../data/mockBooks');
          setBooks(mock.MOCK_BOOKS);
          setNewArrivals([...mock.NEW_ARRIVALS, ...mock.MOCK_BOOKS].slice(0, 20));
          setSource('mock');
          setError(null);
          return;
        } catch {
          // Fall through to the backend error below.
        }
      }
      setBooks([]);
      setNewArrivals([]);
      setSource('api');
      setError(pickErrorMessage(requestError));
    }
    finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    const AUTO_REFRESH_MS = 60_000;
    if (typeof window === 'undefined') return;

    const intervalId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void refresh();
    }, AUTO_REFRESH_MS);

    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void refresh();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      window.clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [refresh]);

  const value = useMemo(
    () => ({books, newArrivals, isLoading, error, source, refresh}),
    [books, newArrivals, isLoading, error, source, refresh],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const value = useContext(LibraryContext);
  if (!value) throw new Error('useLibrary must be used within <LibraryProvider>.');
  return value;
}

