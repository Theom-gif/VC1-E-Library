import React from 'react';
import {Icons} from '../types';
import {useDownloads} from '../context/DownloadContext';
import CoverImage from '../components/CoverImage';
import {requestAuth, shouldRequireAuthForRead, trackRead} from '../utils/readerUpgrade';

interface DownloadsProps {
  onNavigate: (page: any, data?: any) => void;
}

function formatBytes(value: number) {
  const bytes = Math.max(0, Number(value) || 0);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  let unitIndex = 0;
  let n = bytes;
  while (n >= 1024 && unitIndex < units.length - 1) {
    n /= 1024;
    unitIndex += 1;
  }
  const precision = unitIndex <= 1 ? 0 : 1;
  return `${n.toFixed(precision)} ${units[unitIndex]}`;
}

function formatSpeed(value: number) {
  const speed = Math.max(0, Number(value) || 0);
  if (!speed) return '\u2014';
  return `${formatBytes(speed)}/s`;
}

export default function Downloads({onNavigate}: DownloadsProps) {
  const {active, completed, storageUsed, pause, resume, cancel, remove, openOffline} = useDownloads();
  const hasActiveDownloads = active.length > 0;

  const totalCapacityBytes = 10 * 1024 * 1024 * 1024;
  const storageLabel = `${formatBytes(storageUsed)} / 10 GB`;
  const storagePct = totalCapacityBytes ? Math.min(100, Math.round((storageUsed / totalCapacityBytes) * 100)) : 0;

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
            <p className="text-sm font-bold text-text">{storageLabel}</p>
          </div>
          <div className="w-24 h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{width: `${storagePct}%`}} />
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {hasActiveDownloads ? (
          <section className="space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2 text-text">
              Active Downloads
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">{active.length}</span>
            </h3>

            <div className="space-y-3">
              {active.map((item) => (
                <div key={item.bookId} className="p-4 rounded-2xl bg-surface border border-border flex items-center gap-6">
                  <CoverImage src={item.book.cover} alt={item.book.title} className="w-12 h-16 object-cover rounded shadow-lg" />

                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-text">{item.book.title}</h4>
                        <p className="text-[10px] text-text-muted">
                          {item.book.author} {'\u2022'} {item.totalBytes ? formatBytes(item.totalBytes) : formatBytes(item.receivedBytes)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-primary">{item.progress}%</p>
                        <p className="text-[10px] text-text-muted">
                          {item.status === 'paused' ? 'Paused' : item.status === 'error' ? 'Failed' : formatSpeed(item.speedBytesPerSec)}
                        </p>
                      </div>
                    </div>

                    <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.status === 'paused' ? 'bg-orange-500' : item.status === 'error' ? 'bg-red-500' : 'bg-primary'
                        }`}
                        style={{width: `${item.progress}%`}}
                      />
                    </div>

                    {item.error ? <p className="text-[10px] font-bold text-red-500">{item.error}</p> : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {item.status === 'error' && item.downloadUrl ? (
                      <button
                        className="p-2 rounded-lg bg-surface hover:bg-white/10 text-text-muted transition-all"
                        onClick={() => window.open(item.downloadUrl, '_blank', 'noreferrer')}
                        title="Open file in browser"
                      >
                        <Icons.ExternalLink className="size-4" />
                      </button>
                    ) : null}
                    <button
                      className="p-2 rounded-lg bg-surface hover:bg-white/10 text-text-muted transition-all"
                      onClick={() => (item.status === 'downloading' ? pause(item.bookId) : resume(item.book))}
                      title={item.status === 'downloading' ? 'Pause' : 'Resume'}
                    >
                      {item.status === 'downloading' ? (
                        <Icons.PauseCircle className="size-4" />
                      ) : (
                        <Icons.Rocket className="size-4" />
                      )}
                    </button>
                    <button
                      className="p-2 rounded-lg bg-surface hover:bg-red-500/20 text-red-500 transition-all"
                      onClick={() => cancel(item.bookId)}
                      title="Cancel"
                    >
                      <Icons.XCircle className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2 text-text">
            Completed
            <span className="px-2 py-0.5 rounded-full bg-surface text-text-muted text-[10px] font-bold">{completed.length}</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completed.length === 0 ? (
              <div className="md:col-span-2 p-10 rounded-2xl bg-surface border border-border text-center text-sm text-text-muted">
                No offline books yet. Download a book to read it offline.
              </div>
            ) : null}

            {completed.map((item) => (
              <div
                key={item.bookId}
                className="group p-4 rounded-2xl bg-surface border border-border hover:border-primary/30 transition-all flex items-center gap-4 cursor-pointer"
                onClick={() => {
                  if (shouldRequireAuthForRead()) {
                    requestAuth('read-limit');
                    return;
                  }
                  openOffline(item.bookId)
                    .then(() => {
                      trackRead(item.bookId);
                    })
                    .catch(() => onNavigate('book-details', item.book));
                }}
                title="Open offline"
              >
                <CoverImage src={item.book.cover} alt={item.book.title} className="w-16 h-24 object-cover rounded-lg shadow-lg group-hover:scale-105 transition-transform" />

                <div className="flex-1">
                  <h4 className="font-bold text-text group-hover:text-primary transition-colors line-clamp-1">{item.book.title}</h4>
                  <p className="text-xs text-text-muted mb-3">{item.book.author}</p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-text-muted">
                      <Icons.BookOpen className="size-3" />
                      {formatBytes(item.sizeBytes)}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                      <Icons.Star className="size-3 fill-emerald-500" />
                      Offline Ready
                    </div>
                  </div>
                </div>

                <button
                  className="p-2 rounded-lg bg-surface hover:bg-red-500/20 text-red-500 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    void remove(item.bookId);
                  }}
                  title="Remove from device"
                >
                  <Icons.Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {completed.length > 0 ? (
          <div className="pt-6 border-t border-border flex justify-center">
            <button
              onClick={() => onNavigate('home')}
              className="text-sm font-bold text-text-muted hover:text-text transition-colors flex items-center gap-2"
            >
              <Icons.ChevronLeft className="size-4" />
              Back to Home
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

