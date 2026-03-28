import * as React from 'react';
import {API_BASE_URL} from '../service/apiClient';
import defaultAvatarUrl from '../test/defaultAvatar';

type AvatarImageProps = {
  src: string;
  alt: string;
  className?: string;
  title?: string;
  fallbackSrc?: string;
};

function safeUrl(input: string, base: string): URL | null {
  try {
    return new URL(input, base);
  } catch {
    return null;
  }
}

function toggleStorageInPath(url: URL): URL | null {
  const path = url.pathname || '/';
  const normalized = path.startsWith('/') ? path : `/${path}`;

  if (normalized.startsWith('/storage/')) {
    const next = normalized.replace(/^\/storage\//, '/');
    const u = new URL(url.toString());
    u.pathname = next;
    return u;
  }

  const u = new URL(url.toString());
  u.pathname = `/storage${normalized}`;
  return u;
}

function readToken(): string | null {
  try {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('accessToken') ||
      localStorage.getItem('auth_token');
    const normalized = String(token ?? '').trim();
    return normalized || null;
  } catch {
    return null;
  }
}

export default function AvatarImage({src, alt, className, title, fallbackSrc}: AvatarImageProps) {
  const fallback = String(fallbackSrc || defaultAvatarUrl || '').trim();
  const raw = String(src || '').trim();

  const [currentSrc, setCurrentSrc] = React.useState(raw || fallback);
  const objectUrlRef = React.useRef<string | null>(null);
  const triedRef = React.useRef({toggledStorage: false, triedFallback: false, triedAuthBlob: false});

  React.useEffect(() => {
    setCurrentSrc(raw || fallback);
    triedRef.current = {toggledStorage: false, triedFallback: false, triedAuthBlob: false};
    if (objectUrlRef.current) {
      try {
        URL.revokeObjectURL(objectUrlRef.current);
      } catch {}
      objectUrlRef.current = null;
    }
  }, [fallback, raw]);

  React.useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        try {
          URL.revokeObjectURL(objectUrlRef.current);
        } catch {}
        objectUrlRef.current = null;
      }
    };
  }, []);

  const onError = () => {
    const base = String(API_BASE_URL || '').trim() || window.location.origin;
    const url = safeUrl(currentSrc, base);

    // If backend serves avatars behind auth (e.g. /api/... requires Bearer token),
    // the browser <img> request will 401. Retry via fetch() with Authorization and use a blob URL.
    if (!triedRef.current.triedAuthBlob && url) {
      const token = readToken();
      const isApiPath = url.pathname.startsWith('/api/');
      if (token && isApiPath) {
        triedRef.current.triedAuthBlob = true;
        void fetch(url.toString(), {headers: {Authorization: `Bearer ${token}`}})
          .then(async (res) => {
            if (!res.ok) throw new Error(`Avatar request failed: ${res.status}`);
            const blob = await res.blob();
            if (objectUrlRef.current) {
              try {
                URL.revokeObjectURL(objectUrlRef.current);
              } catch {}
              objectUrlRef.current = null;
            }
            objectUrlRef.current = URL.createObjectURL(blob);
            setCurrentSrc(objectUrlRef.current);
          })
          .catch(() => {
            // Fall through to other strategies on next onError.
          });
        return;
      }
    }

    if (!triedRef.current.toggledStorage && url) {
      const variant = toggleStorageInPath(url);
      const nextSrc = variant?.toString() || '';
      triedRef.current.toggledStorage = true;
      if (nextSrc && nextSrc !== currentSrc) {
        setCurrentSrc(nextSrc);
        return;
      }
    }

    if (!triedRef.current.triedFallback && fallback && currentSrc !== fallback) {
      triedRef.current.triedFallback = true;
      setCurrentSrc(fallback);
      return;
    }
  };

  // Always render an <img> so layout stays stable; if even the fallback fails,
  // the browser will show alt text (better than crashing UI).
  return <img src={currentSrc} alt={alt} className={className} title={title} loading="lazy" onError={onError} />;
}
