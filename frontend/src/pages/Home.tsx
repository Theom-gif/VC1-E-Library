import React, {useMemo, useRef, useState} from 'react';
import {Icons} from '../types';
import { motion } from 'motion/react';
import BookCard from '../components/BookCard';
import CoverImage from '../components/CoverImage';
import ModalPortal from '../components/ModalPortal';
import { useLibrary } from '../context/LibraryContext';

interface HomeProps {
  onNavigate: (page: any, data?: any) => void;
  onLogin?: (payload: { email: string; password: string; role?: 'user' | 'author' | 'admin'; remember?: boolean }) => Promise<void>;
  onRegister?: (payload: {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
    password_confirmation: string;
    role: 'user' | 'author' | 'admin';
  }) => Promise<void>;
  showAuthOverlay?: boolean;
  initialAuthMode?: 'login' | 'register';
  authOverlayReason?: 'read-limit' | 'feature';
  onCloseAuthOverlay?: () => void;
  onAuthSuccess?: () => void;
}

function extractAuthErrorText(err: any, fallback: string) {
  const errors = err?.data?.errors;
  if (errors && typeof errors === 'object') {
    const emailErrorsRaw = (errors as any)?.email;
    const emailErrorsText = Array.isArray(emailErrorsRaw)
      ? emailErrorsRaw.map((m) => String(m || '').trim()).filter(Boolean).join(' ')
      : String(emailErrorsRaw || '').trim();
    if (emailErrorsText && /already/i.test(emailErrorsText) && /(taken|exist|registered)/i.test(emailErrorsText)) {
      return 'This email is already registered. Please use Login instead.';
    }

    const messages = Object.values(errors)
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    if (messages.length) return messages.slice(0, 3).join(' ');
  }

  const message =
    typeof err === 'string'
      ? err.trim()
      : String(err?.data?.message || err?.data?.error || err?.message || '').trim();
  if (message) {
    if (/failed to fetch/i.test(message)) {
      return 'Cannot connect to the backend API. Start the backend (npm run dev / npm run dev:backend) and check VITE_API_URL/VITE_API_BASE_URL, proxy, and CORS.';
    }
    return message;
  }

  return fallback;
}

