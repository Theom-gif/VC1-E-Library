import React, { useState, useMemo } from 'react';
import {Icons} from '../types';
import type {BookType} from '../types';
import { motion } from 'motion/react';
import BookCard from '../components/BookCard';
import {useFavorites} from '../context/FavoritesContext';

interface FavoritesProps {
  onNavigate: (page: any, data?: any) => void;
}

type TabType = 'All Favorites' | 'Recently Added' | 'Reading Progress' | 'Completed';

export default function Favorites({ onNavigate }: FavoritesProps) {
  const {favorites, isLoading, error, refresh} = useFavorites();
  const [activeTab, setActiveTab] = useState<TabType>('All Favorites');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBooks = useMemo(() => {
    let items = favorites;

    // Filter by tab
    if (activeTab === 'Recently Added') {
      // Just showing all for now as we don't have "added date"
      items = favorites;
    } else if (activeTab === 'Reading Progress') {
      items = favorites.filter(b => (b.progress && b.progress > 0 && b.progress < 100) || b.status === 'Currently Reading');
    } else if (activeTab === 'Completed') {
      items = favorites.filter(b => b.status === 'Completed' || b.progress === 100);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(b => 
        b.title.toLowerCase().includes(query) || 
        b.author.toLowerCase().includes(query)
      );
    }

    return items;
  }, [activeTab, searchQuery, favorites]);

  const tabs: TabType[] = ['All Favorites', 'Recently Added', 'Reading Progress', 'Completed'];

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-20 py-10 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-text">Favorite Books</h1>
          <p className="text-sm text-text-muted">You have {filteredBooks.length} books in this view</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-muted/30" />
            <input 
              type="text" 
              placeholder="Search favorites..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-xl bg-surface border border-border text-text text-sm focus:ring-primary focus:border-primary outline-none w-64"
            />
          </div>
        </div>
      </div>

      {(isLoading || error) && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-4 py-3">
          <div className="text-sm text-text-muted">
            {isLoading ? 'Loading favorites...' : error}
          </div>
          <button
            onClick={() => void refresh()}
            className="text-xs font-bold uppercase tracking-widest text-primary hover:underline"
          >
            Refresh
          </button>
        </div>
      )}

      <div className="flex items-center gap-4 border-b border-border pb-4 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-sm font-bold px-4 py-2 rounded-lg transition-all whitespace-nowrap ${activeTab === tab ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {filteredBooks.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
          {filteredBooks.map((book) => (
            <BookCard 
              key={book.id} 
              book={book} 
              onClick={() => onNavigate('book-details', book)} 
              onNavigate={onNavigate}
              onAuthorClick={(author) => onNavigate('author-details', author)}
            />
          ))}
        </div>
      ) : (
        <div className="py-20 flex flex-col items-center text-center space-y-4">
          <div className="size-20 rounded-full bg-surface flex items-center justify-center text-text-muted/20">
            <Icons.Heart className="size-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-text">No books found</h3>
            <p className="text-sm text-text-muted">Try adjusting your filters or search query.</p>
          </div>
          {activeTab !== 'All Favorites' && (
            <button 
              onClick={() => setActiveTab('All Favorites')}
              className="text-primary font-bold hover:underline"
            >
              Show all favorites
            </button>
          )}
        </div>
      )}
    </div>
  );
}
