import { 
  Book, 
  Heart, 
  Download, 
  Settings, 
  User, 
  Home, 
  Search, 
  Bell, 
  MoreVertical, 
  Star, 
  Filter, 
  Plus, 
  ChevronRight, 
  ChevronLeft, 
  History, 
  TrendingUp, 
  Newspaper, 
  BookOpen, 
  Trash2, 
  PauseCircle, 
  XCircle, 
  LogOut, 
  Globe, 
  Mail, 
  Rss, 
  LayoutDashboard,
  Award,
  Flame,
  Rocket,
  Edit3,
  Share2,
  Eye,
  Bookmark,
  Send,
  MessageSquare,
  Sparkles,
  ArrowUpRight,
  Moon,
  Sun,
  Trophy,
  CheckCheck,
  BellOff,
  X
} from 'lucide-react';
import {API_BASE_URL} from './service/apiClient';

export const Icons = {
  Book,
  Heart,
  Download,
  Settings,
  User,
  Home,
  Search,
  Bell,
  MoreVertical,
  Star,
  Filter,
  Plus,
  ChevronRight,
  ChevronLeft,
  History,
  TrendingUp,
  Newspaper,
  BookOpen,
  Trash2,
  PauseCircle,
  XCircle,
  LogOut,
  Globe,
  Mail,
  Rss,
  LayoutDashboard,
  Award,
  Flame,
  Rocket,
  Edit3,
  Share2,
  Eye,
  Bookmark,
  Send,
  MessageSquare,
  Sparkles,
  ArrowUpRight,
  Moon,
  Sun,
  Trophy,
  CheckCheck,
  BellOff,
  X
};

export interface BookType {
  id: string;
  title: string;
  author: string;
  cover: string;
  category: string;
  rating: number;
  progress?: number;
  pages?: number;
  description?: string;
  status?: 'Want to Read' | 'Currently Reading' | 'Completed' | 'Downloading' | 'Paused';
  reviews?: number;
  timeLeft?: string;
  size?: string;
  downloadProgress?: number;
  speed?: string;
}