export default function Home({
  onNavigate,
  onLogin,
  onRegister,
  showAuthOverlay,
  initialAuthMode,
  authOverlayReason,
  onCloseAuthOverlay,
  onAuthSuccess,
}: HomeProps) {
  const { books, newArrivals, isLoading, error, source, refresh } = useLibrary();
  const showError = Boolean(error && !isLoading);
  const showMock = source === 'mock' && !isLoading && !error;
  const canShowAuthOverlay = Boolean(showAuthOverlay && onLogin && onRegister);
  const [showAllRecentlyRead, setShowAllRecentlyRead] = useState(false);

  const normalizeBookId = (value: unknown) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    return raw.startsWith('api-') ? raw.slice(4) : raw;
  };

  const recentlyReadBooks = useMemo(() => {
    const list = Array.isArray(books) ? books : [];
    try {
      const raw = localStorage.getItem('elibrary_read_books');
      const parsed = raw ? JSON.parse(raw) : [];
      const ids = Array.isArray(parsed) ? parsed.map(normalizeBookId).filter(Boolean) : [];
      if (ids.length) {
        const byId = new Map(list.map((b) => [normalizeBookId(b.id), b] as const));
        const resolved = ids
          .slice()
          .reverse()
          .map((id) => byId.get(id))
          .filter(Boolean) as typeof list;
        if (resolved.length) return resolved;
      }
    } catch {
      // ignore
    }

    // Fallback: show books with progress/status, else first items.
    const byProgress = list.filter((b) => (Number(b.progress) || 0) > 0 || b.status === 'Currently Reading');
    return (byProgress.length ? byProgress : list).slice(0, 12);
  }, [books]);

  const recentlyReadPreview = useMemo(() => recentlyReadBooks.slice(0, 3), [recentlyReadBooks]);

  const newArrivalsScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollNewArrivals = (direction: 'left' | 'right') => {
    const el = newArrivalsScrollRef.current;
    if (!el) return;
    const delta = Math.max(240, Math.round(el.clientWidth * 0.9));
    el.scrollBy({left: direction === 'left' ? -delta : delta, behavior: 'smooth'});
  };

  const topRatedBooks = useMemo(() => {
    const list = Array.isArray(books) ? books : [];
    const sorted = [...list].sort((a, b) => {
      const aRating = Number(a?.rating) || 0;
      const bRating = Number(b?.rating) || 0;
      if (bRating !== aRating) return bRating - aRating;

      const aReviews = Number((a as any)?.reviews) || 0;
      const bReviews = Number((b as any)?.reviews) || 0;
      if (bReviews !== aReviews) return bReviews - aReviews;

      return String(a?.title || '').localeCompare(String(b?.title || ''));
    });
    return sorted.slice(0, 4);
  }, [books]);

  const formatRating = (value: unknown) => {
    const n = Number(value);
    if (!Number.isFinite(n) || Number.isNaN(n)) return '0';
    if (n <= 0) return '0';
    return n.toFixed(1).replace(/\.0$/, '');
  };
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    password_confirmation: '',
  });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (canShowAuthOverlay) {
      setAuthMode(initialAuthMode === 'register' ? 'register' : 'login');
      setAuthError('');
    }
  }, [canShowAuthOverlay, initialAuthMode]);

  const getAuthError = (err: any) => {
    return extractAuthErrorText(err, 'Unable to login. Please check your credentials.');
  };

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onLogin) return;
    const email = loginForm.email.trim().toLowerCase();
    if (!email) {
      setAuthError('Email is required.');
      return;
    }
    setIsSubmitting(true);
    setAuthError('');
    try {
      await onLogin({
        email,
        password: loginForm.password,
        remember: true,
      });
      setLoginForm({ email: '', password: '' });
      onAuthSuccess?.();
    } catch (err: any) {
      setAuthError(getAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onRegister) return;
    const firstname = registerForm.firstname.trim();
    const lastname = registerForm.lastname.trim();
    const email = registerForm.email.trim().toLowerCase();
    if (firstname.length < 2 || lastname.length < 2) {
      setAuthError('First name and last name must each be at least 2 characters.');
      return;
    }
    if (registerForm.password !== registerForm.password_confirmation) {
      setAuthError('Password confirmation does not match.');
      return;
    }
    setIsSubmitting(true);
    setAuthError('');
    try {
      await onRegister({
        firstname,
        lastname,
        email,
        password: registerForm.password,
        password_confirmation: registerForm.password_confirmation,
        role: 'user',
      });
      setRegisterForm({
        firstname: '',
        lastname: '',
        email: '',
        password: '',
        password_confirmation: '',
      });
      onAuthSuccess?.();
    } catch (err: any) {
      setAuthError(getAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-20 py-10 space-y-16">
      {(isLoading || showError || showMock) && (
        <div
          className={`rounded-2xl border px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${showError ? 'bg-red-500/10 border-red-500/20' : showMock ? 'bg-orange-500/10 border-orange-500/20' : 'bg-surface border-border'
            }`}
        >
          <div className="text-sm">
            {isLoading ? (
              <span className="font-semibold text-text">Loading books from backend…</span>
            ) : showMock ? (
              <>
                <span className="font-semibold text-text">Showing mock data.</span>{' '}
                <span className="text-text-muted">Connect your backend (`VITE_API_URL` or `VITE_BACKEND_PROXY_TARGET`) to load real books.</span>
              </>
            ) : showError ? (
              <>
                <span className="font-semibold text-text">Backend request failed.</span>{' '}
                <span className="text-text-muted">{error}</span>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="px-4 py-2 rounded-xl bg-surface border border-border hover:bg-white/10 transition-all text-sm font-semibold"
              disabled={isLoading}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {canShowAuthOverlay && (
        <ModalPortal>
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4 py-10 overflow-y-auto backdrop-blur-md">
            <div className="w-full max-w-2xl rounded-3xl border border-border bg-bg/90 p-6 md:p-8 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                  <Icons.User className="size-3" />
                  Reader Access Required
                </div>
                <h2 className="mt-4 text-2xl md:text-3xl font-bold text-text">
                  {authOverlayReason === 'read-limit' ? 'Reading limit reached' : 'Reader access required'}
                </h2>
                <p className="mt-2 text-sm text-text-muted">
                  {authOverlayReason === 'read-limit'
                    ? 'You have reached the free reading limit. Login or register as a Reader to continue.'
                    : 'Please login or register as a Reader to unlock this feature.'}
                </p>
              </div>
              {onCloseAuthOverlay ? (
                <button
                  type="button"
                  onClick={onCloseAuthOverlay}
                  className="rounded-lg border border-border bg-surface px-2 py-2 text-text-muted hover:text-text transition-colors"
                  aria-label="Close"
                >
                  <Icons.X className="size-4" />
                </button>
              ) : null}
            </div>

            <div className="mt-6 flex gap-2 rounded-2xl bg-surface p-2">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthError('');
                }}
                className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${authMode === 'login' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
                  }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setAuthError('');
                }}
                className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${authMode === 'register' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
                  }`}
              >
                Register
              </button>
            </div>

            {authMode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="mt-6 grid gap-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-muted">Library Email</label>
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(event) => {
                      setLoginForm((prev) => ({ ...prev, email: event.target.value }));
                      setAuthError('');
                    }}
                    placeholder="you@example.com"
                    required
                    className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-muted">Password</label>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      value={loginForm.password}
                      onChange={(event) => {
                        setLoginForm((prev) => ({...prev, password: event.target.value}));
                        setAuthError('');
                      }}
                      placeholder="********"
                      required
                      className="w-full rounded-xl border border-border bg-bg px-4 py-3 pr-12 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((value) => !value)}
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-text-muted hover:text-text transition-colors"
                    >
                      {showLoginPassword ? <Icons.EyeOff className="size-4" /> : <Icons.Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                {authError && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-400">
                    {authError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
                >
                  {isSubmitting ? 'Signing in...' : 'Sign In as Reader'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="mt-6 grid gap-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-muted">First Name</label>
                    <input
                      type="text"
                      value={registerForm.firstname}
                      onChange={(event) => {
                        setRegisterForm((prev) => ({ ...prev, firstname: event.target.value }));
                        setAuthError('');
                      }}
                      required
                      className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-muted">Last Name</label>
                    <input
                      type="text"
                      value={registerForm.lastname}
                      onChange={(event) => {
                        setRegisterForm((prev) => ({ ...prev, lastname: event.target.value }));
                        setAuthError('');
                      }}
                      required
                      className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-muted">Library Email</label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(event) => {
                      setRegisterForm((prev) => ({ ...prev, email: event.target.value }));
                      setAuthError('');
                    }}
                    required
                    className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-muted">Password</label>
                    <div className="relative">
                      <input
                        type={showRegisterPassword ? 'text' : 'password'}
                        value={registerForm.password}
                        onChange={(event) => {
                          setRegisterForm((prev) => ({...prev, password: event.target.value}));
                          setAuthError('');
                        }}
                        placeholder="********"
                        required
                        className="w-full rounded-xl border border-border bg-bg px-4 py-3 pr-12 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterPassword((value) => !value)}
                        aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-text-muted hover:text-text transition-colors"
                      >
                        {showRegisterPassword ? <Icons.EyeOff className="size-4" /> : <Icons.Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-muted">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showRegisterConfirmPassword ? 'text' : 'password'}
                        value={registerForm.password_confirmation}
                        onChange={(event) => {
                          setRegisterForm((prev) => ({...prev, password_confirmation: event.target.value}));
                          setAuthError('');
                        }}
                        placeholder="********"
                        required
                        className="w-full rounded-xl border border-border bg-bg px-4 py-3 pr-12 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterConfirmPassword((value) => !value)}
                        aria-label={showRegisterConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-text-muted hover:text-text transition-colors"
                      >
                        {showRegisterConfirmPassword ? <Icons.EyeOff className="size-4" /> : <Icons.Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                {authError && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-400">
                    {authError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
                >
                  {isSubmitting ? 'Creating account...' : 'Register as Reader'}
                </button>
              </form>
            )}
          </div>
          </div>
        </ModalPortal>
      )}

      {/* Hero Section */}
      <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary/20 via-bg to-bg border border-border p-8 md:p-16">
        <div className="relative z-10 max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
            <Icons.Rocket className="size-3" />
            <span>Knowledge, Anywhere</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight text-text">
            Your Smart Digital Library for  <span className="text-primary"> Unlimited</span> Learning
          </h1>
          <p className="text-lg text-text-muted leading-relaxed max-w-lg">
            Access thousands of books, audiobooks, and learning resources anytime, anywhere.
            Build your reading habits, explore new ideas, and grow your knowledge every day.
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <button
              onClick={() => onNavigate('categories')}
              className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              Start Reading
            </button>
          </div>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/3 hidden lg:block">
          <div className="h-full w-full bg-gradient-to-l from-primary/10 to-transparent" />
        </div>
      </section>

      {/* Recently Read */}
      {recentlyReadPreview.length ? (
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
              <Icons.History className="size-5" />
            </div>
            <h3 className="text-xl font-bold">Recently Read</h3>
          </div>
          {recentlyReadBooks.length > 3 ? (
            <button
              type="button"
              className="text-sm font-bold text-primary hover:underline"
              onClick={() => setShowAllRecentlyRead(true)}
            >
              View All
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recentlyReadPreview.map((book) => {
            const progress = Number.isFinite(Number(book.progress)) ? Number(book.progress) : 0;
            const timeLeft = String(book.timeLeft || '').trim();

            return (
              <div
                key={book.id}
                onClick={() => onNavigate('book-details', book)}
                className="group flex gap-4 p-4 rounded-2xl bg-surface border border-border hover:border-primary/30 transition-all cursor-pointer"
              >
                <CoverImage src={book.cover} alt={book.title} className="w-24 h-32 object-cover rounded-lg shadow-lg group-hover:scale-105 transition-transform" />
                <div className="flex-1 flex flex-col justify-between py-1">
                  <div>
                    <h4 className="font-bold text-text group-hover:text-primary transition-colors line-clamp-1">{book.title}</h4>
                    <p className="text-xs text-text-muted">{book.author}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                      <span className="text-text-muted">Progress</span>
                      <span className="text-primary">{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                    {timeLeft ? <p className="text-[10px] text-text-muted italic">{timeLeft}</p> : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      ) : null}

      {showAllRecentlyRead ? (
        <ModalPortal>
          <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 px-4 py-10 overflow-y-auto backdrop-blur-md">
            <div className="w-full max-w-6xl rounded-3xl border border-border bg-bg shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-6 py-5">
                <div className="flex items-center gap-2">
                  <Icons.History className="size-5 text-orange-500" />
                  <h4 className="text-base font-black text-text">Recently Read</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllRecentlyRead(false)}
                  className="rounded-xl border border-border bg-surface p-2 text-text-muted hover:text-text hover:bg-white/5 transition-all"
                  aria-label="Close"
                >
                  <Icons.X className="size-4" />
                </button>
              </div>
              <div className="px-6 py-6">
                {recentlyReadBooks.length ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {recentlyReadBooks.map((book) => (
                      <BookCard
                        key={book.id}
                        book={book}
                        onClick={() => {
                          setShowAllRecentlyRead(false);
                          onNavigate('book-details', book);
                        }}
                        onNavigate={onNavigate}
                        onAuthorClick={(author) => onNavigate('author-details', author)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-text-muted">
                    No recently read books yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}

      {/* New Arrivals */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Icons.Newspaper className="size-5" />
            </div>
            <h3 className="text-xl font-bold">New Arrivals</h3>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => scrollNewArrivals('left')}
              className="p-2 rounded-lg bg-surface border border-border hover:bg-white/10 transition-all"
              aria-label="Scroll left"
            >
              <Icons.ChevronLeft className="size-4 text-text" />
            </button>
            <button
              type="button"
              onClick={() => scrollNewArrivals('right')}
              className="p-2 rounded-lg bg-surface border border-border hover:bg-white/10 transition-all"
              aria-label="Scroll right"
            >
              <Icons.ChevronRight className="size-4 text-text" />
            </button>
          </div>
        </div>
        <div
          ref={newArrivalsScrollRef}
          className="flex gap-6 overflow-x-auto scroll-smooth no-scrollbar pb-2"
        >
          {newArrivals.map((book) => (
            <div key={book.id} className="shrink-0 w-[160px] sm:w-[180px] md:w-[200px] lg:w-[220px]">
              <BookCard
                book={book}
                onClick={() => onNavigate('book-details', book)}
                onNavigate={onNavigate}
                onAuthorClick={(author) => onNavigate('author-details', author)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Trending & Top Rated */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <section className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <Icons.TrendingUp className="size-5" />
              </div>
              <h3 className="text-xl font-bold">Trending Now</h3>
            </div>
            <button className="text-sm font-bold text-primary hover:underline">Explore</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {books.slice(3, 5).map((book) => (
              <div
                key={book.id}
                onClick={() => onNavigate('book-details', book)}
                className="relative h-48 rounded-2xl overflow-hidden group cursor-pointer"
              >
                <CoverImage src={book.cover} alt={book.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-6 flex flex-col justify-end">
                  <span className="text-[10px] font-bold uppercase text-primary mb-1">{book.category}</span>
                  <h4 className="text-lg font-bold text-white line-clamp-1">{book.title}</h4>
                  <p className="text-xs text-white/60">{book.author}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500">
              <Icons.Star className="size-5" />
            </div>
            <h3 className="text-xl font-bold">Top Rated</h3>
          </div>
          <div className="space-y-4">
            {topRatedBooks.map((book, i) => (
              <div
                key={book.id}
                onClick={() => onNavigate('book-details', book)}
                className="flex items-center gap-4 group cursor-pointer"
              >
                <span className="text-2xl font-black text-text/10 group-hover:text-primary/20 transition-colors">0{i + 1}</span>
                <CoverImage src={book.cover} alt={book.title} className="w-12 h-16 object-cover rounded shadow" />
                <div>
                  <h4 className="text-sm font-bold text-text group-hover:text-primary transition-colors line-clamp-1">{book.title}</h4>
                  <div className="flex items-center gap-1">
                    <Icons.Star className="size-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-[10px] font-bold text-text-muted">{formatRating(book.rating)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
