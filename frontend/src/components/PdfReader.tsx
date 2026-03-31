import React from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type PdfReaderProps = {
  src: string;
  title: string;
  onClose: () => void;
};

type PdfDocument = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;

let activeRenderTask: {cancel: () => void} | null = null;

export default function PdfReader({src, title, onClose}: PdfReaderProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const docRef = React.useRef<PdfDocument | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [rendering, setRendering] = React.useState(false);
  const [error, setError] = React.useState('');
  const [pageNumber, setPageNumber] = React.useState(1);
  const [pageCount, setPageCount] = React.useState(0);
  const [viewportWidth, setViewportWidth] = React.useState(() => (typeof window !== 'undefined' ? window.innerWidth : 0));

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setViewportWidth(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setRendering(false);
    setError('');
    setPageNumber(1);
    setPageCount(0);

    if (activeRenderTask) {
      try {
        activeRenderTask.cancel();
      } catch {
        // ignore
      }
      activeRenderTask = null;
    }

    const loadingTask = pdfjsLib.getDocument({url: src, withCredentials: true});

    void loadingTask.promise
      .then((doc) => {
        if (!alive) {
          void doc.destroy();
          return;
        }
        docRef.current = doc;
        setPageCount(doc.numPages);
        setLoading(false);
      })
      .catch((err: any) => {
        if (!alive) return;
        setError(err?.message || 'Unable to open this book.');
        setLoading(false);
      });

    return () => {
      alive = false;
      if (activeRenderTask) {
        try {
          activeRenderTask.cancel();
        } catch {
          // ignore
        }
        activeRenderTask = null;
      }
      const doc = docRef.current;
      docRef.current = null;
      if (doc) {
        void doc.destroy();
      }
      loadingTask.destroy();
    };
  }, [src]);

  const renderPage = React.useCallback(async () => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || !viewportWidth || loading || error) return;

    const page = await doc.getPage(pageNumber);
    const baseViewport = page.getViewport({scale: 1});
    const maxWidth = Math.max(320, viewportWidth - 24);
    const scale = Math.max(0.5, Math.min(3, maxWidth / baseViewport.width));
    const dpr = typeof window !== 'undefined' ? Math.max(1, window.devicePixelRatio || 1) : 1;
    const viewport = page.getViewport({scale: scale * dpr});
    const context = canvas.getContext('2d', {alpha: false});
    if (!context) {
      throw new Error('Canvas is not available.');
    }

    if (activeRenderTask) {
      try {
        activeRenderTask.cancel();
      } catch {
        // ignore
      }
      activeRenderTask = null;
    }

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

    setRendering(true);
    const task = page.render({canvasContext: context, viewport});
    activeRenderTask = task;
    try {
      await task.promise;
    } finally {
      if (activeRenderTask === task) activeRenderTask = null;
      setRendering(false);
    }
  }, [error, loading, pageNumber, viewportWidth]);

  React.useEffect(() => {
    if (!docRef.current || loading || error) return;
    void renderPage();
  }, [error, loading, pageNumber, renderPage, viewportWidth]);

  const canGoPrev = pageNumber > 1;
  const canGoNext = pageNumber < pageCount;

  return (
    <div className="fixed inset-0 z-[220] flex h-[100dvh] w-[100dvw] flex-col bg-[#0b1220] text-white">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#111827] px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400">Reading</p>
          <h2 className="truncate text-sm font-bold text-white">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/90"
        >
          Close
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto px-3 py-3">
        {error ? (
          <div className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
            <div>
              <p className="text-lg font-bold text-white">Could not open this book.</p>
              <p className="mt-2 text-sm text-white/70">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-[#0b1220]"
              >
                Close Reader
              </button>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4">
            {loading ? (
              <div className="flex w-full items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-10 text-sm text-white/70">
                Loading reader...
              </div>
            ) : null}
            <canvas ref={canvasRef} className={`max-w-full rounded-2xl bg-white shadow-2xl ${loading ? 'hidden' : 'block'}`} />
            {rendering ? <p className="text-xs text-white/60">Rendering page {pageNumber} of {pageCount || '...'}</p> : null}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-[#111827] px-4 py-3">
        <button
          type="button"
          onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
          disabled={!canGoPrev || loading}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          Prev
        </button>
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">Page</p>
          <p className="text-sm font-bold text-white">
            {pageCount ? `${pageNumber} / ${pageCount}` : '0 / 0'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPageNumber((current) => Math.min(pageCount || current, current + 1))}
          disabled={!canGoNext || loading}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
