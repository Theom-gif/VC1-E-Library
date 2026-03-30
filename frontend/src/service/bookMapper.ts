import {API_BASE_URL} from './apiClient';
import type {BookType} from '../types';

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized) return normalized;
      continue;
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
      const normalized = String(value).trim();
      if (normalized) return normalized;
      continue;
    }
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

function asAbsoluteAssetUrl(value: string): string {
  const raw = String(value || '').trim().replace(/\\/g, '/');
  if (!raw) return '';
  if (/^(https?:|data:)/i.test(raw)) return raw;

  const base = String(API_BASE_URL || '').replace(/\/+$/, '');

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

function pickCoverValue(raw: any): string {
  const direct = pickString(
    raw?.cover_image_url,
    raw?.cover_url,
    raw?.cover,
    raw?.cover_image,
    raw?.cover_image_path,
    raw?.cover_path,
    raw?.coverImageUrl,
    raw?.coverImage,
    raw?.image_url,
    raw?.image,
    raw?.thumbnail_url,
    raw?.thumbnail,
    raw?.cover_image?.url,
    raw?.cover_image?.path,
    raw?.coverImage?.url,
    raw?.coverImage?.path,
  );

  return asAbsoluteAssetUrl(direct);
}

export function toBookType(raw: any): BookType {
  const normalized = raw?.book ?? raw?.data?.book ?? raw;

  const id = pickString(normalized?.id, normalized?.book_id, normalized?._id, normalized?.uuid);
  const title = pickString(normalized?.title, normalized?.name);
  const authorId = pickString(
    normalized?.author?.id,
    normalized?.author_id,
    normalized?.authorId,
    normalized?.author?.author_id,
    normalized?.author?.user_id,
    normalized?.author?.userId,
    normalized?.author_user_id,
    normalized?.created_by_id,
    normalized?.createdById,
    normalized?.created_by?.id,
  );
  const author = pickString(normalized?.author?.name, normalized?.author_name, normalized?.author);
  const category = pickString(normalized?.category?.name, normalized?.category_name, normalized?.category, 'Uncategorized');
  const cover = pickCoverValue(normalized);

  return {
    id: id || `book_${Date.now()}`,
    title: title || 'Untitled',
    author: author || 'Unknown',
    authorId: authorId || undefined,
    cover: cover || '',
    category,
    rating: pickNumber(
      normalized?.rating,
      normalized?.avg_rating,
      normalized?.average_rating,
      normalized?.avgRating,
      normalized?.averageRating,
      normalized?.rating_average,
      normalized?.ratingAvg,
      normalized?.rating_summary?.average,
      normalized?.rating_summary?.average_rating,
      normalized?.ratings?.average,
      normalized?.ratings?.average_rating,
    ),
    pages: normalized?.pages !== undefined ? pickNumber(normalized?.pages, normalized?.page_count) : undefined,
    description: pickString(normalized?.description, normalized?.summary, normalized?.about),
    reviews: normalized?.reviews !== undefined ? pickNumber(normalized?.reviews, normalized?.reviews_count) : undefined,
  };
}

export function isApprovedBook(raw: any): boolean {
  const normalized = raw?.book ?? raw?.data?.book ?? raw;

  const hasApprovalFlag =
    normalized?.is_approved !== undefined ||
    normalized?.approved !== undefined ||
    normalized?.approval_status !== undefined ||
    normalized?.status !== undefined ||
    normalized?.book_status !== undefined;

  if (!hasApprovalFlag) return true;

  const flag = normalized?.is_approved ?? normalized?.approved;
  if (typeof flag === 'boolean') return flag;
  if (typeof flag === 'number') return flag === 1;
  if (typeof flag === 'string') {
    const v = flag.trim().toLowerCase();
    if (!v) return true;
    return v === '1' || v === 'true' || v === 'approved' || v === 'active' || v === 'published';
  }

  const status = pickString(normalized?.approval_status, normalized?.status, normalized?.book_status).toLowerCase();
  if (!status) return true;
  return status.includes('approved') || status === 'active' || status === 'published';
}

