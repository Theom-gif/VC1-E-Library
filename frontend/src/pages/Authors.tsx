import React from 'react';
import {Icons} from '../types';
import authorService, {AuthorType} from '../service/authorService';

interface AuthorsProps {
  onNavigate: (page: any, data?: any) => void;
}

function formatFollowers(value?: number): string {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return '0';
  const n = Number(value);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export default function Authors({onNavigate}: AuthorsProps) {
  const [query, setQuery] = React.useState('');
  const [authors, setAuthors] = React.useState<AuthorType[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [source, setSource] = React.useState<'authors-endpoint' | 'books-fallback'>('authors-endpoint');
  const [reloadTick, setReloadTick] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      setError('');

      void authorService
        .list({
          q: query.trim() || undefined,
          per_page: 60,
        })
        .then((response) => {
          if (!alive) return;
          setAuthors(response.items);
          setSource(response.source);
        })
        .catch((requestError: any) => {
          if (!alive) return;
          setError(requestError?.data?.message || requestError?.message || 'Unable to load authors from backend.');
          setAuthors([]);
        })
        .finally(() => {
          if (alive) setIsLoading(false);
        });
    }, 250);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query, reloadTick]);

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-20 py-10 space-y-10">
      <section className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-bg to-bg p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-primary">Library People</p>
            <h1 className="text-4xl font-black tracking-tight text-text">Author Directory</h1>
            <p className="max-w-2xl text-sm text-text-muted">
              Explore writers in our library and open their profile pages.
            </p>
          </div>

          <div className="w-full md:w-[360px]">
            <label htmlFor="authors-search" className="sr-only">Search authors</label>
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2">
              <Icons.Search className="size-4 text-text-muted" />
              <input
                id="authors-search"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search author name"
                className="w-full border-none bg-transparent text-sm text-text outline-none focus:outline-none focus:ring-0"
              />
            </div>
          </div>
        </div>
      </section>

      {source === 'books-fallback' && !error ? (
        <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-text-muted">
          Author list endpoint is unavailable. Showing authors derived from books API.
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-3xl border border-border bg-surface p-12 text-center">
          <p className="text-sm font-semibold text-text">Loading authors from backend...</p>
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-12 text-center space-y-3">
          <p className="text-base font-bold text-text">Could not load authors</p>
          <p className="text-sm text-text-muted">{error}</p>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
            onClick={() => {
              setReloadTick((value) => value + 1);
            }}
          >
            <Icons.Rss className="size-4" />
            Try Again
          </button>
        </div>
      ) : authors.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface p-12 text-center">
          <p className="text-base font-bold text-text">No authors found</p>
          <p className="mt-2 text-sm text-text-muted">Try another keyword.</p>
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {authors.map((author) => (
            <article
              key={author.id}
              className="rounded-3xl border border-border bg-surface p-6 transition-all hover:border-primary/35 hover:-translate-y-0.5"
            >
              <div className="flex items-start gap-4">
                <img
                  src={author.photo || `https://picsum.photos/seed/${encodeURIComponent(author.name)}/160/160`}
                  alt={author.name}
                  className="size-16 rounded-full border border-border object-cover"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-bold text-text">{author.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-text-muted">
                    {author.bio || `${author.name} is featured in our digital library.`}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-border bg-bg/60 px-2 py-2">
                  <p className="text-sm font-bold text-text">{author.books_count ?? 0}</p>
                  <p className="text-[10px] uppercase tracking-wider text-text-muted">Books</p>
                </div>
                <div className="rounded-xl border border-border bg-bg/60 px-2 py-2">
                  <p className="text-sm font-bold text-text">{author.avg_rating?.toFixed(1) ?? 'N/A'}</p>
                  <p className="text-[10px] uppercase tracking-wider text-text-muted">Rating</p>
                </div>
                <div className="rounded-xl border border-border bg-bg/60 px-2 py-2">
                  <p className="text-sm font-bold text-text">{formatFollowers(author.followers)}</p>
                  <p className="text-[10px] uppercase tracking-wider text-text-muted">Followers</p>
                </div>
              </div>

              <button
                type="button"
                className="mt-5 w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                onClick={() => onNavigate('author-details', author.name)}
              >
                View Author
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
