export type MembershipTier = 'normal' | 'reader';

export const GUEST_FREE_READ_LIMIT = 3;

const READ_BOOKS_KEY = 'elibrary_read_books';
const TIER_KEY = 'elibrary_membership_tier';
const SESSION_KEY = 'elibrary_session';
const AUTH_REQUIRED_KEY = 'elibrary_require_auth';

export const MEMBERSHIP_TIER_EVENT = 'elibrary-membership-tier-changed';
export const AUTH_REQUIRED_EVENT = 'elibrary-auth-required';
export const PENDING_BOOK_RATING_KEY = 'elibrary_pending_book_rating';

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

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

type SessionShape = {
  id?: string;
  role?: string;
};

function getSession(): SessionShape {
  const sessionRaw = safeLocalStorageGet(SESSION_KEY);
  return safeJsonParse<SessionShape>(sessionRaw, {});
}

function getSessionRole(): string {
  return String(getSession()?.role || '').toLowerCase();
}

export function isGuestSession(): boolean {
  return String(getSession()?.id || '') === 'guest';
}

export function hasAuthenticatedSession(): boolean {
  const id = String(getSession()?.id || '').trim();
  return Boolean(id) && id !== 'guest';
}

export function isAuthRequired(): boolean {
  return String(safeLocalStorageGet(AUTH_REQUIRED_KEY) || '') === 'true';
}

export function setAuthRequired(value: boolean) {
  safeLocalStorageSet(AUTH_REQUIRED_KEY, value ? 'true' : 'false');
}

export function getMembershipTier(): MembershipTier {
  const stored = String(safeLocalStorageGet(TIER_KEY) || '').toLowerCase();
  return stored === 'reader' ? 'reader' : 'normal';
}

export function setMembershipTier(tier: MembershipTier) {
  safeLocalStorageSet(TIER_KEY, tier);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MEMBERSHIP_TIER_EVENT, {detail: tier}));
  }
}

function readBookIds(): string[] {
  return safeJsonParse<string[]>(safeLocalStorageGet(READ_BOOKS_KEY), []);
}

export function getReadCount(): number {
  return readBookIds().length;
}

export function hasReachedReadLimit(limit = GUEST_FREE_READ_LIMIT): boolean {
  return getReadCount() >= limit;
}

function recordRead(bookId: string): number {
  const list = readBookIds();
  const normalized = String(bookId || '').trim();
  if (!normalized) return list.length;
  if (!list.includes(normalized)) {
    list.push(normalized);
    safeLocalStorageSet(READ_BOOKS_KEY, JSON.stringify(list));
  }
  return list.length;
}

export function trackRead(bookId: string) {
  recordRead(bookId);
}

export function shouldRequireAuthForRead(): boolean {
  const role = getSessionRole();
  if (role && role !== 'user') return false;
  if (!isGuestSession()) return false;
  return hasReachedReadLimit();
}

export function requestAuth(
  reason: 'read-limit' | 'feature',
  options?: {
    returnTo?: {
      page?: string;
      data?: unknown;
    };
  },
) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT, {detail: {reason, ...options}}));
  }
}
