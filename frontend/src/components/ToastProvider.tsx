import React from 'react';

type ToastKind = 'success' | 'error' | 'info';

type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
  durationMs?: number;
};

type ToastContextValue = {
  push: (toast: Omit<Toast, 'id'>) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

function randomId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toastClasses(kind: ToastKind) {
  if (kind === 'success') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  if (kind === 'error') return 'border-red-500/30 bg-red-500/10 text-red-200';
  return 'border-border bg-surface text-text';
}

export function ToastProvider({children}: {children: React.ReactNode}) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const push = React.useCallback((toast: Omit<Toast, 'id'>) => {
    const id = randomId();
    const durationMs = Math.max(1200, Math.min(8000, Number(toast.durationMs) || 3500));
    setToasts((prev) => [...prev, {id, ...toast, durationMs}]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, durationMs);
  }, []);

  return (
    <ToastContext.Provider value={{push}}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex w-[min(360px,calc(100vw-3rem))] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === 'error' ? 'alert' : 'status'}
            aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur ${toastClasses(toast.kind)}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) return {push: (_: Omit<Toast, 'id'>) => {}};
  return ctx;
}