export const MOCK_BOOKS: BookType[] = [
  {
    id: '1',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCbZBgkIZNzQIjsDiER-2EO1kPBYz3IYaSUU3zvw3SKzWCrDIC9z0GezfOEb6Re2pm1aph0JQeL4U6PrWSckciJ3RFUqeSGkIGpXUhyJwxCa7O2ueAJYPeicMqoWu8g9vOSxziN_YEAnvW4ISTgMPVVBOAOCZ6QLg_M9WI8k8Fnk3G0YsCV__GhZrWdDaFfusGh6xDVpt8GAuDivtj1TmvOQFA7tz9u8enitF2UP1T3SKz4PiXIt4xcC0Vu13BxOMrN1-E6WoiWVRU',
    category: 'Classic',
    rating: 4.8,
    progress: 65,
    pages: 218,
    timeLeft: '2h read left',
    reviews: 12408,
    description: 'The Great Gatsby, third novel by F. Scott Fitzgerald, published in 1925 by Charles Scribner’s Sons. Set in Jazz Age New York, the novel tells the tragic story of Jay Gatsby, a self-made millionaire, and his pursuit of Daisy Buchanan, a wealthy young woman whom he loved in his youth.'
  },
  {
    id: '2',
    title: '1984',
    author: 'George Orwell',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCTm18AF6bYCmuGb_9Hg8Sj8gXiD36pTp14rx8nEHLM92rJTGwNovYTOvJT-I4dk1v-OYf0R023pivDibnYOURrkO4FbNPcE1jM7ITRPJ3FkSpFLv-MCQoFjey2vPIz7NCVuivLlj460dt6Li6aF09MnU2_CDYu-oU-sNnmJ17Sch92mia--9vYVN1XM3EKR2qlBDhskGljz4DPFLC5UuWeSs8Ca1PpVZNyBopzNHlYEgDdZzU_NvBPyfQ0Gm4YCDLnkwJ5xjYfLd8',
    category: 'Dystopian',
    rating: 4.9,
    progress: 22,
    timeLeft: 'New'
  },
  {
    id: '3',
    title: 'To Kill a Mockingbird',
    author: 'Harper Lee',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAPUq3AaNJ_PXV5kAzQrTwrIzxc8dEpNZFi2EYbTcABAktNKoVNcUMI5ehAVxfIJ-yjEFcfMHSbWygxF5WgzteovIWMMbt0GaC1DEDIAjtN41iVEpLDGQfdpHtEKxgPmyR4IGUhvQ-jG6oZBtL79uH9_Gp-4sW3bih9fxMgdkvTpLyjmLWuFdxPV7wcq6VC7mt5IGvDCTKj5EOCKHdYCS95uqIQFI6yL-_SMEUI4teOT_Z52kIBisbFMQiqGd4Eo1grZpP15_GjKQs',
    category: 'Classic',
    rating: 4.7,
    progress: 85
  },
  {
    id: '4',
    title: 'The Catcher in the Rye',
    author: 'J.D. Salinger',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCphdrloV9S6uJgj17ebyZ9M1GPhNiYMjfk30ceeaXK0JxIlV6gJ_DA60srg3YrcQL1f0rRWceVzC6cruf-jjkk34pvgS2aTYfJEPX82GNDaioKU3jA03RPsocGLma3zt8IaHw1sOzDLDHlSA_YpU-rLZQ6FyX8bJ86sH2fsOdd2nXIkEUAJNWoG0UX-LRQuhfYYLp4c6wsBH0lMnyqj9tfAbo7Xh_TSXhbMlBHReHJFQUugWHoN39sNm4jqiVU0aUrrSZSiQO9Y8Q',
    category: 'Fiction',
    rating: 4.5,
    status: 'Completed'
  },
  {
    id: '5',
    title: 'Atomic Habits',
    author: 'James Clear',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAVlZsmfyKzgmEYIhW_GNI-m-M42jAkO93oSttT-uH1d1lJslTDxolfnGw1fNZfspAD2FQNganeRBEAXwJLcyL5lHUfmiGlQG7-H5irwlcF7-UbtpTt-Z5oIWzLxDpyQ7pqy01RIg50JV_ebr_lEnpeWqwvVk_UKO6kAKvD_t-ME0goBt9dci3hS8p5wqUk6AgnnD64URKjOVb4KmnZZdK0WUsOcYOsVIfObEkqmOuoIR2RWir-esTlpyUMzwaIpGT0QK5GztXtj_Q',
    category: 'Self-Help',
    rating: 4.9,
    progress: 22
  },
  {
    id: '6',
    title: 'Project Hail Mary',
    author: 'Andy Weir',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA1wEw3qXJObgxFTl7Dsn4RFgZL4Mdx3Sr6PQCj3DEWBMVkVjoSboaLvFiUTB4miw9Ab6hSS2JMNta1uJiD_TM3QGWhr3WG4Tt9H_ByxoeRZB4X-VRSosU_pbzYopCowhBHHOTmAGr_pwkSOJ5Xa1gKBMWt4x9OxB1JVKPt3-QTskvzRPK5TSuka75ECOFAcVJJr0qslzRKFAwgWEqMSApKUZFzYan9BeNqfLOH3QljLYn45paokVbT7dP438dYcU5eEmOKHS9cYac',
    category: 'Sci-Fi',
    rating: 4.8,
    progress: 89
  },
  {
    id: '7',
    title: 'The Alchemist',
    author: 'Paulo Coelho',
    cover: 'https://picsum.photos/seed/alchemist/400/600',
    category: 'Novel',
    rating: 4.7
  },
  {
    id: '8',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    cover: 'https://picsum.photos/seed/cleancode/400/600',
    category: 'Technology',
    rating: 4.9
  },
  {
    id: '9',
    title: 'The Art of Learning',
    author: 'Josh Waitzkin',
    cover: 'https://picsum.photos/seed/learning/400/600',
    category: 'Education',
    rating: 4.8
  }
];

