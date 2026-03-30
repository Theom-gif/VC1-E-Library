import React from 'react';
import {Icons} from '../types';
import {motion} from 'motion/react';
import {useLibrary} from '../context/LibraryContext';
import CoverImage from '../components/CoverImage';
import AvatarImage from '../components/AvatarImage';
import profileService, {type ReadingActivityBucket, type ReadingActivityRange} from '../service/profileService';
import authorService, {type AuthorType} from '../service/authorService';
import ProfileForm from '../components/profile/ProfileForm';
import {useI18n} from '../i18n/I18nProvider';
import authService from '../service/authService';
import {hasAuthenticatedSession} from '../utils/readerUpgrade';
import {FOLLOWING_AUTHORS_EVENT, listFollowingAuthorsFromCache, type FollowingAuthorSnapshot} from '../utils/followingAuthors';

interface ProfileProps {
  user: {name: string; photo: string; membership: string; memberSince?: string};
  onUpdateUser: (user: any) => void;
  onNavigate: (page: any, data?: any) => void;
}

function formatMemberSince(value?: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric'});
}

const READING_ACTIVITY_RANGE_OPTIONS: Array<{value: ReadingActivityRange; labelKey: string}> = [
  {value: '7d', labelKey: 'profile.range7d'},
  {value: '30d', labelKey: 'profile.range30d'},
  {value: '1y', labelKey: 'profile.range1y'},
];

const READING_ACTIVITY_FALLBACK: Record<ReadingActivityRange, ReadingActivityBucket[]> = {
  '7d': [
    {key: 'mon', label: 'Mon', minutes: 45},
    {key: 'tue', label: 'Tue', minutes: 80},
    {key: 'wed', label: 'Wed', minutes: 30},
    {key: 'thu', label: 'Thu', minutes: 95},
    {key: 'fri', label: 'Fri', minutes: 60},
    {key: 'sat', label: 'Sat', minutes: 40},
    {key: 'sun', label: 'Sun', minutes: 75},
  ],
  '30d': [
    {key: 'w1', label: 'Week 1', minutes: 120},
    {key: 'w2', label: 'Week 2', minutes: 210},
    {key: 'w3', label: 'Week 3', minutes: 165},
    {key: 'w4', label: 'Week 4', minutes: 240},
  ],
  '1y': [
    {key: 'jan', label: 'Jan', minutes: 320},
    {key: 'feb', label: 'Feb', minutes: 280},
    {key: 'mar', label: 'Mar', minutes: 360},
    {key: 'apr', label: 'Apr', minutes: 415},
    {key: 'may', label: 'May', minutes: 390},
    {key: 'jun', label: 'Jun', minutes: 440},
  ],
};

function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Phnom_Penh';
  } catch {
    return 'Asia/Phnom_Penh';
  }
}

function mapFollowingSnapshots(items: FollowingAuthorSnapshot[], limit?: number): AuthorType[] {
  const slice = typeof limit === 'number' ? items.slice(0, limit) : items;
  return slice
    .filter((item) => item && item.id)
    .map((item) => {
      const followers = typeof item.followers_count === 'number' ? item.followers_count : undefined;
      const name = String(item.name || '').trim() || 'Unknown Author';
      const photo = String(item.photo || '').trim() || undefined;
      return {
        id: item.id,
        name,
        photo,
        followers,
        followers_count: followers,
        is_following: true,
      };
    });
}

