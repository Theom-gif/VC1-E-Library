import React, {Suspense, lazy, useMemo, useRef, useState} from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {Icons} from './types';
import type {BookType} from './types';
import {useLibrary} from './context/LibraryContext';
import {useUnsavedChanges} from './context/UnsavedChangesContext';
import defaultAvatarUrl from './test/defaultAvatar';
import {useI18n} from './i18n/I18nProvider';

// Page Components (lazy-loaded for faster initial load)
const Home = lazy(() => import('./pages/Home'));
const Authors = lazy(() => import('./pages/Authors'));
const Categories = lazy(() => import('./pages/Categories'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Downloads = lazy(() => import('./pages/Downloads'));
const Settings = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Profile'));
const BookDetails = lazy(() => import('./pages/BookDetails'));
const AuthorDetails = lazy(() => import('./pages/AuthorDetails'));
const NotificationsPage = lazy(() => import('./pages/Notifications'));
const Logout = lazy(() => import('./pages/Logout'));
const SearchPage = lazy(() => import('./pages/Search'));
const Plans = lazy(() => import('./pages/Plans'));
import CoverImage from './components/CoverImage';
import AvatarImage from './components/AvatarImage';
import profileService from './service/profileService';
import notificationService from './service/notificationService';
import authService from './service/authService';
import {
  AUTH_REQUIRED_EVENT,
  GUEST_FREE_READ_LIMIT,
  getMembershipTier,
  MEMBERSHIP_TIER_EVENT,
  MembershipTier,
} from './utils/readerUpgrade';

type Page =
  | 'home'
  | 'authors'
  | 'plans'
  | 'categories'
  | 'favorites'
  | 'downloads'
  | 'settings'
  | 'profile'
  | 'search'
  | 'book-details'
  | 'author-details'
  | 'notifications'
  | 'logout';

type SelectedAuthor = {id?: string; name?: string} | string | null;

type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'author' | 'admin';
  memberSince?: string;
};

type AppProps = {
  authUser: AuthenticatedUser;
  onLogout: () => void;
  onLogin: (payload: {email: string; password: string; role?: AuthenticatedUser['role']; remember?: boolean}) => Promise<void>;
  onRegister: (payload: {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
    password_confirmation: string;
    role: AuthenticatedUser['role'];
  }) => Promise<void>;
};

const PROFILE_CACHE_KEY = 'elibrary_profile_cache';
const THEME_MODE_KEY = 'elibrary_theme_mode';
const LOCAL_NOTIFICATIONS_KEY = 'local-notifications';
const DEFAULT_PROFILE_PHOTO = defaultAvatarUrl;
const APP_NAME = '\u1782\u1798\u17d2\u1796\u17b8-ELibrary';
const FAVICON_SRC = `${import.meta.env.BASE_URL}favicon.svg?v=1`;

function PageFallback() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 lg:px-20 py-16">
      <div className="flex items-center gap-3 text-text-muted">
        <Icons.BookOpen className="size-5 animate-pulse" />
        <span className="text-sm font-semibold">Loading…</span>
      </div>
    </div>
  );
}

function readProfileCache(): Partial<{name: string; photo: string; memberSince: string}> {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeProfileCache(value: Partial<{name: string; photo: string; memberSince: string}>) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(value));
  } catch {
    // ignore storage issues
  }
}

function clearProfileCache() {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // ignore storage issues
  }
}

type BadgeNotificationItem = {
  id: string;
  unread: boolean;
};

function normalizeUnread(raw: any): boolean {
  const readAt = String(raw?.read_at ?? raw?.readAt ?? '').trim();
  const unreadRaw = raw?.unread ?? raw?.is_unread ?? raw?.unread_flag;
  if (typeof unreadRaw === 'boolean') return unreadRaw;
  if (typeof unreadRaw === 'number') return unreadRaw === 1;
  if (typeof unreadRaw === 'string') {
    const token = unreadRaw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'unread'].includes(token)) return true;
    if (['0', 'false', 'no', 'read'].includes(token)) return false;
  }
  return !readAt;
}

function extractNotificationItems(payload: any): BadgeNotificationItem[] {
  const list =
    (Array.isArray(payload?.data?.data) && payload.data.data) ||
    (Array.isArray(payload?.data?.items) && payload.data.items) ||
    (Array.isArray(payload?.data) && payload.data) ||
    (Array.isArray(payload?.notifications) && payload.notifications) ||
    (Array.isArray(payload?.results) && payload.results) ||
    (Array.isArray(payload?.items) && payload.items) ||
    (Array.isArray(payload) && payload) ||
    [];

  return list
    .map((item: any) => ({
      id: String(item?.id ?? '').trim(),
      unread: normalizeUnread(item),
    }))
    .filter((item: BadgeNotificationItem) => Boolean(item.id));
}

