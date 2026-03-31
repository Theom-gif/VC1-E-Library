import type {BookType} from '../types';

export type StoredDownload = {
  bookId: string;
  book: BookType;
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
  updatedAt: number;
  fileName?: string;
  localIdentifier?: string;
};

const DB_NAME = 'elibrary_offline';
const DB_VERSION = 1;
const STORE_DOWNLOADS = 'downloads';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_DOWNLOADS)) {
        db.createObjectStore(STORE_DOWNLOADS, {keyPath: 'bookId'});
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open IndexedDB.'));
  });
}

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_DOWNLOADS, mode);
        const store = tx.objectStore(STORE_DOWNLOADS);
        const request = fn(store);

        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
      }),
  );
}

export async function putDownload(record: StoredDownload): Promise<void> {
  await withStore('readwrite', (store) => store.put(record));
}

export async function getDownload(bookId: string): Promise<StoredDownload | null> {
  const result = await withStore('readonly', (store) => store.get(bookId));
  return (result as any) || null;
}

export async function getDownloadByLocalIdentifier(localIdentifier: string): Promise<StoredDownload | null> {
  const normalized = String(localIdentifier || '').trim();
  if (!normalized) return null;
  const items = await listDownloads();
  return items.find((item) => String(item?.localIdentifier || '').trim() === normalized) || null;
}

export async function deleteDownload(bookId: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(bookId));
}

export async function listDownloads(): Promise<StoredDownload[]> {
  const result = await withStore('readonly', (store) => store.getAll());
  return Array.isArray(result) ? (result as StoredDownload[]) : [];
}

export async function storageUsedBytes(): Promise<number> {
  const items = await listDownloads();
  return items.reduce((sum, item) => sum + (Number(item?.sizeBytes) || 0), 0);
}

