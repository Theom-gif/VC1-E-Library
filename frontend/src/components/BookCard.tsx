import React, {useCallback} from 'react';
import { motion } from 'motion/react';
import {Icons} from '../types';
import type {BookType} from '../types';
import {useDownloads} from '../context/DownloadContext';
import {useFavorites} from '../context/FavoritesContext';
import CoverImage from './CoverImage';
import {sweetAlert} from '../utils/sweetAlert';
import bookService from '../service/bookService';
import {openReaderTab, shouldOpenReaderDirectly} from '../utils/openReaderTab';
import {requestAuth, shouldRequireAuthForRead, trackRead} from '../utils/readerUpgrade';

interface BookCardProps {
  book: BookType;
  onClick: () => void;
  onNavigate?: (page: any, data?: any) => void;
  onAuthorClick?: (author: string | {id?: string; name?: string}) => void;
  key?: any;
}

function normalizeBackendBookId(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw.startsWith('api-') ? raw.slice(4) : raw;
}

export default function BookCard({book, onClick, onNavigate, onAuthorClick}: BookCardProps) {
  const {startDownload, resume, openOffline, isDownloaded, activeById} = useDownloads();
  const {isFavorite, toggle} = useFavorites();
  const downloaded = isDownloaded(String(book.id));
  const active = activeById(String(book.id));
  const favorite = isFavorite(String(book.id));

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (downloaded) {
        void openOffline(String(book.id)).catch((err: any) => {
          void sweetAlert(err?.message || 'Unable to open offline book.', {icon: 'error', title: 'Error'});
        });
        return;
      }
      if (active?.status === 'paused') {
        void resume(book);
        onNavigate?.('downloads');
        return;
      }
      void startDownload(book);
      onNavigate?.('downloads');
    },
    [active?.status, book, downloaded, onNavigate, openOffline, resume, startDownload],
  );

  const handleRead = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const normalizedBookId = normalizeBackendBookId(book.id);
      if (!normalizedBookId) return;
      if (shouldRequireAuthForRead()) {
        requestAuth('read-limit');
        return;
      }

      if (shouldOpenReaderDirectly()) {
        void (async () => {
          try {
            const url = await bookService.readUrl(normalizedBookId);
            trackRead(normalizedBookId);
            window.location.href = url;
          } catch (err: any) {
            void sweetAlert(err?.message || 'Unable to open this book.', {icon: 'error', title: 'Error'});
          }
        })();
        return;
      }

      const tab = window.open('', '_blank');
      if (!tab) {
        void sweetAlert('Popup blocked. Please allow popups to open the reader.', {icon: 'error', title: 'Error'});
        return;
      }

      void (async () => {
        try {
          const url = await bookService.readUrl(normalizedBookId);
          openReaderTab({
            title: book.title || 'Read',
            url,
            tab,
            mimeType: /\.pdf(\?|#|$)/i.test(url) ? 'application/pdf' : undefined,
            tracking: {
              bookId: normalizedBookId,
              source: 'web',
            },
          });
          trackRead(normalizedBookId);
        } catch (err: any) {
          try {
            tab.close();
          } catch {}
          void sweetAlert(err?.message || 'Unable to open this book.', {icon: 'error', title: 'Error'});
        }
      })();
    },
    [book.id, book.title, downloaded, openOffline],
  );

  const handleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      void toggle(book);
    },
    [book, toggle],
  );

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="space-y-3 cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-xl"
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-xl">
        <CoverImage src={book.cover} alt={book.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        {/* Hover devices: show actions on hover/focus. Touch devices: show a bottom bar. */}
        <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity items-center justify-center gap-2 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:hover)]:flex [@media(hover:none)]:hidden">
          <button
            type="button"
            className="p-2 rounded-full bg-primary text-white shadow-lg hover:scale-110 transition-transform"
            onClick={handleRead}
            title="Read in browser"
          >
            <Icons.BookOpen className="size-4" />
          </button>
          <button
            type="button"
            className="p-2 rounded-full bg-primary text-white shadow-lg hover:scale-110 transition-transform"
            onClick={handleDownload}
            title={downloaded ? 'Open offline' : active?.status === 'downloading' ? `Downloading ${active.progress}%` : 'Download for offline reading'}
          >
            <Icons.Download className="size-4" />
          </button>
          <button 
            type="button"
            className={`p-2 rounded-full shadow-lg hover:scale-110 transition-transform ${favorite ? 'bg-rose-500 text-white' : 'bg-white text-background-dark'}`}
            onClick={handleFavorite}
            title={favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Icons.Heart className={`size-4 ${favorite ? 'fill-white' : ''}`} />
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent hidden items-center justify-center gap-2 [@media(hover:none)]:flex">
          <button
            type="button"
            className="p-2 rounded-full bg-primary text-white shadow-lg active:scale-95 transition-transform"
            onClick={handleRead}
            aria-label="Read in browser"
          >
            <Icons.BookOpen className="size-4" />
          </button>
          <button
            type="button"
            className="p-2 rounded-full bg-primary text-white shadow-lg active:scale-95 transition-transform"
            onClick={handleDownload}
            aria-label={downloaded ? 'Open offline' : 'Download for offline reading'}
          >
            <Icons.Download className="size-4" />
          </button>
          <button
            type="button"
            className={`p-2 rounded-full shadow-lg active:scale-95 transition-transform ${favorite ? 'bg-rose-500 text-white' : 'bg-white text-background-dark'}`}
            onClick={handleFavorite}
            aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Icons.Heart className={`size-4 ${favorite ? 'fill-white' : ''}`} />
          </button>
        </div>
      </div>
      <div>
        <h4 className="text-sm font-bold text-text group-hover:text-primary transition-colors line-clamp-1">{book.title}</h4>
        <p 
          className="text-[10px] text-text-muted hover:text-primary transition-colors"
          onClick={(e) => {
            if (onAuthorClick) {
              e.stopPropagation();
              onAuthorClick(book.authorId ? {id: book.authorId, name: book.author} : book.author);
            }
          }}
        >
          {book.author}
        </p>
      </div>
    </motion.div>
  );
}
