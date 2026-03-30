import React from 'react';
import {motion} from 'motion/react';
import {Icons} from '../types';
import type {BookType} from '../types';
import BookCard from '../components/BookCard';
import AvatarImage from '../components/AvatarImage';
import {useLibrary} from '../context/LibraryContext';
import authorService, {AuthorType} from '../service/authorService';

type AuthorRef = string | {id?: string; name?: string};

interface AuthorDetailsProps {
  author: AuthorRef;
  onNavigate: (page: any, data?: any) => void;
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function formatFollowers(value?: number): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function toSafeRating(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

function averageRating(books: BookType[]): number {
  if (!books.length) return 0;
  const sum = books.reduce((acc, book) => acc + toSafeRating(book.rating), 0);
  return Number((sum / books.length).toFixed(1));
}

export default function AuthorDetails({author, onNavigate}: AuthorDetailsProps) {
  const {books, newArrivals} = useLibrary();
  const initialAuthorId = typeof author === 'string' ? '' : pickString(author?.id);
  const initialAuthorName = typeof author === 'string' ? pickString(author) : pickString(author?.name);

  const [authorData, setAuthorData] = React.useState<AuthorType | null>(null);
  const [isLoadingAuthor, setIsLoadingAuthor] = React.useState(true);
  const [authorError, setAuthorError] = React.useState('');

  React.useEffect(() => {
    let alive = true;
    setIsLoadingAuthor(true);
    setAuthorError('');

    const load = async () => {
      try {
        let item: AuthorType | null = null;
        if (initialAuthorId) item = await authorService.getById(initialAuthorId);
        if (!item && initialAuthorName) item = await authorService.getByName(initialAuthorName);

        if (!alive) return;
        setAuthorData(item);
      } catch (error: any) {
        if (!alive) return;
        setAuthorError(error?.data?.message || error?.message || 'Unable to load author details.');
      } finally {
        if (alive) setIsLoadingAuthor(false);
      }
    };

    void load();

    return () => {
      alive = false;
    };
  }, [initialAuthorId, initialAuthorName]);

  const displayName = pickString(authorData?.name, initialAuthorName, 'Unknown Author');

  const allBooks = React.useMemo(() => {
    const map = new Map<string, BookType>();
    [...books, ...newArrivals].forEach((book) => {
      const id = pickString(book?.id, `${book.title}-${book.author}`);
      if (!map.has(id)) map.set(id, book);
    });
    return Array.from(map.values());
  }, [books, newArrivals]);

  const authorBooks = React.useMemo(() => {
    const target = displayName.toLowerCase();
    return allBooks.filter((book) => pickString(book.author).toLowerCase() === target);
  }, [allBooks, displayName]);

  const [relatedAuthors, setRelatedAuthors] = React.useState<AuthorType[]>([]);

  React.useEffect(() => {
    let alive = true;
    void authorService
      .list({per_page: 20})
      .then((response) => {
        if (!alive) return;
        const items = response.items
          .filter((item) => item.name.trim().toLowerCase() !== displayName.trim().toLowerCase())
          .slice(0, 4);
        setRelatedAuthors(items);
      })
      .catch(() => {
        if (!alive) return;
        const fallback = Array.from(
          new Set(
            allBooks
              .map((book) => pickString(book.author))
              .filter(Boolean)
              .filter((name) => name.toLowerCase() !== displayName.toLowerCase()),
          ),
        )
          .slice(0, 4)
          .map((name, index) => ({id: `local-${index + 1}`, name}));
        setRelatedAuthors(fallback);
      });

    return () => {
      alive = false;
    };
  }, [allBooks, displayName]);

  const statsBooksCount = authorData?.books_count ?? authorBooks.length;
  const statsRating = toSafeRating(authorData?.avg_rating) || averageRating(authorBooks);
  const statsFollowers = formatFollowers(authorData?.followers);
  const authorBio =
    pickString(authorData?.bio) ||
    `${displayName} is a featured author in our digital library collection.`;
  const authorPhoto = pickString(authorData?.photo);

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-20 py-10 space-y-12">
      <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
        <button type="button" onClick={() => onNavigate('home')} className="hover:text-primary transition-colors">Home</button>
        <Icons.ChevronRight className="size-3" />
        <button type="button" onClick={() => onNavigate('authors')} className="hover:text-primary transition-colors">Authors</button>
        <Icons.ChevronRight className="size-3" />
        <span className="text-text">{displayName}</span>
      </nav>

      {authorError ? (
        <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-text-muted">
          {authorError}
        </div>
      ) : null}

      <section className="relative rounded-[2.5rem] overflow-hidden bg-surface border border-border p-8 md:p-12">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          <motion.div initial={{scale: 0.9, opacity: 0}} animate={{scale: 1, opacity: 1}} className="relative">
            <div className="size-40 md:size-56 rounded-full border-4 border-primary/20 p-2">
              <AvatarImage src={authorPhoto} alt={displayName} className="w-full h-full object-cover rounded-full shadow-2xl" />
            </div>
            <div className="absolute -bottom-2 -right-2 p-3 rounded-2xl bg-primary text-white shadow-lg shadow-primary/30">
              <Icons.Award className="size-6" />
            </div>
          </motion.div>

          <div className="flex-1 text-center md:text-left space-y-6">
            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-bold text-text tracking-tight">{displayName}</h1>
              <p className="text-primary font-bold uppercase tracking-widest text-sm">
                {isLoadingAuthor ? 'Loading author profile...' : 'Author Profile'}
              </p>
            </div>

            <p className="text-text-muted leading-relaxed max-w-2xl text-lg">{authorBio}</p>

            <div className="flex flex-wrap justify-center md:justify-start gap-8">
              <div className="text-center md:text-left">
                <p className="text-2xl font-bold text-text">{statsFollowers}</p>
                <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Followers</p>
              </div>
              <div className="text-center md:text-left border-x border-border px-8">
                <p className="text-2xl font-bold text-text">{statsBooksCount}</p>
                <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Books</p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-2xl font-bold text-text">{statsRating ? statsRating.toFixed(1) : 'N/A'}</p>
                <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Avg Rating</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Icons.Book className="size-6" />
            </div>
            <h3 className="text-2xl font-bold text-text">Books by {displayName}</h3>
          </div>
        </div>

        {authorBooks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
            {authorBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onClick={() => onNavigate('book-details', book)}
                onAuthorClick={(nextAuthor) => onNavigate('author-details', nextAuthor)}
              />
            ))}
          </div>
        ) : (
          <div className="py-20 flex flex-col items-center text-center space-y-4 bg-surface rounded-3xl border border-border">
            <div className="size-20 rounded-full bg-bg flex items-center justify-center text-text-muted/20">
              <Icons.Book className="size-10" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-text">No books found</h3>
              <p className="text-sm text-text-muted">We couldn't find books for this author in the current library list.</p>
            </div>
          </div>
        )}
      </section>

      {relatedAuthors.length ? (
        <section className="space-y-8">
          <h3 className="text-2xl font-bold text-text">Similar Authors</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {relatedAuthors.map((item) => (
              <button
                key={item.id}
                type="button"
                className="p-6 rounded-3xl bg-surface border border-border hover:border-primary/30 transition-all cursor-pointer group text-center"
                onClick={() => onNavigate('author-details', {id: item.id, name: item.name})}
              >
                <AvatarImage
                  src={pickString(item.photo)}
                  alt={item.name}
                  className="size-20 rounded-full mx-auto mb-4 object-cover border-2 border-border group-hover:border-primary transition-colors"
                />
                <h4 className="font-bold text-text group-hover:text-primary transition-colors">{item.name}</h4>
                <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest mt-1">Author</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
