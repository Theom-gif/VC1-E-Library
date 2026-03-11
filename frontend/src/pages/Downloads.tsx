import React from 'react';
import { Icons, BookType } from '../types';

interface DownloadsProps {
  onNavigate: (page: any, data?: any) => void;
  books: BookType[];
  onToggleFavorite: (bookId: string) => void;
}

export default function Downloads({ onNavigate, books }: DownloadsProps) {
  const downloadItems = books.filter((book) => book.status);
  const activeDownloads = downloadItems.filter((item) => item.status !== 'Completed');
  const completedDownloads = downloadItems.filter((item) => item.status === 'Completed');

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-20 py-10 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-text">Downloads</h1>
          <p className="text-sm text-text-muted">Manage your offline library and active downloads</p>
        </div>
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface border border-border">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Icons.Download className="size-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Storage Used</p>
            <p className="text-sm font-bold text-text">2.4 GB / 10 GB</p>
          </div>
          <div className="w-24 h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: '24%' }} />
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Active Downloads */}
        <section className="space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2 text-text">
            Active Downloads
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">{activeDownloads.length}</span>
          </h3>
          <div className="space-y-3">
            {activeDownloads.length ? (
              activeDownloads.map((item) => (
                <div key={item.id} className="p-4 rounded-2xl bg-surface border border-border flex items-center gap-6">
                  <img src={item.cover} alt={item.title} className="w-12 h-16 object-cover rounded shadow-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-text">{item.title}</h4>
                        <p className="text-[10px] text-text-muted">{item.author} • {item.size || 'Unknown size'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-primary">{item.downloadProgress ?? 0}%</p>
                        <p className="text-[10px] text-text-muted">{item.speed || '0 KB/s'}</p>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${item.status === 'Paused' ? 'bg-orange-500' : 'bg-primary'}`} 
                        style={{ width: `${item.downloadProgress ?? 0}%` }} 
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 rounded-lg bg-surface hover:bg-white/10 text-text-muted transition-all">
                      {item.status === 'Paused' ? <Icons.Rocket className="size-4" /> : <Icons.PauseCircle className="size-4" />}
                    </button>
                    <button className="p-2 rounded-lg bg-surface hover:bg-red-500/20 text-red-500 transition-all">
                      <Icons.XCircle className="size-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-muted">
                No active downloads.
              </div>
            )}
          </div>
        </section>

        {/* Completed Downloads */}
        <section className="space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2 text-text">
            Completed Downloads
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">{completedDownloads.length}</span>
          </h3>
          <div className="space-y-3">
            {completedDownloads.length ? (
              completedDownloads.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => onNavigate('book-details', item)}
                  className="p-4 rounded-2xl bg-surface border border-border flex items-center gap-6 hover:border-primary/30 transition-all cursor-pointer"
                >
                  <img src={item.cover} alt={item.title} className="w-12 h-16 object-cover rounded shadow-lg" />
                  <div className="flex-1">
                    <h4 className="font-bold text-sm text-text">{item.title}</h4>
                    <p className="text-[10px] text-text-muted">{item.author} • {item.size || 'Unknown size'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all">
                      <Icons.CheckCheck className="size-4" />
                    </button>
                    <button className="p-2 rounded-lg bg-surface hover:bg-red-500/20 text-red-500 transition-all">
                      <Icons.Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-muted">
                No completed downloads.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
