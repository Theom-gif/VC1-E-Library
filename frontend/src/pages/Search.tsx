import React from 'react';
import {Icons} from '../types';
import type {BookType} from '../types';
import BookCard from '../components/BookCard';

interface SearchPageProps {
  query: string;
  results: BookType[];
  onNavigate: (page: any, data?: any) => void;
}

export default function SearchPage({ query, results, onNavigate }: SearchPageProps) {
  const q = query.trim();

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-20 py-10 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Search</h1>
          <p className="text-sm text-text-muted">
            {q ? (
              <>
                Results for <span className="text-text font-semibold">"{q}"</span> •{' '}
                <span className="text-text font-semibold">{results.length}</span>
              </>
            ) : (
              <>Type in the search bar to find books by title, author, or category.</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border hover:bg-white/10 transition-all text-sm font-semibold"
        >
          <Icons.ChevronLeft className="size-4" />
          Back
        </button>
      </div>

      {q && results.length === 0 ? (
        <div className="rounded-2xl bg-surface border border-border p-10 text-center">
          <div className="mx-auto size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
            <Icons.Search className="size-6" />
          </div>
          <h2 className="text-lg font-bold">No results found</h2>
          <p className="mt-1 text-sm text-text-muted">Try a different keyword or check the spelling.</p>
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {results.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onClick={() => onNavigate('book-details', book)}
              onAuthorClick={(author) => onNavigate('author-details', author)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

