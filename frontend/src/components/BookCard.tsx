import React from 'react';
import { motion } from 'motion/react';
import { Icons, BookType } from '../types';

interface BookCardProps {
  book: BookType;
  onClick: () => void;
  onAuthorClick?: (author: string) => void;
  key?: any;
}

export default function BookCard({ book, onClick, onAuthorClick }: BookCardProps) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      onClick={onClick}
      className="space-y-3 cursor-pointer group"
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-xl">
        <img src={book.cover} alt={book.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button 
            className="p-2 rounded-full bg-primary text-white shadow-lg hover:scale-110 transition-transform"
            onClick={(e) => {
              e.stopPropagation();
              // In a real app, this would trigger a download
              alert(`Downloading ${book.title}...`);
            }}
          >
            <Icons.Download className="size-4" />
          </button>
          <button 
            className="p-2 rounded-full bg-white text-background-dark shadow-lg hover:scale-110 transition-transform"
            onClick={(e) => {
              e.stopPropagation();
              // In a real app, this would toggle favorite
            }}
          >
            <Icons.Heart className="size-4" />
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
              onAuthorClick(book.author);
            }
          }}
        >
          {book.author}
        </p>
      </div>
    </motion.div>
  );
}