export default function Profile({user, onUpdateUser, onNavigate}: ProfileProps) {
  const {t} = useI18n();
  const {books} = useLibrary();
  const [isEditing, setIsEditing] = React.useState(false);
  const [readingActivityRange, setReadingActivityRange] = React.useState<ReadingActivityRange>('7d');
  const [readingActivity, setReadingActivity] = React.useState<ReadingActivityBucket[]>(READING_ACTIVITY_FALLBACK['7d']);
  const [readingActivityTotal, setReadingActivityTotal] = React.useState(
    READING_ACTIVITY_FALLBACK['7d'].reduce((sum, item) => sum + item.minutes, 0),
  );
  const [readingActivityLoading, setReadingActivityLoading] = React.useState(false);
  const [readingActivityError, setReadingActivityError] = React.useState('');
  const [currentlyReading, setCurrentlyReading] = React.useState(() => books.slice(0, 2));
  const [currentlyReadingLoading, setCurrentlyReadingLoading] = React.useState(false);
  const [currentlyReadingError, setCurrentlyReadingError] = React.useState('');
  const [profileStats, setProfileStats] = React.useState({
    booksReadCount: 0,
    readingDaysCount: 0,
  });

  const [authTick, setAuthTick] = React.useState(0);
  const [followingCount, setFollowingCount] = React.useState<number>(() => listFollowingAuthorsFromCache().length);
  const [followingLoading, setFollowingLoading] = React.useState(false);
  const [followingAllOpen, setFollowingAllOpen] = React.useState(false);
  const [followingAuthors, setFollowingAuthors] = React.useState<AuthorType[]>(() => mapFollowingSnapshots(listFollowingAuthorsFromCache()));

  const canUseAccountFeatures = React.useCallback(() => {
    try {
      return Boolean(authService.getToken()) || hasAuthenticatedSession();
    } catch {
      return hasAuthenticatedSession();
    }
  }, []);

  React.useEffect(() => {
    const handleTokenChanged = () => setAuthTick((v) => v + 1);
    if (typeof window !== 'undefined') {
      window.addEventListener('elibrary-token-changed', handleTokenChanged as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('elibrary-token-changed', handleTokenChanged as EventListener);
      }
    };
  }, []);

  React.useEffect(() => {
    const refreshFromCache = () => {
      const cached = listFollowingAuthorsFromCache();
      setFollowingCount(cached.length);
      setFollowingAuthors(mapFollowingSnapshots(cached));
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(FOLLOWING_AUTHORS_EVENT, refreshFromCache as EventListener);
      window.addEventListener('storage', refreshFromCache as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(FOLLOWING_AUTHORS_EVENT, refreshFromCache as EventListener);
        window.removeEventListener('storage', refreshFromCache as EventListener);
      }
    };
  }, []);

  React.useEffect(() => {
    let alive = true;
    const cached = listFollowingAuthorsFromCache();
    const cachedCount = cached.length;
    setFollowingCount(cachedCount);
    setFollowingAuthors(mapFollowingSnapshots(cached));

    if (!canUseAccountFeatures()) {
      setFollowingLoading(false);
      return () => {
        alive = false;
      };
    }

    setFollowingLoading(true);
    void authorService
      .listFollowing({per_page: 200})
      .then((response) => {
        if (!alive) return;
        const total = Number(response?.meta?.total);
        const count = Number.isFinite(total) && total >= 0 ? total : Array.isArray(response?.items) ? response.items.length : cachedCount;
        setFollowingCount(count);
        if (Array.isArray(response?.items)) {
          setFollowingAuthors(response.items);
        }
      })
      .catch(() => {
        if (!alive) return;
        const fallback = listFollowingAuthorsFromCache();
        setFollowingCount(fallback.length);
        setFollowingAuthors(mapFollowingSnapshots(fallback));
      })
      .finally(() => {
        if (alive) setFollowingLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [authTick, canUseAccountFeatures]);

  React.useEffect(() => {
    let alive = true;

    void profileService
      .me()
      .then((profile) => {
        if (!alive || !profile.stats) return;
        setProfileStats({
          booksReadCount: profile.stats.booksReadCount,
          readingDaysCount: profile.stats.readingDaysCount,
        });
      })
      .catch(() => {
        // Keep UI fallback values if backend profile stats are unavailable.
      });

    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    let alive = true;
    setReadingActivityLoading(true);
    setReadingActivityError('');

    void profileService
      .getReadingActivity(readingActivityRange, getLocalTimezone())
      .then((response) => {
        if (!alive) return;
        const next = response.data.length ? response.data : READING_ACTIVITY_FALLBACK[readingActivityRange];
        setReadingActivity(next);
        setReadingActivityTotal(
          response.meta.total_minutes || next.reduce((sum, item) => sum + item.minutes, 0),
        );
      })
      .catch((error: any) => {
        if (!alive) return;
        setReadingActivity(READING_ACTIVITY_FALLBACK[readingActivityRange]);
        setReadingActivityTotal(
          READING_ACTIVITY_FALLBACK[readingActivityRange].reduce((sum, item) => sum + item.minutes, 0),
        );
        const status = Number(error?.status);
        const canShowDetails = Boolean((import.meta as any)?.env?.DEV);
        if (canShowDetails && status !== 404) {
          setReadingActivityError(error?.data?.message || error?.message || 'Unable to load reading activity.');
        } else {
          setReadingActivityError('');
        }
      })
      .finally(() => {
        if (alive) setReadingActivityLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [readingActivityRange]);

  React.useEffect(() => {
    let alive = true;
    setCurrentlyReadingLoading(true);
    setCurrentlyReadingError('');

    void profileService
      .getCurrentlyReading()
      .then((items) => {
        if (!alive) return;
        if (items.length) {
          setCurrentlyReading(items.slice(0, 2));
          return;
        }
        setCurrentlyReading(books.slice(0, 2));
      })
      .catch((error: any) => {
        if (!alive) return;
        setCurrentlyReading(books.slice(0, 2));
        const status = Number(error?.status);
        const canShowDetails = Boolean((import.meta as any)?.env?.DEV);
        if (canShowDetails && status !== 404) {
          setCurrentlyReadingError(error?.data?.message || error?.message || 'Unable to load currently reading books.');
        } else {
          setCurrentlyReadingError('');
        }
      })
      .finally(() => {
        if (alive) setCurrentlyReadingLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [books]);

  const memberSinceText = formatMemberSince(user.memberSince);
  const maxReadingMinutes = Math.max(...readingActivity.map((item) => item.minutes), 1);
  const booksReadValue = String(readingActivity.filter((item) => item.minutes > 0).length);

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-20 py-10 space-y-12">
      <section className="relative rounded-3xl overflow-hidden bg-surface border border-border p-8 md:p-12">
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-r from-primary/30 via-bg to-primary/30 opacity-50" />
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-end gap-8">
          <div className="relative">
            <div className="size-32 rounded-3xl border-4 border-bg shadow-2xl overflow-hidden bg-surface">
              <AvatarImage
                src={user.photo}
                alt={t('profile.avatarAlt', {name: user.name || 'User'})}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-primary text-white shadow-lg" aria-hidden="true">
              <Icons.Award className="size-5" />
            </div>
          </div>
          <div className="flex-1 text-center md:text-left space-y-2">
            {isEditing ? (
              <div className="w-full">
                <ProfileForm
                  initialName={user.name}
                  initialPhoto={user.photo}
                  onClose={() => setIsEditing(false)}
                  onUpdatedUser={(partial) =>
                    onUpdateUser({
                      ...user,
                      ...partial,
                    })
                  }
                />
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-text">{user.name}</h1>
                <p className="text-text-muted">
                  {memberSinceText
                    ? t('profile.taglineMemberSince', {date: memberSinceText})
                    : t('profile.tagline')}
                </p>
              </>
            )}
            <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
              <StatBadge
                label={t('profile.booksRead')}
                value={String(profileStats.booksReadCount || Number(booksReadValue))}
                icon={<Icons.Book className="size-3" />}
              />
              <StatBadge
                label={t('profile.readingStreak')}
                value={`${profileStats.readingDaysCount || readingActivity.reduce((count, item) => (item.minutes > 0 ? count + 1 : count), 0)} Days`}
                icon={<Icons.Flame className="size-3" />}
              />
              <StatBadge
                label={t('profile.following')}
                value={followingLoading ? '...' : String(followingCount)}
                icon={<Icons.User className="size-3" />}
              />
            </div>
          </div>
          <div className="flex gap-3">
            {isEditing ? null : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-primary text-white px-6 py-2 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  {t('profile.edit')}
                </button>
                <button
                  onClick={() => onNavigate('logout')}
                  className="bg-surface text-red-500 border border-red-500/30 px-6 py-2 rounded-xl font-bold hover:bg-red-500/10 transition-all"
                >
                  {t('profile.logout')}
                </button>
                <button
                  className="bg-surface text-text border border-border p-2 rounded-xl hover:bg-white/10 transition-all"
                  aria-label={t('profile.share')}
                >
                  <Icons.Share2 className="size-5" />
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-text">{t('profile.readingActivity')}</h3>
              <select
                value={readingActivityRange}
                onChange={(event) => setReadingActivityRange(event.target.value as ReadingActivityRange)}
                className="bg-surface border border-border rounded-lg px-3 py-1 text-xs font-bold outline-none text-text"
              >
                {READING_ACTIVITY_RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-bg">
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-bold text-primary">
                {readingActivityTotal} mins total
              </span>
              {readingActivityLoading ? <span className="text-text-muted">{t('profile.loadingBackendActivity')}</span> : null}
              {readingActivityError ? <span className="text-amber-500">{readingActivityError}</span> : null}
            </div>
            <div className="h-64 w-full bg-surface border border-border rounded-2xl p-6 flex items-end justify-between gap-3">
              {readingActivity.map((item, i) => {
                const heightPercent = maxReadingMinutes > 0 ? Math.max(6, Math.round((item.minutes / maxReadingMinutes) * 100)) : 0;
                return (
                <div key={item.key || i} className="flex-1 flex flex-col items-center gap-3 h-full justify-end">
                  <div className="w-full bg-primary/5 rounded-t-lg flex-1 flex items-end overflow-hidden">
                    <motion.div
                      initial={{height: 0}}
                      animate={{height: `${heightPercent}%`}}
                      transition={{duration: 1, delay: i * 0.1, ease: 'easeOut'}}
                      className="w-full bg-gradient-to-t from-primary/40 to-primary rounded-t-lg relative group cursor-pointer"
                    >
                      <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-surface border border-border text-text text-[10px] font-bold px-2 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 whitespace-nowrap shadow-xl z-10">
                        {item.minutes} mins
                      </div>
                    </motion.div>
                  </div>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">
                    {item.label}
                  </span>
                </div>
              )})}
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-bold text-text">{t('profile.currentlyReading')}</h3>
              <div className="text-xs">
                {currentlyReadingLoading ? <span className="text-text-muted">{t('profile.loadingBackendBooks')}</span> : null}
                {currentlyReadingError ? <span className="text-amber-500">{currentlyReadingError}</span> : null}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {currentlyReading.slice(0, 2).map((book) => (
                <div
                  key={book.id}
                  onClick={() => onNavigate('book-details', book)}
                  className="p-4 rounded-2xl bg-surface border border-border flex gap-4 cursor-pointer group hover:border-primary/30 transition-all"
                >
                  <CoverImage src={book.cover} alt={book.title} className="w-20 h-28 object-cover rounded-lg shadow-lg" />
                  <div className="flex-1 flex flex-col justify-between py-1">
                    <div>
                      <h4 className="font-bold text-sm text-text group-hover:text-primary transition-colors line-clamp-1">{book.title}</h4>
                      <p className="text-[10px] text-text-muted">{book.author}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-text-muted">Progress</span>
                        <span className="text-primary">{Math.max(0, Math.min(100, Math.round(Number(book.progress || 0))))}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{width: `${Math.max(0, Math.min(100, Math.round(Number(book.progress || 0))))}%`}}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-12">
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-text">{t('profile.following')}</h3>
              <button
                type="button"
                onClick={() => setFollowingAllOpen(true)}
                disabled={followingAuthors.length === 0}
                className="text-xs font-bold text-primary hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('profile.seeAll')}
              </button>
            </div>
            <div className="space-y-4">
              {followingLoading ? (
                <p className="text-sm font-semibold text-text-muted">{t('common.loading')}</p>
              ) : followingAuthors.length === 0 ? (
                <div className="rounded-2xl border border-border bg-surface px-4 py-5 text-center">
                  <p className="text-sm font-bold text-text">{t('profile.noFollowing')}</p>
                  <p className="mt-1 text-xs text-text-muted">{t('profile.noFollowingHint')}</p>
                  <button
                    type="button"
                    onClick={() => onNavigate('authors')}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-primary/90"
                  >
                    <Icons.User className="size-4" />
                    {t('profile.browseAuthors')}
                  </button>
                </div>
              ) : (
                followingAuthors.slice(0, 4).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onNavigate('author-details', {id: a.id, name: a.name})}
                    className="w-full flex items-center justify-between rounded-2xl border border-border bg-surface px-3 py-3 text-left hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <AvatarImage
                        src={String(a.photo || '')}
                        alt={a.name}
                        className="size-10 rounded-full border border-border object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-text">{a.name}</p>
                        <p className="text-[10px] text-text-muted">
                          {t('profile.followersCount', {
                            count: (a.followers_count ?? a.followers ?? 0).toLocaleString(),
                          })}
                        </p>
                      </div>
                    </div>
                    <Icons.ChevronRight className="size-4 text-text-muted/50" />
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {followingAllOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 px-4 py-10 overflow-y-auto backdrop-blur-md">
          <div className="w-full max-w-xl rounded-3xl border border-border bg-bg shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div className="flex items-center gap-2">
                <Icons.User className="size-5 text-primary" />
                <h4 className="text-base font-black text-text">{t('profile.following')}</h4>
              </div>
              <button
                type="button"
                onClick={() => setFollowingAllOpen(false)}
                className="rounded-xl border border-border bg-surface p-2 text-text-muted hover:text-text hover:bg-white/5 transition-all"
                aria-label="Close"
              >
                <Icons.X className="size-4" />
              </button>
            </div>
            <div className="px-6 py-6">
              {followingLoading ? (
                <p className="text-sm font-semibold text-text-muted">{t('common.loading')}</p>
              ) : followingAuthors.length === 0 ? (
                <div className="rounded-2xl border border-border bg-surface px-4 py-6 text-center">
                  <p className="text-sm font-bold text-text">{t('profile.noFollowing')}</p>
                  <p className="mt-1 text-xs text-text-muted">{t('profile.noFollowingHint')}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFollowingAllOpen(false);
                      onNavigate('authors');
                    }}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-primary/90"
                  >
                    <Icons.User className="size-4" />
                    {t('profile.browseAuthors')}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {followingAuthors.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setFollowingAllOpen(false);
                        onNavigate('author-details', {id: a.id, name: a.name});
                      }}
                      className="w-full flex items-center justify-between rounded-2xl border border-border bg-surface px-3 py-3 text-left hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <AvatarImage
                          src={String(a.photo || '')}
                          alt={a.name}
                          className="size-10 rounded-full border border-border object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-text">{a.name}</p>
                          <p className="text-[10px] text-text-muted">
                            {t('profile.followersCount', {
                              count: (a.followers_count ?? a.followers ?? 0).toLocaleString(),
                            })}
                          </p>
                        </div>
                      </div>
                      <Icons.ChevronRight className="size-4 text-text-muted/50" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatBadge({label, value, icon}: {label: string; value: string; icon: React.ReactNode}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-border">
      <div className="text-primary">{icon}</div>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-tighter leading-none">{label}</span>
        <span className="text-xs font-bold text-text">{value}</span>
      </div>
    </div>
  );
}
