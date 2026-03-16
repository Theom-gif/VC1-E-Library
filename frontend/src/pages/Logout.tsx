import React from 'react';
import { Icons } from '../types';

interface LogoutProps {
  onLogout: () => void;
  onNavigate: (page: any, data?: any) => void;
}

export default function Logout({ onLogout, onNavigate }: LogoutProps) {
  return (
    <div className="mx-auto max-w-3xl px-6 lg:px-20 py-16">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 md:p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/20" />
        <div className="relative space-y-6">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
              <Icons.LogOut className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-text">Confirm logout</h1>
              <p className="text-sm text-text-muted">You will be signed out from this device.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-bg/60 p-4 space-y-2">
            <p className="text-sm text-text-muted">
              Any local session data will be cleared. Your saved books and profile stay safe in your account.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => onNavigate('profile')}
              className="px-6 py-2 rounded-xl font-bold text-text-muted hover:text-text transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onLogout}
              className="bg-red-500 text-white px-8 py-2 rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