function extractNotificationMeta(payload: any): Record<string, any> {
  if (payload?.meta && typeof payload.meta === 'object') return payload.meta;
  if (payload?.data?.meta && typeof payload.data.meta === 'object') return payload.data.meta;
  if (payload?.data?.pagination && typeof payload.data.pagination === 'object') return payload.data.pagination;
  if (payload?.pagination && typeof payload.pagination === 'object') return payload.pagination;
  return {};
}

function readLocalUnreadNotifications(): BadgeNotificationItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: any) => ({
        id: String(item?.id ?? '').trim(),
        unread: Boolean(item?.unread),
      }))
      .filter((item: BadgeNotificationItem) => Boolean(item.id && item.unread));
  } catch {
    return [];
  }
}

function readThemeMode(): 'light' | 'dark' {
  try {
    const raw = String(localStorage.getItem(THEME_MODE_KEY) || '').trim().toLowerCase();
    if (raw === 'light' || raw === 'dark') return raw;
  } catch {
    // ignore storage issues
  }

  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  } catch {
    // ignore matchMedia issues
  }

  return 'light';
}

function writeThemeMode(mode: 'light' | 'dark') {
  try {
    localStorage.setItem(THEME_MODE_KEY, mode);
  } catch {
    // ignore storage issues
  }
}

