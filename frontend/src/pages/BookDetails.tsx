import * as React from 'react';
import { Icons, BookType } from '../types';
import {useDownloads} from '../context/DownloadContext';
import {useLibrary} from '../context/LibraryContext';
import {useFavorites} from '../context/FavoritesContext';
import bookService from '../service/bookService';
import ratingService, {type BookRatingsSummary} from '../service/ratingService';
import reviewService from '../service/reviewService';
import CoverImage from '../components/CoverImage';
import {openReaderTab} from '../utils/openReaderTab';
import {PENDING_BOOK_RATING_KEY, requestAuth, shouldRequireAuthForRead, trackRead} from '../utils/readerUpgrade';

interface BookDetailsProps {
  book?: BookType | null;
  onNavigate: (page: any, data?: any) => void;
}

interface Comment {
  id: string;
  user: string;
  avatar: string;
  text: string;
  time: string;
  likes: number;
  replies: number;
  rating: number;
  canEdit?: boolean;
  canDelete?: boolean;
  likedByMe?: boolean;
}

function normalizeBackendBookId(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw.startsWith('api-') ? raw.slice(4) : raw;
}

function readToken(): string | null {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
}

function fallbackRatingsSummary(book: BookType): BookRatingsSummary {
  return {
    book_id: normalizeBackendBookId(book?.id),
    average_rating: Number(book?.rating) || 0,
    total_ratings: Number(book?.reviews) || 0,
    distribution: {'1': 0, '2': 0, '3': 0, '4': 0, '5': 0},
    user_rating: null,
  };
}

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

function formatRelativeTime(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const date = new Date(raw);
  const ms = date.getTime();
  if (Number.isNaN(ms)) return raw;

  const diffSeconds = Math.round((Date.now() - ms) / 1000);
  if (diffSeconds < 10) return 'Just now';
  if (diffSeconds < 60) return `${diffSeconds} seconds ago`;

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;

  const diffDays = Math.round(diffHours / 24);
  return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
}

function normalizeComment(raw: any, fallbackIndex: number): Comment {
  const source = pickObject(raw);
  const user = pickObject(source?.user);
  const id = pickString(source?.id, source?.review_id, source?.comment_id, `local-${fallbackIndex + 1}`);
  const avatar = pickString(user?.avatar, user?.photo, source?.avatar, source?.user_avatar);
  const createdAt = pickString(source?.created_at, source?.createdAt, source?.time);
  const rating = pickNumber(source?.rating, source?.stars, source?.score);
  return {
    id,
    user: pickString(user?.name, source?.user_name, source?.username, 'Library User'),
    avatar: avatar || 'https://picsum.photos/seed/user/100/100',
    text: pickString(source?.text, source?.comment, source?.body),
    time: formatRelativeTime(createdAt) || createdAt || '',
    likes: Math.max(0, Math.round(pickNumber(source?.likes, source?.likes_count, source?.like_count))),
    replies: Math.max(0, Math.round(pickNumber(source?.replies, source?.replies_count, source?.reply_count))),
    rating: Math.max(0, Math.min(5, rating || 0)),
    canEdit: Boolean(source?.can_edit ?? source?.canEdit),
    canDelete: Boolean(source?.can_delete ?? source?.canDelete),
    likedByMe: Boolean(source?.liked_by_me ?? source?.likedByMe),
  };
}

type PendingBookRating = {
  bookId: string;
  rating: number;
};

