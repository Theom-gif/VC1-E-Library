import React from 'react';
import { Icons } from '../types';
import { motion } from 'motion/react';
import notificationService from '../service/notificationService';
import authService from '../service/authService';

interface NotificationsPageProps {
  onNavigate: (page: any, data?: any) => void;
}

type UiNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt?: string;
  timeLabel: string;
  unread: boolean;
  actionUrl?: string;
};

const LOCAL_NOTIFICATIONS_KEY = 'local-notifications';

function loadLocalNotifications(): UiNotification[] {
  try {
    const json = localStorage.getItem(LOCAL_NOTIFICATIONS_KEY);
    if (!json) return [];
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.id === 'string')
      .map((item) => ({
        id: String(item.id),
        type: String(item.type || 'system'),
        title: String(item.title || 'Notification'),
        message: String(item.message || ''),
        createdAt: String(item.createdAt || new Date().toISOString()),
        timeLabel: String(item.timeLabel || 'just now'),
        unread: Boolean(item.unread) || false,
        actionUrl: item.actionUrl ? String(item.actionUrl) : undefined,
      }));
  } catch {
    return [];
  }
}

function saveLocalNotifications(items: UiNotification[]) {
  try {
    localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(items.slice(0, 100)));
  } catch {
    // Ignore storage errors.
  }
}