export default function App({ authUser, onLogout, onLogin, onRegister }: AppProps) {
  const {t} = useI18n();
  const {books, newArrivals} = useLibrary();
  const [membershipTier, setMembershipTier] = useState<MembershipTier>(() => getMembershipTier());
  const [showAccessPrompt, setShowAccessPrompt] = useState(false);
  const [showReauthPrompt, setShowReauthPrompt] = useState(false);
  const [pendingNav, setPendingNav] = useState<{page: Page; data?: any} | null>(null);
  const [accessPromptReason, setAccessPromptReason] = useState<'feature' | 'read-limit'>('feature');
  const [showHomeAuthOverlay, setShowHomeAuthOverlay] = useState(false);
  const [homeAuthMode, setHomeAuthMode] = useState<'login' | 'register'>('login');
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedBook, setSelectedBook] = useState<BookType | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<SelectedAuthor>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isLightMode, setIsLightMode] = useState(() => readThemeMode() === 'light');
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const markingAllNotificationsReadRef = useRef(false);
  const isGuestUser = authUser?.id === 'guest';
  const guestRestrictedPages: Page[] = ['favorites', 'downloads', 'settings', 'profile'];
  const cachedProfile = readProfileCache();
  const [user, setUser] = useState({
    name: authUser?.id === 'guest' ? 'Guest User' : cachedProfile.name || authUser?.name || 'Library User',
    photo: cachedProfile.photo || DEFAULT_PROFILE_PHOTO,
    membership: authUser?.id === 'guest' ? 'Normal User' : membershipTier === 'reader' ? 'Reader Member' : 'Normal User',
    memberSince: authUser?.id === 'guest' ? '' : cachedProfile.memberSince || authUser?.memberSince || '',
  });

  const {isDirty, confirmIfDirty, setDirty} = useUnsavedChanges();
  const canNavigateAway = React.useCallback(() => {
    if (!isDirty) return true;
    const ok = confirmIfDirty();
    if (ok) setDirty(false);
    return ok;
  }, [confirmIfDirty, isDirty, setDirty]);

  const urlSyncRef = useRef({skipPush: false});
  const navigateToRef = useRef<(page: Page, data?: any) => boolean>(() => true);

  const pageToPath = React.useCallback((page: Page) => {
    if (page === 'home') return '/';
    if (page === 'authors') return '/authors';
    if (page === 'plans') return '/plans';
    if (page === 'categories') return '/categories';
    if (page === 'favorites') return '/favorites';
    if (page === 'downloads') return '/downloads';
    if (page === 'settings') return '/settings';
    if (page === 'profile') return '/profile';
    if (page === 'notifications') return '/notifications';
    if (page === 'search') return '/search';
    return '/';
  }, []);

  const pathToPage = React.useCallback((path: string): Page | null => {
    const normalized = String(path || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
    if (!normalized || normalized === 'home') return 'home';
    if (normalized === 'authors') return 'authors';
    if (normalized === 'plans') return 'plans';
    if (normalized === 'categories') return 'categories';
    if (normalized === 'favorites') return 'favorites';
    if (normalized === 'downloads') return 'downloads';
    if (normalized === 'settings') return 'settings';
    if (normalized === 'profile') return 'profile';
    if (normalized === 'notifications') return 'notifications';
    if (normalized === 'search') return 'search';
    return null;
  }, []);

  React.useEffect(() => {
    if (isLightMode) document.documentElement.classList.remove('dark');
    else document.documentElement.classList.add('dark');
    writeThemeMode(isLightMode ? 'light' : 'dark');
  }, [isLightMode]);

  React.useEffect(() => {
    let alive = true;

    const loadUnreadCount = async () => {
      // Avoid flicker: if we're clearing unread notifications, force badge to 0.
      if (markingAllNotificationsReadRef.current) {
        if (alive) setUnreadNotificationCount(0);
        return;
      }

      const localUnread = readLocalUnreadNotifications();
      const localUnreadSet = new Set(localUnread.map((item) => item.id));
      let nextCount = localUnreadSet.size;

      const token = authService.getToken();
      if (token) {
        try {
          const payload: any = await notificationService.list({page: 1, per_page: 50, unread: true});
          const backendItems = extractNotificationItems(payload).filter((item) => item.unread);
          const backendUnreadSet = new Set(backendItems.map((item) => item.id));

          const meta = extractNotificationMeta(payload);
          const totalFromMeta = Number(meta?.total ?? meta?.unread_total ?? meta?.unreadCount);
          const currentPage = Number(meta?.current_page ?? meta?.currentPage ?? 1);
          const lastPage = Number(meta?.last_page ?? meta?.lastPage ?? 1);
          const perPage = Number(meta?.per_page ?? meta?.perPage ?? 0);

          let backendCount = backendUnreadSet.size;
          if (Number.isFinite(totalFromMeta) && totalFromMeta >= 0) {
            backendCount = totalFromMeta;
          } else if (
            Number.isFinite(currentPage) &&
            Number.isFinite(lastPage) &&
            Number.isFinite(perPage) &&
            currentPage === 1 &&
            lastPage > 1 &&
            perPage > 0
          ) {
            backendCount = Math.max(backendUnreadSet.size, (lastPage - 1) * perPage + backendUnreadSet.size);
          }

          const localOnlyUnread = localUnread.filter((item) => item.id.startsWith('local-')).length;
          nextCount = Math.max(nextCount, backendCount + localOnlyUnread);
        } catch {
          // Keep local unread count if backend unread lookup fails.
        }
      }

      if (alive) setUnreadNotificationCount(Math.max(0, Math.round(nextCount)));
    };

    const onLocalNotification = () => {
      void loadUnreadCount();
    };
    const onFocus = () => {
      void loadUnreadCount();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== LOCAL_NOTIFICATIONS_KEY) return;
      void loadUnreadCount();
    };

    void loadUnreadCount();
    const intervalId = window.setInterval(() => {
      void loadUnreadCount();
    }, 30000);

    window.addEventListener('local-notification', onLocalNotification as EventListener);
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);

    return () => {
      alive = false;
      window.clearInterval(intervalId);
      window.removeEventListener('local-notification', onLocalNotification as EventListener);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, [authUser?.id, currentPage]);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const shouldLockScroll = Boolean(showAccessPrompt || showReauthPrompt);
    if (!shouldLockScroll) return;

    const body = document.body;
    const html = document.documentElement;
    const previousOverflow = body.style.overflow;
    const previousHtmlOverflow = html.style.overflow;
    const previousPaddingRight = body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - html.clientWidth;
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      html.style.overflow = previousHtmlOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [showAccessPrompt, showReauthPrompt]);

  React.useEffect(() => {
    setUser((prev) => ({
      ...prev,
      name: authUser?.id === 'guest' ? 'Guest User' : readProfileCache().name || authUser?.name || prev.name,
      memberSince: authUser?.id === 'guest' ? '' : readProfileCache().memberSince || authUser?.memberSince || prev.memberSince,
      photo: authUser?.id === 'guest' ? DEFAULT_PROFILE_PHOTO : readProfileCache().photo || prev.photo || DEFAULT_PROFILE_PHOTO,
    }));
  }, [authUser?.id, authUser?.memberSince, authUser?.name]);

  React.useEffect(() => {
    setUser((prev) => ({
      ...prev,
      membership: authUser?.id === 'guest' ? 'Normal User' : membershipTier === 'reader' ? 'Reader Member' : 'Normal User',
    }));
  }, [authUser?.id, membershipTier]);

  React.useEffect(() => {
    const handleAuthRequired = (event: Event) => {
      const detail = (event as CustomEvent)?.detail || {};
      const reason = detail?.reason;
      const returnTo = detail?.returnTo;
      if (returnTo?.page) {
        setPendingNav({page: returnTo.page, data: returnTo.data});
      }

      // Guest session: keep the existing upsell/access prompt.
      if (authUser?.id === 'guest') {
        setAccessPromptReason(reason === 'feature' ? 'feature' : 'read-limit');
        setShowAccessPrompt(true);
        return;
      }

      // Logged-in session: only show re-auth UI when we're confident the token is truly missing/expired.
      // Many endpoints may return 403 for permission/feature restrictions; that should not force a re-login prompt.
      const token = authService.getToken();
      if (!token) {
        setShowReauthPrompt(false);
        setAccessPromptReason(reason === 'feature' ? 'feature' : 'read-limit');
        setShowAccessPrompt(true);
        onLogout();
        return;
      }

      void authService
        .me()
        .then(() => {
          // Token still valid; ignore this auth-required signal.
        })
        .catch((requestError: any) => {
          const status = Number(requestError?.status);
          const rawMessage = String(
            requestError?.data?.message || requestError?.message || requestError?.data?.error || '',
          ).toLowerCase();
          const looksExpired =
            status === 401 ||
            rawMessage.includes('unauthenticated') ||
            rawMessage.includes('token expired') ||
            rawMessage.includes('invalid token') ||
            rawMessage.includes('expired token');

          if (!looksExpired) return;

          // If the token really expired, downgrade to guest and show the standard guest access prompt.
          // This avoids repeatedly nagging logged-in Readers with a separate "session expired" modal.
          setShowReauthPrompt(false);
          setAccessPromptReason(reason === 'feature' ? 'feature' : 'read-limit');
          setShowAccessPrompt(true);
          onLogout();
        });
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired as EventListener);
      }
    };
  }, [authUser?.id, onLogout]);

  React.useEffect(() => {
    const handleTierChange = (event: Event) => {
      const next = (event as CustomEvent)?.detail;
      if (next === 'reader' || next === 'normal') {
        setMembershipTier(next);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(MEMBERSHIP_TIER_EVENT, handleTierChange as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(MEMBERSHIP_TIER_EVENT, handleTierChange as EventListener);
      }
    };
  }, []);

  React.useEffect(() => {
    if (isGuestUser) return;
    setShowAccessPrompt(false);
    setShowReauthPrompt(false);
    setShowHomeAuthOverlay(false);
    setPendingNav(null);
    if (membershipTier !== 'reader') {
      setMembershipTier('reader');
    }
  }, [authUser?.id, isGuestUser, membershipTier]);

  React.useEffect(() => {
    if (isGuestUser) return;
    let alive = true;

    void profileService
      .me()
      .then((profile) => {
        if (!alive) return;
        setUser((prev) => {
          const prevPhoto = String(prev?.photo || '').trim();
          const serverPhoto = String(profile?.photo || '').trim();
          const keepPrevPhoto = /^data:|^blob:/i.test(prevPhoto);
          return {
            ...prev,
            name: profile.name || prev.name,
            photo: keepPrevPhoto ? prevPhoto : serverPhoto || prevPhoto || DEFAULT_PROFILE_PHOTO,
            memberSince: profile.memberSince || prev.memberSince,
            membership: profile.membership || prev.membership,
          };
        });
      })
      .catch(() => {
        // Keep cached/local profile when backend profile read is unavailable.
      });

    return () => {
      alive = false;
    };
  }, [isGuestUser, authUser?.id]);

  React.useEffect(() => {
    if (isGuestUser) {
      clearProfileCache();
      return;
    }
    writeProfileCache({
      name: user.name,
      photo: user.photo,
      memberSince: user.memberSince,
    });
  }, [isGuestUser, user.memberSince, user.name, user.photo]);

  const handleAuthRedirect = (mode: 'login' | 'register' = 'login') => {
    if (currentPage !== 'home' && !canNavigateAway()) return;
    setShowAccessPrompt(false);
    setShowReauthPrompt(false);
    setHomeAuthMode(mode);
    setShowHomeAuthOverlay(true);
    setCurrentPage('home');
    window.scrollTo(0, 0);
  };

  const handleHomeAuthSuccess = () => {
    setShowHomeAuthOverlay(false);
    setShowReauthPrompt(false);
    const next = pendingNav;
    setPendingNav(null);
    if (next) {
      navigateTo(next.page, next.data);
    }
  };

  const navigateTo = (page: Page, data?: any) => {
    if (isGuestUser && guestRestrictedPages.includes(page)) {
      setPendingNav({page, data});
      setAccessPromptReason('feature');
      setShowAccessPrompt(true);
      return false;
    }
    if (page !== 'notifications' && page !== currentPage && !canNavigateAway()) return false;

    if (page === 'notifications') {
      // Opening notifications should clear the badge and mark current items as read.
      setUnreadNotificationCount(0);
      markingAllNotificationsReadRef.current = true;

      try {
        const raw = localStorage.getItem(LOCAL_NOTIFICATIONS_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed) && parsed.length) {
          const updated = parsed.map((item: any) => ({...item, unread: false}));
          localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(updated.slice(0, 100)));
        }
      } catch {
        // ignore storage issues
      }

      const token = authService.getToken();
      if (token) {
        void notificationService
          .markAllRead()
          .catch(() => {
            // ignore; unread will show again if backend still reports it
          })
          .finally(() => {
            markingAllNotificationsReadRef.current = false;
          });
      } else {
        markingAllNotificationsReadRef.current = false;
      }
    }
    if (page === 'book-details' && data) setSelectedBook(data);
    if (page === 'author-details' && data) setSelectedAuthor(data);
    if (page === 'home') {
      const overlayMode = data?.authOverlay;
      if (overlayMode === 'login' || overlayMode === 'register') {
        setShowAccessPrompt(false);
        setPendingNav(null);
        setHomeAuthMode(overlayMode);
        setShowHomeAuthOverlay(true);
      } else if (overlayMode === false) {
        setShowHomeAuthOverlay(false);
      }
    }
    setCurrentPage(page);
    window.scrollTo(0, 0);
    return true;
  };

  React.useEffect(() => {
    navigateToRef.current = navigateTo;
  }, [navigateTo]);

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const payload: any = (event as any)?.data;
      if (!payload || payload.source !== 'elibrary-reader') return;
      if (payload.type === 'navigate-home') {
        navigateToRef.current('home');
      }
    };

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, []);

  const didInitUrlRef = useRef(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (didInitUrlRef.current) return;
    didInitUrlRef.current = true;

    const next = pathToPage(window.location.pathname);
    if (!next || next === currentPage) return;

    urlSyncRef.current.skipPush = true;
    const ok = navigateTo(next);
    if (!ok) {
      // Keep the URL consistent with the actual app state.
      urlSyncRef.current.skipPush = true;
      window.history.replaceState(null, '', pageToPath(currentPage));
    }
  }, [currentPage, navigateTo, pageToPath, pathToPage]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (urlSyncRef.current.skipPush) {
      urlSyncRef.current.skipPush = false;
      return;
    }
    const nextPath = pageToPath(currentPage);
    if (nextPath && window.location.pathname !== nextPath) {
      window.history.pushState(null, '', nextPath);
    }
  }, [currentPage, pageToPath]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const onPopState = () => {
      const next = pathToPage(window.location.pathname);
      if (!next || next === currentPage) return;

      urlSyncRef.current.skipPush = true;
      const ok = navigateTo(next);
      if (!ok) {
        urlSyncRef.current.skipPush = true;
        window.history.pushState(null, '', pageToPath(currentPage));
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [currentPage, navigateTo, pageToPath, pathToPage]);

  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [authUser?.id]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== '/') return;
      const target = event.target as HTMLElement | null;
      const tag = String(target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      event.preventDefault();
      setIsSearchFocused(true);
      searchInputRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const libraryBooks = useMemo(() => {
    const byId = new Map<string, BookType>();
    [...newArrivals, ...books].forEach((book) => byId.set(book.id, book));
    return Array.from(byId.values());
  }, [books, newArrivals]);

  const filteredBooks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    const tokens = query.split(/\s+/).filter(Boolean);

    const scoreBook = (book: BookType) => {
      const title = (book.title || '').toLowerCase();
      const author = (book.author || '').toLowerCase();
      const category = (book.category || '').toLowerCase();
      const haystack = `${title} ${author} ${category}`;

      if (!tokens.every((t) => haystack.includes(t))) return 0;

      let score = 0;
      if (title.startsWith(query)) score += 100;
      if (title.includes(query)) score += 70;
      if (author.includes(query)) score += 35;
      if (category.includes(query)) score += 15;
      score += Math.round((book.rating || 0) * 2);
      return score;
    };

    return libraryBooks
      .map((book) => ({ book, score: scoreBook(book) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.book.title.localeCompare(b.book.title))
      .map((item) => item.book);
  }, [libraryBooks, searchQuery]);

  const showSearchPopover = isSearchFocused && searchQuery.trim().length > 0;
  const quickResults = filteredBooks.slice(0, 6);
  const handleLogout = () => {
    if (currentPage !== 'home' && !canNavigateAway()) return;
    onLogout();
    setHomeAuthMode('login');
    setShowAccessPrompt(false);
    setShowReauthPrompt(false);
    setPendingNav(null);
    setShowHomeAuthOverlay(false);
    setCurrentPage('home');
    window.scrollTo(0, 0);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <Home
            onNavigate={navigateTo}
            onLogin={onLogin}
            onRegister={onRegister}
            showAuthOverlay={showHomeAuthOverlay && authUser?.id === 'guest'}
            initialAuthMode={homeAuthMode}
            authOverlayReason={accessPromptReason}
            onCloseAuthOverlay={() => setShowHomeAuthOverlay(false)}
            onAuthSuccess={handleHomeAuthSuccess}
          />
        );
      case 'plans':
        return <Plans onNavigate={navigateTo} isGuest={isGuestUser} membershipTier={membershipTier} />;
      case 'authors': return <Authors onNavigate={navigateTo} />;
      case 'categories': return <Categories onNavigate={navigateTo} />;
      case 'favorites': return <Favorites onNavigate={navigateTo} />;
      case 'downloads': return <Downloads onNavigate={navigateTo} />;
      case 'settings': return <Settings onNavigate={navigateTo} />;
      case 'profile': return <Profile user={user} onUpdateUser={setUser} onNavigate={navigateTo} />;
      case 'search': return <SearchPage query={searchQuery} results={filteredBooks} onNavigate={navigateTo} />;
      case 'book-details': return <BookDetails book={selectedBook || books[0]} onNavigate={navigateTo} />;
      case 'author-details': return <AuthorDetails author={selectedAuthor || 'Unknown Author'} onNavigate={navigateTo} />;
      case 'notifications': return <NotificationsPage onNavigate={navigateTo} userRole={authUser?.role} />;
      case 'logout': return <Logout onLogout={handleLogout} onNavigate={navigateTo} />;
      default:
        return (
          <Home
            onNavigate={navigateTo}
            onLogin={onLogin}
            onRegister={onRegister}
            showAuthOverlay={showHomeAuthOverlay && authUser?.id === 'guest'}
            initialAuthMode={homeAuthMode}
            authOverlayReason={accessPromptReason}
            onCloseAuthOverlay={() => setShowHomeAuthOverlay(false)}
            onAuthSuccess={handleHomeAuthSuccess}
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text overflow-x-hidden">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-bg/80 backdrop-blur-md px-4 sm:px-6 lg:px-12 py-3">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 lg:gap-4">
          <div className="flex min-w-0 items-center gap-4 lg:gap-6">
            <div 
              className="elibrary-logo shrink-0 flex items-center gap-2 text-primary cursor-pointer"
              onClick={() => navigateTo('home')}
            >
              <img src={FAVICON_SRC} alt="" className="size-8" />
              <h2 className="text-xl font-bold leading-tight tracking-tight hidden sm:block">{APP_NAME}</h2>
            </div>
            <nav className="hidden xl:flex items-center gap-5">
              <NavLink active={currentPage === 'home'} onClick={() => navigateTo('home')}>Home</NavLink>
              <NavLink active={currentPage === 'authors'} onClick={() => navigateTo('authors')}>Author</NavLink>
              <NavLink active={currentPage === 'categories'} onClick={() => navigateTo('categories')}>Categories</NavLink>
              <NavLink active={currentPage === 'favorites'} onClick={() => navigateTo('favorites')}>Favorites</NavLink>
              <NavLink active={currentPage === 'downloads'} onClick={() => navigateTo('downloads')}>Downloads</NavLink>
            </nav>
          </div>
            <div className="flex min-w-0 flex-1 justify-end items-center gap-2 lg:gap-3">
              <div
                ref={searchContainerRef}
                className="relative hidden lg:flex flex-1 min-w-[220px] max-w-[440px]"
              >
                <div
                  className={`w-full rounded-2xl border bg-bg/70 px-4 py-2 backdrop-blur-xl transition-all shadow-sm ${
                    isSearchFocused
                      ? 'border-primary/45 ring-2 ring-primary/20'
                      : 'border-border/60 hover:border-primary/25'
                  }`}
                >
                  <label htmlFor="nav-search" className="sr-only">
                    {t('nav.searchPlaceholder')}
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center rounded-xl bg-surface/70 p-2 text-text-muted">
                      <Icons.Search className="size-4" />
                    </div>
                    <input
                      ref={searchInputRef}
                      id="nav-search"
                      type="text"
                      placeholder={t('nav.searchPlaceholder')}
                      className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-sm text-text placeholder:text-text-muted/80"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => setIsSearchFocused(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setSearchQuery('');
                          setIsSearchFocused(false);
                          return;
                        }
                        if (e.key === 'Enter') {
                          const q = searchQuery.trim();
                          if (!q) return;
                          navigateTo('search');
                          setIsSearchFocused(false);
                        }
                      }}
                      autoComplete="off"
                      aria-expanded={showSearchPopover}
                      aria-controls="nav-search-popover"
                    />

                    <div className="flex items-center gap-1">
                      {searchQuery.trim().length > 0 ? (
                        <button
                          type="button"
                          className="rounded-xl p-2 text-text-muted hover:text-text hover:bg-surface/80 transition-colors"
                          onClick={() => {
                            setSearchQuery('');
                            setIsSearchFocused(true);
                            searchInputRef.current?.focus();
                          }}
                          title={t('nav.clearSearch')}
                          aria-label={t('nav.clearSearch')}
                        >
                          <Icons.X className="size-4" />
                        </button>
                      ) : (
                        <span className="hidden xl:inline-flex items-center gap-1 rounded-xl border border-border/60 bg-surface/60 px-2 py-1 text-[10px] font-bold text-text-muted/80">
                          <span>/</span>
                          <span className="font-semibold">Search</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {showSearchPopover && (
                  <div
                    id="nav-search-popover"
                    className="absolute top-full left-0 right-0 mt-2 rounded-2xl bg-bg/85 border border-border/70 shadow-2xl overflow-hidden z-50 backdrop-blur-xl"
                  >
                    <div className="max-h-80 overflow-auto">
                      {quickResults.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-text-muted">
                          {t('search.noResultsFor', {query: searchQuery.trim()})}
                        </div>
                      ) : (
                        <div className="py-1">
                          {quickResults.map((book) => (
                            <button
                              key={book.id}
                              type="button"
                              className="group w-full px-4 py-2.5 flex items-center gap-3 hover:bg-surface/70 transition-colors text-left"
                              onClick={() => {
                                navigateTo('book-details', book);
                                setIsSearchFocused(false);
                              }}
                            >
                              <CoverImage src={book.cover} alt={book.title} className="w-8 h-10 rounded object-cover border border-border" />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-text line-clamp-1 group-hover:text-primary transition-colors">{book.title}</div>
                                <div className="text-[11px] text-text-muted line-clamp-1">{book.author} \u2022 {book.category}</div>
                              </div>
                              <Icons.ArrowUpRight className="size-4 text-text-muted" />
                            </button>
                          ))}
                          <div className="border-t border-border mt-1">
                            <button
                              type="button"
                              className="w-full px-4 py-2 text-sm font-semibold text-primary hover:bg-surface transition-colors text-left"
                              onClick={() => {
                                navigateTo('search');
                                setIsSearchFocused(false);
                              }}
                            >
                              {t('search.viewAll')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="relative shrink-0">
                <button 
                  onClick={() => setIsLightMode(!isLightMode)}
                  className="p-2 rounded-lg bg-surface border border-border hover:bg-white/10 transition-all flex items-center justify-center"
                  title={isLightMode ? "Switch to Dark Teal Mode" : "Switch to Light Mode"}
                >
                  {isLightMode ? (
                    <Icons.Moon className="size-5 text-text-muted" />
                  ) : (
                    <Icons.Sun className="size-5 text-text-muted" />
                  )}
                </button>
              </div>

              <div className="relative shrink-0">
                <button 
                  onClick={() => navigateTo('notifications')}
                  className="relative p-2 rounded-lg bg-surface border border-border hover:bg-white/10 transition-all"
                >
                  <Icons.Bell className="size-5 text-text-muted" />
                  {unreadNotificationCount > 0 ? (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] leading-[18px] text-center font-bold border-2 border-bg">
                      {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                    </span>
                  ) : null}
                </button>
              </div>

              <div className="flex shrink-0 items-center gap-2 lg:gap-3 border-l border-primary/10 pl-3 lg:pl-4">
              <div className="text-right hidden 2xl:block">
                <p className="text-xs font-bold text-text max-w-[140px] truncate">{user.name}</p>
                <p className="text-primary text-[10px] font-bold uppercase hidden 2xl:block">{user.membership}</p>
              </div>
              <button
                type="button"
                className="size-9 lg:size-10 rounded-full bg-primary/20 border-2 border-primary/20 cursor-pointer overflow-hidden"
                aria-label="Open profile"
                onClick={() => {
                  if (isGuestUser) {
                    handleAuthRedirect('login');
                    return;
                  }
                  navigateTo('profile');
                }}
              >
                <AvatarImage src={user.photo} alt={`${user.name} avatar`} className="h-full w-full object-cover" />
              </button>
              {isGuestUser ? (
                <div className="flex items-center gap-1.5 pr-1 lg:pr-2">
                  <button
                    onClick={() => handleAuthRedirect('login')}
                    className="whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted hover:text-primary transition-colors"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => handleAuthRedirect('register')}
                    className="whitespace-nowrap rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white hover:bg-primary/90 transition-colors"
                  >
                    Register
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => navigateTo('logout')}
                  className="whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted hover:text-primary transition-colors"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Suspense fallback={<PageFallback />}>
              {renderPage()}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-bg border-t border-border mt-12 py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-20 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-1">
            <div className="text-primary flex items-center gap-2 mb-4">
              <img src={FAVICON_SRC} alt="" className="size-6" />
              <h2 className="text-lg font-bold">{APP_NAME}</h2>
            </div>
            <p className="text-sm text-text-muted leading-relaxed">
              Making knowledge accessible to everyone, anywhere in the world. Access thousands of premium titles at your fingertips.
            </p>
          </div>
          <div>
            <h5 className="font-bold mb-4 text-text">Platform</h5>
            <ul className="text-sm text-text-muted space-y-2">
              <li><FooterLink>Browse Library</FooterLink></li>
              <li><FooterLink>Authors</FooterLink></li>
              <li><FooterLink>Publishers</FooterLink></li>
              <li><FooterLink>Mobile App</FooterLink></li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold mb-4 text-text">Support</h5>
            <ul className="text-sm text-text-muted space-y-2">
              <li><FooterLink>Help Center</FooterLink></li>
              <li><FooterLink>Privacy Policy</FooterLink></li>
              <li><FooterLink>Terms of Service</FooterLink></li>
              <li><FooterLink>Contact Us</FooterLink></li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold mb-4 text-text">Newsletter</h5>
            <p className="text-sm text-text-muted mb-4">Get weekly book recommendations and library updates.</p>
            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="Email address" 
                className="w-full text-sm rounded-lg bg-surface border border-border focus:ring-primary focus:border-primary text-text placeholder:text-text-muted"
              />
              <button className="bg-primary text-white p-2 rounded-lg hover:bg-primary/90 transition-all">
                <Icons.Send className="size-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-6 lg:px-20 pt-8 mt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-text-muted">© 2024 {APP_NAME} Inc. All rights reserved.</p>
          <div className="flex gap-6">
            <Icons.Globe className="size-5 text-text-muted hover:text-primary cursor-pointer transition-colors" />
            <Icons.User className="size-5 text-text-muted hover:text-primary cursor-pointer transition-colors" />
            <Icons.LayoutDashboard className="size-5 text-text-muted hover:text-primary cursor-pointer transition-colors" />
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-bg border-t border-border px-6 py-3 flex justify-around z-50 backdrop-blur-md bg-bg/90">
        <MobileNavLink active={currentPage === 'home'} onClick={() => navigateTo('home')} icon={<Icons.Home className="size-5" />} label="Home" />
        <MobileNavLink active={currentPage === 'authors'} onClick={() => navigateTo('authors')} icon={<Icons.User className="size-5" />} label="Author" />
        <MobileNavLink active={currentPage === 'categories'} onClick={() => navigateTo('categories')} icon={<Icons.LayoutDashboard className="size-5" />} label="Categories" />
        <MobileNavLink active={currentPage === 'downloads'} onClick={() => navigateTo('downloads')} icon={<Icons.Download className="size-5" />} label="Downloads" />
        <MobileNavLink active={currentPage === 'favorites'} onClick={() => navigateTo('favorites')} icon={<Icons.Heart className="size-5" />} label="Favorites" />
        <MobileNavLink active={currentPage === 'profile'} onClick={() => navigateTo('profile')} icon={<Icons.User className="size-5" />} label="Profile" />
      </nav>

      {showAccessPrompt ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4 py-10 overflow-y-auto backdrop-blur-md">
          <div className="w-full max-w-xl rounded-3xl border border-border bg-bg p-8 shadow-2xl">
            <div className="flex items-center gap-3 text-primary">
              <Icons.User className="size-6" />
              <p className="text-xs font-bold uppercase tracking-widest">Reader Access Required</p>
            </div>
            <h3 className="mt-4 text-2xl font-bold text-text">
              {accessPromptReason === 'read-limit' ? 'Guest reading limit reached.' : 'Choose how you want to continue.'}
            </h3>
            <p className="mt-2 text-sm text-text-muted leading-relaxed">
              {accessPromptReason === 'read-limit'
                ? `Guests can open ${GUEST_FREE_READ_LIMIT} books for free. To continue reading more books, sign in or register as a Reader.`
                : 'You can keep browsing as a normal guest user, or sign in/register as a Reader to unlock this feature.'}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAccessPrompt(false);
                  setPendingNav(null);
                }}
                className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold text-text-muted hover:text-text hover:bg-white/5 transition-all"
              >
                Stay as Guest
              </button>
              <button
                type="button"
                onClick={() => handleAuthRedirect('login')}
                className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 transition-all"
              >
                Register / Login as Reader
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showReauthPrompt ? (
        <div className="fixed inset-0 z-[121] flex items-center justify-center bg-black/60 px-4 py-10 overflow-y-auto backdrop-blur-md">
          <div className="w-full max-w-xl rounded-3xl border border-border bg-bg p-8 shadow-2xl">
            <div className="flex items-center gap-3 text-primary">
              <Icons.User className="size-6" />
              <p className="text-xs font-bold uppercase tracking-widest">Session Expired</p>
            </div>
            <h3 className="mt-4 text-2xl font-bold text-text">
              Please login again to continue.
            </h3>
            <p className="mt-2 text-sm text-text-muted leading-relaxed">
              Your sign-in session expired while performing this action. Open the login modal to continue without reloading this page.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowReauthPrompt(false);
                }}
                className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold text-text-muted hover:text-text hover:bg-white/5 transition-all"
              >
                Not Now
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReauthPrompt(false);
                  setHomeAuthMode('login');
                  setShowHomeAuthOverlay(true);
                  setCurrentPage('home');
                  window.scrollTo(0, 0);
                }}
                className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 transition-all"
              >
                Login Now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NavLink({ children, active, onClick }: { children: React.ReactNode, active?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`text-sm font-semibold transition-colors ${active ? 'text-primary border-b-2 border-primary' : 'text-text-muted hover:text-primary'}`}
    >
      {children}
    </button>
  );
}

function MobileNavLink({ active, onClick, icon, label }: { active?: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 ${active ? 'text-primary' : 'text-text-muted'}`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase">{label}</span>
    </button>
  );
}

function FooterLink({ children }: { children: React.ReactNode }) {
  return (
    <a href="#" className="text-text-muted hover:text-primary transition-colors">{children}</a>
  );
}
