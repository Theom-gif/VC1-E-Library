import * as React from 'react';
import {Icons} from '../types';
import type {BookType} from '../types';
import {useDownloads} from '../context/DownloadContext';
import {useLibrary} from '../context/LibraryContext';
import {useFavorites} from '../context/FavoritesContext';
import bookService from '../service/bookService';
import ratingService, {type BookRatingsSummary} from '../service/ratingService';
import reviewService from '../service/reviewService';
import authorService from '../service/authorService';
import CoverImage from '../components/CoverImage';
import {openReaderTab} from '../utils/openReaderTab';
import {sweetAlert, sweetConfirm} from '../utils/sweetAlert';
import {isFollowingAuthor, setFollowingAuthor} from '../utils/followingAuthors';
import {
  PENDING_BOOK_RATING_KEY,
  hasAuthenticatedSession,
  requestAuth,
  shouldRequireAuthForRead,
  trackRead,
} from '../utils/readerUpgrade';
import authService from '../service/authService';
import {API_BASE_URL} from '../service/apiClient';

interface BookDetailsProps {
  book?: BookType | null;
  onNavigate: (page: any, data?: any) => void;
}

interface Comment {
  id: string;
  userId?: string;
  user: string;
  avatar: string;
  text: string;
  time: string;
  createdAt?: string;
  likes: number;
  replies: number;
  rating: number;
  canEdit?: boolean;
  canDelete?: boolean;
  likedByMe?: boolean;
  replyItems?: CommentReply[];
}

interface CommentReply {
  id: string;
  userId?: string;
  user: string;
  avatar: string;
  text: string;
  time: string;
  createdAt?: string;
  canEdit?: boolean;
  canDelete?: boolean;
}

function normalizeBackendBookId(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw.startsWith('api-') ? raw.slice(4) : raw;
}

