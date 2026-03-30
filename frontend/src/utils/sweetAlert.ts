export type SweetAlertIcon = 'success' | 'error' | 'info' | 'warning';

export type SweetAlertOptions = {
  title?: string;
  text: string;
  icon?: SweetAlertIcon;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
};

type SweetAlertPayload = SweetAlertOptions & {
  resolve: (value: boolean) => void;
};

const SWEET_ALERT_EVENT = 'elibrary:sweet-alert';
const PROVIDER_FLAG = '__ELIBRARY_SWEET_ALERT_PROVIDER__';

function firePayload(payload: SweetAlertPayload) {
  const hasProvider = typeof window !== 'undefined' && Boolean((window as any)?.[PROVIDER_FLAG]);
  if (!hasProvider) {
    if (payload.showCancel) {
      // eslint-disable-next-line no-alert
      payload.resolve(confirm(payload.text));
      return;
    }
    // eslint-disable-next-line no-alert
    alert(payload.text);
    payload.resolve(true);
    return;
  }

  window.dispatchEvent(new CustomEvent<SweetAlertPayload>(SWEET_ALERT_EVENT, {detail: payload}));
}

export function sweetAlert(text: string, options?: Omit<SweetAlertOptions, 'text' | 'showCancel'>): Promise<void> {
  return new Promise((resolve) => {
    firePayload({
      title: options?.title,
      text,
      icon: options?.icon,
      confirmText: options?.confirmText,
      cancelText: options?.cancelText,
      showCancel: false,
      resolve: () => resolve(),
    });
  });
}

export function sweetConfirm(text: string, options?: Omit<SweetAlertOptions, 'text'>): Promise<boolean> {
  return new Promise((resolve) => {
    firePayload({
      title: options?.title,
      text,
      icon: options?.icon,
      confirmText: options?.confirmText,
      cancelText: options?.cancelText,
      showCancel: options?.showCancel ?? true,
      resolve,
    });
  });
}

export function onSweetAlert(handler: (payload: SweetAlertPayload) => void) {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const custom = event as CustomEvent<SweetAlertPayload>;
    if (!custom?.detail) return;
    handler(custom.detail);
  };
  window.addEventListener(SWEET_ALERT_EVENT, listener as EventListener);
  return () => window.removeEventListener(SWEET_ALERT_EVENT, listener as EventListener);
}
