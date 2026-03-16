import * as React from 'react';
import {ImageOff} from 'lucide-react';
import {API_BASE_URL} from '../service/apiClient';

type CoverImageProps = {
  src: string;
  alt: string;
  className?: string;
  title?: string;
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

export default function CoverImage({src, alt, className, title}: CoverImageProps) {
  const [currentSrc, setCurrentSrc] = React.useState(src);
  const [isFinalFallback, setIsFinalFallback] = React.useState(!String(src || '').trim());
  const triedRef = React.useRef({toggledStorage: false});

  React.useEffect(() => {
    setCurrentSrc(src);
    setIsFinalFallback(!String(src || '').trim());
    triedRef.current = {toggledStorage: false};
  }, [src]);

  const onError = () => {
    if (isFinalFallback) return;
    const base = String(API_BASE_URL || '').trim() || window.location.origin;
    const url = safeUrl(currentSrc, base);

    if (!triedRef.current.toggledStorage && url) {
      const variant = toggleStorageInPath(url);
      const nextSrc = variant?.toString() || '';
      triedRef.current.toggledStorage = true;
      if (nextSrc && nextSrc !== currentSrc) {
        setCurrentSrc(nextSrc);
        return;
      }
    }

    setIsFinalFallback(true);
  };

  if (isFinalFallback) {
    return (
      <div
        className={`${className || ''} bg-surface border border-border text-text-muted/70 flex flex-col items-center justify-center`}
        title={title || alt}
        aria-label={alt}
      >
        <ImageOff className="size-6" />
        <span className="mt-1 text-[10px] font-bold uppercase tracking-widest">No cover</span>
      </div>
    );
  }

  return <img src={currentSrc} alt={alt} className={className} title={title} loading="lazy" onError={onError} />;
}
