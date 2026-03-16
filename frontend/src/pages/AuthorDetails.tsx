import React from 'react';
import { Icons, BookType } from '../types';
import { motion } from 'motion/react';
import BookCard from '../components/BookCard';
import {useLibrary} from '../context/LibraryContext';

interface AuthorDetailsProps {
  authorName: string;
  onNavigate: (page: any, data?: any) => void;
}

export default function AuthorDetails({ authorName, onNavigate }: AuthorDetailsProps) {
  const {books, newArrivals} = useLibrary();
  // Combine all books and filter by author
  const allBooks = [...books, ...newArrivals];
  const authorBooks = allBooks.filter(book => book.author === authorName);
  
  // Mock author data
  const authorData = {
    name: authorName,
    bio: `${authorName} is a celebrated author known for their compelling storytelling and unique perspective. With multiple bestsellers and a dedicated global following, they continue to inspire readers across generations.`,
    followers: '12.4K',
    booksCount: authorBooks.length,
    rating: '4.8',
    photo: `https://picsum.photos/seed/${authorName}/400/400`
  };

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-20 py-10 space-y-12">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted">
        <button onClick={() => onNavigate('home')} className="hover:text-primary transition-colors">Home</button>
        <Icons.ChevronRight className="size-3" />
        <span>Authors</span>
        <Icons.ChevronRight className="size-3" />
        <span className="text-text">{authorName}</span>
      </nav>

      {/* Author Header */}
      <section className="relative rounded-[2.5rem] overflow-hidden bg-surface border border-border p-8 md:p-12">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
            <div className="size-40 md:size-56 rounded-full border-4 border-primary/20 p-2">
              <img 
                src={authorData.photo} 
                alt={authorName} 
                className="w-full h-full object-cover rounded-full shadow-2xl"
              />
            </div>
            <div className="absolute -bottom-2 -right-2 p-3 rounded-2xl bg-primary text-white shadow-lg shadow-primary/30">
              <Icons.Award className="size-6" />
            </div>
          </motion.div>

          <div className="flex-1 text-center md:text-left space-y-6">
            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-bold text-text tracking-tight">{authorData.name}</h1>
              <p className="text-primary font-bold uppercase tracking-widest text-sm">Professional Author</p>
            </div>
            
            <p className="text-text-muted leading-relaxed max-w-2xl text-lg">
              {authorData.bio}
            </p>

            <div className="flex flex-wrap justify-center md:justify-start gap-8">
              <div className="text-center md:text-left">
                <p className="text-2xl font-bold text-text">{authorData.followers}</p>
                <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Followers</p>
              </div>
              <div className="text-center md:text-left border-x border-border px-8">
                <p className="text-2xl font-bold text-text">{authorData.booksCount}</p>
                <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Books</p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-2xl font-bold text-text">{authorData.rating}</p>
                <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Avg Rating</p>
              </div>
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-4">
              <button className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2">
                <Icons.Plus className="size-5" />
                Follow Author
              </button>
              <button className="bg-surface text-text border border-border px-8 py-3 rounded-xl font-bold hover:bg-white/10 transition-all flex items-center gap-2">
                <Icons.Share2 className="size-5" />
                Share Profile
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Author's Books */}
      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Icons.Book className="size-6" />
            </div>
            <h3 className="text-2xl font-bold text-text">Books by {authorName}</h3>
          </div>
        </div>

        {authorBooks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
            {authorBooks.map((book) => (
              <BookCard 
                key={book.id} 
                book={book} 
                onClick={() => onNavigate('book-details', book)} 
                onAuthorClick={(author) => onNavigate('author-details', author)}
              />
            ))}
          </div>
        ) : (
          <div className="py-20 flex flex-col items-center text-center space-y-4 bg-surface rounded-3xl border border-border">
            <div className="size-20 rounded-full bg-bg flex items-center justify-center text-text-muted/20">
              <Icons.Book className="size-10" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-text">No other books found</h3>
              <p className="text-sm text-text-muted">We couldn't find any other books by this author in our library.</p>
            </div>
          </div>
        )}
      </section>

      {/* Similar Authors (Mock) */}
      <section className="space-y-8">
        <h3 className="text-2xl font-bold text-text">Similar Authors</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {['J.K. Rowling', 'Stephen King', 'Haruki Murakami', 'Margaret Atwood'].map((name) => (
            <div 
              key={name}
              className="p-6 rounded-3xl bg-surface border border-border hover:border-primary/30 transition-all cursor-pointer group text-center"
              onClick={() => onNavigate('author-details', name)}
            >
              <img 
                src={`https://picsum.photos/seed/${name}/200/200`} 
                alt={name} 
                className="size-20 rounded-full mx-auto mb-4 object-cover border-2 border-border group-hover:border-primary transition-colors"
              />
              <h4 className="font-bold text-text group-hover:text-primary transition-colors">{name}</h4>
              <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest mt-1">Author</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