function readToken(): string | null {
  try {
    return authService.getToken();
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

function canUseProtectedFeatures(): boolean {
  return Boolean(readToken()) || hasAuthenticatedSession();
}

const PROFILE_CACHE_KEY = 'elibrary_profile_cache';
const SESSION_KEY = 'elibrary_session';
const ONE_TIME_RATINGS_KEY = 'elibrary_one_time_ratings_v1';
const MAX_RATINGS_PER_USER = 300;
const authorPhotoCache = new Map<string, string>();

type StoredRatingsByUser = Record<string, Record<string, number>>;

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

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readCurrentProfile(): {name: string; photo: string} {
  const session = safeJsonParse<any>(typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null, {});
  const cache = safeJsonParse<any>(typeof localStorage !== 'undefined' ? localStorage.getItem(PROFILE_CACHE_KEY) : null, {});
  return {
    name: pickString(cache?.name, session?.name, 'Library User'),
    photo: pickString(cache?.photo, ''),
  };
}

function readSessionUserId(): string {
  const session = safeJsonParse<any>(safeLocalStorageGet(SESSION_KEY), {});
  const id = String(session?.id || '').trim();
  return id && id !== 'guest' ? id : '';
}

function fallbackProfilePhoto(seed: string, size = 100): string {
  const raw = String(seed || '').trim() || 'user';
  const safeSize = Math.max(40, Math.min(256, Math.round(Number(size) || 100)));
  // "Real" placeholder portraits (stable by seed).
  return `https://i.pravatar.cc/${safeSize}?u=${encodeURIComponent(raw)}`;
}

function stableHash(value: string): string {
  // FNV-1a 32-bit (good enough for local storage keys).
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16);
}

function getRatingUserKey(): string {
  const id = readSessionUserId();
  if (id) return `u_${id}`;
  const token = String(readToken() || '').trim();
  if (token) return `tok_${stableHash(token)}`;
  return 'guest';
}

function readStoredRatings(): StoredRatingsByUser {
  const raw = safeLocalStorageGet(ONE_TIME_RATINGS_KEY);
  const parsed = safeJsonParse<any>(raw, {});
  return parsed && typeof parsed === 'object' ? (parsed as StoredRatingsByUser) : {};
}

function writeStoredRatings(next: StoredRatingsByUser) {
  safeLocalStorageSet(ONE_TIME_RATINGS_KEY, JSON.stringify(next));
}

function getStoredBookRating(userKey: string, bookId: string): number {
  const normalizedUserKey = String(userKey || '').trim();
  const normalizedBookId = normalizeBackendBookId(bookId);
  if (!normalizedUserKey || !normalizedBookId) return 0;
  const store = readStoredRatings();
  const rating = Number(store?.[normalizedUserKey]?.[normalizedBookId] || 0);
  if (rating >= 1 && rating <= 5) return Math.round(rating);
  return 0;
}

function setStoredBookRating(userKey: string, bookId: string, rating: number) {
  const normalizedUserKey = String(userKey || '').trim();
  const normalizedBookId = normalizeBackendBookId(bookId);
  const nextRating = Math.max(1, Math.min(5, Math.round(Number(rating) || 0)));
  if (!normalizedUserKey || !normalizedBookId || !nextRating) return;

  const store = readStoredRatings();
  const perUser = store?.[normalizedUserKey] && typeof store[normalizedUserKey] === 'object' ? store[normalizedUserKey] : {};
  perUser[normalizedBookId] = nextRating;

  const keys = Object.keys(perUser);
  if (keys.length > MAX_RATINGS_PER_USER) {
    for (const k of keys.slice(0, keys.length - MAX_RATINGS_PER_USER)) {
      delete perUser[k];
    }
  }

  store[normalizedUserKey] = perUser;
  writeStoredRatings(store);
}

function asAbsoluteAssetUrl(value: string): string {
  const raw = String(value || '').trim().replace(/\\/g, '/');
  if (!raw) return '';
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;

  const base =
    String(API_BASE_URL || '').trim().replace(/\/+$/, '') ||
    (typeof window !== 'undefined' ? String(window.location.origin || '') : '');

  const withoutPublicPrefix = raw.replace(/^\/?public\//, '');
  const withoutAppPublic = withoutPublicPrefix.replace(/^\/?storage\/app\/public\//, 'storage/');
  const withoutPublicStorage = withoutAppPublic.replace(/^\/?public\/storage\//, 'storage/');
  const normalized = withoutPublicStorage.replace(/^\/+/, '');

  if (!base) return raw.startsWith('/') ? raw : `/${normalized}`;
  if (raw.startsWith('/')) return `${base}/${normalized}`;
  if (normalized.startsWith('storage/')) return `${base}/${normalized}`;
  if (normalized.startsWith('uploads/') || normalized.startsWith('images/') || normalized.startsWith('assets/')) {
    return `${base}/${normalized}`;
  }
  return `${base}/storage/${normalized}`;
}

function parseRelativeAgoToIso(value: string): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const match = raw.match(/^(\d+)\s*(second|minute|hour|day|week)s?\s*ago$/i);
  if (!match) return '';
  const n = Math.max(0, Number(match[1] || 0));
  const unit = match[2];
  const seconds =
    unit === 'week'
      ? n * 7 * 24 * 60 * 60
      : unit === 'day'
        ? n * 24 * 60 * 60
        : unit === 'hour'
          ? n * 60 * 60
          : unit === 'minute'
            ? n * 60
            : n;
  return new Date(Date.now() - seconds * 1000).toISOString();
}

function formatRelativeTime(value: unknown, nowMs = Date.now()): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const date = new Date(raw);
  const ms = date.getTime();
  if (Number.isNaN(ms)) return raw;

  const diffSeconds = Math.round((nowMs - ms) / 1000);
  if (diffSeconds < 10) return 'Just now';
  if (diffSeconds < 60) return `${diffSeconds} seconds ago`;

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;

  const diffDays = Math.round(diffHours / 24);
  return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
}

function normalizeCommentReply(raw: any, fallbackIndex: number): CommentReply {
  const source = pickObject(raw);
  const user = pickObject(source?.user);
  const profile = readCurrentProfile();
  const first = pickString(user?.firstname, source?.firstname, source?.first_name);
  const last = pickString(user?.lastname, source?.lastname, source?.last_name);
  const derivedName = pickString(`${first} ${last}`.trim());
  const id = pickString(source?.id, source?.reply_id, source?.comment_id, `reply-local-${fallbackIndex + 1}`);
  const userId = pickString(user?.id, user?.user_id, source?.user_id, source?.userId);
  const avatarRaw = pickString(
    user?.avatar,
    user?.avatar_url,
    user?.photo,
    user?.photo_url,
    user?.profile_photo_url,
    user?.profile_photo,
    user?.image,
    source?.avatar,
    source?.user_avatar,
    source?.user_photo,
    source?.user_image,
  );
  const createdAtRaw = pickString(source?.created_at, source?.createdAt, source?.timestamp, source?.time);
  const derivedCreatedAt = parseRelativeAgoToIso(createdAtRaw);
  const createdAt = derivedCreatedAt || createdAtRaw;
  const displayName = pickString(user?.name, derivedName, source?.user_name, source?.username, profile.name, 'Library User');
  const avatarFallback = displayName.trim().toLowerCase() === profile.name.trim().toLowerCase() ? profile.photo : '';
  const avatar =
    asAbsoluteAssetUrl(avatarRaw) ||
    asAbsoluteAssetUrl(avatarFallback) ||
    fallbackProfilePhoto(userId || displayName, 100);

  return {
    id,
    userId: userId || undefined,
    user: displayName,
    avatar,
    text: pickString(source?.text, source?.content, source?.comment, source?.body, source?.message),
    time: createdAt ? formatRelativeTime(createdAt) : pickString(source?.time) || '',
    createdAt: createdAt && !Number.isNaN(new Date(createdAt).getTime()) ? new Date(createdAt).toISOString() : undefined,
    canEdit: Boolean(source?.can_edit ?? source?.canEdit),
    canDelete: Boolean(source?.can_delete ?? source?.canDelete),
  };
}

function normalizeComment(raw: any, fallbackIndex: number): Comment {
  const source = pickObject(raw);
  const user = pickObject(source?.user);
  const profile = readCurrentProfile();
  const first = pickString(user?.firstname, source?.firstname, source?.first_name);
  const last = pickString(user?.lastname, source?.lastname, source?.last_name);
  const derivedName = pickString(`${first} ${last}`.trim());
  const id = pickString(source?.id, source?.review_id, source?.comment_id, `local-${fallbackIndex + 1}`);
  const userId = pickString(user?.id, user?.user_id, source?.user_id, source?.userId);
  const avatarRaw = pickString(
    user?.avatar,
    user?.avatar_url,
    user?.photo,
    user?.photo_url,
    user?.profile_photo_url,
    user?.profile_photo,
    user?.image,
    source?.avatar,
    source?.user_avatar,
    source?.user_photo,
    source?.user_image,
  );
  const createdAtRaw = pickString(source?.created_at, source?.createdAt, source?.timestamp, source?.time);
  const derivedCreatedAt = parseRelativeAgoToIso(createdAtRaw);
  const createdAt = derivedCreatedAt || createdAtRaw;
  const rating = pickNumber(source?.rating, source?.stars, source?.score);
  const displayName = pickString(user?.name, derivedName, source?.user_name, source?.username, profile.name, 'Library User');
  const avatarFallback = displayName.trim().toLowerCase() === profile.name.trim().toLowerCase() ? profile.photo : '';
  const avatar =
    asAbsoluteAssetUrl(avatarRaw) ||
    asAbsoluteAssetUrl(avatarFallback) ||
    fallbackProfilePhoto(userId || displayName, 100);
  const nestedReplies = Array.isArray(source?.replies)
    ? source.replies
    : pickArray(source?.replies?.data, source?.replies_data, source?.children, source?.children?.data);
  const replyItems = nestedReplies.map((item: any, index: number) => normalizeCommentReply(item, index));
  const repliesCount = Math.max(
    Math.max(0, Math.round(pickNumber(source?.replies, source?.replies_count, source?.reply_count))),
    replyItems.length,
  );
  return {
    id,
    userId: userId || undefined,
    user: displayName,
    avatar,
    text: pickString(source?.text, source?.content, source?.comment, source?.body, source?.message),
    time: createdAt ? formatRelativeTime(createdAt) : pickString(source?.time) || '',
    createdAt: createdAt && !Number.isNaN(new Date(createdAt).getTime()) ? new Date(createdAt).toISOString() : undefined,
    likes: Math.max(0, Math.round(pickNumber(source?.likes, source?.likes_count, source?.like_count))),
    replies: repliesCount,
    rating: Math.max(0, Math.min(5, rating || 0)),
    canEdit: Boolean(source?.can_edit ?? source?.canEdit),
    canDelete: Boolean(source?.can_delete ?? source?.canDelete),
    likedByMe: Boolean(source?.liked_by_me ?? source?.likedByMe),
    replyItems,
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
  const normalizedBookId = normalizeBackendBookId(currentBook.id);
  const currentProfile = readCurrentProfile();
  const [authorPhoto, setAuthorPhoto] = React.useState<string>('');
  const [authorInfo, setAuthorInfo] = React.useState<{id?: string; name?: string; photo?: string; followers_count?: number; is_following?: boolean} | null>(null);
  const [isTogglingFollow, setIsTogglingFollow] = React.useState(false);
  const [nowTick, setNowTick] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    const authorName = pickString(currentBook.author);
    const authorId = pickString(currentBook.authorId);
    if (!authorName) {
      setAuthorPhoto('');
      setAuthorInfo(null);
      return;
    }
    const cacheKey = authorId ? `id:${authorId}` : `name:${authorName}`;
    const cached = authorPhotoCache.get(cacheKey);
    if (cached) {
      setAuthorPhoto(cached);
      setAuthorInfo((prev) => prev || {id: authorId || prev?.id, name: authorName, photo: cached});
      return;
    }

    let alive = true;
    const loadAuthor = authorId ? authorService.getById(authorId) : authorService.getByName(authorName);

    void loadAuthor
      .then((author) => {
        if (!alive) return;
        const next = String(author?.photo || '').trim() || fallbackProfilePhoto(authorName, 100);
        authorPhotoCache.set(cacheKey, next);
        setAuthorPhoto(next);
        setAuthorInfo(
          author
            ? {
                id: author.id,
                name: author.name,
                photo: next,
                followers_count: author.followers_count ?? author.followers,
                is_following:
                  typeof author.is_following === 'boolean'
                    ? author.is_following
                    : author.id
                      ? isFollowingAuthor(author.id)
                      : undefined,
              }
            : {name: authorName, photo: next},
        );
      })
      .catch(() => {
        if (!alive) return;
        const next = fallbackProfilePhoto(authorName, 100);
        authorPhotoCache.set(cacheKey, next);
        setAuthorPhoto(next);
        setAuthorInfo((prev) => prev || {name: authorName, photo: next});
      });

    return () => {
      alive = false;
    };
  }, [currentBook.author]);

  const cachedIsFollowing = authorInfo?.id ? isFollowingAuthor(authorInfo.id) : false;
  const isFollowing = Boolean(authorInfo?.is_following) || cachedIsFollowing;

  const toggleFollow = async () => {
    const authorId = String(authorInfo?.id || '').trim();
    const authorName = pickString(authorInfo?.name, currentBook.author);
    if (!authorId) return;

    if (!canUseProtectedFeatures()) {
      requestAuth('feature', {returnTo: {page: 'book-details', data: currentBook}});
      return;
    }

    if (isTogglingFollow) return;
    setIsTogglingFollow(true);
    try {
      const result = isFollowing ? await authorService.unfollow(authorId) : await authorService.follow(authorId);
      const canonicalAuthorId = String((result as any)?.author_id || authorId).trim() || authorId;
      const nextFollowers =
        typeof result.followers_count === 'number'
          ? result.followers_count
          : Math.max(0, Math.round(Number(authorInfo?.followers_count ?? 0)) + (result.is_following ? 1 : -1));
      setAuthorInfo((prev) =>
        prev
          ? {
              ...prev,
              is_following: Boolean(result.is_following),
              followers_count: nextFollowers,
            }
          : prev,
      );
      const nextFollowing = Boolean(result.is_following);
      setFollowingAuthor(
        {id: authorId, name: authorName, photo: pickString(authorInfo?.photo, authorPhoto), followers_count: nextFollowers},
        nextFollowing,
      );
      if (canonicalAuthorId !== authorId) {
        setFollowingAuthor(
          {id: canonicalAuthorId, name: authorName, photo: pickString(authorInfo?.photo, authorPhoto), followers_count: nextFollowers},
          nextFollowing,
        );
      }
    } catch (error: any) {
      const status = Number(error?.status);
      if (status === 401 || status === 403) {
        requestAuth('feature', {returnTo: {page: 'book-details', data: currentBook}});
        return;
      }
      if (status === 404 || status === 405) {
        const next = !isFollowing;
        const nextFollowers = Math.max(0, Math.round(Number(authorInfo?.followers_count ?? 0)) + (next ? 1 : -1));
        setAuthorInfo((prev) => (prev ? {...prev, is_following: next, followers_count: nextFollowers} : prev));
        setFollowingAuthor(
          {id: authorId, name: authorName, photo: pickString(authorInfo?.photo, authorPhoto), followers_count: nextFollowers},
          next,
        );
        return;
      }
      // Ignore other errors; keep UI state.
    } finally {
      setIsTogglingFollow(false);
    }
  };

  const active = activeById(String(currentBook.id));
  const downloaded = isDownloaded(String(currentBook.id));
  const favorite = isFavorite(String(currentBook.id));
  const [commentText, setCommentText] = React.useState('');
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null);
  const [editingText, setEditingText] = React.useState('');
  const [ratings, setRatings] = React.useState<BookRatingsSummary>(() => fallbackRatingsSummary(currentBook));
  const [ratingError, setRatingError] = React.useState('');
  const [selectedRating, setSelectedRating] = React.useState<number>(0);
  const ratingUserKey = getRatingUserKey();
  const storedUserRating = getStoredBookRating(ratingUserKey, normalizedBookId);
  const ratingLockedValue = Number(ratings.user_rating || 0) || storedUserRating || 0;
  const isRatingLocked = Boolean(ratingLockedValue);
  const [isLoadingRatings, setIsLoadingRatings] = React.useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = React.useState(false);
  const [isLoadingComments, setIsLoadingComments] = React.useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = React.useState(false);
  const [commentsError, setCommentsError] = React.useState('');
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [commentsPage, setCommentsPage] = React.useState(1);
  const [commentsHasMore, setCommentsHasMore] = React.useState(false);
  const [commentsTotal, setCommentsTotal] = React.useState<number | null>(null);
  const [isLoadingMoreComments, setIsLoadingMoreComments] = React.useState(false);
  const [commentsReloadKey, setCommentsReloadKey] = React.useState(0);
  const [deletingCommentId, setDeletingCommentId] = React.useState<string | null>(null);
  const [openRepliesByCommentId, setOpenRepliesByCommentId] = React.useState<Record<string, boolean>>({});
  const [replyDraftsByCommentId, setReplyDraftsByCommentId] = React.useState<Record<string, string>>({});
  const [replySubmittingByCommentId, setReplySubmittingByCommentId] = React.useState<Record<string, boolean>>({});

  const handlePostComment = async () => {
    const nextText = commentText.trim();
    if (!nextText) return;

    const normalizedBookId = normalizeBackendBookId(currentBook.id);
    if (!canUseProtectedFeatures()) {
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

    if (!canUseProtectedFeatures()) {
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

  const handleDeleteComment = async (comment: Comment) => {
    const commentId = String(comment?.id || '').trim();
    if (!commentId || deletingCommentId === commentId) return;

    if (!canUseProtectedFeatures()) {
      requestAuth('feature', {
        returnTo: {
          page: 'book-details',
          data: currentBook,
        },
      });
      return;
    }

    const ok =
      typeof window === 'undefined'
        ? true
        : await sweetConfirm('Delete this comment?', {icon: 'warning', title: 'Confirm', confirmText: 'Delete'});
    if (!ok) return;

    setDeletingCommentId(commentId);
    setCommentsError('');
    try {
      await reviewService.remove(commentId);
      setComments((prev) => prev.filter((item) => item.id !== commentId));
      setCommentsTotal((prev) => (typeof prev === 'number' ? Math.max(0, prev - 1) : prev));
      setOpenRepliesByCommentId((prev) => {
        const next = {...prev};
        delete next[commentId];
        return next;
      });
      setReplyDraftsByCommentId((prev) => {
        const next = {...prev};
        delete next[commentId];
        return next;
      });
      setReplySubmittingByCommentId((prev) => {
        const next = {...prev};
        delete next[commentId];
        return next;
      });
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditingText('');
      }
    } catch (error: any) {
      const status = Number(error?.status);
      if (status === 401) {
        requestAuth('feature', {
          returnTo: {
            page: 'book-details',
            data: currentBook,
          },
        });
        return;
      }
      if (status === 404) {
        // Already gone on backend; keep UI consistent.
        setComments((prev) => prev.filter((item) => item.id !== commentId));
        setCommentsTotal((prev) => (typeof prev === 'number' ? Math.max(0, prev - 1) : prev));
        return;
      }
      setCommentsError(error?.data?.message || error?.message || 'Unable to delete this comment.');
    } finally {
      setDeletingCommentId((prev) => (prev === commentId ? null : prev));
    }
  };

  const toggleRepliesPanel = (commentId: string) => {
    setOpenRepliesByCommentId((prev) => ({...prev, [commentId]: !prev[commentId]}));
  };

  const handleReplyDraftChange = (commentId: string, value: string) => {
    setReplyDraftsByCommentId((prev) => ({...prev, [commentId]: value}));
  };

  const handlePostReply = async (comment: Comment) => {
    const nextText = String(replyDraftsByCommentId[comment.id] || '').trim();
    if (!nextText) return;

    if (!canUseProtectedFeatures()) {
      requestAuth('feature', {
        returnTo: {
          page: 'book-details',
          data: currentBook,
        },
      });
      return;
    }

    setReplySubmittingByCommentId((prev) => ({...prev, [comment.id]: true}));
    setCommentsError('');

    try {
      const response = await reviewService.createReply(comment.id, {
        text: nextText,
        rating: comment.rating > 0 ? Math.round(comment.rating) : undefined,
      });
      const source = pickObject(response);
      const created = source?.data ?? source;
      const createdReply = normalizeCommentReply(created, 0);

      setComments((prev) =>
        prev.map((item) => {
          if (item.id !== comment.id) return item;
          const nextReplies = [...(item.replyItems || []), createdReply];
          return {
            ...item,
            replyItems: nextReplies,
            replies: Math.max(item.replies + 1, nextReplies.length),
          };
        }),
      );
      setReplyDraftsByCommentId((prev) => ({...prev, [comment.id]: ''}));
      setOpenRepliesByCommentId((prev) => ({...prev, [comment.id]: true}));
    } catch (error: any) {
      const status = Number(error?.status);
      if (Number(error?.status) === 401) {
        requestAuth('feature', {
          returnTo: {
            page: 'book-details',
            data: currentBook,
          },
        });
        return;
      }
      if (status === 404 || status === 405) {
        const localReply: CommentReply = {
          id: `reply-local-${Date.now()}-${Math.round(Math.random() * 10000)}`,
          user: currentProfile.name || 'Library User',
          avatar: asAbsoluteAssetUrl(currentProfile.photo) || fallbackProfilePhoto(currentProfile.name || 'user', 100),
          text: nextText,
          time: 'Just now',
          createdAt: new Date().toISOString(),
        };
        setComments((prev) =>
          prev.map((item) => {
            if (item.id !== comment.id) return item;
            const nextReplies = [...(item.replyItems || []), localReply];
            return {
              ...item,
              replyItems: nextReplies,
              replies: Math.max(item.replies + 1, nextReplies.length),
            };
          }),
        );
        setReplyDraftsByCommentId((prev) => ({...prev, [comment.id]: ''}));
        setOpenRepliesByCommentId((prev) => ({...prev, [comment.id]: true}));
        return;
      }
      setCommentsError(error?.data?.message || error?.message || 'Unable to post your reply.');
    } finally {
      setReplySubmittingByCommentId((prev) => ({...prev, [comment.id]: false}));
    }
  };

  React.useEffect(() => {
    let alive = true;

    const userKey = getRatingUserKey();
    const stored = getStoredBookRating(userKey, normalizedBookId);
    const fallback = fallbackRatingsSummary(currentBook);

    setRatings({...fallback, user_rating: stored ? stored : null});
    setSelectedRating(stored || 0);
    setRatingError('');
    setIsLoadingRatings(true);

    void ratingService
      .getForBook(normalizedBookId)
      .then((summary) => {
        if (!alive) return;
        const merged: BookRatingsSummary = {
          ...summary,
          user_rating: summary.user_rating || stored || null,
        };
        setRatings(merged);
        setSelectedRating(merged.user_rating || 0);
        if (merged.user_rating) {
          setStoredBookRating(userKey, normalizedBookId, merged.user_rating);
        }
      })
      .catch((error: any) => {
        if (!alive) return;
        setRatings({...fallbackRatingsSummary(currentBook), user_rating: stored ? stored : null});
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
    const pending = readPendingBookRating();
    if (!pending || pending.bookId !== normalizedBookId) return;
    if (!canUseProtectedFeatures()) return;
    if (isSubmittingRating) return;
    if (getStoredBookRating(getRatingUserKey(), normalizedBookId) || Number(ratings.user_rating || 0) > 0) {
      clearPendingBookRating();
      setRatingError('You already rated this book.');
      return;
    }

    clearPendingBookRating();
    setSelectedRating(pending.rating);
    void submitRating(pending.rating);
  }, [currentBook.id, isSubmittingRating, ratings.user_rating]);

  React.useEffect(() => {
    const normalizedBookId = normalizeBackendBookId(currentBook.id);
    let alive = true;

    setIsLoadingComments(true);
    setCommentsError('');
    setCommentsPage(1);
    setCommentsHasMore(false);
    setCommentsTotal(null);
    setOpenRepliesByCommentId({});
    setReplyDraftsByCommentId({});
    setReplySubmittingByCommentId({});

    const pickList = (payload: any) => {
      const source = pickObject(payload);
      return pickArray(source?.data?.data, source?.data, source?.results, source?.items, payload);
    };

    const pickMeta = (payload: any) => {
      const source = pickObject(payload);
      const candidates = [
        source?.meta,
        source?.data?.meta,
        source?.data?.pagination,
        source?.pagination,
        source?.data,
        source,
      ];
      for (const candidate of candidates) {
        const obj = pickObject(candidate);
        if (Object.keys(obj).length) return obj;
      }
      return {};
    };

    const loadPage = async (page: number, {append}: {append: boolean}) => {
      if (!alive) return;
      if (append) setIsLoadingMoreComments(true);
      else setIsLoadingComments(true);
      setCommentsError('');
      try {
        const payload: any = await reviewService.listForBook(normalizedBookId, {page, per_page: 10, sort: 'newest'});
        if (!alive) return;

        const list = pickList(payload);
        const normalized = list.map((item: any, index: number) => normalizeComment(item, (page - 1) * 10 + index));

        setComments((prev) => (append ? [...prev, ...normalized] : normalized));

        const meta = pickMeta(payload);
        const total = Number(meta?.total ?? meta?.count ?? meta?.total_items ?? meta?.totalItems);
        const lastPage = Number(meta?.last_page ?? meta?.lastPage ?? meta?.total_pages ?? meta?.totalPages);
        const currentPage = Number(meta?.current_page ?? meta?.currentPage ?? page);
        const nextPageUrl = pickString(meta?.next_page_url, meta?.nextPageUrl, meta?.links?.next);
        if (Number.isFinite(total) && total >= 0) setCommentsTotal(total);
        if (nextPageUrl) {
          setCommentsHasMore(true);
        } else if (Number.isFinite(lastPage) && lastPage >= 1) {
          setCommentsHasMore(currentPage < lastPage);
        } else if (Number.isFinite(total) && total >= 0) {
          const loaded = (page - 1) * 10 + normalized.length;
          setCommentsHasMore(loaded < total);
        } else {
          setCommentsHasMore(normalized.length >= 10);
        }

        setCommentsPage(page);
      } catch (error: any) {
        if (!alive) return;
        if (Number(error?.status) !== 404) {
          setCommentsError(error?.data?.message || error?.message || 'Unable to load comments.');
        }
      } finally {
        if (!alive) return;
        if (append) setIsLoadingMoreComments(false);
        setIsLoadingComments(false);
      }
    };

    void loadPage(1, {append: false});

    return () => {
      alive = false;
    };
  }, [currentBook.id, commentsReloadKey]);

  const handleLoadMoreComments = async () => {
    if (isLoadingComments || isLoadingMoreComments || !commentsHasMore) return;
    const normalizedBookId = normalizeBackendBookId(currentBook.id);
    const nextPage = commentsPage + 1;
    setIsLoadingMoreComments(true);
    setCommentsError('');
    try {
      const payload: any = await reviewService.listForBook(normalizedBookId, {page: nextPage, per_page: 10, sort: 'newest'});
      const source = pickObject(payload);
      const items = pickArray(source?.data?.data, source?.data, source?.results, source?.items, payload);
      const normalized = items.map((item, index) => normalizeComment(item, (nextPage - 1) * 10 + index));
      setComments((prev) => [...prev, ...normalized]);

      const metaCandidates = [
        source?.meta,
        source?.data?.meta,
        source?.data?.pagination,
        source?.pagination,
        source?.data,
        source,
      ];
      let meta: Record<string, any> = {};
      for (const candidate of metaCandidates) {
        const obj = pickObject(candidate);
        if (Object.keys(obj).length) {
          meta = obj;
          break;
        }
      }

      const lastPage = Number(meta?.last_page ?? meta?.lastPage ?? meta?.total_pages ?? meta?.totalPages);
      const currentPage = Number(meta?.current_page ?? meta?.currentPage ?? nextPage);
      const nextPageUrl = pickString(meta?.next_page_url, meta?.nextPageUrl, meta?.links?.next);
      if (nextPageUrl) {
        setCommentsHasMore(true);
      } else if (Number.isFinite(lastPage) && lastPage >= 1) {
        setCommentsHasMore(currentPage < lastPage);
      } else {
        setCommentsHasMore(normalized.length >= 10);
      }
      const total = Number(meta?.total ?? meta?.count ?? meta?.total_items ?? meta?.totalItems);
      if (Number.isFinite(total) && total >= 0) setCommentsTotal(total);
      setCommentsPage(nextPage);
    } catch (error: any) {
      if (Number(error?.status) !== 404) {
        setCommentsError(error?.data?.message || error?.message || 'Unable to load more comments.');
      }
    } finally {
      setIsLoadingMoreComments(false);
    }
  };

  const submitRating = async (nextRating: number) => {
    if (!nextRating) {
      setRatingError('Select a star rating first.');
      return;
    }
    const userKey = getRatingUserKey();
    const existing = getStoredBookRating(userKey, normalizedBookId) || Number(ratings.user_rating || 0);
    if (existing) {
      setSelectedRating(existing);
      setRatingError('You already rated this book.');
      return;
    }
    if (!canUseProtectedFeatures()) {
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
      const lockedValue = submitted.user_rating || nextRating;
      setStoredBookRating(userKey, normalizedBookId, lockedValue);
      setRatings((prev) => ({
        ...prev,
        ...submitted,
        user_rating: lockedValue,
      }));

      const refreshed = await ratingService.getForBook(normalizedBookId);
      const merged: BookRatingsSummary = {
        ...refreshed,
        user_rating: refreshed.user_rating || lockedValue || null,
      };
      setRatings(merged);
      setSelectedRating(merged.user_rating || lockedValue);
    } catch (error: any) {
      const status = Number(error?.status);
      const rawMessage = String(error?.data?.message || error?.message || '').toLowerCase();
      const looksLikeAlreadyRated =
        status === 409 ||
        rawMessage.includes('already rated') ||
        rawMessage.includes('already') && rawMessage.includes('rated') ||
        rawMessage.includes('duplicate') && rawMessage.includes('rating');
      if (looksLikeAlreadyRated) {
        setStoredBookRating(userKey, normalizedBookId, nextRating);
        setRatings((prev) => ({...prev, user_rating: prev.user_rating || nextRating}));
        setSelectedRating((prev) => prev || nextRating);
        setRatingError('You already rated this book.');
        return;
      }
      if (Number(error?.status) === 401) {
        savePendingBookRating(normalizedBookId, nextRating);
        const likelyExpiredSession =
          !readToken() ||
          rawMessage.includes('unauthenticated') ||
          rawMessage.includes('token expired') ||
          rawMessage.includes('invalid token');

        if (likelyExpiredSession) {
          requestAuth('feature', {
            returnTo: {
              page: 'book-details',
              data: currentBook,
            },
          });
          setRatingError('Session expired. Please login to submit your rating.');
          return;
        }

        setRatingError(error?.data?.message || error?.message || 'Unable to submit your rating.');
        return;
      }
      setRatingError(error?.data?.message || error?.message || 'Unable to submit your rating.');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleSubmitRating = async () => {
    await submitRating(selectedRating);
  };

  const handleQuickRate = async (star: number) => {
    if (isRatingLocked) {
      setSelectedRating(ratingLockedValue);
      setRatingError('You already rated this book.');
      return;
    }
    setSelectedRating(star);
    setRatingError('');
    if (!canUseProtectedFeatures()) {
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
    const tab = window.open('', '_blank');
    if (!tab) throw new Error('Popup blocked. Please allow popups to open the reader.');
    try {
      const url = await bookService.readUrl(normalizedBookId);
      openReaderTab({
        title: currentBook.title || 'Read',
        url,
        tab,
        mimeType: /\.pdf(\?|#|$)/i.test(url) ? 'application/pdf' : undefined,
        tracking: {
          bookId: normalizedBookId,
          source: 'web',
        },
      });
      trackRead(normalizedBookId);
    } catch (err) {
      try {
        tab.close();
      } catch {}
      throw err;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-20 py-10 space-y-12">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
        <button type="button" onClick={() => onNavigate('home')} className="hover:text-primary transition-colors">Home</button>
        <Icons.ChevronRight className="size-3" />
        <button type="button" onClick={() => onNavigate('categories')} className="hover:text-primary transition-colors">{currentBook.category}</button>
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
            <button type="button"
              onClick={() => {
                void openOnline().catch((err: any) => {
                  void sweetAlert(err?.message || 'Unable to open this book.', {icon: 'error', title: 'Error'});
                });
              }}
              className="bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              title="Read in browser"
            >
              <Icons.BookOpen className="size-4" />
              Read Now
            </button>
            <button type="button"
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
                      void sweetAlert(err?.message || 'Unable to open offline book.', {icon: 'error', title: 'Error'});
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
            type="button"
            onClick={(event) => {
              event.preventDefault();
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
                onClick={() =>
                  onNavigate('author-details', currentBook.authorId ? {id: currentBook.authorId, name: currentBook.author} : currentBook.author)
                }
              >
                <div className="size-10 rounded-full bg-surface border border-border overflow-hidden group-hover/author:border-primary transition-colors">
                  <img
                    src={authorPhoto || fallbackProfilePhoto(currentBook.author, 100)}
                    alt={currentBook.author}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-text-muted uppercase tracking-tighter">Author</p>
                  <p className="text-sm font-bold text-text group-hover/author:text-primary transition-colors">{currentBook.author}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void toggleFollow()}
                disabled={!authorInfo?.id || isTogglingFollow}
                className={`px-4 py-1.5 rounded-lg border text-[11px] font-bold uppercase tracking-widest transition-all ${
                  isFollowing
                    ? 'border-primary/30 bg-primary text-white hover:bg-primary/90'
                    : 'border-primary/30 text-primary hover:bg-primary hover:text-white'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
                title={!authorInfo?.id ? 'Author info not available' : isFollowing ? 'Unfollow author' : 'Follow author'}
              >
                {isTogglingFollow ? 'Saving...' : isFollowing ? 'Following' : 'Follow'}
              </button>
              <div className="h-8 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void handleQuickRate(s)}
                      disabled={isSubmittingRating || isRatingLocked}
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
            <button type="button" className="text-sm font-bold text-primary hover:underline">Read More</button>
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
                    disabled={isSubmittingRating || isLoadingRatings || isRatingLocked}
                    onClick={() => {
                      if (isRatingLocked) return;
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
                disabled={isSubmittingRating || isLoadingRatings || isRatingLocked}
                className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-60"
              >
                {isSubmittingRating ? 'Submitting...' : isRatingLocked ? 'Rated' : 'Submit Rating'}
              </button>
              <p className="text-xs text-text-muted">
                Ratings require login. One rating per book (1-5 stars).
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-text">Community Discussion</h3>
              <span className="text-xs font-bold text-text-muted uppercase tracking-widest">
                {isLoadingComments && comments.length === 0
                  ? 'Loading...'
                  : `${(commentsTotal ?? comments.length).toLocaleString()} Comments`}
              </span>
            </div>
            {commentsError ? <p className="text-sm font-semibold text-red-500">{commentsError}</p> : null}

            {/* Comment Input */}
            <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="size-10 rounded-full bg-primary/20 shrink-0 overflow-hidden border border-border">
                    <img
                      src={asAbsoluteAssetUrl(currentProfile.photo) || fallbackProfilePhoto(currentProfile.name || 'user', 100)}
                      alt={currentProfile.name || 'User'}
                    />
                  </div>
                <div className="flex-1 space-y-3">
                  <textarea 
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Share your thoughts about this book..."
                    className="w-full bg-surface border border-border rounded-2xl p-4 text-sm text-text placeholder:text-text-muted focus:ring-primary focus:border-primary outline-none min-h-[100px] resize-none transition-all"
                  />
                  <div className="flex justify-end">
                    <button type="button" 
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
              ) : commentsError && !comments.length ? (
                <button
                  type="button"
                  onClick={() => setCommentsReloadKey((prev) => prev + 1)}
                  className="w-fit rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold text-text-muted hover:text-text hover:border-primary/30 transition-all"
                >
                  Retry
                </button>
              ) : !comments.length ? (
                <p className="text-sm text-text-muted">No comments yet. Be the first to comment.</p>
              ) : null}
              {comments.map((comment) => {
                const replyItems = comment.replyItems || [];
                const isRepliesOpen = Boolean(openRepliesByCommentId[comment.id]);
                const replyDraft = String(replyDraftsByCommentId[comment.id] || '');
                const isReplySubmitting = Boolean(replySubmittingByCommentId[comment.id]);

                return (
                <div key={comment.id} className="p-6 rounded-2xl bg-surface border border-border space-y-4 hover:border-primary/30 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-primary/20 overflow-hidden border border-border">
                        <img src={comment.avatar} alt={comment.user} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text">{comment.user}</p>
                        <p className="text-[10px] text-text-muted">
                          {comment.createdAt ? formatRelativeTime(comment.createdAt, nowTick) : comment.time}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {(comment.canDelete ||
                        comment.user.trim().toLowerCase() === currentProfile.name.trim().toLowerCase()) &&
                        editingCommentId !== comment.id && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteComment(comment)}
                          disabled={deletingCommentId === comment.id}
                          className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline disabled:opacity-50"
                        >
                          {deletingCommentId === comment.id ? 'Deleting...' : 'Delete'}
                        </button>
                      )}
                      {(comment.canEdit ||
                        comment.user.trim().toLowerCase() === currentProfile.name.trim().toLowerCase()) &&
                        editingCommentId !== comment.id && (
                        <button type="button" 
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
                        <button type="button" 
                          onClick={handleEditCancel}
                          className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-text-muted hover:text-text transition-colors uppercase tracking-widest"
                        >
                          Cancel
                        </button>
                        <button type="button" 
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
                    <button type="button" className="flex items-center gap-1 text-[10px] font-bold text-text-muted hover:text-primary transition-colors">
                      <Icons.Heart className="size-3" />
                      {comment.likes} Likes
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleRepliesPanel(comment.id)}
                      className="flex items-center gap-1 text-[10px] font-bold text-text-muted hover:text-primary transition-colors"
                    >
                      <Icons.MessageSquare className="size-3" />
                      {isRepliesOpen ? 'Hide Replies' : `${comment.replies} ${comment.replies === 1 ? 'Reply' : 'Replies'}`}
                    </button>
                  </div>

                  {isRepliesOpen ? (
                    <div className="space-y-3 rounded-xl border border-border bg-bg/40 p-3">
                      {replyItems.length ? (
                        <div className="space-y-3">
                          {replyItems.map((reply) => (
                            <div key={reply.id} className="rounded-lg border border-border/70 bg-surface/70 p-3">
                              <div className="mb-2 flex items-center gap-2">
                                <div className="size-6 rounded-full overflow-hidden border border-border bg-primary/20">
                                  <img src={reply.avatar} alt={reply.user} />
                                </div>
                                <p className="text-xs font-bold text-text">{reply.user}</p>
                                <p className="text-[10px] text-text-muted">
                                  {reply.createdAt ? formatRelativeTime(reply.createdAt, nowTick) : reply.time}
                                </p>
                              </div>
                              <p className="text-xs text-text-muted leading-relaxed">{reply.text}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-text-muted">No replies yet. Be the first to reply.</p>
                      )}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyDraft}
                          onChange={(e) => handleReplyDraftChange(comment.id, e.target.value)}
                          placeholder="Write a reply..."
                          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text placeholder:text-text-muted outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => void handlePostReply(comment)}
                          disabled={!replyDraft.trim() || isReplySubmitting}
                          className="rounded-lg bg-primary px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-primary/90 disabled:opacity-50"
                        >
                          {isReplySubmitting ? 'Sending...' : 'Reply'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )})}
            </div>
            
            {commentsHasMore ? (
              <button
                type="button"
                onClick={() => void handleLoadMoreComments()}
                disabled={isLoadingMoreComments || isLoadingComments}
                className="w-full py-3 rounded-xl border border-border text-sm font-bold text-text-muted hover:bg-surface transition-all disabled:opacity-60"
              >
                {isLoadingMoreComments
                  ? 'Loading more...'
                  : commentsTotal && commentsTotal > comments.length
                    ? `View All ${commentsTotal.toLocaleString()} Reviews`
                    : 'View More Reviews'}
              </button>
            ) : null}
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

