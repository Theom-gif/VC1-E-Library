import React from 'react';
import { Icons } from '../types';
import { motion } from 'motion/react';

interface NotificationsPageProps {
  onNavigate: (page: any, data?: any) => void;
}

export default function NotificationsPage({ onNavigate }: NotificationsPageProps) {
  const notifications = [
    { id: 1, type: 'new', title: 'New Arrival', message: 'Sea of Tranquility is now available!', time: '2m ago', unread: true, icon: <Icons.Book className="size-5" /> },
    { id: 2, type: 'download', title: 'Download Complete', message: 'The Great Gatsby has been downloaded.', time: '1h ago', unread: false, icon: <Icons.Download className="size-5" /> },
    { id: 3, type: 'goal', title: 'Reading Goal', message: 'You are 2 days away from your streak!', time: '5h ago', unread: false, icon: <Icons.Trophy className="size-5" /> },
    { id: 4, type: 'system', title: 'System Update', message: 'New themes are now available in settings.', time: '1d ago', unread: false, icon: <Icons.Settings className="size-5" /> },
    { id: 5, type: 'new', title: 'Author Update', message: 'Emily St. John Mandel just released a new short story.', time: '2d ago', unread: false, icon: <Icons.User className="size-5" /> },
    { id: 6, type: 'goal', title: 'Achievement Unlocked', message: 'You have read for 30 days consecutively!', time: '3d ago', unread: false, icon: <Icons.Award className="size-5" /> },
  ];

  return (
    <div className="mx-auto max-w-4xl px-6 lg:px-20 py-10 space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text">Notifications</h1>
          <p className="text-sm text-text-muted">Stay updated with your reading journey and library activity</p>
        </div>
        <button className="text-sm font-bold text-primary hover:underline flex items-center gap-2">
          <Icons.CheckCheck className="size-4" />
          Mark all as read
        </button>
      </div>

      <div className="space-y-4">
        {notifications.map((n, i) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`group p-6 rounded-3xl border border-border bg-surface hover:border-primary/30 transition-all relative ${n.unread ? 'ring-1 ring-primary/20' : ''}`}
          >
            {n.unread && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-primary rounded-r-full" />
            )}
            <div className="flex gap-6">
              <div className={`size-14 rounded-2xl shrink-0 flex items-center justify-center border transition-transform group-hover:scale-110 ${
                n.type === 'new' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' :
                n.type === 'download' ? 'bg-blue-500/20 text-blue-400 border-blue-500/20' :
                n.type === 'goal' ? 'bg-orange-500/20 text-orange-400 border-orange-500/20' :
                'bg-primary/20 text-primary border-primary/20'
              }`}>
                {n.icon}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className={`text-lg font-bold ${n.unread ? 'text-text' : 'text-text-muted'}`}>{n.title}</h5>
                    <p className="text-sm text-text-muted leading-relaxed">{n.message}</p>
                  </div>
                  <span className="text-xs text-text-muted font-bold font-mono whitespace-nowrap">{n.time}</span>
                </div>
                <div className="flex items-center gap-4 pt-2">
                  <button className="text-xs font-bold text-primary hover:underline uppercase tracking-widest">View Details</button>
                  <button className="text-xs font-bold text-text-muted hover:text-red-500 transition-colors uppercase tracking-widest">Delete</button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="pt-10 border-t border-border flex justify-center">
        <button 
          onClick={() => onNavigate('home')}
          className="text-sm font-bold text-text-muted hover:text-text transition-colors flex items-center gap-2"
        >
          <Icons.ChevronLeft className="size-4" />
          Back to Home
        </button>
      </div>
    </div>
  );
}
