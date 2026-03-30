import React from 'react';
import { motion } from 'motion/react';
import {Icons} from '../types';
import type {BookType} from '../types';
import {useDownloads} from '../context/DownloadContext';
import {useFavorites} from '../context/FavoritesContext';
import CoverImage from './CoverImage';
import {sweetAlert} from '../utils/sweetAlert';

interface BookCardProps {
  book: BookType;
  onClick: () => void;
  onNavigate?: (page: any, data?: any) => void;
  onAuthorClick?: (author: string | {id?: string; name?: string}) => void;
  key?: any;
}

export default function BookCard({book, onClick, onNavigate, onAuthorClick}: BookCardProps) {
  const {startDownload, resume, openOffline, isDownloaded, activeById} = useDownloads();
  const {isFavorite, toggle} = useFavorites();
  const downloaded = isDownloaded(String(book.id));
  const active = activeById(String(book.id));
  const favorite = isFavorite(String(book.id));

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      onClick={onClick}
      className="space-y-3 cursor-pointer group"
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-xl">
        <CoverImage src={book.cover} alt={book.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button 
            type="button"
            className="p-2 rounded-full bg-primary text-white shadow-lg hover:scale-110 transition-transform"
            onClick={(e) => {
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
            }}
            title={downloaded ? 'Open offline' : active?.status === 'downloading' ? `Downloading ${active.progress}%` : 'Download for offline reading'}
          >
            <Icons.Download className="size-4" />
          </button>
          <button 
            type="button"
            className={`p-2 rounded-full shadow-lg hover:scale-110 transition-transform ${favorite ? 'bg-rose-500 text-white' : 'bg-white text-background-dark'}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void toggle(book);
            }}
            title={favorite ? 'Remove from favorites' : 'Add to favorites'}
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