export const NEW_ARRIVALS: BookType[] = [
  {
    id: 'n1',
    title: 'Sea of Tranquility',
    author: 'Emily St. John Mandel',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB_c4rdzosFKSS7WPhXvOwkYapOxlZZUuqx5IVpJpiqOGl6Nc4zrgkoHrY89meDTitltpLMA4gCi2HTMJAi-ANKirs_2sNyuoRbPhLa4FP5r4fyDKkGaFYP_OZ7t0QvUOFw8TrYohXH5-9iLYUKA_qLhcErTwQZWYx3DjumBGPuAEWPEcua5-xvnZm0bnxu7OTHBBXqN8-5l2iEg06nxmhdXRAHi_7vLg99LPD3eM7S80BOs6NNWfIFN3iw_yAcAx3Z01zmZTfAPXQ',
    category: 'Sci-Fi',
    rating: 4.9
  },
  {
    id: 'n2',
    title: 'Tomorrow, and Tomorrow, and Tomorrow',
    author: 'Gabrielle Zevin',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAI7REEwdhhAzG2_Tp4wQV2ylyp_FcMju-CwF716m3MGUWZDCi8Loewm67yYQCM1gp8OkBZ9wdLcFc-66S_rwLs3ZnP6EugRiXN2hVcpHUoYlmdbV_EAuXM4lVzZHPZXAdIVzECApr_cn9vFrVAIfdf2y5oVtu9zqR3n7wTPGvODfzrr6Yh21yKdLcZ5pLA1MJC7bbImUZOHiYbiv7C_o6qysNLrp-nKuvN0WAZJdKd8OrCsHstnUmz4M9oGNTVXKoT2G4WT9tCm7w',
    category: 'Fiction',
    rating: 4.8
  },
  {
    id: 'n3',
    title: 'Fairy Tale',
    author: 'Stephen King',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAbEnnQRHc6TN97KV_0Giw3jGlLX6S0Fgc4JztKz1TmeLph2tDQn3PdO3hnl24RWtz-BRb3HkdNtmViwYSDY9KZCNJSE7sr2eJ4JF-Xl9aIhcU-WPhnv-mMyWqecgpBRXJi8OSWYPa5UYlPLd6r2HqzMEzt9g0NkLrMUSwfdkRUQD_nRPGK0-3QK3-Vb35ORXzn5brTERIecR6x6wcCRhZueyHpOo_wjFg1O1J27myqsJQotSbwBEqM8gvaa6pPWNn8ewhnBqqyIgY',
    category: 'Fantasy',
    rating: 4.7
  },
  {
    id: 'n4',
    title: 'Lessons in Chemistry',
    author: 'Bonnie Garmus',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCe9ttkpYoBWs6uIjOSFfrhdYZfem2bKOBg-X2eBU-vOMdHRpXkZJlxwM-KksXbGNHZe0shKgUq-MuliqrOTDrckFNJaYtdPPLxwv1x2VzdZfsHt-Yc7bcWO0RaARJcOurpA1kG_MFcb6d6KEFlxMF1atZjmN10zcyiIwm8vCnl21NzrN6RX-fIsSkHrninxDCMyv3gBbgTDV0WfLX08RQs4xbw3yif7RFot8UEaNqCPtPRpBRxLF0Hgj46J-7_kjk3tsghJe6niDQ',
    category: 'Fiction',
    rating: 4.8
  },
  {
    id: 'n5',
    title: 'Babel',
    author: 'R.F. Kuang',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBsGyrxSt_2ucByChAKSnJ5YTzZ7HPp_b9s9JXw8W4PGWfu8Eho6Th1ieKz7KQkl_HatuEq9iu2HDqicp_FOKwQ7rcUrzj2720CLQ-AJOBQ3iZJxiIsl2K_c5K8uxD0gpA5WMto6Q3nk3p9OJ5w7lGJVaL5SGSCgAhEKg6xhz6aa0V6DUJcvf7GtwMRwZ41FakjD3Hi2eqohvxr8M8Y5sB8vMTojA8Eow_OUEnnBl2Eevf0u8cNvLn7EmT6pjcfdDN8U7L0zmZ4IxY',
    category: 'Fantasy',
    rating: 4.9
  }
];
const STATIC_MOCK_BOOKS: BookType[] = [...MOCK_BOOKS];
const STATIC_NEW_ARRIVALS: BookType[] = [...NEW_ARRIVALS];

