import http from 'node:http';
import path from 'node:path';
import {URL, pathToFileURL} from 'node:url';

const DEFAULT_PORT = 8000;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.setHeader('Access-Control-Max-Age', '600');
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload ?? null);
  setCorsHeaders(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.end(body);
}

function sendText(res, statusCode, text) {
  const body = String(text ?? '');
  setCorsHeaders(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.end(body);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pickString(value, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : fallback;
}

function toPositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function toNonNegativeNumber(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || Number.isNaN(n) || n < 0) return fallback;
  return n;
}

function toIsoString(value) {
  if (!value) return new Date().toISOString();
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function dateKeyUtc(value) {
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthKeyUtc(value) {
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function addDaysUtc(date, deltaDays) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + Number(deltaDays || 0));
  return d;
}

function parseBearerToken(req) {
  const authHeader = pickString(req?.headers?.authorization);
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function svgCoverDataUrl(title, background = '#0ea5e9') {
  const safeTitle = pickString(title, 'Book');
  const initial = safeTitle.trim().slice(0, 1).toUpperCase() || 'B';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="640" viewBox="0 0 420 640">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${background}"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <rect width="420" height="640" fill="url(#g)"/>
  <text x="50%" y="52%" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="220" font-weight="800" fill="rgba(255,255,255,0.92)" text-anchor="middle" dominant-baseline="middle">${initial}</text>
  <text x="50%" y="76%" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="28" font-weight="700" fill="rgba(255,255,255,0.85)" text-anchor="middle">${escapeXml(safeTitle).slice(0, 22)}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function svgAvatarDataUrl(label = 'User', background = '#0ea5e9') {
  const safeLabel = pickString(label, 'User');
  const parts = safeLabel.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p.slice(0, 1).toUpperCase()).join('') || 'U';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${background}"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="128" ry="128" fill="url(#g)"/>
  <text x="50%" y="53%" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="92" font-weight="800" fill="rgba(255,255,255,0.92)" text-anchor="middle" dominant-baseline="middle">${escapeXml(initials)}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function seedBooks() {
  const raw = [
    {id: 1, title: 'Atomic Habits', author_name: 'James Clear', category_name: 'Self-Help', average_rating: 4.8, bg: '#22c55e'},
    {id: 2, title: 'Clean Code', author_name: 'Robert C. Martin', category_name: 'Programming', average_rating: 4.7, bg: '#0ea5e9'},
    {id: 3, title: 'The Pragmatic Programmer', author_name: 'Andrew Hunt', category_name: 'Programming', average_rating: 4.6, bg: '#a855f7'},
    {id: 4, title: 'Deep Work', author_name: 'Cal Newport', category_name: 'Productivity', average_rating: 4.5, bg: '#f97316'},
    {id: 5, title: 'The Great Gatsby', author_name: 'F. Scott Fitzgerald', category_name: 'Classic', average_rating: 4.3, bg: '#ef4444'},
    {id: 6, title: 'Dune', author_name: 'Frank Herbert', category_name: 'Sci-Fi', average_rating: 4.6, bg: '#14b8a6'},
    {id: 7, title: 'Sapiens', author_name: 'Yuval Noah Harari', category_name: 'History', average_rating: 4.4, bg: '#6366f1'},
    {id: 8, title: 'The Psychology of Money', author_name: 'Morgan Housel', category_name: 'Finance', average_rating: 4.5, bg: '#eab308'},
    {id: 9, title: '1984', author_name: 'George Orwell', category_name: 'Classic', average_rating: 4.4, bg: '#64748b'},
    {id: 10, title: 'The Alchemist', author_name: 'Paulo Coelho', category_name: 'Fiction', average_rating: 4.1, bg: '#ec4899'},
  ];

  return raw.map((b) => ({
    ...b,
    status: 'approved',
    cover_image_url: svgCoverDataUrl(b.title, b.bg),
  }));
}

function buildCategories(books) {
  const map = new Map();
  for (const b of books) {
    const name = pickString(b.category_name, 'Uncategorized');
    if (!map.has(name)) map.set(name, {id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''), name, book_count: 0});
    map.get(name).book_count += 1;
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function hashString(value) {
  const text = pickString(value);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function buildAuthors(books) {
  const map = new Map();
  for (const book of books) {
    const name = pickString(book.author_name, 'Unknown Author');
    if (!map.has(name)) {
      const hash = hashString(name);
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      map.set(name, {
        id: slug || `author-${hash || 1}`,
        name,
        bio: `${name} is a featured author in the E-Library collection.`,
        photo: svgAvatarDataUrl(name, '#0ea5e9'),
        followers: 1200 + (hash % 48000),
        avg_rating_total: 0,
        books_count: 0,
      });
    }

    const rating = toNonNegativeNumber(book.average_rating, 0);
    const item = map.get(name);
    item.avg_rating_total += rating;
    item.books_count += 1;
  }

  return Array.from(map.values())
    .map((item) => ({
      id: item.id,
      name: item.name,
      bio: item.bio,
      photo: item.photo,
      followers: item.followers,
      books_count: item.books_count,
      avg_rating: item.books_count > 0 ? Number((item.avg_rating_total / item.books_count).toFixed(1)) : 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function filterBooks(books, {q, category, sort}) {
  let list = books.slice();
  const query = pickString(q).toLowerCase();
  const categoryQuery = pickString(category).toLowerCase();

  if (query) {
    list = list.filter((b) => {
      const hay = `${pickString(b.title)} ${pickString(b.author_name)} ${pickString(b.category_name)}`.toLowerCase();
      return hay.includes(query);
    });
  }

  if (categoryQuery) {
    list = list.filter((b) => pickString(b.category_name).toLowerCase() === categoryQuery);
  }

  const s = pickString(sort).toLowerCase();
  if (s === 'rating') {
    list.sort((a, b) => Number(b.average_rating) - Number(a.average_rating));
  } else if (s === 'newest') {
    list.sort((a, b) => Number(b.id) - Number(a.id));
  }

  return list;
}

export function createMockBackendServer({logger = console} = {}) {
  const books = seedBooks();
  const categories = buildCategories(books);
  const authors = buildAuthors(books);
  const favorites = new Set();
  const authorFollowsByUser = new Map(); // userId => Set(authorId)
  const baseUser = {
    id: 1,
    firstname: 'Mock',
    lastname: 'User',
    email: 'user@example.com',
    role: 'user',
  };

  const users = new Map();
  users.set(String(baseUser.id), {...baseUser});

  const readingLogs = [];
  const reviews = [];
  const notifications = [];
  const unlockedByUser = new Map(); // userId => Map(key => unlocked_at ISO string)
  const readingSessions = new Map(); // userId => {started_at, book_id}
  let nextReadingLogId = 1;
  let nextReviewId = 1;
  let nextNotificationId = 1;

  // "Session" user for this mock process; updated via login/register.
  let sessionUser = {...baseUser};

  const achievementDefinitions = [
    {key: 'streak', label: 'Streak', description: 'Read on consecutive days.', threshold: 7, unit: 'days'},
    {key: 'elite', label: 'Elite', description: 'Unlock other badges.', threshold: 4, unit: 'badges'},
    {key: 'fast', label: 'Fast', description: 'Spend time reading.', threshold: 60, unit: 'minutes'},
    {key: 'scholar', label: 'Scholar', description: 'Read different books.', threshold: 5, unit: 'books'},
    {key: 'critic', label: 'Critic', description: 'Write book reviews.', threshold: 3, unit: 'reviews'},
  ];

  function isAdmin(user) {
    return pickString(user?.role).toLowerCase() === 'admin';
  }

  function isAuthor(user) {
    return pickString(user?.role).toLowerCase() === 'author';
  }

  function ensureUser(id) {
    const key = String(id ?? '').trim();
    if (!key) return null;
    if (!users.has(key)) {
      users.set(key, {
        id: Number.isFinite(Number(key)) ? Number(key) : key,
        firstname: 'User',
        lastname: key,
        email: `user${key}@example.com`,
        role: 'user',
      });
    }
    return users.get(key);
  }

  function requireAuth(req, res) {
    const token = parseBearerToken(req);
    if (!token) {
      sendJson(res, 401, {message: 'Unauthenticated'});
      return null;
    }
    // Ensure session user exists in our in-memory user table.
    ensureUser(sessionUser.id);
    users.set(String(sessionUser.id), {...users.get(String(sessionUser.id)), ...sessionUser});
    return users.get(String(sessionUser.id));
  }

  function ensureAuthorFollowSet(userId) {
    const uid = String(userId ?? '').trim();
    if (!uid) return new Set();
    if (!authorFollowsByUser.has(uid)) authorFollowsByUser.set(uid, new Set());
    return authorFollowsByUser.get(uid);
  }

  function isFollowingAuthorId(userId, authorId) {
    const uid = String(userId ?? '').trim();
    const aid = pickString(authorId);
    if (!uid || !aid) return false;
    const set = ensureAuthorFollowSet(uid);
    return set.has(aid);
  }

  function createNotification(userId, payload) {
    const uid = String(userId);
    ensureUser(uid);
    const createdAt = toIsoString(payload?.created_at);
    const notification = {
      id: `n_${nextNotificationId++}`,
      user_id: uid,
      type: pickString(payload?.type, 'system'),
      title: pickString(payload?.title, 'Notification'),
      message: pickString(payload?.message, payload?.body, ''),
      action_url: pickString(payload?.action_url, payload?.url) || undefined,
      payload: payload?.payload && typeof payload.payload === 'object' ? payload.payload : undefined,
      created_at: createdAt,
      read_at: payload?.read_at ?? null,
      audience: pickString(payload?.audience) || undefined,
    };
    notifications.push(notification);
    return notification;
  }

  function createAchievementUnlockNotifications(userId, keys) {
    const uid = String(userId);
    const uniq = Array.from(new Set((Array.isArray(keys) ? keys : []).map((k) => pickString(k).toLowerCase()).filter(Boolean)));
    if (!uniq.length) return [];

    const created = [];
    for (const key of uniq) {
      const def = achievementDefinitions.find((d) => pickString(d?.key).toLowerCase() === key);
      const label = pickString(def?.label, key);
      created.push(
        createNotification(uid, {
          type: 'goal',
          title: 'Achievement Unlocked',
          message: `You unlocked the ${label} badge!`,
          audience: 'user',
        }),
      );
    }
    return created;
  }

  function listUserNotifications(userId, {unreadOnly = false, page = 1, perPage = 20} = {}) {
    const uid = String(userId);
    const filtered = notifications
      .filter((n) => String(n.user_id) === uid)
      .filter((n) => (unreadOnly ? !n.read_at : true))
      .slice()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    const total = filtered.length;
    const safePerPage = Math.max(1, Math.min(100, toPositiveInt(perPage, 20)));
    const lastPage = Math.max(1, Math.ceil(total / safePerPage));
    const safePage = Math.min(Math.max(1, toPositiveInt(page, 1)), lastPage);
    const start = (safePage - 1) * safePerPage;
    const data = filtered.slice(start, start + safePerPage);
    const unreadCount = notifications.filter((n) => String(n.user_id) === uid && !n.read_at).length;

    return {
      data,
      meta: {current_page: safePage, last_page: lastPage, per_page: safePerPage, total, unread_count: unreadCount},
    };
  }

  function unlockedMapForUser(userId) {
    const key = String(userId);
    if (!unlockedByUser.has(key)) unlockedByUser.set(key, new Map());
    return unlockedByUser.get(key);
  }

  function getUserReadingStats(userId) {
    const uid = String(userId);
    const userLogs = readingLogs.filter((l) => String(l.user_id) === uid);
    const totalSeconds = userLogs.reduce((sum, l) => sum + toNonNegativeNumber(l.total_seconds, 0), 0);
    const bookSet = new Set(userLogs.map((l) => pickString(l.book_id)).filter(Boolean));
    const daySet = new Set(userLogs.map((l) => dateKeyUtc(l.logged_at)).filter(Boolean));
    const sortedDays = Array.from(daySet).sort(); // YYYY-MM-DD
    let currentStreak = 0;
    if (sortedDays.length) {
      let streak = 1;
      for (let i = sortedDays.length - 1; i > 0; i -= 1) {
        const current = new Date(`${sortedDays[i]}T00:00:00.000Z`);
        const prev = new Date(`${sortedDays[i - 1]}T00:00:00.000Z`);
        const diffDays = Math.round((current.getTime() - prev.getTime()) / 86400000);
        if (diffDays === 1) streak += 1;
        else break;
      }
      currentStreak = streak;
    }

    const userReviews = reviews.filter((r) => String(r.user_id) === uid);

    return {
      totalSeconds,
      totalMinutes: Math.floor(totalSeconds / 60),
      uniqueBooks: bookSet.size,
      readingDays: daySet.size,
      currentStreak,
      reviewCount: userReviews.length,
    };
  }

  function buildUserAchievement(def, userId) {
    const stats = getUserReadingStats(userId);
    const key = pickString(def?.key).toLowerCase();
    const threshold = def?.threshold !== undefined ? Number(def.threshold) : undefined;

    let progress = 0;
    if (key === 'streak') progress = stats.currentStreak;
    else if (key === 'fast') progress = stats.totalMinutes;
    else if (key === 'scholar') progress = stats.uniqueBooks;
    else if (key === 'critic') progress = stats.reviewCount;
    else if (key === 'elite') {
      const map = unlockedMapForUser(userId);
      progress = Array.from(map.keys()).filter((k) => k !== 'elite').length;
    }

    const map = unlockedMapForUser(userId);
    const unlockedAt = map.get(key) || null;
    const unlocked = Boolean(unlockedAt) || (threshold !== undefined ? progress >= threshold : false);

    return {
      ...def,
      unlocked,
      progress,
      unlocked_at: unlockedAt,
    };
  }

  function checkAndUnlockAchievements(userId) {
    const uid = String(userId);
    ensureUser(uid);
    const unlocks = unlockedMapForUser(uid);
    const now = new Date().toISOString();

    // Evaluate non-elite first so elite can depend on them.
    const orderedDefs = [
      ...achievementDefinitions.filter((d) => d.key !== 'elite'),
      ...achievementDefinitions.filter((d) => d.key === 'elite'),
    ];

    const newlyUnlocked = [];
    for (const def of orderedDefs) {
      const key = pickString(def?.key).toLowerCase();
      const threshold = def?.threshold !== undefined ? Number(def.threshold) : undefined;
      if (!key || threshold === undefined) continue;
      const current = buildUserAchievement(def, uid);
      if (current.unlocked && !unlocks.get(key)) {
        unlocks.set(key, now);
        newlyUnlocked.push(key);
      }
    }

    const achievements = achievementDefinitions.map((def) => buildUserAchievement(def, uid));
    return {achievements, newlyUnlocked};
  }

  function buildProfile(userId) {
    const user = ensureUser(userId) || baseUser;
    const stats = getUserReadingStats(userId);
    return {
      ...user,
      name: `${pickString(user.firstname, 'Mock')} ${pickString(user.lastname, 'User')}`.trim(),
      photo: svgAvatarDataUrl(`${pickString(user.firstname, 'Mock')} ${pickString(user.lastname, 'User')}`, '#22c55e'),
    bio: 'This is a local mock profile (no real backend connected).',
    facebookUrl: '',
    memberSince: '2026-01-01',
    membership: 'Free',
    stats: {
      favoritesCount: 0,
      downloadsCount: 0,
      booksReadCount: stats.uniqueBooks,
      readingDaysCount: stats.readingDays,
      totalReadingSeconds: stats.totalSeconds,
      totalReadingMinutes: stats.totalMinutes,
    },
  };
  }

  const server = http.createServer(async (req, res) => {
    const method = pickString(req.method, 'GET').toUpperCase();
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (logger?.info) logger.info(`[mock-backend] ${method} ${pathname}${url.search || ''}`);

    if (method === 'OPTIONS') {
      setCorsHeaders(res);
      res.statusCode = 204;
      res.end();
      return;
    }

    if (method === 'GET' && pathname === '/health') {
      sendText(res, 200, 'ok');
      return;
    }

    // Basic /storage passthrough (useful when UI tries to fetch avatar paths from a real backend).
    if (method === 'GET' && pathname.startsWith('/storage')) {
      // Always return a simple SVG so the UI doesn't 404 during local dev.
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="640" viewBox="0 0 420 640">
  <rect width="420" height="640" fill="#111827"/>
  <text x="50%" y="50%" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="28" font-weight="700" fill="rgba(255,255,255,0.85)" text-anchor="middle" dominant-baseline="middle">Mock storage</text>
</svg>`;
      const body = Buffer.from(svg, 'utf8');
      setCorsHeaders(res);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Content-Length', body.length);
      res.end(body);
      return;
    }

    // Books
    if (method === 'GET' && pathname === '/api/books') {
      const page = toPositiveInt(url.searchParams.get('page'), 1);
      const perPage = toPositiveInt(url.searchParams.get('per_page'), 15);
      const q = url.searchParams.get('q') || '';
      const category = url.searchParams.get('category') || '';
      const sort = url.searchParams.get('sort') || '';

      const filtered = filterBooks(books, {q, category, sort});
      const total = filtered.length;
      const lastPage = Math.max(1, Math.ceil(total / perPage));
      const currentPage = Math.min(Math.max(1, page), lastPage);
      const start = (currentPage - 1) * perPage;
      const data = filtered.slice(start, start + perPage);

      sendJson(res, 200, {
        success: true,
        message: 'Approved books retrieved successfully.',
        data,
        meta: {current_page: currentPage, last_page: lastPage, per_page: perPage, total},
      });
      return;
    }

    const bookIdMatch = pathname.match(/^\/api\/books\/([^/]+)$/);
    if (method === 'GET' && bookIdMatch) {
      const id = decodeURIComponent(bookIdMatch[1]);
      const book = books.find((b) => String(b.id) === String(id));
      if (!book) {
        sendJson(res, 404, {message: 'Book not found'});
        return;
      }
      sendJson(res, 200, {success: true, data: book});
      return;
    }

    // Categories
    if (method === 'GET' && pathname === '/api/categories') {
      sendJson(res, 200, {success: true, data: categories});
      return;
    }

    const categoryIdMatch = pathname.match(/^\/api\/categories\/([^/]+)$/);
    if (method === 'GET' && categoryIdMatch) {
      const id = decodeURIComponent(categoryIdMatch[1]);
      const cat = categories.find((c) => String(c.id) === String(id)) || categories.find((c) => c.name.toLowerCase() === id.toLowerCase());
      if (!cat) {
        sendJson(res, 404, {message: 'Category not found'});
        return;
      }
      sendJson(res, 200, {success: true, data: cat});
      return;
    }

    const categoryBooksMatch = pathname.match(/^\/api\/categories\/([^/]+)\/books$/);
    if (method === 'GET' && categoryBooksMatch) {
      const categoryId = decodeURIComponent(categoryBooksMatch[1]);
      const cat =
        categories.find((c) => String(c.id) === String(categoryId)) ||
        categories.find((c) => c.name.toLowerCase() === categoryId.toLowerCase());
      if (!cat) {
        sendJson(res, 404, {message: 'Category not found'});
        return;
      }

      const page = toPositiveInt(url.searchParams.get('page'), 1);
      const perPage = toPositiveInt(url.searchParams.get('per_page'), 15);
      const q = url.searchParams.get('q') || '';

      const filtered = filterBooks(books, {q, category: cat.name});
      const total = filtered.length;
      const lastPage = Math.max(1, Math.ceil(total / perPage));
      const currentPage = Math.min(Math.max(1, page), lastPage);
      const start = (currentPage - 1) * perPage;
      const data = filtered.slice(start, start + perPage);

      sendJson(res, 200, {
        success: true,
        data,
        meta: {current_page: currentPage, last_page: lastPage, per_page: perPage, total},
      });
      return;
    }

    // Authors
    if (method === 'GET' && pathname === '/api/authors') {
      const page = toPositiveInt(url.searchParams.get('page'), 1);
      const perPage = toPositiveInt(url.searchParams.get('per_page'), 15);
      const q = pickString(url.searchParams.get('q')).toLowerCase();

      const filtered = q
        ? authors.filter((author) => `${pickString(author.name)} ${pickString(author.bio)}`.toLowerCase().includes(q))
        : authors.slice();

      const total = filtered.length;
      const lastPage = Math.max(1, Math.ceil(total / perPage));
      const currentPage = Math.min(Math.max(1, page), lastPage);
      const start = (currentPage - 1) * perPage;
      const data = filtered.slice(start, start + perPage);

      sendJson(res, 200, {
        success: true,
        data,
        meta: {current_page: currentPage, last_page: lastPage, per_page: perPage, total},
      });
      return;
    }

    const authorByNameMatch = pathname.match(/^\/api\/authors\/by-name\/([^/]+)$/);
    if (method === 'GET' && authorByNameMatch) {
      const rawName = decodeURIComponent(authorByNameMatch[1]);
      const author = authors.find((item) => pickString(item.name).toLowerCase() === pickString(rawName).toLowerCase());
      if (!author) {
        sendJson(res, 404, {message: 'Author not found'});
        return;
      }
      sendJson(res, 200, {success: true, data: author});
      return;
    }

    const authorIdMatch = pathname.match(/^\/api\/authors\/([^/]+)$/);
    if (method === 'GET' && authorIdMatch) {
      const rawId = decodeURIComponent(authorIdMatch[1]);
      const normalized = pickString(rawId).toLowerCase();
      const author =
        authors.find((item) => String(item.id).toLowerCase() === normalized) ||
        authors.find((item) => pickString(item.name).toLowerCase() === normalized);
      if (!author) {
        sendJson(res, 404, {message: 'Author not found'});
        return;
      }
      const user = parseBearerToken(req) ? ensureUser(sessionUser.id) || sessionUser : null;
      const isFollowing = user ? isFollowingAuthorId(user.id, author.id) : false;
      sendJson(res, 200, {
        success: true,
        data: {
          ...author,
          followers_count: author.followers,
          is_following: isFollowing,
        },
      });
      return;
    }

    const authorFollowMatch = pathname.match(/^\/api\/authors\/([^/]+)\/follow$/);
    if (authorFollowMatch && (method === 'POST' || method === 'DELETE')) {
      const user = requireAuth(req, res);
      if (!user) return;
      const rawId = decodeURIComponent(authorFollowMatch[1]);
      const author =
        authors.find((item) => String(item.id) === pickString(rawId)) ||
        authors.find((item) => String(item.id).toLowerCase() === pickString(rawId).toLowerCase());
      if (!author) {
        sendJson(res, 404, {message: 'Author not found'});
        return;
      }
      const set = ensureAuthorFollowSet(user.id);
      const wasFollowing = set.has(author.id);
      if (method === 'POST') set.add(author.id);
      else set.delete(author.id);
      const isFollowing = set.has(author.id);
      const delta = isFollowing === wasFollowing ? 0 : isFollowing ? 1 : -1;
      author.followers = Math.max(0, Math.round(Number(author.followers || 0)) + delta);
      sendJson(res, 200, {
        success: true,
        data: {
          author_id: author.id,
          is_following: isFollowing,
          followers_count: author.followers,
        },
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/me/following/authors') {
      const user = requireAuth(req, res);
      if (!user) return;
      const set = ensureAuthorFollowSet(user.id);
      const followed = authors
        .filter((a) => set.has(a.id))
        .map((a) => ({
          ...a,
          followers_count: a.followers,
          is_following: true,
        }));
      sendJson(res, 200, {
        success: true,
        data: followed,
        meta: {current_page: 1, last_page: 1, per_page: followed.length, total: followed.length},
      });
      return;
    }

    // Auth (minimal)
    if (method === 'POST' && (pathname === '/api/auth/login' || pathname === '/api/auth/register')) {
      const body = (await readJsonBody(req)) || {};
      const email = pickString(body.email, 'user@example.com');
      const firstname = pickString(body.firstname, 'Mock');
      const lastname = pickString(body.lastname, 'User');
      const role = pickString(body.role, 'user');

      sessionUser = {
        ...sessionUser,
        id: sessionUser.id || 1,
        firstname,
        lastname,
        email,
        role,
      };
      users.set(String(sessionUser.id), {...(users.get(String(sessionUser.id)) || {}), ...sessionUser});

      sendJson(res, 200, {
        token: 'mock-token',
        user: {
          id: 1,
          firstname,
          lastname,
          email,
          role,
        },
      });
      return;
    }

    if (method === 'POST' && (pathname === '/api/logout' || pathname === '/logout')) {
      sendJson(res, 200, {success: true, message: 'Logged out'});
      return;
    }

    if (method === 'GET' && (pathname === '/api/me' || pathname === '/me')) {
      const user = requireAuth(req, res);
      if (!user) return;
      sendJson(res, 200, user);
      return;
    }

    if (method === 'GET' && pathname === '/api/me/profile') {
      // The UI calls this before/without login in some flows; return a profile object regardless.
      sendJson(res, 200, buildProfile(sessionUser.id));
      return;
    }

    if (method === 'PATCH' && pathname === '/api/me/settings') {
      const body = (await readJsonBody(req)) || {};
      sendJson(res, 200, {success: true, data: {settings: body}});
      return;
    }

    if (method === 'GET' && pathname === '/api/me/reading-activity') {
      const user = parseBearerToken(req) ? requireAuth(req, res) : ensureUser(sessionUser.id) || sessionUser;
      if (!user) return;
      const range = pickString(url.searchParams.get('range'), '7d');
      const now = new Date();
      const data = [];

      const uid = String(user.id);
      const logs = readingLogs.filter((l) => String(l.user_id) === uid);
      const minutesByDay = new Map();
      for (const log of logs) {
        const key = dateKeyUtc(log.logged_at);
        if (!key) continue;
        const minutes = Math.floor(toNonNegativeNumber(log.total_seconds, 0) / 60);
        minutesByDay.set(key, (minutesByDay.get(key) || 0) + minutes);
      }

      if (range === '30d') {
        for (let i = 29; i >= 0; i -= 1) {
          const day = addDaysUtc(now, -i);
          const key = dateKeyUtc(day);
          data.push({key, label: key.slice(5), minutes: minutesByDay.get(key) || 0});
        }
      } else if (range === '1y') {
        const minutesByMonth = new Map();
        for (const [key, minutes] of minutesByDay.entries()) {
          const month = key.slice(0, 7);
          minutesByMonth.set(month, (minutesByMonth.get(month) || 0) + minutes);
        }
        for (let i = 11; i >= 0; i -= 1) {
          const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
          const key = monthKeyUtc(d);
          const monthLabel = d.toLocaleString('en-US', {month: 'short', timeZone: 'UTC'});
          data.push({key, label: monthLabel, minutes: minutesByMonth.get(key) || 0});
        }
      } else {
        for (let i = 6; i >= 0; i -= 1) {
          const day = addDaysUtc(now, -i);
          const key = dateKeyUtc(day);
          const label = day.toLocaleString('en-US', {weekday: 'short', timeZone: 'UTC'});
          data.push({key, label, minutes: minutesByDay.get(key) || 0});
        }
      }

      const totalMinutes = data.reduce((sum, bucket) => sum + toNonNegativeNumber(bucket.minutes, 0), 0);
      sendJson(res, 200, {data, meta: {range, unit: 'minutes', total_minutes: totalMinutes}});
      return;
    }

    if (method === 'GET' && pathname === '/api/me/currently-reading') {
      sendJson(res, 200, {data: []});
      return;
    }

    // Reading sessions (simple)
    if (method === 'POST' && pathname === '/api/reading/start') {
      const authUser = requireAuth(req, res);
      if (!authUser) return;
      const body = (await readJsonBody(req)) || {};
      const startedAt = new Date().toISOString();
      readingSessions.set(String(authUser.id), {
        started_at: startedAt,
        book_id: pickString(body.book_id, body.bookId, body.id),
      });
      sendJson(res, 200, {success: true, data: {started_at: startedAt}});
      return;
    }

    if (method === 'POST' && pathname === '/api/reading/finish') {
      const authUser = requireAuth(req, res);
      if (!authUser) return;
      const body = (await readJsonBody(req)) || {};
      const uid = String(authUser.id);
      const session = readingSessions.get(uid) || null;

      const sessionSeconds = session?.started_at
        ? Math.max(0, Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000))
        : 0;
      const requestedSeconds =
        body.total_seconds !== undefined
          ? Math.floor(toNonNegativeNumber(body.total_seconds, 0))
          : body.minutes !== undefined
            ? Math.floor(toNonNegativeNumber(body.minutes, 0) * 60)
            : 0;
      const totalSeconds = requestedSeconds > 0 ? requestedSeconds : sessionSeconds;

      const entry = {
        id: nextReadingLogId++,
        user_id: uid,
        book_id: pickString(body.book_id, body.bookId, session?.book_id),
        total_seconds: totalSeconds,
        logged_at: toIsoString(body.logged_at),
      };
      readingLogs.push(entry);
      readingSessions.delete(uid);

      const result = checkAndUnlockAchievements(uid);
      const created = createAchievementUnlockNotifications(uid, result.newlyUnlocked);

      // Create a user-facing notification for reading finish event.
      const finishNotification = createNotification(uid, {
        type: 'system',
        title: 'Reading Finished',
        message: `You finished reading book ${entry.book_id || 'unknown'}.`,
        audience: 'user',
        payload: {book_id: entry.book_id, reading_log_id: entry.id},
      });

      sendJson(res, 201, {
        success: true,
        data: {
          reading_log: entry,
          newly_unlocked: result.newlyUnlocked,
          notifications: [finishNotification, ...created],
        },
      });
      return;
    }

    // Notifications (preferred routes)
    if (method === 'GET' && pathname === '/api/user/notifications') {
      const authUser = requireAuth(req, res);
      if (!authUser) return;
      const unreadOnly = ['1', 'true', 'yes'].includes(pickString(url.searchParams.get('unread')).toLowerCase());
      const page = toPositiveInt(url.searchParams.get('page'), 1);
      const perPage = toPositiveInt(url.searchParams.get('per_page'), 20);
      const result = listUserNotifications(authUser.id, {unreadOnly, page, perPage});
      sendJson(res, 200, {success: true, ...result});
      return;
    }

    if (method === 'POST' && pathname === '/api/user/notifications') {
      const authUser = requireAuth(req, res);
      if (!authUser) return;
      const body = (await readJsonBody(req)) || {};
      const notification = createNotification(authUser.id, body);
      sendJson(res, 201, {success: true, data: notification});
      return;
    }

    const userNotificationReadMatch = pathname.match(/^\/api\/user\/notifications\/([^/]+)\/read$/);
    if (method === 'POST' && userNotificationReadMatch) {
      const authUser = requireAuth(req, res);
      if (!authUser) return;
      const id = decodeURIComponent(userNotificationReadMatch[1]);
      const item = notifications.find((n) => String(n.id) === String(id) && String(n.user_id) === String(authUser.id));
      if (!item) {
        sendJson(res, 404, {message: 'Notification not found'});
        return;
      }
      item.read_at = item.read_at || new Date().toISOString();
      sendJson(res, 200, {success: true, data: item});
      return;
    }

    // Author notifications (same underlying data, role-gated)
    if (method === 'GET' && pathname === '/api/author/notifications') {
      const authUser = requireAuth(req, res);
      if (!authUser) return;
      if (!isAuthor(authUser) && !isAdmin(authUser)) {
        sendJson(res, 403, {message: 'Forbidden'});
        return;
      }
      const unreadOnly = ['1', 'true', 'yes'].includes(pickString(url.searchParams.get('unread')).toLowerCase());
      const page = toPositiveInt(url.searchParams.get('page'), 1);
      const perPage = toPositiveInt(url.searchParams.get('per_page'), 20);
      const result = listUserNotifications(authUser.id, {unreadOnly, page, perPage});
      const filtered = result.data.filter((n) => !n.audience || n.audience === 'author' || n.audience === 'all');
      sendJson(res, 200, {success: true, data: filtered, meta: {...result.meta, total: filtered.length}});
      return;
    }

    // Admin notifications (global view + sender)
    if (method === 'GET' && pathname === '/api/admin/notifications') {
      const authUser = requireAuth(req, res);
      if (!authUser) return;
      if (!isAdmin(authUser)) {
        sendJson(res, 403, {message: 'Forbidden'});
        return;
      }
      const unreadOnly = ['1', 'true', 'yes'].includes(pickString(url.searchParams.get('unread')).toLowerCase());
      const targetUserId = pickString(url.searchParams.get('user_id'));
      const page = toPositiveInt(url.searchParams.get('page'), 1);
      const perPage = toPositiveInt(url.searchParams.get('per_page'), 20);

      const baseList = notifications
        .filter((n) => (targetUserId ? String(n.user_id) === String(targetUserId) : true))
        .filter((n) => (unreadOnly ? !n.read_at : true))
        .slice()
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

      const total = baseList.length;
      const safePerPage = Math.max(1, Math.min(100, toPositiveInt(perPage, 20)));
      const lastPage = Math.max(1, Math.ceil(total / safePerPage));
      const safePage = Math.min(Math.max(1, toPositiveInt(page, 1)), lastPage);
      const start = (safePage - 1) * safePerPage;
      const data = baseList.slice(start, start + safePerPage);

      sendJson(res, 200, {
        success: true,
        data,
        meta: {current_page: safePage, last_page: lastPage, per_page: safePerPage, total},
      });
      return;
    }

    if (method === 'POST' && pathname === '/api/admin/notifications/send') {
      const authUser = requireAuth(req, res);
      if (!authUser) return;
      if (!isAdmin(authUser)) {
        sendJson(res, 403, {message: 'Forbidden'});
        return;
      }
      const body = (await readJsonBody(req)) || {};
      const title = pickString(body.title, 'Notification');
      const message = pickString(body.message, body.body, '');
      const type = pickString(body.type, 'system');
      const actionUrl = pickString(body.action_url, body.url) || undefined;
      const audienceRaw = pickString(body.audience, body.role, 'all').toLowerCase();
      const requestedUserId = pickString(body.user_id, body.userId);

      let targets = [];
      if (requestedUserId) {
        const u = ensureUser(requestedUserId);
        if (u) targets = [String(u.id)];
      } else if (audienceRaw === 'author' || audienceRaw === 'authors') {
        targets = Array.from(users.values())
          .filter((u) => pickString(u?.role).toLowerCase() === 'author')
          .map((u) => String(u.id));
      } else if (audienceRaw === 'admin' || audienceRaw === 'admins') {
        targets = Array.from(users.values())
          .filter((u) => pickString(u?.role).toLowerCase() === 'admin')
          .map((u) => String(u.id));
      } else {
        targets = Array.from(users.values()).map((u) => String(u.id));
      }

      if (!targets.length) targets = [String(authUser.id)];

      const created = targets.map((id) =>
        createNotification(id, {
          type,
          title,
          message,
          action_url: actionUrl,
          payload: body.payload,
          audience: audienceRaw || 'all',
        }),
      );
      sendJson(res, 201, {success: true, data: {created: created.length, notifications: created}});
      return;
    }

    // Notification aliases (backward-compatible with existing frontend service)
    if (method === 'GET' && pathname === '/api/notifications') {
      const authUser = requireAuth(req, res);
      if (!authUser) return;
      const unreadOnly = ['1', 'true', 'yes'].includes(pickString(url.searchParams.get('unread')).toLowerCase());
      const page = toPositiveInt(url.searchParams.get('page'), 1);
      const perPage = toPositiveInt(url.searchParams.get('per_page'), 20);
      const result = listUserNotifications(authUser.id, {unreadOnly, page, perPage});
      sendJson(res, 200, {success: true, ...result});
      return;
    }

    if (method === 'POST' && pathname === '/api/notifications') {
      const authUser = requireAuth(req, res);
      if (!authUser) return;
      const body = (await readJsonBody(req)) || {};
      const notification = createNotification(authUser.id, body);
      sendJson(res, 201, {success: true, data: notification});
      return;
    }

    if (method === 'POST' && (pathname === '/api/notifications/read-all' || pathname === '/api/user/notifications/read-all')) {
      const authUser = requireAuth(req, res);
      if (!authUser) return;
      const uid = String(authUser.id);
      let updated = 0;
      for (const item of notifications) {
        if (String(item.user_id) !== uid) continue;
        if (!item.read_at) {
          item.read_at = new Date().toISOString();
          updated += 1;
        }
      }
      sendJson(res, 200, {success: true, data: {updated}});
      return;
    }

    const notificationReadMatch = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
    if ((method === 'PATCH' || method === 'POST') && notificationReadMatch) {
      const authUser = requireAuth(req, res);
      if (!authUser) return;
      const id = decodeURIComponent(notificationReadMatch[1]);
      const item = notifications.find((n) => String(n.id) === String(id) && String(n.user_id) === String(authUser.id));
      if (!item) {
        sendJson(res, 404, {message: 'Notification not found'});
        return;
      }
      item.read_at = item.read_at || new Date().toISOString();
      sendJson(res, 200, {success: true, data: item});
      return;
    }

    const notificationDeleteMatch = pathname.match(/^\/api\/notifications\/([^/]+)$/);
    const userNotificationDeleteMatch = pathname.match(/^\/api\/user\/notifications\/([^/]+)$/);
    if (method === 'DELETE' && (notificationDeleteMatch || userNotificationDeleteMatch)) {
      const authUser = requireAuth(req, res);
      if (!authUser) return;
      const id = decodeURIComponent((notificationDeleteMatch || userNotificationDeleteMatch)[1]);
      const idx = notifications.findIndex((n) => String(n.id) === String(id) && String(n.user_id) === String(authUser.id));
      if (idx === -1) {
        sendJson(res, 404, {message: 'Notification not found'});
        return;
      }
      notifications.splice(idx, 1);
      sendJson(res, 200, {success: true});
      return;
    }

    // Achievements
    if (method === 'GET' && pathname === '/api/achievements') {
      sendJson(res, 200, {success: true, data: achievementDefinitions});
      return;
    }

    const userAchievementsMatch = pathname.match(/^\/api\/users\/([^/]+)\/achievements$/);
    if (method === 'GET' && userAchievementsMatch) {
      const authUser = requireAuth(req, res);
      if (!authUser) return;
      const rawUserId = decodeURIComponent(userAchievementsMatch[1]);
      const targetId = rawUserId.toLowerCase() === 'me' ? String(authUser.id) : rawUserId;
      ensureUser(targetId);
      const achievements = achievementDefinitions.map((def) => buildUserAchievement(def, targetId));
      sendJson(res, 200, {success: true, data: achievements});
      return;
    }

    const checkAchievementsMatch = pathname.match(/^\/api\/users\/([^/]+)\/check-achievements$/);
    if (method === 'POST' && checkAchievementsMatch) {
      const authUser = requireAuth(req, res);
      if (!authUser) return;
      const rawUserId = decodeURIComponent(checkAchievementsMatch[1]);
      const targetId = rawUserId.toLowerCase() === 'me' ? String(authUser.id) : rawUserId;
      if (String(targetId) !== String(authUser.id) && !isAdmin(authUser)) {
        sendJson(res, 403, {message: 'Forbidden'});
        return;
      }
      const result = checkAndUnlockAchievements(targetId);
      const created = createAchievementUnlockNotifications(targetId, result.newlyUnlocked);
      sendJson(res, 200, {
        success: true,
        data: {newly_unlocked: result.newlyUnlocked, achievements: result.achievements, notifications: created},
      });
      return;
    }

    // Reading logs (minimal)
    if (method === 'POST' && pathname === '/api/reading-logs') {
      const authUser = requireAuth(req, res);
      if (!authUser) return;
      const body = (await readJsonBody(req)) || {};

      const requestedUserId = pickString(body.user_id, body.userId, body.user);
      const targetUserId = requestedUserId ? requestedUserId : String(authUser.id);
      if (requestedUserId && String(requestedUserId) !== String(authUser.id) && !isAdmin(authUser)) {
        sendJson(res, 403, {message: 'Only admins can create reading logs for another user.'});
        return;
      }

      const totalSeconds =
        body.total_seconds !== undefined
          ? Math.floor(toNonNegativeNumber(body.total_seconds, 0))
          : body.minutes !== undefined
            ? Math.floor(toNonNegativeNumber(body.minutes, 0) * 60)
            : 0;

      const entry = {
        id: nextReadingLogId++,
        user_id: targetUserId,
        book_id: pickString(body.book_id),
        total_seconds: totalSeconds,
        logged_at: toIsoString(body.logged_at),
      };
      readingLogs.push(entry);

      const result = checkAndUnlockAchievements(targetUserId);
      const created = createAchievementUnlockNotifications(targetUserId, result.newlyUnlocked);
      sendJson(res, 201, {
        success: true,
        data: {reading_log: entry, newly_unlocked: result.newlyUnlocked, notifications: created},
      });
      return;
    }

    // Minimal reviews storage so "Critic" can be unlocked during local dev.
    const bookReviewsMatch = pathname.match(/^\/api\/books\/([^/]+)\/reviews$/);
    if (method === 'GET' && bookReviewsMatch) {
      const bookId = decodeURIComponent(bookReviewsMatch[1]);
      const items = reviews.filter((r) => String(r.book_id) === String(bookId));
      sendJson(res, 200, {success: true, data: items});
      return;
    }

    if (method === 'POST' && bookReviewsMatch) {
      const authUser = requireAuth(req, res);
      if (!authUser) return;
      const bookId = decodeURIComponent(bookReviewsMatch[1]);
      const body = (await readJsonBody(req)) || {};
      const text = pickString(body.text, body.content);
      const rating = toPositiveInt(body.rating ?? body.stars, 0) || 0;
      const review = {
        id: `r_${nextReviewId++}`,
        book_id: String(bookId),
        user_id: String(authUser.id),
        text,
        rating,
        created_at: new Date().toISOString(),
      };
      reviews.push(review);
      const result = checkAndUnlockAchievements(authUser.id);
      const created = createAchievementUnlockNotifications(authUser.id, result.newlyUnlocked);
      sendJson(res, 201, {success: true, data: review, newly_unlocked: result.newlyUnlocked, notifications: created});
      return;
    }

    // Favorites (minimal)
    if (method === 'GET' && pathname === '/api/favorites') {
      const items = books.filter((b) => favorites.has(String(b.id)));
      sendJson(res, 200, {success: true, data: items});
      return;
    }

    if (method === 'POST' && pathname === '/api/favorites') {
      const body = (await readJsonBody(req)) || {};
      const id = pickString(body.book_id, body.bookId, body.id);
      if (id) favorites.add(String(id));
      sendJson(res, 200, {success: true});
      return;
    }

    const favoriteIdMatch = pathname.match(/^\/api\/favorites\/([^/]+)$/);
    if (method === 'DELETE' && favoriteIdMatch) {
      const id = decodeURIComponent(favoriteIdMatch[1]);
      favorites.delete(String(id));
      sendJson(res, 200, {success: true});
      return;
    }

    sendJson(res, 404, {message: 'Not found'});
  });

  return {server};
}

async function runSelfTest() {
  const {server} = createMockBackendServer({logger: null});
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : null;
  if (!port) throw new Error('Unable to start server');

  const authHeaders = {Accept: 'application/json', Authorization: 'Bearer mock-token'};

  const res = await fetch(`http://127.0.0.1:${port}/api/books?per_page=5`, {
    headers: {Accept: 'application/json'},
  });
  const data = await res.json();

  if (!res.ok) throw new Error(`Self-test failed: HTTP ${res.status}`);
  if (!data || !Array.isArray(data.data)) throw new Error('Self-test failed: missing data array');
  if (data.data.length === 0) throw new Error('Self-test failed: expected books');

  const authorsRes = await fetch(`http://127.0.0.1:${port}/api/authors?per_page=5`, {
    headers: {Accept: 'application/json'},
  });
  const authorsPayload = await authorsRes.json();
  if (!authorsRes.ok) throw new Error(`Self-test failed (/api/authors): HTTP ${authorsRes.status}`);
  if (!authorsPayload || !Array.isArray(authorsPayload.data)) throw new Error('Self-test failed: authors should be an array');
  if (authorsPayload.data.length === 0) throw new Error('Self-test failed: expected authors');

  const profileRes = await fetch(`http://127.0.0.1:${port}/api/me/profile`, {
    headers: {Accept: 'application/json'},
  });
  const profile = await profileRes.json();
  if (!profileRes.ok) throw new Error(`Self-test failed (/api/me/profile): HTTP ${profileRes.status}`);
  if (!profile || typeof profile !== 'object') throw new Error('Self-test failed: missing profile payload');

  const favRes = await fetch(`http://127.0.0.1:${port}/api/favorites`, {
    headers: {Accept: 'application/json'},
  });
  const fav = await favRes.json();
  if (!favRes.ok) throw new Error(`Self-test failed (/api/favorites): HTTP ${favRes.status}`);
  if (!fav || !Array.isArray(fav.data)) throw new Error('Self-test failed: favorites should be an array');

  const defsRes = await fetch(`http://127.0.0.1:${port}/api/achievements`, {headers: {Accept: 'application/json'}});
  const defs = await defsRes.json();
  if (!defsRes.ok) throw new Error(`Self-test failed (/api/achievements): HTTP ${defsRes.status}`);
  if (!defs || !Array.isArray(defs.data)) throw new Error('Self-test failed: achievements definitions should be an array');

  const logsRes = await fetch(`http://127.0.0.1:${port}/api/reading-logs`, {
    method: 'POST',
    headers: {...authHeaders, 'Content-Type': 'application/json'},
    body: JSON.stringify({book_id: 1, minutes: 5}),
  });
  const logsPayload = await logsRes.json();
  if (!logsRes.ok) throw new Error(`Self-test failed (/api/reading-logs): HTTP ${logsRes.status}`);
  if (!logsPayload?.data?.reading_log) throw new Error('Self-test failed: reading log missing');

  const fastRes = await fetch(`http://127.0.0.1:${port}/api/reading-logs`, {
    method: 'POST',
    headers: {...authHeaders, 'Content-Type': 'application/json'},
    body: JSON.stringify({book_id: 1, minutes: 70}),
  });
  const fastPayload = await fastRes.json();
  if (!fastRes.ok) throw new Error(`Self-test failed (/api/reading-logs fast): HTTP ${fastRes.status}`);
  if (!Array.isArray(fastPayload?.data?.newly_unlocked)) throw new Error('Self-test failed: missing newly_unlocked array');

  const notifRes = await fetch(`http://127.0.0.1:${port}/api/user/notifications`, {headers: authHeaders});
  const notifPayload = await notifRes.json();
  if (!notifRes.ok) throw new Error(`Self-test failed (/api/user/notifications): HTTP ${notifRes.status}`);
  if (!Array.isArray(notifPayload?.data)) throw new Error('Self-test failed: notifications data should be an array');

  const firstNotifId = notifPayload?.data?.[0]?.id;
  if (firstNotifId) {
    const markRes = await fetch(`http://127.0.0.1:${port}/api/user/notifications/${encodeURIComponent(firstNotifId)}/read`, {
      method: 'POST',
      headers: authHeaders,
    });
    const markPayload = await markRes.json();
    if (!markRes.ok) throw new Error(`Self-test failed (mark read): HTTP ${markRes.status}`);
    if (!markPayload?.data?.read_at) throw new Error('Self-test failed: expected read_at after mark read');
  }

  const startRes = await fetch(`http://127.0.0.1:${port}/api/reading/start`, {
    method: 'POST',
    headers: {...authHeaders, 'Content-Type': 'application/json'},
    body: JSON.stringify({book_id: 1}),
  });
  const startPayload = await startRes.json();
  if (!startRes.ok) throw new Error(`Self-test failed (/api/reading/start): HTTP ${startRes.status}`);
  if (!startPayload?.data?.started_at) throw new Error('Self-test failed: missing started_at');

  const finishRes = await fetch(`http://127.0.0.1:${port}/api/reading/finish`, {
    method: 'POST',
    headers: {...authHeaders, 'Content-Type': 'application/json'},
    body: JSON.stringify({minutes: 1, book_id: 1}),
  });
  const finishPayload = await finishRes.json();
  if (!finishRes.ok) throw new Error(`Self-test failed (/api/reading/finish): HTTP ${finishRes.status}`);
  if (!finishPayload?.data?.reading_log) throw new Error('Self-test failed: missing reading_log for finish');

  // Admin notifications sender
  const loginRes = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
    body: JSON.stringify({email: 'admin@example.com', firstname: 'Admin', lastname: 'User', role: 'admin'}),
  });
  if (!loginRes.ok) throw new Error(`Self-test failed (/api/auth/login admin): HTTP ${loginRes.status}`);

  const adminSendRes = await fetch(`http://127.0.0.1:${port}/api/admin/notifications/send`, {
    method: 'POST',
    headers: {...authHeaders, 'Content-Type': 'application/json'},
    body: JSON.stringify({title: 'Test', message: 'Hello', type: 'system', audience: 'all'}),
  });
  const adminSendPayload = await adminSendRes.json();
  if (!adminSendRes.ok) throw new Error(`Self-test failed (/api/admin/notifications/send): HTTP ${adminSendRes.status}`);
  if (!adminSendPayload?.data?.created) throw new Error('Self-test failed: expected created count');

  const adminListRes = await fetch(`http://127.0.0.1:${port}/api/admin/notifications`, {headers: authHeaders});
  const adminListPayload = await adminListRes.json();
  if (!adminListRes.ok) throw new Error(`Self-test failed (/api/admin/notifications): HTTP ${adminListRes.status}`);
  if (!Array.isArray(adminListPayload?.data)) throw new Error('Self-test failed: admin notifications data should be an array');

  server.close();
  process.stdout.write('mock-backend self-test: ok\n');
}

if (process.argv.includes('--self-test')) {
  runSelfTest().catch((err) => {
    process.stderr.write(`${err?.stack || err}\n`);
    process.exitCode = 1;
  });
} else if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = toPositiveInt(process.env.PORT, DEFAULT_PORT);
  const host = pickString(process.env.HOST, '127.0.0.1');
  const {server} = createMockBackendServer();
  server.listen(port, host, () => {
    process.stdout.write(`[mock-backend] listening on http://${host}:${port}\n`);
    process.stdout.write(`[mock-backend] try: http://${host}:${port}/api/books\n`);
  });
}
