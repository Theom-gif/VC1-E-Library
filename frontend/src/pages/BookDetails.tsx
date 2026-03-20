import * as React from 'react';
import { Icons, BookType } from '../types';
import {useDownloads} from '../context/DownloadContext';
import {useLibrary} from '../context/LibraryContext';
import {useFavorites} from '../context/FavoritesContext';
import bookService from '../service/bookService';
import CoverImage from '../components/CoverImage';
import {openReaderTab} from '../utils/openReaderTab';
import {requestAuth, shouldRequireAuthForRead, trackRead} from '../utils/readerUpgrade';

interface BookDetailsProps {
  book?: BookType | null;
  onNavigate: (page: any, data?: any) => void;
}

interface Comment {
  id: string;
  user: string;
  avatar: string;
  text: string;
  time: string;
  likes: number;
  replies: number;
  rating: number;
}

export default function BookDetails({ book, onNavigate }: BookDetailsProps) {
  const {books} = useLibrary();
  const {startDownload, resume, openOffline, isDownloaded, activeById} = useDownloads();
  const {isFavorite, toggle} = useFavorites();
  const currentBook = book ?? books[0];
  if (!currentBook) return null;

  const active = activeById(String(currentBook.id));
  const downloaded = isDownloaded(String(currentBook.id));
  const favorite = isFavorite(String(currentBook.id));
  const [commentText, setCommentText] = React.useState('');
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null);
  const [editingText, setEditingText] = React.useState('');
  const [comments, setComments] = React.useState<Comment[]>([
    {
      id: '1',
      user: 'Sarah Miller',
      avatar: 'https://picsum.photos/seed/sarah/100/100',
      text: 'Absolutely loved the character development in this one. The pacing was perfect and the ending was completely unexpected!',
      time: '2 hours ago',
      likes: 24,
      replies: 12,
      rating: 5.0
    }
  ]);

  const handlePostComment = () => {
    if (!commentText.trim()) return;

    const newComment: Comment = {
      id: Date.now().toString(),
      user: 'Alex Johnson',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD1haEXmvd-9CjxAle36WW70lL3Mx9lorZ1Q4k0kbEI9nmCj-ma1YtFbS2GBfNRTBE5BU01cGbyXGzI6wE9hbeZ-RY34Gy-JJLG7xxgWRY4HEFdxc5q-LNWEd7TElRZFb4C4zbB7wby_Mv0-gV-v1vD1AzSJCtmL1-hvVMi7Z68G5TjPhr8SoVt31XZrcogHgVqvw4aN3W9Y6WZdW0NWNbBCUnRffhuITfWhijdjYig6s_j3euhV_5pa3Fs4O5MNWESVnMB286u1ZI',
      text: commentText,
      time: 'Just now',
      likes: 0,
      replies: 0,
      rating: 5.0
    };

    setComments((prev) => [newComment, ...prev]);
    setCommentText('');
  };

  const handleEditStart = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingText(comment.text);
  };

  const handleEditSave = (id: string) => {
    const nextText = editingText.trim();
    if (!nextText) return;

    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, text: nextText } : c)));
    setEditingCommentId(null);
    setEditingText('');
  };

  const handleEditCancel = () => {
    setEditingCommentId(null);
    setEditingText('');
  };

  const openOnline = async () => {
    if (shouldRequireAuthForRead()) {
      requestAuth('read-limit');
      return;
    }
    const url = await bookService.readUrl(String(currentBook.id));
    openReaderTab({title: currentBook.title || 'Read', url});
    trackRead(String(currentBook.id));
  };

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-20 py-10 space-y-12">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
        <button onClick={() => onNavigate('home')} className="hover:text-primary transition-colors">Home</button>
        <Icons.ChevronRight className="size-3" />
        <button onClick={() => onNavigate('categories')} className="hover:text-primary transition-colors">{currentBook.category}</button>
        <Icons.ChevronRight className="size-3" />
        <span className="text-text">{currentBook.title}</span>
      </nav>

      {/* Main Info */}
      <section className="flex flex-col lg:flex-row gap-12">
        <div className="w-full lg:w-80 shrink-0 space-y-6">
          <div className="relative aspect-[2/3] rounded-3xl overflow-hidden shadow-2xl border border-border">
            <CoverImage src={currentBook.cover} alt={currentBook.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                if (downloaded) {
                  if (shouldRequireAuthForRead()) {
                    requestAuth('read-limit');
                    return;
                  }
                  void openOffline(String(currentBook.id))
                    .then(() => {
                      trackRead(String(currentBook.id));
                    })
                    .catch((err: any) => {
                      window.alert(err?.message || 'Unable to open offline book.');
                    });
                  return;
                }
                void openOnline().catch((err: any) => {
                  window.alert(err?.message || 'Unable to open this book.');
                });
              }}
              className="bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              title={downloaded ? 'Open offline' : 'Read in browser'}
            >
              <Icons.BookOpen className="size-4" />
              {downloaded ? 'Read Offline' : 'Read Now'}
            </button>
            <button
              onClick={() => {
                if (downloaded) {
                  if (shouldRequireAuthForRead()) {
                    requestAuth('read-limit');
                    return;
                  }
                  void openOffline(String(currentBook.id))
                    .then(() => {
                      trackRead(String(currentBook.id));
                    })
                    .catch((err: any) => {
                      window.alert(err?.message || 'Unable to open offline book.');
                    });
                  return;
                }
                if (active && active.status === 'paused') {
                  void resume(currentBook);
                  onNavigate('downloads');
                  return;
                }
                void startDownload(currentBook);
                onNavigate('downloads');
              }}
              className="bg-surface text-text border border-border py-3 rounded-xl font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              disabled={Boolean(active && active.status === 'downloading')}
              title={downloaded ? 'Open offline' : 'Download for offline reading'}
            >
              <Icons.Download className="size-4" />
              {downloaded
                ? 'Open Offline'
                : active && active.status === 'downloading'
                  ? `Downloading ${active.progress}%`
                  : active && active.status === 'paused'
                    ? 'Resume Download'
                    : 'Download'}
            </button>
          </div>
          <button
            onClick={() => {
              void toggle(currentBook);
            }}
            className={`w-full border py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${favorite ? 'bg-rose-500 text-white border-rose-500 hover:bg-rose-500/90' : 'bg-surface text-text border-border hover:bg-white/10'}`}
            title={favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Icons.Heart className={`size-4 ${favorite ? 'fill-white' : ''}`} />
            {favorite ? 'Remove from Favorites' : 'Add to Favorites'}
          </button>
        </div>

        <div className="flex-1 space-y-8">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest">
                {currentBook.category}
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase tracking-widest">
                Best Seller
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight text-text">{currentBook.title}</h1>
            <div className="flex items-center gap-6">
              <div 
                className="flex items-center gap-3 cursor-pointer group/author"
                onClick={() => onNavigate('author-details', currentBook.author)}
              >
                <div className="size-10 rounded-full bg-surface border border-border overflow-hidden group-hover/author:border-primary transition-colors">
                  <img src={`https://picsum.photos/seed/${currentBook.author}/100/100`} alt={currentBook.author} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-xs font-bold text-text-muted uppercase tracking-tighter">Author</p>
                  <p className="text-sm font-bold text-text group-hover/author:text-primary transition-colors">{currentBook.author}</p>
                </div>
              </div>
              <button className="px-4 py-1.5 rounded-lg border border-primary/30 text-primary text-[11px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all">
                Follow
              </button>
              <div className="h-8 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Icons.Star key={s} className={`size-4 ${s <= Math.floor(currentBook.rating) ? 'text-yellow-500 fill-yellow-500' : 'text-text/10'}`} />
                  ))}
                </div>
                <span className="text-sm font-bold text-text">{currentBook.rating}</span>
                <span className="text-xs text-text-muted">({currentBook.reviews?.toLocaleString() || '1.2k'} reviews)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-6 border-y border-border">
            <BookStat label="Pages" value={currentBook.pages?.toString() || '342'} />
            <BookStat label="Language" value="English" />
            <BookStat label="Format" value="EPUB, PDF" />
            <BookStat label="Published" value="2021" />
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold text-text">About this book</h3>
            <p className="text-text-muted leading-relaxed">
              {currentBook.description || "In this groundbreaking work, the author explores the fundamental principles that govern our understanding of the world. Through a series of compelling narratives and rigorous analysis, the book challenges conventional wisdom and offers a fresh perspective on the challenges we face in the 21st century."}
            </p>
            <button className="text-sm font-bold text-primary hover:underline">Read More</button>
          </div>

          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-text">Community Discussion</h3>
              <span className="text-xs font-bold text-text-muted uppercase tracking-widest">{comments.length} Comments</span>
            </div>

            {/* Comment Input */}
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="size-10 rounded-full bg-primary/20 shrink-0 overflow-hidden border border-border">
                  <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuD1haEXmvd-9CjxAle36WW70lL3Mx9lorZ1Q4k0kbEI9nmCj-ma1YtFbS2GBfNRTBE5BU01cGbyXGzI6wE9hbeZ-RY34Gy-JJLG7xxgWRY4HEFdxc5q-LNWEd7TElRZFb4C4zbB7wby_Mv0-gV-v1vD1AzSJCtmL1-hvVMi7Z68G5TjPhr8SoVt31XZrcogHgVqvw4aN3W9Y6WZdW0NWNbBCUnRffhuITfWhijdjYig6s_j3euhV_5pa3Fs4O5MNWESVnMB286u1ZI" alt="User" />
                </div>
                <div className="flex-1 space-y-3">
                  <textarea 
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Share your thoughts about this book..."
                    className="w-full bg-surface border border-border rounded-2xl p-4 text-sm text-text placeholder:text-text-muted focus:ring-primary focus:border-primary outline-none min-h-[100px] resize-none transition-all"
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={handlePostComment}
                      disabled={!commentText.trim()}
                      className="bg-primary text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                    >
                      Post Comment
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Comments List */}
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="p-6 rounded-2xl bg-surface border border-border space-y-4 hover:border-primary/30 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-primary/20 overflow-hidden border border-border">
                        <img src={comment.avatar} alt={comment.user} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text">{comment.user}</p>
                        <p className="text-[10px] text-text-muted">{comment.time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {comment.user === 'Alex Johnson' && editingCommentId !== comment.id && (
                        <button 
                          onClick={() => handleEditStart(comment)}
                          className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
                        >
                          Edit
                        </button>
                      )}
                      <div className="flex items-center gap-1">
                        <Icons.Star className="size-3 text-yellow-500 fill-yellow-500" />
                        <span className="text-xs font-bold text-text">{comment.rating.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                  {editingCommentId === comment.id ? (
                    <div className="space-y-3">
                      <textarea 
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="w-full bg-surface border border-primary/30 rounded-xl p-3 text-sm text-text focus:ring-primary focus:border-primary outline-none min-h-[80px] resize-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={handleEditCancel}
                          className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-text-muted hover:text-text transition-colors uppercase tracking-widest"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => handleEditSave(comment.id)}
                          className="bg-primary text-white px-4 py-1.5 rounded-lg font-bold text-[10px] hover:bg-primary/90 transition-all uppercase tracking-widest"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted leading-relaxed">
                      {comment.text}
                    </p>
                  )}
                  <div className="flex items-center gap-4">
                    <button className="flex items-center gap-1 text-[10px] font-bold text-text-muted hover:text-primary transition-colors">
                      <Icons.Heart className="size-3" />
                      {comment.likes} Likes
                    </button>
                    <button className="flex items-center gap-1 text-[10px] font-bold text-text-muted hover:text-primary transition-colors">
                      <Icons.MessageSquare className="size-3" />
                      {comment.replies} Replies
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <button className="w-full py-3 rounded-xl border border-border text-sm font-bold text-text-muted hover:bg-surface transition-all">
              View All {comments.length + 123} Reviews
            </button>
          </div>
        </div>
      </section>

      {/* Similar Books */}
      <section className="space-y-6">
        <h3 className="text-2xl font-bold">Similar Books</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {books.slice(0, 6).map((item) => (
            <div 
              key={item.id} 
              onClick={() => onNavigate('book-details', item)}
              className="group cursor-pointer space-y-2"
            >
              <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-lg">
                <CoverImage src={item.cover} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <h4 className="text-xs font-bold text-text group-hover:text-primary transition-colors line-clamp-1">{item.title}</h4>
              <p className="text-[10px] text-text-muted">{item.author}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function BookStat({ label, value }: { label: string, value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{label}</p>
      <p className="text-sm font-bold text-text">{value}</p>
    </div>
  );
}
