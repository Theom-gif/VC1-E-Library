import * as React from 'react';
import { Icons, BookType } from '../types';
import apiClient from '../service/apiClient';

interface BookDetailsProps {
  book?: BookType | null;
  onNavigate: (page: any, data?: any) => void;
  onToggleFavorite: (bookId: string) => void;
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
}

const DEFAULT_USER_NAME = 'Alex Johnson';
const isNotFound = (error: any) => error?.status === 404;

const toRelativeTime = (value?: string | null) => {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diffMinutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const toNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeComment = (raw: any, index: number): Comment => ({
  id: String(raw?.id ?? raw?.comment_id ?? `api-${index}`),
  user: raw?.user?.name || raw?.user_name || raw?.author || DEFAULT_USER_NAME,
  avatar: raw?.user?.avatar || raw?.avatar || raw?.photo || `https://picsum.photos/seed/comment-${index}/100/100`,
  text: raw?.text || raw?.comment || raw?.content || raw?.message || '',
  time: toRelativeTime(raw?.created_at || raw?.updated_at || raw?.time),
  likes: toNumber(raw?.likes_count ?? raw?.likes ?? raw?.like_count, 0),
  replies: toNumber(raw?.replies ?? raw?.reply_count, 0),
  rating: toNumber(raw?.rating ?? raw?.stars, 0),
});

const extractCommentList = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.comments)) return data.comments;
  if (Array.isArray(data?.data?.comments)) return data.data.comments;
  return [];
};

const extractAverageRating = (data: any, fallback: number) =>
  toNumber(
    data?.average_rating ??
      data?.avg_rating ??
      data?.rating ??
      data?.data?.average_rating ??
      data?.data?.avg_rating ??
      data?.data?.rating ??
      data?.data?.average_rating ??
      data?.data?.avg_rating ??
      data?.data?.rating ??
      data?.book?.rating ??
      data?.data?.book?.rating,
    fallback,
  );

const extractRatingPayload = (data: any) => {
  const payload = data?.data ?? data ?? {};
  return {
    average: toNumber(payload?.average_rating, 0),
    total: toNumber(payload?.total_ratings, 0),
    userRating: payload?.user_rating ?? null,
  };
};

const requestFirstSuccess = async (
  method: 'GET' | 'POST' | 'PATCH',
  paths: string[],
  body?: Record<string, unknown>,
) => {
  let lastError: any;

  for (const path of paths) {
    try {
      if (method === 'GET') return await apiClient.get(path);
      if (method === 'POST') return await apiClient.post(path, body);
      return await apiClient.patch(path, body);
    } catch (error: any) {
      if (!isNotFound(error)) throw error;
      lastError = error;
    }
  }

  throw lastError || new Error(`${method} endpoint not found`);
};

const fetchBookComments = async (bookId: string) =>
  requestFirstSuccess('GET', [`/api/books/${bookId}/comments`]);

const createBookComment = async (bookId: string, payload: { text: string; parentId?: number | null }) =>
  requestFirstSuccess('POST', [`/api/books/${bookId}/comments`], {
    content: payload.text,
    parent_id: payload.parentId ?? null,
  });

const submitBookRating = async (bookId: string, rating: number) =>
  requestFirstSuccess('POST', [
    `/api/books/${bookId}/ratings`,
    `/api/books/${bookId}/rating`,
    '/api/rating',
  ], {
    rating,
  });

const fetchBookRatings = async (bookId: string) =>
  requestFirstSuccess('GET', [`/api/books/${bookId}/ratings`]);

