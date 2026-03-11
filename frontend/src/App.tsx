import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Icons, BookType } from './types';

// Page Components
import Home from './pages/Home';
import Categories from './pages/Categories';
import Favorites from './pages/Favorites';
import Downloads from './pages/Downloads';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import BookDetails from './pages/BookDetails';
import { fetchPublishedBooks } from './service/bookService';
import AuthorDetails from './pages/AuthorDetails';
import NotificationsPage from './pages/Notifications';

type Page = 'home' | 'categories' | 'favorites' | 'downloads' | 'settings' | 'profile' | 'book-details' | 'author-details' | 'notifications';

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
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [books, setBooks] = useState<BookType[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [isLightMode, setIsLightMode] = useState(false);
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
    setUser((prev) => ({
      ...prev,
      name: authUser?.name || prev.name,
    }));
  }, [authUser?.name]);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const dbBooks = await fetchPublishedBooks();
        if (active) {
          const favoriteIds = new Set<string>(
            JSON.parse(localStorage.getItem('favorite_books') || '[]'),
          );
          setBooks(dbBooks.map((book) => ({ ...book, isFavorite: favoriteIds.has(book.id) })));
        }
      } catch {
        if (active) setBooks([]);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const toggleFavorite = (bookId: string) => {
    setBooks((current) => {
      const next = current.map((book) =>
        book.id === bookId ? { ...book, isFavorite: !book.isFavorite } : book,
      );
      const favoriteIds = next.filter((book) => book.isFavorite).map((book) => book.id);
      localStorage.setItem('favorite_books', JSON.stringify(favoriteIds));
      return next;
    });
  };

  const notifications = [
    { id: 1, type: 'new', title: 'New Arrival', message: 'Sea of Tranquility is now available!', time: '2m ago', unread: true, icon: <Icons.Book className="size-4" /> },
    { id: 2, type: 'download', title: 'Download Complete', message: 'The Great Gatsby has been downloaded.', time: '1h ago', unread: false, icon: <Icons.Download className="size-4" /> },
    { id: 3, type: 'goal', title: 'Reading Goal', message: 'You are 2 days away from your streak!', time: '5h ago', unread: false, icon: <Icons.Trophy className="size-4" /> },
    { id: 4, type: 'system', title: 'System Update', message: 'New themes are now available in settings.', time: '1d ago', unread: false, icon: <Icons.Settings className="size-4" /> },
  ];

  const navigateTo = (page: Page, data?: any) => {
    if (page === 'book-details' && data) setSelectedBookId(data.id);
    if (page === 'author-details' && data) setSelectedAuthor(data);
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  const selectedBook = books.find((b) => b.id === selectedBookId);

  const renderPage = () => {
    switch (currentPage) {
      case 'home': return <Home onNavigate={navigateTo} books={books} onToggleFavorite={toggleFavorite} />;
      case 'categories': return <Categories onNavigate={navigateTo} books={books} onToggleFavorite={toggleFavorite} />;
      case 'favorites': return <Favorites onNavigate={navigateTo} books={books} onToggleFavorite={toggleFavorite} />;
      case 'downloads': return <Downloads onNavigate={navigateTo} books={books} onToggleFavorite={toggleFavorite} />;
      case 'settings': return <Settings />;
      case 'profile': return <Profile user={user} onUpdateUser={setUser} onNavigate={navigateTo} books={books} onToggleFavorite={toggleFavorite} />;
      case 'book-details':
        return <BookDetails book={selectedBook} onNavigate={navigateTo} onToggleFavorite={toggleFavorite} />;
      case 'author-details':
        return (
          <AuthorDetails authorName={selectedAuthor || 'Unknown Author'} onNavigate={navigateTo} books={books} onToggleFavorite={toggleFavorite} />
        );
      case 'notifications': return <NotificationsPage onNavigate={navigateTo} />;
      default: return <Home onNavigate={navigateTo} books={books} onToggleFavorite={toggleFavorite} />;
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
              <h2 className="text-xl font-bold leading-tight tracking-tight hidden sm:block">គម្ពី-Elibrary</h2>
            </div>
            <nav className="hidden lg:flex items-center gap-6">
              <NavLink active={currentPage === 'home'} onClick={() => navigateTo('home')}>Home</NavLink>
              <NavLink active={currentPage === 'categories'} onClick={() => navigateTo('categories')}>Categories</NavLink>
              <NavLink active={currentPage === 'favorites'} onClick={() => navigateTo('favorites')}>Favorites</NavLink>
              <NavLink active={currentPage === 'downloads'} onClick={() => navigateTo('downloads')}>Downloads</NavLink>
            </nav>
          </div>
            <div className="flex flex-1 justify-end items-center gap-6">
              <div className="relative hidden md:flex items-center bg-surface border border-border rounded-lg px-4 py-2 w-64">
                <Icons.Search className="size-4 text-text-muted mr-2" />
                <input 
                  type="text" 
                  placeholder="Search library..." 
                  className="bg-transparent border-none focus:ring-0 text-sm text-text w-full placeholder:text-text-muted"
                />
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
              <h2 className="text-lg font-bold">គម្ពី-Elibrary</h2>
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
          <p className="text-xs text-text-muted">© 2024 គម្ពី-Elibrary Inc. All rights reserved.</p>
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