type ApiBookPayload = {
  id?: string | number;
  title?: string;
  author?: string;
  author_name?: string;
  category?: string;
  category_name?: string;
  cover?: string;
  cover_url?: string;
  cover_image_url?: string;
  coverImageUrl?: string;
  cover_image_path?: string;
  description?: string;
  average_rating?: number;
};

const resolveApiBaseUrl = (): string => {
  const envBase = ((import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined) || '';
  const trimmed = envBase.trim().replace(/\/$/, '');
  const fromClient = String(API_BASE_URL || '').trim().replace(/\/$/, '');
  return trimmed || fromClient || 'https://elibrary.pncproject.site';
};

const asAbsoluteUrl = (value: string | undefined | null): string => {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (/^(https?:|data:)/i.test(raw)) return raw;

  const base = resolveApiBaseUrl();
  const normalized = raw.replace(/^\/+/, '');
  if (raw.startsWith('/')) return `${base}/${normalized}`;
  if (normalized.startsWith('storage/')) return `${base}/${normalized}`;
  if (normalized.startsWith('uploads/') || normalized.startsWith('images/') || normalized.startsWith('assets/')) return `${base}/${normalized}`;
  return `${base}/storage/${normalized}`;
};

const normalizeApiBook = (book: ApiBookPayload, index: number): BookType | null => {
  const title = (book?.title || '').trim();
  if (!title) return null;

  const author = (book?.author_name || book?.author || 'Unknown Author').trim();
  const category = (book?.category_name || book?.category || 'General').trim();
  const cover =
    asAbsoluteUrl(book?.cover_image_url) ||
    asAbsoluteUrl(book?.coverImageUrl) ||
    asAbsoluteUrl(book?.cover_url) ||
    asAbsoluteUrl(book?.cover) ||
    asAbsoluteUrl(book?.cover_image_path) ||
    '';

  const idValue = book?.id ?? `book-${index + 1}`;

  return {
    id: String(idValue),
    title,
    author,
    cover,
    category,
    rating: Number(book?.average_rating) > 0 ? Number(book?.average_rating) : 4.5,
    description: book?.description || undefined,
  };
};

export async function hydrateBooksFromApi(): Promise<number> {
  const base = resolveApiBaseUrl();
  const endpoints = [`${base}/api/books`, `${base}/api/auth/books`];

  let payload: any = null;
  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index];
    try {
      const response = await fetch(endpoint, { method: 'GET' });
      if (!response.ok) {
        if (response.status === 404 && index === 0) continue;
        break;
      }
      payload = await response.json();
      if (payload) break;
    } catch {
      if (index > 0) break;
    }
  }

  const source: ApiBookPayload[] =
    (Array.isArray(payload?.data) && payload.data) ||
    (Array.isArray(payload?.books) && payload.books) ||
    (Array.isArray(payload?.results) && payload.results) ||
    [];

  if (!source.length) {
    return 0;
  }

  const remoteBooks = source
    .map((book, index) => normalizeApiBook(book, index))
    .filter((book): book is BookType => Boolean(book));

  if (!remoteBooks.length) {
    return 0;
  }

  const seen = new Set<string>();
  const merged: BookType[] = [];
  for (const book of [...remoteBooks, ...STATIC_MOCK_BOOKS]) {
    const key = `${book.title.toLowerCase()}::${book.author.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(book);
  }

  MOCK_BOOKS.splice(0, MOCK_BOOKS.length, ...merged);

  const arrivals: BookType[] = [
    ...remoteBooks.slice(0, 5),
    ...STATIC_NEW_ARRIVALS,
  ].filter((book, index, arr) => {
    const key = `${book.title.toLowerCase()}::${book.author.toLowerCase()}`;
    return arr.findIndex((item) => `${item.title.toLowerCase()}::${item.author.toLowerCase()}` === key) === index;
  }).slice(0, 8);

  NEW_ARRIVALS.splice(0, NEW_ARRIVALS.length, ...arrivals);

  return remoteBooks.length;
}
