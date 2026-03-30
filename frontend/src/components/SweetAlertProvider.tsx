import React from 'react';
import {Icons} from '../types';
import {onSweetAlert, type SweetAlertIcon, type SweetAlertOptions} from '../utils/sweetAlert';
import ModalPortal from './ModalPortal';

type ActiveAlert = SweetAlertOptions & {resolve: (value: boolean) => void};

function iconStyles(icon?: SweetAlertIcon) {
  if (icon === 'success') return {wrap: 'bg-emerald-500/10 border-emerald-500/30', icon: 'text-emerald-400'};
  if (icon === 'error') return {wrap: 'bg-red-500/10 border-red-500/30', icon: 'text-red-400'};
  if (icon === 'warning') return {wrap: 'bg-amber-500/10 border-amber-500/30', icon: 'text-amber-400'};
  return {wrap: 'bg-surface border-border', icon: 'text-primary'};
}

function iconNode(icon?: SweetAlertIcon) {
  if (icon === 'success') return <Icons.CheckCheck className="size-5" />;
  if (icon === 'error') return <Icons.XCircle className="size-5" />;
  if (icon === 'warning') return <Icons.Award className="size-5" />;
  return <Icons.Bell className="size-5" />;
}

export function SweetAlertProvider({children}: {children: React.ReactNode}) {
  const [active, setActive] = React.useState<ActiveAlert | null>(null);
  const confirmButtonRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    return onSweetAlert((payload) => {
      setActive(() => ({
        title: payload.title,
        text: payload.text,
        icon: payload.icon,
        confirmText: payload.confirmText,
        cancelText: payload.cancelText,
        showCancel: payload.showCancel,
        resolve: payload.resolve,
      }));
    });
  }, []);

  React.useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (active.showCancel) close(false);
      else close(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  React.useEffect(() => {
    if (!active) return;
    window.setTimeout(() => confirmButtonRef.current?.focus(), 0);
  }, [active]);

  const close = React.useCallback(
    (value: boolean) => {
      if (!active) return;
      const resolver = active.resolve;
      setActive(null);
      resolver(value);
    },
    [active],
  );

  const styles = iconStyles(active?.icon);
  const title =
    String(active?.title || '').trim() ||
    (active?.icon === 'error' ? 'Error' : active?.icon === 'warning' ? 'Confirm' : 'Message');
  const text = String(active?.text || '').trim();
  const confirmText = String(active?.confirmText || '').trim() || 'OK';
  const cancelText = String(active?.cancelText || '').trim() || 'Cancel';

  return (
    <>
      {children}
      {active ? (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 py-10 overflow-y-auto backdrop-blur-md"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close(active.showCancel ? false : true);
            }}
          >
            <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-3xl border border-border bg-bg shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className={`rounded-2xl border p-2 ${styles.wrap} ${styles.icon}`}>{iconNode(active.icon)}</div>
                  <div className="min-w-0">
                    <h4 className="text-base font-black text-text">{title}</h4>
                    <p className="mt-0.5 text-xs text-text-muted">{text}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => close(active.showCancel ? false : true)}
                  className="rounded-xl border border-border bg-surface p-2 text-text-muted hover:text-text hover:bg-white/5 transition-all"
                  aria-label="Close"
                >
                  <Icons.X className="size-4" />
                </button>
              </div>

              <div className="px-6 py-5 flex justify-end gap-2">
                {active.showCancel ? (
                  <button
                    type="button"
                    onClick={() => close(false)}
                    className="rounded-2xl border border-border bg-surface px-4 py-2 text-sm font-black text-text hover:bg-white/10 transition-all"
                  >
                    {cancelText}
                  </button>
                ) : null}
                <button
                  ref={confirmButtonRef}
                  type="button"
                  onClick={() => close(true)}
                  className="rounded-2xl bg-primary px-4 py-2 text-sm font-black text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}

