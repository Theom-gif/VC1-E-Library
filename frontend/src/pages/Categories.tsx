import React, {useMemo, useState} from 'react';
import {Icons, type BookType} from '../types';
import BookCard from '../components/BookCard';
import {useLibrary} from '../context/LibraryContext';

interface CategoriesProps {
  onNavigate: (page: any, data?: any) => void;
}

type CategoryDef = {
  name: string;
  icon: React.ReactNode;
  matches: (book: BookType) => boolean;
};

const CATEGORY_DEFS: CategoryDef[] = [
  {name: 'All Genres', icon: <Icons.LayoutDashboard className="size-4" />, matches: () => true},
  {name: 'Technology', icon: <Icons.Book className="size-4" />, matches: (book) => book.category === 'Technology'},
  {name: 'Novel', icon: <Icons.BookOpen className="size-4" />, matches: (book) => book.category === 'Novel'},
  {name: 'Education', icon: <Icons.Rocket className="size-4" />, matches: (book) => book.category === 'Education'},
  {name: 'Business', icon: <Icons.Search className="size-4" />, matches: (book) => book.category === 'Business'},
  {name: 'History', icon: <Icons.Award className="size-4" />, matches: (book) => book.category === 'History'},
  // Examples for when you add these categories back:
  // {name: 'Sci-Fi & Fantasy', icon: <Icons.Rocket className="size-4" />, matches: (book) => book.category === 'Sci-Fi' || book.category === 'Fantasy'},
  // {name: 'Classics', icon: <Icons.Award className="size-4" />, matches: (book) => book.category === 'Classic'},
];

const BOOKS_PER_PAGE = 8;

export default function Categories({ onNavigate }: CategoriesProps) {
  const {books} = useLibrary();
  const [activeCategory, setActiveCategory] = useState('All Genres');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const categories = useMemo(() => {
    return CATEGORY_DEFS.map((cat) => ({
      ...cat,
      count: books.filter((book) => cat.matches(book)).length,
    }));
  }, [books]);

  const activeCategoryDef = useMemo(() => {
    return categories.find((cat) => cat.name === activeCategory) || categories[0];
  }, [activeCategory, categories]);

  const filteredBooks = books.filter(book => {
    // Category Filter
    const matchesCategory = activeCategoryDef?.matches ? activeCategoryDef.matches(book) : true;
    
    // Search Filter
    const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      book.author.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredBooks.length / BOOKS_PER_PAGE);
  const startIndex = (currentPage - 1) * BOOKS_PER_PAGE;
  const paginatedBooks = filteredBooks.slice(startIndex, startIndex + BOOKS_PER_PAGE);

  // Reset to first page when category or search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, searchQuery]);

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-20 py-10 flex flex-col lg:flex-row gap-12">
      {/* Sidebar */}
      <aside className="w-full lg:w-72 space-y-8">
        <div className="space-y-6">
          <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-text-muted px-4">Categories</h3>
          <nav className="space-y-1">
            {categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-300 ${
                  activeCategory === cat.name 
                    ? 'bg-primary text-white shadow-[0_0_20px_rgba(19,200,236,0.3)] ring-1 ring-white/20' 
                    : 'text-text-muted hover:bg-surface hover:text-text'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`${activeCategory === cat.name ? 'text-white' : 'text-text-muted/40'}`}>
                    {cat.icon}
                  </div>
                  <span className="text-[15px] font-bold tracking-tight">{cat.name}</span>
                </div>
                <span className={`text-xs font-bold ${activeCategory === cat.name ? 'text-white/70' : 'text-text-muted/40'}`}>
                  {cat.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-8 rounded-[2rem] bg-surface border border-border space-y-6">
          <div className="flex items-center gap-3 text-primary">
            <Icons.Flame className="size-6" />
            <h4 className="font-bold text-base">Reading Streak</h4>
          </div>
          <p className="text-sm text-text-muted leading-relaxed">You've read for 12 days in a row! Keep it up to earn the "Bookworm" badge.</p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <div key={d} className={`h-1.5 flex-1 rounded-full ${d <= 5 ? 'bg-primary shadow-[0_0_10px_rgba(19,200,236,0.5)]' : 'bg-border'}`} />
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-text">{activeCategory}</h2>
            <p className="text-sm text-text-muted">
              Showing {filteredBooks.length ? startIndex + 1 : 0}-{Math.min(startIndex + BOOKS_PER_PAGE, filteredBooks.length)} of {filteredBooks.length} books
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search in category..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-xl bg-surface border border-border text-sm focus:ring-primary focus:border-primary outline-none w-48 sm:w-64"
              />
            </div>
          </div>
        </div>

        {paginatedBooks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-8">
            {paginatedBooks.map((book) => (
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
              <Icons.Search className="size-10" />
            </div>
            <div>
              <h3 className="text-xl font-bold">No books found</h3>
              <p className="text-sm text-text-muted">Try adjusting your search or category filter.</p>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center pt-12">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-surface border border-border hover:bg-white/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <Icons.ChevronLeft className="size-4 text-text" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button 
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`size-10 rounded-lg text-sm font-bold transition-all ${currentPage === p ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surface border border-border hover:bg-white/10 text-text'}`}
                >
                  {p}
                </button>
              ))}
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-surface border border-border hover:bg-white/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <Icons.ChevronRight className="size-4 text-text" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
