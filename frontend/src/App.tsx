import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Icons, BookType, hydrateBooksFromApi } from './types';
import {useLibrary} from './context/LibraryContext';
import {useUnsavedChanges} from './context/UnsavedChangesContext';
import defaultAvatarUrl from './test/defaultAvatar';
import {useI18n} from './i18n/I18nProvider';

// Page Components
import Home from './pages/Home';
import Authors from './pages/Authors';
import Categories from './pages/Categories';
import Favorites from './pages/Favorites';
import Downloads from './pages/Downloads';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import BookDetails from './pages/BookDetails';
import AuthorDetails from './pages/AuthorDetails';
import NotificationsPage from './pages/Notifications';
import Logout from './pages/Logout';
import SearchPage from './pages/Search';
import Plans from './pages/Plans';
import CoverImage from './components/CoverImage';
import AvatarImage from './components/AvatarImage';
import profileService from './service/profileService';
import {
  AUTH_REQUIRED_EVENT,
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
  onLogin: (payload: {email: string; password: string; role?: AuthenticatedUser['role']}) => Promise<void>;
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
const DEFAULT_PROFILE_PHOTO = defaultAvatarUrl;

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
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isLightMode, setIsLightMode] = useState(true);
  const [, setBooksSyncVersion] = useState(0);
  const isGuestUser = authUser?.id === 'guest';
  const guestRestrictedPages: Page[] = ['favorites', 'downloads', 'settings', 'profile', 'notifications'];
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
  }, [isLightMode]);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const shouldLockScroll = Boolean(showAccessPrompt || showReauthPrompt || (showHomeAuthOverlay && authUser?.id === 'guest'));
    if (!shouldLockScroll) return;

    const body = document.body;
    const html = document.documentElement;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - html.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [authUser?.id, showAccessPrompt, showHomeAuthOverlay, showReauthPrompt]);
  React.useEffect(() => {
    let isMounted = true;

    hydrateBooksFromApi()
      .then((count) => {
        if (isMounted && count > 0) {
          setBooksSyncVersion((value) => value + 1);
        }
      })
      .catch(() => {
        // Keep static mock data when backend is unavailable.
      });

    return () => {
      isMounted = false;
    };
  }, []);

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

      // Non-guest session but auth is missing (token cleared/expired): show login overlay.
      setShowAccessPrompt(false);
      setShowReauthPrompt(true);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired as EventListener);
      }
    };
  }, [authUser?.id]);

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
    if (authUser?.role === 'user' && membershipTier !== 'reader') {
      setMembershipTier('reader');
    }
  }, [authUser?.id, authUser?.role, isGuestUser, membershipTier]);

  React.useEffect(() => {
    if (isGuestUser) return;
    let alive = true;

    void profileService
      .me()
      .then((profile) => {
        if (!alive) return;
        setUser((prev) => ({
          ...prev,
          name: profile.name || prev.name,
          photo: profile.photo || prev.photo || DEFAULT_PROFILE_PHOTO,
          memberSince: profile.memberSince || prev.memberSince,
          membership: profile.membership || prev.membership,
        }));
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

  const notifications = [
    { id: 1, type: 'new', title: 'New Arrival', message: 'Sea of Tranquility is now available!', time: '2m ago', unread: true, icon: <Icons.Book className="size-4" /> },
    { id: 2, type: 'download', title: 'Download Complete', message: 'The Great Gatsby has been downloaded.', time: '1h ago', unread: false, icon: <Icons.Download className="size-4" /> },
    { id: 3, type: 'goal', title: 'Reading Goal', message: 'You are 2 days away from your streak!', time: '5h ago', unread: false, icon: <Icons.Trophy className="size-4" /> },
    { id: 4, type: 'system', title: 'System Update', message: 'New themes are now available in settings.', time: '1d ago', unread: false, icon: <Icons.Settings className="size-4" /> },
  ];

  const navigateTo = (page: Page, data?: any) => {
    if (isGuestUser && guestRestrictedPages.includes(page)) {
      setPendingNav({page, data});
      setAccessPromptReason('feature');
      setShowAccessPrompt(true);
      return false;
    }
    if (page !== currentPage && !canNavigateAway()) return false;
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
      case 'author-details': return <AuthorDetails authorName={selectedAuthor || 'Unknown Author'} onNavigate={navigateTo} />;
      case 'notifications': return <NotificationsPage onNavigate={navigateTo} />;
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
              <Icons.BookOpen className="size-8" />
              <h2 className="text-xl font-bold leading-tight tracking-tight hidden sm:block">គម្ពី-ELibrary</h2>
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
                  <span className="absolute top-1.5 right-1.5 size-2 bg-primary rounded-full border-2 border-bg" />
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
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-bg border-t border-border mt-12 py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-20 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-1">
            <div className="text-primary flex items-center gap-2 mb-4">
              <Icons.BookOpen className="size-6" />
              <h2 className="text-lg font-bold">គម្ពី-ELibrary</h2>
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
          <p className="text-xs text-text-muted">© 2024 គម្ពី-ELibrary Inc. All rights reserved.</p>
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
                ? 'Guests can open 2 books for free. To continue reading more books, sign in or register as a Reader.'
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
