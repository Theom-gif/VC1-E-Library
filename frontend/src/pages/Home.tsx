import React from 'react';
import { Icons, MOCK_BOOKS, NEW_ARRIVALS, BookType } from '../types';
import { motion } from 'motion/react';
import BookCard from '../components/BookCard';

interface HomeProps {
  onNavigate: (page: any, data?: any) => void;
}

export default function Home({ onNavigate }: HomeProps) {
  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-20 py-10 space-y-16">
      {/* Hero Section */}
      <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary/20 via-bg to-bg border border-border p-8 md:p-16">
        <div className="relative z-10 max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
            <Icons.Rocket className="size-3" />
            <span>New Feature: AI Book Summaries</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-[1.1] tracking-tight text-text">
            Your Personal <span className="text-primary">Sanctuary</span> of Knowledge
          </h1>
          <p className="text-lg text-text-muted leading-relaxed max-w-lg">
            Explore over 50,000 digital books, audiobooks, and magazines. Track your reading journey and discover your next favorite story.
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <button 
              onClick={() => onNavigate('categories')}
              className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              Start Reading
            </button>
            <button className="bg-surface text-text border border-border px-8 py-3 rounded-xl font-bold hover:bg-white/10 transition-all">
              View Plans
            </button>
          </div>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/3 hidden lg:block">
          <div className="h-full w-full bg-gradient-to-l from-primary/10 to-transparent" />
        </div>
      </section>

      {/* Recently Read */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
              <Icons.History className="size-5" />
            </div>
            <h3 className="text-xl font-bold">Recently Read</h3>
          </div>
          <button className="text-sm font-bold text-primary hover:underline">View All</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MOCK_BOOKS.slice(0, 3).map((book) => (
            <div 
              key={book.id}
              onClick={() => onNavigate('book-details', book)}
              className="group flex gap-4 p-4 rounded-2xl bg-surface border border-border hover:border-primary/30 transition-all cursor-pointer"
            >
              <img src={book.cover} alt={book.title} className="w-24 h-32 object-cover rounded-lg shadow-lg group-hover:scale-105 transition-transform" />
              <div className="flex-1 flex flex-col justify-between py-1">
                <div>
                  <h4 className="font-bold text-text group-hover:text-primary transition-colors line-clamp-1">{book.title}</h4>
                  <p className="text-xs text-text-muted">{book.author}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                    <span className="text-text-muted">Progress</span>
                    <span className="text-primary">{book.progress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${book.progress}%` }} />
                  </div>
                  <p className="text-[10px] text-text-muted italic">{book.timeLeft}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* New Arrivals */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Icons.Newspaper className="size-5" />
            </div>
            <h3 className="text-xl font-bold">New Arrivals</h3>
          </div>
          <div className="flex gap-2">
            <button className="p-2 rounded-lg bg-surface border border-border hover:bg-white/10 transition-all">
              <Icons.ChevronLeft className="size-4 text-text" />
            </button>
            <button className="p-2 rounded-lg bg-surface border border-border hover:bg-white/10 transition-all">
              <Icons.ChevronRight className="size-4 text-text" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {NEW_ARRIVALS.map((book) => (
            <BookCard 
              key={book.id} 
              book={book} 
              onClick={() => onNavigate('book-details', book)} 
              onAuthorClick={(author) => onNavigate('author-details', author)}
            />
          ))}
        </div>
      </section>

      {/* Trending & Top Rated */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <section className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <Icons.TrendingUp className="size-5" />
              </div>
              <h3 className="text-xl font-bold">Trending Now</h3>
            </div>
            <button className="text-sm font-bold text-primary hover:underline">Explore</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {MOCK_BOOKS.slice(3, 5).map((book) => (
              <div 
                key={book.id}
                onClick={() => onNavigate('book-details', book)}
                className="relative h-48 rounded-2xl overflow-hidden group cursor-pointer"
              >
                <img src={book.cover} alt={book.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-6 flex flex-col justify-end">
                  <span className="text-[10px] font-bold uppercase text-primary mb-1">{book.category}</span>
                  <h4 className="text-lg font-bold text-white line-clamp-1">{book.title}</h4>
                  <p className="text-xs text-white/60">{book.author}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500">
              <Icons.Star className="size-5" />
            </div>
            <h3 className="text-xl font-bold">Top Rated</h3>
          </div>
          <div className="space-y-4">
            {MOCK_BOOKS.slice(0, 4).map((book, i) => (
              <div 
                key={book.id}
                onClick={() => onNavigate('book-details', book)}
                className="flex items-center gap-4 group cursor-pointer"
              >
                <span className="text-2xl font-black text-text/10 group-hover:text-primary/20 transition-colors">0{i + 1}</span>
                <img src={book.cover} alt={book.title} className="w-12 h-16 object-cover rounded shadow" />
                <div>
                  <h4 className="text-sm font-bold text-text group-hover:text-primary transition-colors line-clamp-1">{book.title}</h4>
                  <div className="flex items-center gap-1">
                    <Icons.Star className="size-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-[10px] font-bold text-text-muted">{book.rating}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
