import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';
import type {BookType} from '../types';
import {MOCK_BOOKS, NEW_ARRIVALS} from '../types';
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

function pickErrorMessage(error: any): string {
  return error?.data?.message || error?.message || 'Unable to load library data.';
}

export function LibraryProvider({children}: {children: React.ReactNode}) {
  const [books, setBooks] = useState<BookType[]>(() => MOCK_BOOKS);
  const [newArrivals, setNewArrivals] = useState<BookType[]>(() => NEW_ARRIVALS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<LibrarySource>('mock');

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await bookService.list({per_page: 50});
      if (response.items.length > 0) {
        setBooks(response.items);
        setNewArrivals(response.items.slice(0, 5));
        setSource('api');
      } else {
        setSource('mock');
      }
    } catch (requestError: any) {
      setSource('mock');
      setError(pickErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
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

