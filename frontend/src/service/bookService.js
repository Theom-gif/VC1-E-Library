import apiClient from './apiClient';

const FALLBACK_COVER = 'https://picsum.photos/seed/book-cover/400/600';

const normalizeAssetUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('http://localhost')) {
    return url.replace('http://localhost', 'http://127.0.0.1:8000');
  }
  return url;
};

const normalizeBook = (raw, index) => {
  const id = String(raw?.id ?? raw?.book_id ?? `db-${index}`);
  const rating = Number(raw?.rating ?? raw?.average_rating ?? raw?.avg_rating ?? 4.5);
  const pages = Number(raw?.total_pages ?? raw?.pages ?? 0);

  return {
    id,
    title: raw?.title || raw?.name || `Untitled Book ${index + 1}`,
    author: raw?.author_name || raw?.author?.name || raw?.author || 'Unknown Author',
    uploaderName:
      raw?.uploaded_by_name ||
      raw?.uploader_name ||
      raw?.created_by_name ||
      raw?.user_name ||
      raw?.user?.name ||
      raw?.author_name ||
      'Unknown Uploader',
    cover: normalizeAssetUrl(
      raw?.cover_api_url ||
        raw?.cover_url ||
        raw?.cover_view_url ||
        raw?.cover_image_url ||
        raw?.cover ||
        FALLBACK_COVER,
    ),
    category: raw?.category_name || raw?.category || 'General',
    rating: Number.isFinite(rating) ? rating : 4.5,
    progress: Number(raw?.progress ?? 0),
    pages: Number.isFinite(pages) && pages > 0 ? pages : undefined,
    description: raw?.description || '',
    reviews: Number(raw?.reviews_count ?? raw?.reviews ?? 0) || undefined,
    status: raw?.status || undefined,
    timeLeft: raw?.time_left || 'New',
    readUrl: raw?.read_url || undefined,
    pdfUrl: raw?.pdf_url || undefined,
  };
};

const extractList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.books)) return data.books;
  if (Array.isArray(data?.data?.books)) return data.data.books;
  return [];
};

const fetchFirstAvailable = async (paths) => {
  let lastError;
  for (const path of paths) {
    try {
      return await apiClient.get(path);
    } catch (error) {
      if (error?.status !== 404) throw error;
      lastError = error;
    }
  }
  throw lastError || new Error('Books endpoint not found');
};

export const fetchPublishedBooks = async () => {
  const data = await fetchFirstAvailable([
    '/api/books?status=approved',
    '/api/books?status=published',
    '/api/books',
  ]);

  return extractList(data).map((book, index) => normalizeBook(book, index));
};

export default {
  fetchPublishedBooks,
};
