import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Icons, BookType, hydrateBooksFromApi } from './types';
import {useLibrary} from './context/LibraryContext';

// Page Components
import Home from './pages/Home';
import Categories from './pages/Categories';
import Favorites from './pages/Favorites';
import Downloads from './pages/Downloads';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import BookDetails from './pages/BookDetails';
import AuthorDetails from './pages/AuthorDetails';
import NotificationsPage from './pages/Notifications';
import Logout from './pages/Logout';
import SearchPage from './pages/Search';

type Page =
  | 'home'
  | 'categories'
  | 'favorites'
  | 'downloads'
  | 'settings'
  | 'profile'
  | 'search'
  | 'book-details'
  | 'author-details'
  | 'notifications'
  | 'logout';

type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'author' | 'admin';
};

type AppProps = {
  authUser: AuthenticatedUser;
  onLogout: () => void;
};

export default function App({ authUser, onLogout }: AppProps) {
  const {books, newArrivals} = useLibrary();
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedBook, setSelectedBook] = useState<BookType | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);
  const [, setBooksSyncVersion] = useState(0);
  const [user, setUser] = useState({
    name: authUser?.name || 'Library User',
    photo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD1haEXmvd-9CjxAle36WW70lL3Mx9lorZ1Q4k0kbEI9nmCj-ma1YtFbS2GBfNRTBE5BU01cGbyXGzI6wE9hbeZ-RY34Gy-JJLG7xxgWRY4HEFdxc5q-LNWEd7TElRZFb4C4zbB7wby_Mv0-gV-v1vD1AzSJCtmL1-hvVMi7Z68G5TjPhr8SoVt31XZrcogHgVqvw4aN3W9Y6WZdW0NWNbBCUnRffhuITfWhijdjYig6s_j3euhV_5pa3Fs4O5MNWESVnMB286u1ZI',
    membership: 'Premium Member'
  });

  React.useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [isLightMode]);
  React.useEffect(() => {
    let isMounted = true;

    hydrateBooksFromApi()
      .then((count) => {
        if (isMounted && count > 0) {
          setBooksSyncVersion((value) => value + 1);
        }
      })
      .catch(() => {
        // Keep static mock data when backend is unavailable.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    setUser((prev) => ({
      ...prev,
      name: authUser?.name || prev.name,
    }));
  }, [authUser?.name]);

  const notifications = [
    { id: 1, type: 'new', title: 'New Arrival', message: 'Sea of Tranquility is now available!', time: '2m ago', unread: true, icon: <Icons.Book className="size-4" /> },
    { id: 2, type: 'download', title: 'Download Complete', message: 'The Great Gatsby has been downloaded.', time: '1h ago', unread: false, icon: <Icons.Download className="size-4" /> },
    { id: 3, type: 'goal', title: 'Reading Goal', message: 'You are 2 days away from your streak!', time: '5h ago', unread: false, icon: <Icons.Trophy className="size-4" /> },
    { id: 4, type: 'system', title: 'System Update', message: 'New themes are now available in settings.', time: '1d ago', unread: false, icon: <Icons.Settings className="size-4" /> },
  ];

  const navigateTo = (page: Page, data?: any) => {
    if (page === 'book-details' && data) setSelectedBook(data);
    if (page === 'author-details' && data) setSelectedAuthor(data);
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const libraryBooks = useMemo(() => {
    const byId = new Map<string, BookType>();
    [...newArrivals, ...books].forEach((book) => byId.set(book.id, book));
    return Array.from(byId.values());
  }, [books, newArrivals]);

  const filteredBooks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    const tokens = query.split(/\s+/).filter(Boolean);

    const scoreBook = (book: BookType) => {
      const title = (book.title || '').toLowerCase();
      const author = (book.author || '').toLowerCase();
      const category = (book.category || '').toLowerCase();
      const haystack = `${title} ${author} ${category}`;

      if (!tokens.every((t) => haystack.includes(t))) return 0;

      let score = 0;
      if (title.startsWith(query)) score += 100;
      if (title.includes(query)) score += 70;
      if (author.includes(query)) score += 35;
      if (category.includes(query)) score += 15;
      score += Math.round((book.rating || 0) * 2);
      return score;
    };

    return libraryBooks
      .map((book) => ({ book, score: scoreBook(book) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.book.title.localeCompare(b.book.title))
      .map((item) => item.book);
  }, [libraryBooks, searchQuery]);

  const showSearchPopover = isSearchFocused && searchQuery.trim().length > 0;
  const quickResults = filteredBooks.slice(0, 6);
  const handleLogout = () => {
    onLogout();
    setCurrentPage('home');
    window.scrollTo(0, 0);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home': return <Home onNavigate={navigateTo} />;
      case 'categories': return <Categories onNavigate={navigateTo} />;
      case 'favorites': return <Favorites onNavigate={navigateTo} />;
      case 'downloads': return <Downloads onNavigate={navigateTo} />;
      case 'settings': return <Settings onNavigate={navigateTo} />;
      case 'profile': return <Profile user={user} onUpdateUser={setUser} onNavigate={navigateTo} />;
      case 'search': return <SearchPage query={searchQuery} results={filteredBooks} onNavigate={navigateTo} />;
      case 'book-details': return <BookDetails book={selectedBook || books[0]} onNavigate={navigateTo} />;
      case 'author-details': return <AuthorDetails authorName={selectedAuthor || 'Unknown Author'} onNavigate={navigateTo} />;
      case 'notifications': return <NotificationsPage onNavigate={navigateTo} />;
      case 'logout': return <Logout onLogout={handleLogout} onNavigate={navigateTo} />;
      default: return <Home onNavigate={navigateTo} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-bg/80 backdrop-blur-md px-6 lg:px-20 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8">
          <div className="flex items-center gap-8">
            <div 
              className="flex items-center gap-2 text-primary cursor-pointer"
              onClick={() => navigateTo('home')}
            >
              <Icons.BookOpen className="size-8" />
              <h2 className="text-xl font-bold leading-tight tracking-tight hidden sm:block">គម្ពី-E-Library</h2>
            </div>
            <nav className="hidden lg:flex items-center gap-6">
              <NavLink active={currentPage === 'home'} onClick={() => navigateTo('home')}>Home</NavLink>
              <NavLink active={currentPage === 'categories'} onClick={() => navigateTo('categories')}>Categories</NavLink>
              <NavLink active={currentPage === 'favorites'} onClick={() => navigateTo('favorites')}>Favorites</NavLink>
              <NavLink active={currentPage === 'downloads'} onClick={() => navigateTo('downloads')}>Downloads</NavLink>
            </nav>
          </div>
            <div className="flex flex-1 justify-end items-center gap-6">
              <div
                ref={searchContainerRef}
                className="relative hidden md:flex items-center bg-surface border border-border rounded-lg px-4 py-2 w-64"
              >
                <Icons.Search className="size-4 text-text-muted mr-2" />
                <input 
                  type="text" 
                  placeholder="Search library..." 
                  className="bg-transparent border-none focus:ring-0 text-sm text-text w-full placeholder:text-text-muted"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setSearchQuery('');
                      setIsSearchFocused(false);
                      return;
                    }
                    if (e.key === 'Enter') {
                      const q = searchQuery.trim();
                      if (!q) return;
                      navigateTo('search');
                      setIsSearchFocused(false);
                    }
                  }}
                  autoComplete="off"
                />
                {searchQuery.trim().length > 0 && (
                  <button
                    type="button"
                    className="ml-2 text-text-muted hover:text-text transition-colors"
                    onClick={() => {
                      setSearchQuery('');
                      setIsSearchFocused(true);
                    }}
                    title="Clear search"
                  >
                    <Icons.X className="size-4" />
                  </button>
                )}

                {showSearchPopover && (
                  <div className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-bg border border-border shadow-2xl overflow-hidden z-50">
                    <div className="max-h-80 overflow-auto">
                      {quickResults.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-text-muted">
                          No results for <span className="text-text font-semibold">"{searchQuery.trim()}"</span>
                        </div>
                      ) : (
                        <div className="py-1">
                          {quickResults.map((book) => (
                            <button
                              key={book.id}
                              type="button"
                              className="w-full px-4 py-2 flex items-center gap-3 hover:bg-surface transition-colors text-left"
                              onClick={() => {
                                navigateTo('book-details', book);
                                setIsSearchFocused(false);
                              }}
                            >
                              <img src={book.cover} alt={book.title} className="w-8 h-10 rounded object-cover border border-border" />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-text line-clamp-1">{book.title}</div>
                                <div className="text-[11px] text-text-muted line-clamp-1">{book.author} • {book.category}</div>
                              </div>
                              <Icons.ArrowUpRight className="size-4 text-text-muted" />
                            </button>
                          ))}
                          <div className="border-t border-border mt-1">
                            <button
                              type="button"
                              className="w-full px-4 py-2 text-sm font-semibold text-primary hover:bg-surface transition-colors text-left"
                              onClick={() => {
                                navigateTo('search');
                                setIsSearchFocused(false);
                              }}
                            >
                              View all results
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="relative">
                <button 
                  onClick={() => setIsLightMode(!isLightMode)}
                  className="p-2 rounded-lg bg-surface border border-border hover:bg-white/10 transition-all flex items-center justify-center"
                  title={isLightMode ? "Switch to Dark Teal Mode" : "Switch to Light Mode"}
                >
                  {isLightMode ? (
                    <Icons.Moon className="size-5 text-text-muted" />
                  ) : (
                    <Icons.Sun className="size-5 text-text-muted" />
                  )}
                </button>
              </div>

              <div className="relative">
                <button 
                  onClick={() => navigateTo('notifications')}
                  className="relative p-2 rounded-lg bg-surface border border-border hover:bg-white/10 transition-all"
                >
                  <Icons.Bell className="size-5 text-text-muted" />
                  <span className="absolute top-1.5 right-1.5 size-2 bg-primary rounded-full border-2 border-bg" />
                </button>
              </div>

              <div className="flex items-center gap-3 border-l border-primary/10 pl-6">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-text">{user.name}</p>
                <p className="text-primary text-[10px] font-bold uppercase">{user.membership}</p>
              </div>
              <div 
                className="size-10 rounded-full bg-primary/20 bg-cover bg-center border-2 border-primary/20 cursor-pointer overflow-hidden"
                style={{ backgroundImage: `url('${user.photo}')` }}
                onClick={() => navigateTo('profile')}
              />
              <button
                onClick={onLogout}
                className="hidden sm:block rounded-lg border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted hover:text-primary transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-bg border-t border-border mt-12 py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-20 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-1">
            <div className="text-primary flex items-center gap-2 mb-4">
              <Icons.BookOpen className="size-6" />
              <h2 className="text-lg font-bold">គម្ពី-E-Library</h2>
            </div>
            <p className="text-sm text-text-muted leading-relaxed">
              Making knowledge accessible to everyone, anywhere in the world. Access thousands of premium titles at your fingertips.
            </p>
          </div>
          <div>
            <h5 className="font-bold mb-4 text-text">Platform</h5>
            <ul className="text-sm text-text-muted space-y-2">
              <li><FooterLink>Browse Library</FooterLink></li>
              <li><FooterLink>Authors</FooterLink></li>
              <li><FooterLink>Publishers</FooterLink></li>
              <li><FooterLink>Mobile App</FooterLink></li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold mb-4 text-text">Support</h5>
            <ul className="text-sm text-text-muted space-y-2">
              <li><FooterLink>Help Center</FooterLink></li>
              <li><FooterLink>Privacy Policy</FooterLink></li>
              <li><FooterLink>Terms of Service</FooterLink></li>
              <li><FooterLink>Contact Us</FooterLink></li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold mb-4 text-text">Newsletter</h5>
            <p className="text-sm text-text-muted mb-4">Get weekly book recommendations and library updates.</p>
            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="Email address" 
                className="w-full text-sm rounded-lg bg-surface border border-border focus:ring-primary focus:border-primary text-text placeholder:text-text-muted"
              />
              <button className="bg-primary text-white p-2 rounded-lg hover:bg-primary/90 transition-all">
                <Icons.Send className="size-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-6 lg:px-20 pt-8 mt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-text-muted">© 2024 គម្ពី-E-Library Inc. All rights reserved.</p>
          <div className="flex gap-6">
            <Icons.Globe className="size-5 text-text-muted hover:text-primary cursor-pointer transition-colors" />
            <Icons.User className="size-5 text-text-muted hover:text-primary cursor-pointer transition-colors" />
            <Icons.LayoutDashboard className="size-5 text-text-muted hover:text-primary cursor-pointer transition-colors" />
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-bg border-t border-border px-6 py-3 flex justify-around z-50 backdrop-blur-md bg-bg/90">
        <MobileNavLink active={currentPage === 'home'} onClick={() => navigateTo('home')} icon={<Icons.Home className="size-5" />} label="Home" />
        <MobileNavLink active={currentPage === 'categories'} onClick={() => navigateTo('categories')} icon={<Icons.LayoutDashboard className="size-5" />} label="Categories" />
        <MobileNavLink active={currentPage === 'downloads'} onClick={() => navigateTo('downloads')} icon={<Icons.Download className="size-5" />} label="Downloads" />
        <MobileNavLink active={currentPage === 'favorites'} onClick={() => navigateTo('favorites')} icon={<Icons.Heart className="size-5" />} label="Favorites" />
        <MobileNavLink active={currentPage === 'profile'} onClick={() => navigateTo('profile')} icon={<Icons.User className="size-5" />} label="Profile" />
      </nav>
    </div>
  );
}

function NavLink({ children, active, onClick }: { children: React.ReactNode, active?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`text-sm font-semibold transition-colors ${active ? 'text-primary border-b-2 border-primary' : 'text-text-muted hover:text-primary'}`}
    >
      {children}
    </button>
  );
}

function MobileNavLink({ active, onClick, icon, label }: { active?: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 ${active ? 'text-primary' : 'text-text-muted'}`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase">{label}</span>
    </button>
  );
}

function FooterLink({ children }: { children: React.ReactNode }) {
  return (
    <a href="#" className="text-text-muted hover:text-primary transition-colors">{children}</a>
  );
}