function readPendingBookRating(): PendingBookRating | null {
  try {
    const raw = sessionStorage.getItem(PENDING_BOOK_RATING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingBookRating;
    const bookId = normalizeBackendBookId(parsed?.bookId);
    const rating = Number(parsed?.rating || 0);
    if (!bookId || rating < 1 || rating > 5) return null;
    return {bookId, rating};
  } catch {
    return null;
  }
}

function savePendingBookRating(bookId: string, rating: number) {
  try {
    sessionStorage.setItem(
      PENDING_BOOK_RATING_KEY,
      JSON.stringify({bookId: normalizeBackendBookId(bookId), rating: Math.max(1, Math.min(5, Math.round(rating)))}),
    );
  } catch {
    // ignore storage issues
  }
}

function clearPendingBookRating() {
  try {
    sessionStorage.removeItem(PENDING_BOOK_RATING_KEY);
  } catch {
    // ignore storage issues
  }
}

export default function BookDetails({ book, onNavigate }: BookDetailsProps) {
  const {books} = useLibrary();
  const {startDownload, resume, openOffline, isDownloaded, activeById} = useDownloads();
  const {isFavorite, toggle} = useFavorites();
  const currentBook = book ?? books[0];
  if (!currentBook) return null;

  const active = activeById(String(currentBook.id));
  const downloaded = isDownloaded(String(currentBook.id));
  const favorite = isFavorite(String(currentBook.id));
  const [commentText, setCommentText] = React.useState('');
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null);
  const [editingText, setEditingText] = React.useState('');
  const [ratings, setRatings] = React.useState<BookRatingsSummary>(() => fallbackRatingsSummary(currentBook));
  const [ratingError, setRatingError] = React.useState('');
  const [selectedRating, setSelectedRating] = React.useState<number>(0);
  const [isLoadingRatings, setIsLoadingRatings] = React.useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = React.useState(false);
  const [isLoadingComments, setIsLoadingComments] = React.useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = React.useState(false);
  const [commentsError, setCommentsError] = React.useState('');
  const [comments, setComments] = React.useState<Comment[]>([]);

  const handlePostComment = async () => {
    const nextText = commentText.trim();
    if (!nextText) return;

    const normalizedBookId = normalizeBackendBookId(currentBook.id);
    if (!readToken()) {
      requestAuth('feature', {
        returnTo: {
          page: 'book-details',
          data: currentBook,
        },
      });
      return;
    }

    setIsSubmittingComment(true);
    setCommentsError('');
    try {
      const response = await reviewService.createForBook(normalizedBookId, {
        text: nextText,
        rating: Math.max(1, Math.min(5, Math.round(selectedRating || 5))),
      });
      const source = pickObject(response);
      const created = source?.data ?? source;
      const createdComment = normalizeComment(created, 0);
      setComments((prev) => [createdComment, ...prev.filter((c) => c.id !== createdComment.id)]);
      setCommentText('');
    } catch (error: any) {
      setCommentsError(error?.data?.message || error?.message || 'Unable to post your comment.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleEditStart = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingText(comment.text);
  };

  const handleEditSave = (id: string) => {
    const nextText = editingText.trim();
    if (!nextText) return;

    if (!readToken()) {
      requestAuth('feature', {
        returnTo: {
          page: 'book-details',
          data: currentBook,
        },
      });
      return;
    }

    setCommentsError('');
    void reviewService
      .update(id, {text: nextText})
      .then((response: any) => {
        const source = pickObject(response);
        const updated = source?.data ?? source;
        const normalized = normalizeComment(updated, 0);
        setComments((prev) =>
          prev.map((c) => (c.id === id ? {...c, text: normalized.text || nextText, rating: normalized.rating || c.rating} : c)),
        );
        setEditingCommentId(null);
        setEditingText('');
      })
      .catch((error: any) => {
        setCommentsError(error?.data?.message || error?.message || 'Unable to update this comment.');
      });
  };

  const handleEditCancel = () => {
    setEditingCommentId(null);
    setEditingText('');
  };

  React.useEffect(() => {
    const normalizedBookId = normalizeBackendBookId(currentBook.id);
    let alive = true;

    setRatings(fallbackRatingsSummary(currentBook));
    setSelectedRating(0);
    setRatingError('');
    setIsLoadingRatings(true);

    void ratingService
      .getForBook(normalizedBookId)
      .then((summary) => {
        if (!alive) return;
        setRatings(summary);
        setSelectedRating(summary.user_rating || 0);
      })
      .catch((error: any) => {
        if (!alive) return;
        setRatings(fallbackRatingsSummary(currentBook));
        if (Number(error?.status) !== 404) {
          setRatingError(error?.data?.message || error?.message || 'Unable to load rating information.');
        }
      })
      .finally(() => {
        if (alive) setIsLoadingRatings(false);
      });

    return () => {
      alive = false;
    };
  }, [currentBook]);

  React.useEffect(() => {
    const normalizedBookId = normalizeBackendBookId(currentBook.id);
    const pending = readPendingBookRating();
    if (!pending || pending.bookId !== normalizedBookId) return;
    if (!readToken()) return;
    if (isSubmittingRating) return;

    clearPendingBookRating();
    setSelectedRating(pending.rating);
    void submitRating(pending.rating);
  }, [currentBook.id, isSubmittingRating]);

  React.useEffect(() => {
    const normalizedBookId = normalizeBackendBookId(currentBook.id);
    let alive = true;

    setIsLoadingComments(true);
    setCommentsError('');

    void reviewService
      .listForBook(normalizedBookId, {page: 1, per_page: 10, sort: 'newest'})
      .then((payload: any) => {
        if (!alive) return;
        const source = pickObject(payload);
        const items = pickArray(source?.data, source?.results, source?.items, payload);
        setComments(items.map((item, index) => normalizeComment(item, index)));
      })
      .catch((error: any) => {
        if (!alive) return;
        if (Number(error?.status) !== 404) {
          setCommentsError(error?.data?.message || error?.message || 'Unable to load comments.');
        }
      })
      .finally(() => {
        if (alive) setIsLoadingComments(false);
      });

    return () => {
      alive = false;
    };
  }, [currentBook.id]);

  const submitRating = async (nextRating: number) => {
    const normalizedBookId = normalizeBackendBookId(currentBook.id);
    if (!nextRating) {
      setRatingError('Select a star rating first.');
      return;
    }
    if (!readToken()) {
      savePendingBookRating(normalizedBookId, nextRating);
      requestAuth('feature', {
        returnTo: {
          page: 'book-details',
          data: currentBook,
        },
      });
      return;
    }

    setIsSubmittingRating(true);
    setRatingError('');
    try {
      const submitted = await ratingService.submitForBook(normalizedBookId, {rating: nextRating});
      clearPendingBookRating();
      setRatings((prev) => ({
        ...prev,
        ...submitted,
        user_rating: submitted.user_rating || nextRating,
      }));

      const refreshed = await ratingService.getForBook(normalizedBookId);
      setRatings(refreshed);
      setSelectedRating(refreshed.user_rating || nextRating);
    } catch (error: any) {
      setRatingError(error?.data?.message || error?.message || 'Unable to submit your rating.');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleSubmitRating = async () => {
    await submitRating(selectedRating);
  };

  const handleQuickRate = async (star: number) => {
    setSelectedRating(star);
    setRatingError('');
    if (!readToken()) {
      savePendingBookRating(normalizeBackendBookId(currentBook.id), star);
      requestAuth('feature', {
        returnTo: {
          page: 'book-details',
          data: currentBook,
        },
      });
    } else {
      await submitRating(star);
    }
  };

  const displayAverageRating = ratings.average_rating > 0 ? ratings.average_rating : Number(currentBook.rating) || 0;
  const displayTotalRatings = ratings.total_ratings > 0 ? ratings.total_ratings : Number(currentBook.reviews) || 0;
  const activeUserRating = ratings.user_rating || selectedRating || 0;
  const summaryStarValue = activeUserRating || Math.round(displayAverageRating);

  const openOnline = async () => {
    if (shouldRequireAuthForRead()) {
      requestAuth('read-limit');
      return;
    }
    const normalizedBookId = normalizeBackendBookId(currentBook.id);
    const url = await bookService.readUrl(normalizedBookId);
    openReaderTab({
      title: currentBook.title || 'Read',
      url,
      tracking: {
        bookId: normalizedBookId,
        source: 'web',
      },
    });
    trackRead(normalizedBookId);
  };

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-20 py-10 space-y-12">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
        <button onClick={() => onNavigate('home')} className="hover:text-primary transition-colors">Home</button>
        <Icons.ChevronRight className="size-3" />
        <button onClick={() => onNavigate('categories')} className="hover:text-primary transition-colors">{currentBook.category}</button>
        <Icons.ChevronRight className="size-3" />
        <span className="text-text">{currentBook.title}</span>
      </nav>

      {/* Main Info */}
      <section className="flex flex-col lg:flex-row gap-12">
        <div className="w-full lg:w-80 shrink-0 space-y-6">
          <div className="relative aspect-[2/3] rounded-3xl overflow-hidden shadow-2xl border border-border">
            <CoverImage src={currentBook.cover} alt={currentBook.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                if (downloaded) {
                  if (shouldRequireAuthForRead()) {
                    requestAuth('read-limit');
                    return;
                  }
                  void openOffline(normalizeBackendBookId(currentBook.id))
                    .then(() => {
                      trackRead(normalizeBackendBookId(currentBook.id));
                    })
                    .catch((err: any) => {
                      window.alert(err?.message || 'Unable to open offline book.');
                    });
                  return;
                }
                void openOnline().catch((err: any) => {
                  window.alert(err?.message || 'Unable to open this book.');
                });
              }}
              className="bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              title={downloaded ? 'Open offline' : 'Read in browser'}
            >
              <Icons.BookOpen className="size-4" />
              {downloaded ? 'Read Offline' : 'Read Now'}
            </button>
            <button
              onClick={() => {
                if (downloaded) {
                  if (shouldRequireAuthForRead()) {
                    requestAuth('read-limit');
                    return;
                  }
                  void openOffline(normalizeBackendBookId(currentBook.id))
                    .then(() => {
                      trackRead(normalizeBackendBookId(currentBook.id));
                    })
                    .catch((err: any) => {
                      window.alert(err?.message || 'Unable to open offline book.');
                    });
                  return;
                }
                if (active && active.status === 'paused') {
                  void resume(currentBook);
                  onNavigate('downloads');
                  return;
                }
                void startDownload(currentBook);
                onNavigate('downloads');
              }}
              className="bg-surface text-text border border-border py-3 rounded-xl font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              disabled={Boolean(active && active.status === 'downloading')}
              title={downloaded ? 'Open offline' : 'Download for offline reading'}
            >
              <Icons.Download className="size-4" />
              {downloaded
                ? 'Open Offline'
                : active && active.status === 'downloading'
                  ? `Downloading ${active.progress}%`
                  : active && active.status === 'paused'
                    ? 'Resume Download'
                    : 'Download'}
            </button>
          </div>
          <button
            onClick={() => {
              void toggle(currentBook);
            }}
            className={`w-full border py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${favorite ? 'bg-rose-500 text-white border-rose-500 hover:bg-rose-500/90' : 'bg-surface text-text border-border hover:bg-white/10'}`}
            title={favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Icons.Heart className={`size-4 ${favorite ? 'fill-white' : ''}`} />
            {favorite ? 'Remove from Favorites' : 'Add to Favorites'}
          </button>
        </div>

        <div className="flex-1 space-y-8">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest">
                {currentBook.category}
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase tracking-widest">
                Best Seller
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight text-text">{currentBook.title}</h1>
            <div className="flex items-center gap-6">
              <div 
                className="flex items-center gap-3 cursor-pointer group/author"
                onClick={() => onNavigate('author-details', currentBook.author)}
              >
                <div className="size-10 rounded-full bg-surface border border-border overflow-hidden group-hover/author:border-primary transition-colors">
                  <img src={`https://picsum.photos/seed/${currentBook.author}/100/100`} alt={currentBook.author} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-xs font-bold text-text-muted uppercase tracking-tighter">Author</p>
                  <p className="text-sm font-bold text-text group-hover/author:text-primary transition-colors">{currentBook.author}</p>
                </div>
              </div>
              <button className="px-4 py-1.5 rounded-lg border border-primary/30 text-primary text-[11px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all">
                Follow
              </button>
              <div className="h-8 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void handleQuickRate(s)}
                      disabled={isSubmittingRating}
                      className="transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={`Rate this book ${s} star${s === 1 ? '' : 's'}`}
                      title={`Rate ${s} star${s === 1 ? '' : 's'}`}
                    >
                      <Icons.Star
                        className={`size-4 ${s <= summaryStarValue ? 'text-yellow-500 fill-yellow-500' : 'text-text/10'}`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-sm font-bold text-text">{displayAverageRating ? displayAverageRating.toFixed(2) : '0.00'}</span>
                <span className="text-xs text-text-muted">
                  ({displayTotalRatings.toLocaleString()} ratings)
                  {isSubmittingRating ? ' • Saving...' : activeUserRating ? ` • Your rating: ${activeUserRating}/5` : ' • Click stars to rate'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-6 border-y border-border">
            <BookStat label="Pages" value={currentBook.pages?.toString() || '342'} />
            <BookStat label="Language" value="English" />
            <BookStat label="Format" value="EPUB, PDF" />
            <BookStat label="Published" value="2021" />
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold text-text">About this book</h3>
            <p className="text-text-muted leading-relaxed">
              {currentBook.description || "In this groundbreaking work, the author explores the fundamental principles that govern our understanding of the world. Through a series of compelling narratives and rigorous analysis, the book challenges conventional wisdom and offers a fresh perspective on the challenges we face in the 21st century."}
            </p>
            <button className="text-sm font-bold text-primary hover:underline">Read More</button>
          </div>

          <div className="space-y-5 rounded-3xl border border-border bg-surface p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-bold text-text">Rate This Book</h3>
                <p className="text-sm text-text-muted">
                  {isLoadingRatings
                    ? 'Loading rating summary...'
                    : `${displayAverageRating ? displayAverageRating.toFixed(2) : '0.00'} average from ${displayTotalRatings.toLocaleString()} ratings`}
                </p>
              </div>
              <div className="rounded-2xl bg-bg px-4 py-3 text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Your Rating</p>
                <p className="text-lg font-bold text-text">{activeUserRating ? `${activeUserRating}/5` : 'Not rated'}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const isActive = star <= (selectedRating || ratings.user_rating || 0);
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => {
                      setSelectedRating(star);
                      setRatingError('');
                      void handleQuickRate(star);
                    }}
                    className={`rounded-xl border px-3 py-2 transition-all ${
                      isActive
                        ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-500'
                        : 'border-border bg-bg text-text-muted hover:border-primary/30 hover:text-primary'
                    }`}
                    aria-label={`Rate ${star} star${star === 1 ? '' : 's'}`}
                  >
                    <Icons.Star className={`size-5 ${isActive ? 'fill-current' : ''}`} />
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = Number(ratings.distribution[String(star)] || 0);
                const width = displayTotalRatings > 0 ? Math.round((count / displayTotalRatings) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-3">
                    <div className="flex w-10 items-center gap-1 text-xs font-bold text-text">
                      <span>{star}</span>
                      <Icons.Star className="size-3 fill-current text-yellow-500" />
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                      <div className="h-full rounded-full bg-primary" style={{width: `${width}%`}} />
                    </div>
                    <span className="w-8 text-right text-xs font-bold text-text-muted">{count}</span>
                  </div>
                );
              })}
            </div>

            {ratingError ? <p className="text-sm font-semibold text-red-500">{ratingError}</p> : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSubmitRating()}
                disabled={isSubmittingRating || isLoadingRatings}
                className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-60"
              >
                {isSubmittingRating ? 'Submitting...' : ratings.user_rating ? 'Update Rating' : 'Submit Rating'}
              </button>
              <p className="text-xs text-text-muted">
                Ratings require login and accept whole numbers from 1 to 5.
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-text">Community Discussion</h3>
              <span className="text-xs font-bold text-text-muted uppercase tracking-widest">
                {isLoadingComments ? 'Loading...' : `${comments.length} Comments`}
              </span>
            </div>
            {commentsError ? <p className="text-sm font-semibold text-red-500">{commentsError}</p> : null}

            {/* Comment Input */}
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="size-10 rounded-full bg-primary/20 shrink-0 overflow-hidden border border-border">
                  <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuD1haEXmvd-9CjxAle36WW70lL3Mx9lorZ1Q4k0kbEI9nmCj-ma1YtFbS2GBfNRTBE5BU01cGbyXGzI6wE9hbeZ-RY34Gy-JJLG7xxgWRY4HEFdxc5q-LNWEd7TElRZFb4C4zbB7wby_Mv0-gV-v1vD1AzSJCtmL1-hvVMi7Z68G5TjPhr8SoVt31XZrcogHgVqvw4aN3W9Y6WZdW0NWNbBCUnRffhuITfWhijdjYig6s_j3euhV_5pa3Fs4O5MNWESVnMB286u1ZI" alt="User" />
                </div>
                <div className="flex-1 space-y-3">
                  <textarea 
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Share your thoughts about this book..."
                    className="w-full bg-surface border border-border rounded-2xl p-4 text-sm text-text placeholder:text-text-muted focus:ring-primary focus:border-primary outline-none min-h-[100px] resize-none transition-all"
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={() => void handlePostComment()}
                      disabled={!commentText.trim() || isSubmittingComment}
                      className="bg-primary text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                    >
                      {isSubmittingComment ? 'Posting...' : 'Post Comment'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Comments List */}
            <div className="space-y-4">
              {isLoadingComments ? (
                <p className="text-sm text-text-muted">Loading comments...</p>
              ) : !comments.length ? (
                <p className="text-sm text-text-muted">No comments yet. Be the first to comment.</p>
              ) : null}
              {comments.map((comment) => (
                <div key={comment.id} className="p-6 rounded-2xl bg-surface border border-border space-y-4 hover:border-primary/30 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-primary/20 overflow-hidden border border-border">
                        <img src={comment.avatar} alt={comment.user} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text">{comment.user}</p>
                        <p className="text-[10px] text-text-muted">{comment.time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {(comment.canEdit || comment.user === 'Alex Johnson') && editingCommentId !== comment.id && (
                        <button 
                          onClick={() => handleEditStart(comment)}
                          className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
                        >
                          Edit
                        </button>
                      )}
                      <div className="flex items-center gap-1">
                        <Icons.Star className="size-3 text-yellow-500 fill-yellow-500" />
                        <span className="text-xs font-bold text-text">{comment.rating.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                  {editingCommentId === comment.id ? (
                    <div className="space-y-3">
                      <textarea 
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="w-full bg-surface border border-primary/30 rounded-xl p-3 text-sm text-text focus:ring-primary focus:border-primary outline-none min-h-[80px] resize-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={handleEditCancel}
                          className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-text-muted hover:text-text transition-colors uppercase tracking-widest"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => handleEditSave(comment.id)}
                          className="bg-primary text-white px-4 py-1.5 rounded-lg font-bold text-[10px] hover:bg-primary/90 transition-all uppercase tracking-widest"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted leading-relaxed">
                      {comment.text}
                    </p>
                  )}
                  <div className="flex items-center gap-4">
                    <button className="flex items-center gap-1 text-[10px] font-bold text-text-muted hover:text-primary transition-colors">
                      <Icons.Heart className="size-3" />
                      {comment.likes} Likes
                    </button>
                    <button className="flex items-center gap-1 text-[10px] font-bold text-text-muted hover:text-primary transition-colors">
                      <Icons.MessageSquare className="size-3" />
                      {comment.replies} Replies
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <button className="w-full py-3 rounded-xl border border-border text-sm font-bold text-text-muted hover:bg-surface transition-all">
              View All {comments.length + 123} Reviews
            </button>
          </div>
        </div>
      </section>

      {/* Similar Books */}
      <section className="space-y-6">
        <h3 className="text-2xl font-bold">Similar Books</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {books.slice(0, 6).map((item) => (
            <div 
              key={item.id} 
              onClick={() => onNavigate('book-details', item)}
              className="group cursor-pointer space-y-2"
            >
              <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-lg">
                <CoverImage src={item.cover} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <h4 className="text-xs font-bold text-text group-hover:text-primary transition-colors line-clamp-1">{item.title}</h4>
              <p className="text-[10px] text-text-muted">{item.author}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function BookStat({ label, value }: { label: string, value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{label}</p>
      <p className="text-sm font-bold text-text">{value}</p>
    </div>
  );
}
