import React from 'react';
import {Icons} from '../types';
import type {MembershipTier} from '../utils/readerUpgrade';

type PlansProps = {
  onNavigate: (page: any, data?: any) => void;
  isGuest?: boolean;
  membershipTier?: MembershipTier;
};

function PlanFeature({children}: {children: React.ReactNode}) {
  return (
    <li className="flex items-start gap-2 text-sm text-text-muted">
      <Icons.CheckCheck className="mt-0.5 size-4 text-emerald-500" />
      <span>{children}</span>
    </li>
  );
}

export default function Plans({onNavigate, isGuest, membershipTier}: PlansProps) {
  const tier = membershipTier === 'reader' ? 'reader' : 'normal';
  const showReaderAsCurrent = !isGuest && tier === 'reader';

  return (
    <div className="mx-auto max-w-6xl px-6 lg:px-20 py-10 space-y-10">
      <header className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            <Icons.Sparkles className="size-3" />
            Membership
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-text">Plans</h1>
          <p className="text-sm text-text-muted max-w-2xl">
            Choose how you want to use គម្ពី-ELibrary. You can browse as a guest, or unlock more features as a Reader.
          </p>
        </div>
        <button
          onClick={() => onNavigate('home')}
          className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold text-text hover:bg-white/10 transition-all"
        >
          Back
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="rounded-3xl border border-border bg-surface p-7 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-text">Normal</h2>
              <p className="text-sm text-text-muted">Browse and preview books.</p>
            </div>
            <span className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-bold text-text-muted">
              Free
            </span>
          </div>

          <ul className="space-y-2">
            <PlanFeature>Browse books and categories</PlanFeature>
            <PlanFeature>Search by title, author, category</PlanFeature>
            <PlanFeature>Limited “Read Now” access as guest</PlanFeature>
          </ul>

          <div className="pt-2">
            <button
              onClick={() => onNavigate('home')}
              className="w-full rounded-2xl border border-border bg-bg px-5 py-3 text-sm font-black text-text hover:bg-white/10 transition-all"
            >
              Continue
            </button>
          </div>
        </section>

        <section className="relative rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-surface to-surface p-7 space-y-5 overflow-hidden">
          <div className="absolute -top-20 -right-24 size-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-text">Reader Member</h2>
              <p className="text-sm text-text-muted">Unlock favorites, downloads, and profile.</p>
            </div>
            {showReaderAsCurrent ? (
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-black text-white">Current</span>
            ) : (
              <span className="rounded-full border border-primary/30 bg-bg px-3 py-1 text-xs font-bold text-primary">
                Recommended
              </span>
            )}
          </div>

          <ul className="relative space-y-2">
            <PlanFeature>Unlimited reading access</PlanFeature>
            <PlanFeature>Favorites and downloads</PlanFeature>
            <PlanFeature>Profile + reading activity</PlanFeature>
            <PlanFeature>Notifications</PlanFeature>
          </ul>

          <div className="relative pt-2">
            {isGuest ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => onNavigate('home', {authOverlay: 'login'})}
                  className="rounded-2xl border border-border bg-bg px-5 py-3 text-sm font-black text-text hover:bg-white/10 transition-all"
                >
                  Login
                </button>
                <button
                  onClick={() => onNavigate('home', {authOverlay: 'register'})}
                  className="rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
                >
                  Register
                </button>
              </div>
            ) : (
              <button
                onClick={() => onNavigate('profile')}
                className="w-full rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
              >
                Manage Account
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