export default function BookDetails({ book, onNavigate, onToggleFavorite }: BookDetailsProps) {
  const currentBook = book ?? null;
  if (!currentBook) {
    return (
      <div className="mx-auto max-w-7xl px-6 lg:px-20 py-16">
        <div className="rounded-3xl border border-border bg-surface p-10 text-center">
          <h2 className="text-2xl font-bold text-text">Select a book</h2>
          <p className="mt-2 text-sm text-text-muted">Choose a book from the database to view details.</p>
        </div>
      </div>
    );
  }
  const runtimeBook = currentBook as BookType & {
    readUrl?: string;
    read_url?: string;
    pdfUrl?: string;
    pdf_url?: string;
    uploaderName?: string;
  };
  const [commentText, setCommentText] = React.useState('');
  const [commentRating, setCommentRating] = React.useState(5);
  const [userRating, setUserRating] = React.useState(Math.round(currentBook.rating) || 5);
  const [displayRating, setDisplayRating] = React.useState(currentBook.rating);
  const [totalRatings, setTotalRatings] = React.useState(0);
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = React.useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = React.useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = React.useState(false);
  const [isOpeningReader, setIsOpeningReader] = React.useState(false);
  const [commentError, setCommentError] = React.useState<string | null>(null);
  const [ratingError, setRatingError] = React.useState<string | null>(null);
  const [readerUrl, setReaderUrl] = React.useState<string | null>(null);
  const readerBlobUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    setDisplayRating(currentBook.rating);
    setUserRating(Math.round(currentBook.rating) || 5);
    setCommentRating(5);
    setCommentText('');
    setCommentError(null);
    setRatingError(null);
    setTotalRatings(0);
    if (readerBlobUrlRef.current) {
      URL.revokeObjectURL(readerBlobUrlRef.current);
      readerBlobUrlRef.current = null;
    }
    setReaderUrl(null);
  }, [currentBook.id, currentBook.rating]);

  React.useEffect(() => {
    if (!readerUrl) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [readerUrl]);

  React.useEffect(() => {
    let isMounted = true;

    const loadComments = async () => {
      setIsLoadingComments(true);
      setCommentError(null);

      try {
        const data = await fetchBookComments(currentBook.id);
        if (!isMounted) return;

        const normalized = extractCommentList(data)
          .map((item, index) => normalizeComment(item, index))
          .filter((item) => item.text.trim().length > 0);

        setComments(normalized);
      } catch (error: any) {
        if (!isMounted) return;
        if (!isNotFound(error)) {
          setCommentError(error?.message || 'Unable to load comments.');
        }
        setComments([]);
      } finally {
        if (isMounted) setIsLoadingComments(false);
      }
    };

    loadComments();
    return () => {
      isMounted = false;
    };
  }, [currentBook.id]);

  React.useEffect(() => {
    let isMounted = true;

    const loadRatings = async () => {
      setRatingError(null);
      try {
        const data = await fetchBookRatings(currentBook.id);
        if (!isMounted) return;
        const payload = extractRatingPayload(data);
        if (payload.average > 0) {
          setDisplayRating(payload.average);
        }
        if (payload.userRating) {
          setUserRating(payload.userRating);
        }
        setTotalRatings(payload.total);
      } catch (error: any) {
        if (!isMounted) return;
        if (!isNotFound(error)) {
          setRatingError(error?.message || 'Unable to load ratings.');
        }
      }
    };

    loadRatings();
    return () => {
      isMounted = false;
    };
  }, [currentBook.id]);

  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    setCommentError(null);
    setIsSubmittingComment(true);

    const trimmedText = commentText.trim();

    try {
      const data = await createBookComment(currentBook.id, { text: trimmedText });
      const created = normalizeComment(
        data?.data || data,
        Date.now(),
      );

      setComments((prev) => [{ ...created, text: created.text || trimmedText }, ...prev]);
      setCommentText('');
      setCommentRating(5);

      if (commentRating) {
        try {
          const ratingData = await submitBookRating(currentBook.id, commentRating);
          setDisplayRating(extractAverageRating(ratingData, commentRating));
          const payload = extractRatingPayload(ratingData);
          setTotalRatings(payload.total || totalRatings);
          setUserRating(commentRating);
        } catch (error: any) {
          if (isNotFound(error)) {
            setRatingError('Rating API route not found on backend (404). Please add/create the rating endpoint.');
          } else {
            setRatingError(error?.message || 'Unable to submit rating.');
          }
        }
      }
    } catch (error: any) {
      if (isNotFound(error)) {
        setCommentError('Comment API route not found on backend (404). Please add/create the comment endpoint.');
      } else {
        setCommentError(error?.message || 'Unable to post comment.');
      }
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleRateBook = async (rating: number) => {
    setRatingError(null);
    setUserRating(rating);
    setIsSubmittingRating(true);

    try {
      const data = await submitBookRating(currentBook.id, rating);
      setDisplayRating(extractAverageRating(data, rating));
      const payload = extractRatingPayload(data);
      setTotalRatings(payload.total || totalRatings);
    } catch (error: any) {
      if (isNotFound(error)) {
        setRatingError('Rating API route not found on backend (404). Please add/create the rating endpoint.');
      } else {
        setRatingError(error?.message || 'Unable to submit rating.');
      }
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleReadNow = () => {
    const readUrl = runtimeBook.readUrl || runtimeBook.read_url || runtimeBook.pdfUrl || runtimeBook.pdf_url;
    if (readUrl) {
      setIsOpeningReader(true);
      apiClient
        .get(readUrl, { responseType: 'blob' })
        .then((blob: Blob) => {
          if (readerBlobUrlRef.current) {
            URL.revokeObjectURL(readerBlobUrlRef.current);
          }
          const blobUrl = URL.createObjectURL(blob);
          readerBlobUrlRef.current = blobUrl;
          setReaderUrl(blobUrl);
        })
        .catch(() => {
          if (readerBlobUrlRef.current) {
            URL.revokeObjectURL(readerBlobUrlRef.current);
            readerBlobUrlRef.current = null;
          }
          setReaderUrl(readUrl);
        })
        .finally(() => {
          setIsOpeningReader(false);
        });
      return;
    }
    alert('This book does not have a readable file yet.');
  };

  const handleCloseReader = () => {
    if (readerBlobUrlRef.current) {
      URL.revokeObjectURL(readerBlobUrlRef.current);
      readerBlobUrlRef.current = null;
    }
    setReaderUrl(null);
  };

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-20 py-10 space-y-12">
      {readerUrl ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-bg">
          <div className="flex items-center justify-between gap-4 border-b border-border bg-bg/90 px-6 py-4 backdrop-blur-md">
            <button
              onClick={handleCloseReader}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-bold text-text hover:bg-white/10 transition-all"
            >
              <Icons.ChevronLeft className="size-4" />
              Back
            </button>
            <div className="flex-1 text-center">
              <h2 className="text-sm sm:text-base font-bold text-text truncate">
                {currentBook.title}
              </h2>
              <p className="text-[11px] text-text-muted truncate">
                {currentBook.author}
              </p>
            </div>
            <div className="w-[84px]" />
          </div>
          <div className="flex-1 bg-black/90">
            <iframe
              src={readerUrl}
              title={`Read ${currentBook.title}`}
              className="h-full w-full"
            />
          </div>
        </div>
      ) : null}

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
            <img src={currentBook.cover} alt={currentBook.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleReadNow}
              className="bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
              disabled={isOpeningReader}
            >
              <Icons.BookOpen className="size-4" />
              {isOpeningReader ? 'Opening...' : 'Read Now'}
            </button>
            <button className="bg-surface text-text border border-border py-3 rounded-xl font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2">
              <Icons.Download className="size-4" />
              Download
            </button>
          </div>
          <button
            onClick={() => onToggleFavorite(currentBook.id)}
            className="w-full bg-surface text-text border border-border py-3 rounded-xl font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
          >
            <Icons.Heart className="size-4" />
            {currentBook.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
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
                  <p className="text-[10px] text-text-muted">Uploaded by {runtimeBook.uploaderName || currentBook.author}</p>
                </div>
              </div>
              <button className="px-4 py-1.5 rounded-lg border border-primary/30 text-primary text-[11px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all">
                Follow
              </button>
              <div className="h-8 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Icons.Star key={s} className={`size-4 ${s <= Math.floor(displayRating) ? 'text-yellow-500 fill-yellow-500' : 'text-text/10'}`} />
                  ))}
                </div>
                <span className="text-sm font-bold text-text">{displayRating.toFixed(1)}</span>
                <span className="text-xs text-text-muted">({totalRatings.toLocaleString()} ratings)</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Rate this book</p>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRateBook(star)}
                    disabled={isSubmittingRating}
                    className="disabled:opacity-50"
                    aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                  >
                    <Icons.Star
                      className={`size-5 transition-colors ${
                        star <= userRating ? 'text-yellow-500 fill-yellow-500' : 'text-text/40'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs text-text-muted">{isSubmittingRating ? 'Saving...' : `${userRating}/5`}</span>
              </div>
              {ratingError ? <p className="text-xs text-red-400">{ratingError}</p> : null}
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

          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-text">Community Discussion</h3>
              <span className="text-xs font-bold text-text-muted uppercase tracking-widest">{comments.length} Comments</span>
            </div>

            {/* Comment Input */}
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Your rating</span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setCommentRating(star)}
                      className="transition-colors"
                      aria-label={`Comment rating ${star} star${star > 1 ? 's' : ''}`}
                    >
                      <Icons.Star
                        className={`size-4 ${
                          star <= commentRating ? 'text-yellow-500 fill-yellow-500' : 'text-text/40'
                        }`}
                      />
                    </button>
                  ))}
                </div>
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
                        onClick={handlePostComment}
                        disabled={!commentText.trim() || isSubmittingComment}
                        className="bg-primary text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                      >
                        {isSubmittingComment ? 'Posting...' : 'Post Comment'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {commentError ? <p className="text-xs text-red-400">{commentError}</p> : null}
            </div>

            {/* Comments List */}
            <div className="space-y-4">
              {isLoadingComments ? (
                <div className="p-4 rounded-xl border border-border bg-surface text-sm text-text-muted">Loading comments...</div>
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
                      {comment.rating > 0 ? (
                        <div className="flex items-center gap-1">
                          <Icons.Star className="size-3 text-yellow-500 fill-yellow-500" />
                          <span className="text-xs font-bold text-text">{comment.rating.toFixed(1)}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-sm text-text-muted leading-relaxed">
                    {comment.text}
                  </p>
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
