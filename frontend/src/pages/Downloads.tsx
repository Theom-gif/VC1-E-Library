import React from 'react';
import { Icons, BookType } from '../types';
import {useLibrary} from '../context/LibraryContext';

interface DownloadsProps {
  onNavigate: (page: any, data?: any) => void;
}

export default function Downloads({ onNavigate }: DownloadsProps) {
  const {books} = useLibrary();

  const downloads: BookType[] = React.useMemo(() => {
    const templates = [
      {size: '12.4 MB', status: 'Downloading', downloadProgress: 45, speed: '1.2 MB/s'},
      {size: '8.2 MB', status: 'Paused', downloadProgress: 22, speed: '0 KB/s'},
      {size: '15.1 MB', status: 'Completed', downloadProgress: 100, speed: 'Done'},
      {size: '5.7 MB', status: 'Completed', downloadProgress: 100, speed: 'Done'},
    ] as const;

    return books.slice(0, templates.length).map((book, index) => ({
      ...book,
      ...templates[index],
    }));
  }, [books]);

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
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">2</span>
          </h3>
          <div className="space-y-3">
            {downloads.filter(d => d.status !== 'Completed').map((item) => (
              <div key={item.id} className="p-4 rounded-2xl bg-surface border border-border flex items-center gap-6">
                <img src={item.cover} alt={item.title} className="w-12 h-16 object-cover rounded shadow-lg" />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-text">{item.title}</h4>
                      <p className="text-[10px] text-text-muted">{item.author} • {item.size}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-primary">{item.downloadProgress}%</p>
                      <p className="text-[10px] text-text-muted">{item.speed}</p>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${item.status === 'Paused' ? 'bg-orange-500' : 'bg-primary'}`} 
                      style={{ width: `${item.downloadProgress}%` }} 
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
            ))}
          </div>
        </section>

        {/* Completed Downloads */}
        <section className="space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2 text-text">
            Completed
            <span className="px-2 py-0.5 rounded-full bg-surface text-text-muted text-[10px] font-bold">12</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {downloads.filter(d => d.status === 'Completed').map((item) => (
              <div 
                key={item.id} 
                className="group p-4 rounded-2xl bg-surface border border-border hover:border-primary/30 transition-all flex items-center gap-4 cursor-pointer"
                onClick={() => onNavigate('book-details', item)}
              >
                <img src={item.cover} alt={item.title} className="w-16 h-24 object-cover rounded-lg shadow-lg group-hover:scale-105 transition-transform" />
                <div className="flex-1">
                  <h4 className="font-bold text-text group-hover:text-primary transition-colors line-clamp-1">{item.title}</h4>
                  <p className="text-xs text-text-muted mb-3">{item.author}</p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-text-muted">
                      <Icons.BookOpen className="size-3" />
                      {item.size}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                      <Icons.Star className="size-3 fill-emerald-500" />
                      Offline Ready
                    </div>
                  </div>
                </div>
                <button className="p-2 rounded-lg bg-surface hover:bg-red-500/20 text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                  <Icons.Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