function pushLocalNotification(notification: UiNotification) {
  const existing = loadLocalNotifications();
  const merged = [notification, ...existing.filter((item) => item.id !== notification.id)].slice(0, 100);
  saveLocalNotifications(merged);
  window.dispatchEvent(new CustomEvent('local-notification', {detail: notification}));
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function formatRelativeTime(value?: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const diffSeconds = Math.max(0, Math.round((Date.now() - parsed.getTime()) / 1000));
  if (diffSeconds < 60) return `${Math.max(1, diffSeconds)}s ago`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function normalizeNotification(raw: any): UiNotification | null {
  const id = pickString(raw?.id);
  if (!id) return null;
  const createdAt = pickString(raw?.created_at, raw?.createdAt, raw?.time, raw?.timestamp);
  const readAt = pickString(raw?.read_at, raw?.readAt);
  const unreadRaw = raw?.unread ?? raw?.is_unread ?? raw?.unread_flag;
  const unread =
    typeof unreadRaw === 'boolean'
      ? unreadRaw
      : typeof unreadRaw === 'number'
        ? unreadRaw === 1
        : typeof unreadRaw === 'string'
          ? ['1', 'true', 'yes', 'unread'].includes(unreadRaw.trim().toLowerCase())
          : !readAt;

  const timeLabel = formatRelativeTime(createdAt) || pickString(raw?.time) || '';

  return {
    id,
    type: pickString(raw?.type, 'system').toLowerCase(),
    title: pickString(raw?.title, 'Notification'),
    message: pickString(raw?.message, raw?.body, raw?.text, ''),
    createdAt: createdAt || undefined,
    timeLabel,
    unread,
    actionUrl: pickString(raw?.action_url, raw?.actionUrl, raw?.url) || undefined,
  };
}

function iconForType(type: string) {
  const t = String(type || '').toLowerCase();
  if (t === 'new') return <Icons.Book className="size-5" />;
  if (t === 'download') return <Icons.Download className="size-5" />;
  if (t === 'goal') return <Icons.Trophy className="size-5" />;
  if (t === 'achievement') return <Icons.Award className="size-5" />;
  return <Icons.Settings className="size-5" />;
}

function colorForType(type: string) {
  const t = String(type || '').toLowerCase();
  if (t === 'new') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20';
  if (t === 'download') return 'bg-blue-500/20 text-blue-400 border-blue-500/20';
  if (t === 'goal' || t === 'achievement') return 'bg-orange-500/20 text-orange-400 border-orange-500/20';
  return 'bg-primary/20 text-primary border-primary/20';
}

export default function NotificationsPage({ onNavigate }: NotificationsPageProps) {
  const [notifications, setNotifications] = React.useState<UiNotification[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [isMarkingAll, setIsMarkingAll] = React.useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<number | null>(null);

  React.useEffect(() => {
    const onLocalNotification = (event: Event) => {
      const customEvent = event as CustomEvent<UiNotification>;
      if (!customEvent?.detail?.id) return;
      setNotifications((prev) => [customEvent.detail, ...prev.filter((item) => item.id !== customEvent.detail.id)]);
      const existing = loadLocalNotifications();
      saveLocalNotifications([customEvent.detail, ...existing.filter((item) => item.id !== customEvent.detail.id)]);
    };

    window.addEventListener('local-notification', onLocalNotification as EventListener);
    return () => {
      window.removeEventListener('local-notification', onLocalNotification as EventListener);
    };
  }, []);

  const extractList = (payload: any): any[] => {
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.data)) return payload.data.data;
    if (Array.isArray(payload?.notifications)) return payload.notifications;
    if (Array.isArray(payload)) return payload;
    return [];
  };

  const extractMeta = (payload: any): Record<string, any> => {
    if (payload?.meta && typeof payload.meta === 'object') return payload.meta;
    if (payload?.data?.meta && typeof payload.data.meta === 'object') return payload.data.meta;
    return {};
  };

  const loadNotifications = React.useCallback(async () => {
    setIsLoading(true);
    setError('');

    const token = authService.getToken();
    if (!token) {
      const local = loadLocalNotifications();
      setNotifications(local);
      setLastUpdatedAt(local.length > 0 ? Date.now() : null);
      setIsLoading(false);
      return;
    }
    try {
      const perPage = 50;
      const all: UiNotification[] = [];
      let page = 1;
      let lastPage = 1;

      do {
        const payload: any = await notificationService.list({page, per_page: perPage});
        const list = extractList(payload);
        const items = list.map(normalizeNotification).filter(Boolean) as UiNotification[];
        all.push(...items);

        const meta = extractMeta(payload);
        const nextLastPage = Number(meta?.last_page ?? meta?.lastPage ?? 1) || 1;
        lastPage = Math.max(1, nextLastPage);
        page += 1;
      } while (page <= lastPage && page <= 20);

      // Deduplicate (some backends return overlapping pages or aliases).
      const byId = new Map<string, UiNotification>();
      for (const item of all) byId.set(item.id, item);
      const backendNotifications = Array.from(byId.values());
      const localNotifications = loadLocalNotifications();

      // Local notifications should show first and not clobber server items with same id.
      const merged = [...localNotifications, ...backendNotifications.filter((n) => !localNotifications.some((l) => l.id === n.id))];
      setNotifications(merged);
      setLastUpdatedAt(Date.now());
    } catch (e: any) {
      const status = Number(e?.status);
      if (status === 401 || status === 403) {
        setError('');
      } else {
        setError(e?.data?.message || e?.message || 'Unable to load notifications.');
      }
      const local = loadLocalNotifications();
      setNotifications(local);
      setLastUpdatedAt(local.length > 0 ? Date.now() : null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      await loadNotifications();
      if (!alive) return;
    })();

    const intervalId = window.setInterval(() => {
      if (!alive) return;
      void loadNotifications();
    }, 30000);
    return () => {
      alive = false;
      window.clearInterval(intervalId);
    };
  }, [loadNotifications]);

  const markAllRead = async () => {
    if (isMarkingAll) return;
    setIsMarkingAll(true);

    const localNotifs = loadLocalNotifications();
    if (localNotifs.length > 0) {
      const updatedLocal = localNotifs.map((n) => ({...n, unread: false}));
      saveLocalNotifications(updatedLocal);
      setNotifications((prev) => prev.map((n) => (n.id.startsWith('local-') ? {...n, unread: false} : n)));
    }

    if (!authService.getToken()) {
      setIsMarkingAll(false);
      return;
    }

    try {
      await notificationService.markAllRead();
      await loadNotifications();
    } catch (e: any) {
      const status = Number(e?.status);
      if (status === 401 || status === 403) {
        setError('');
      } else {
        setError(e?.data?.message || e?.message || 'Unable to mark all as read.');
      }
    } finally {
      setIsMarkingAll(false);
    }
  };

  const markRead = async (id: string) => {
    if (id.startsWith('local-')) {
      setNotifications((prev) => {
        const next = prev.map((n) => (n.id === id ? {...n, unread: false} : n));
        const local = next.filter((n) => n.id.startsWith('local-'));
        saveLocalNotifications(local);
        return next;
      });
      return;
    }

    if (!authService.getToken()) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? {...n, unread: false} : n)));
      return;
    }

    try {
      await notificationService.markRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? {...n, unread: false} : n)));
    } catch (e: any) {
      const status = Number(e?.status);
      if (status === 401 || status === 403) {
        setError('');
      } else {
        setError(e?.data?.message || e?.message || 'Unable to mark as read.');
      }
    }
  };

  const remove = async (id: string) => {
    if (id.startsWith('local-')) {
      setNotifications((prev) => {
        const next = prev.filter((n) => n.id !== id);
        const local = next.filter((n) => n.id.startsWith('local-'));
        saveLocalNotifications(local);
        return next;
      });
      return;
    }

    if (!authService.getToken()) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      return;
    }

    setNotifications((prev) => prev.filter((n) => n.id !== id));

    try {
      await notificationService.remove(id);
    } catch (e: any) {
      const status = Number(e?.status);
      if (status === 401 || status === 403) {
        setError('');
      } else if (status === 404 || status === 405) {
        // Some backends don't expose delete route yet; keep local UI deletion.
        setError('');
      } else {
        setError(e?.data?.message || e?.message || 'Unable to delete notification.');
      }
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 lg:px-20 py-10 space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text">Notifications</h1>
          <p className="text-sm text-text-muted">Stay updated with your reading journey and library activity</p>
        </div>
        <button
          onClick={markAllRead}
          disabled={isMarkingAll || isLoading || notifications.length === 0}
          className="text-sm font-bold text-primary hover:underline flex items-center gap-2 disabled:opacity-60"
        >
          <Icons.CheckCheck className="size-4" />
          {isMarkingAll ? 'Marking...' : 'Mark all as read'}
        </button>
      </div>

      {lastUpdatedAt ? (
        <div className="text-xs text-text-muted">
          Updated {formatRelativeTime(new Date(lastUpdatedAt).toISOString())}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span>{error}</span>
        </div>
      ) : null}

      <div className="space-y-4">
        {isLoading ? (
          <div className="rounded-3xl border border-border bg-surface p-6 text-sm text-text-muted">
            Loading notifications...
          </div>
        ) : null}

        {!isLoading && !error && notifications.length === 0 ? (
          <div className="rounded-3xl border border-border bg-surface p-10 text-center space-y-2">
            <p className="text-text font-bold">No notifications yet</p>
            <p className="text-sm text-text-muted">You will see updates here when something happens.</p>
          </div>
        ) : null}

        {notifications.map((n, i) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`group p-6 rounded-3xl border border-border bg-surface hover:border-primary/30 transition-all relative ${n.unread ? 'ring-1 ring-primary/20' : ''}`}
          >
            {n.unread && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-primary rounded-r-full" />
            )}
            <div className="flex gap-6">
              <div className={`size-14 rounded-2xl shrink-0 flex items-center justify-center border transition-transform group-hover:scale-110 ${colorForType(n.type)}`}>
                {iconForType(n.type)}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className={`text-lg font-bold ${n.unread ? 'text-text' : 'text-text-muted'}`}>{n.title}</h5>
                    <p className="text-sm text-text-muted leading-relaxed">{n.message}</p>
                  </div>
                  <span className="text-xs text-text-muted font-bold font-mono whitespace-nowrap">{n.timeLabel}</span>
                </div>
                <div className="flex items-center gap-4 pt-2">
                  <button
                    onClick={() => void remove(n.id)}
                    className="text-xs font-bold text-text-muted hover:text-red-500 transition-colors uppercase tracking-widest"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="pt-10 border-t border-border flex justify-center">
        <button 
          onClick={() => onNavigate('home')}
          className="text-sm font-bold text-text-muted hover:text-text transition-colors flex items-center gap-2"
        >
          <Icons.ChevronLeft className="size-4" />
          Back to Home
        </button>
      </div>
    </div>
  );
}
