import React from 'react';
import {Icons} from '../types';

interface LogoutProps {
  onLogout: () => void;
  onNavigate: (page: any, data?: any) => void;
}

export default function Logout({onLogout, onNavigate}: LogoutProps) {
  return (
    <div className="mx-auto max-w-5xl px-6 lg:px-20 py-16">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f7fcfd_55%,#dff5fb_100%)] shadow-[0_30px_90px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-[linear-gradient(135deg,#10191d_0%,#122328_55%,#163038_100%)] dark:shadow-2xl">
        <div className="absolute -top-24 -right-16 size-72 rounded-full bg-cyan-200/30 blur-3xl dark:bg-cyan-400/10" />
        <div className="absolute -bottom-20 -left-16 size-64 rounded-full bg-sky-100/50 blur-3xl dark:bg-sky-400/10" />

        <div className="relative grid gap-10 p-8 md:p-12 lg:grid-cols-[1.1fr_0.85fr] lg:gap-12">
          <div className="space-y-8">
            <div className="flex items-start gap-5">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-3xl bg-cyan-100 text-cyan-600 shadow-inner shadow-cyan-200/60">
                <Icons.LogOut className="size-8" />
              </div>
              <div className="space-y-3">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-cyan-600 dark:text-cyan-300">Account Exit</p>
                <h1 className="text-4xl font-black tracking-tight text-slate-950 md:text-5xl dark:text-white">Confirm logout</h1>
                <p className="max-w-xl text-base leading-7 text-slate-600 md:text-lg dark:text-slate-300">
                  You will be signed out on this device and returned to the login page.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <CompactCard
                icon={<Icons.LogOut className="size-5" />}
                iconTone="bg-rose-100 text-rose-500"
                title="Signed out here"
                text="This browser session ends immediately."
              />
              <CompactCard
                icon={<Icons.BookOpen className="size-5" />}
                iconTone="bg-sky-100 text-sky-500"
                title="Books stay saved"
                text="Your account library and profile remain untouched."
              />
            </div>
          </div>

          <aside className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 md:p-7 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/10 dark:bg-[#15262b]/90 dark:shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Ready?</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-white">Choose your next step</h2>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Logging out is a good idea on shared or public computers.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={onLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ff3b43] px-6 py-3.5 text-sm font-black text-white shadow-[0_14px_30px_rgba(255,59,67,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#f13039]"
                >
                  <Icons.LogOut className="size-4" />
                  Log Out Now
                </button>
                <button
                  onClick={() => onNavigate('profile')}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-3.5 text-sm font-bold text-slate-700 transition-all hover:bg-white hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  Stay Signed In
                </button>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function CompactCard({
  icon,
  iconTone,
  title,
  text,
}: {
  icon: React.ReactNode;
  iconTone: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
      <div className={`inline-flex rounded-2xl p-3 ${iconTone}`}>{icon}</div>
      <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</p>
    </div>
  );
}
