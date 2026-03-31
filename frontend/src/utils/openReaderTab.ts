import readingSessionService, {type ReadingSessionSource} from '../service/readingSessionService';
import {readStoredAuthToken} from './authToken';

type OpenReaderTabArgs = {
  title: string;
  url: string;
  tab?: Window | null;
  mimeType?: string;
  fileName?: string;
  tracking?: {
    bookId: string;
    source: ReadingSessionSource;
  };
};

// Use explicit Unicode escapes to avoid mojibake on systems that read files as non-UTF8.
const APP_TAB_TITLE = '\u1782\u1798\u17d2\u1796\u17b8-ELibrary';
const FAVICON_SRC = `${import.meta.env.BASE_URL}favicon.svg?v=1`;
const APP_HOME_HREF = String(import.meta.env.BASE_URL || '/');

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readToken(): string | null {
  return readStoredAuthToken();
}

function wireReadingTracking(
  tab: Window,
  tracking: {bookId: string; source: ReadingSessionSource},
  trackingId: string,
) {
  if (!tracking?.bookId || !readToken()) return;

  let sessionId = '';
  let lastHeartbeatAt = Date.now();
  let finished = false;
  let isStarting = false;

  const cleanup = () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', onMessage);
    }
    window.clearInterval(closePollId);
  };

  const startSession = async () => {
    if (sessionId || finished || isStarting) return;
    isStarting = true;
    try {
      const response = await readingSessionService.start({
        book_id: tracking.bookId,
        started_at: new Date().toISOString(),
        source: tracking.source,
      });
      sessionId = response.sessionId;
      lastHeartbeatAt = Date.now();
    } catch {
      cleanup();
    } finally {
      isStarting = false;
    }
  };

  const sendHeartbeat = async () => {
    if (!sessionId || finished) return;
    const now = Date.now();
    const secondsSinceLastPing = Math.max(1, Math.min(60, Math.round((now - lastHeartbeatAt) / 1000) || 30));
    lastHeartbeatAt = now;
    try {
      await readingSessionService.heartbeat(sessionId, {
        occurred_at: new Date(now).toISOString(),
        seconds_since_last_ping: secondsSinceLastPing,
      });
    } catch {
      // Ignore heartbeat failures so reading stays usable even if analytics is unavailable.
    }
  };

  const finishSession = async () => {
    if (!sessionId || finished) {
      cleanup();
      return;
    }
    finished = true;
    try {
      await readingSessionService.finish(sessionId, {
        ended_at: new Date().toISOString(),
      });
    } catch {
      // Ignore finish failures to avoid blocking the reader close flow.
    } finally {
      cleanup();
    }
  };

  const onMessage = (event: MessageEvent) => {
    if (event.source !== tab) return;
    const payload = event.data;
    if (!payload || payload.source !== 'elibrary-reader' || payload.trackingId !== trackingId) return;
    if (payload.type === 'heartbeat') {
      void sendHeartbeat();
      return;
    }
    if (payload.type === 'closed') {
      void finishSession();
    }
  };

  const closePollId = window.setInterval(() => {
    if (!tab.closed) return;
    void finishSession();
  }, 2000);

  if (typeof window !== 'undefined') {
    window.addEventListener('message', onMessage);
  }

  void startSession();
}

export function openReaderTab({title, url, tracking, tab: providedTab, mimeType, fileName}: OpenReaderTabArgs) {
  const safeTitle = escapeHtml(title || 'Reader');
  const safeAppTitle = escapeHtml(APP_TAB_TITLE);
  const safeFaviconSrc = escapeHtml(FAVICON_SRC);
  const safeHomeHref = escapeHtml(APP_HOME_HREF);
  const safeUrl = escapeHtml(url);
  const trackingId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const safeTrackingId = escapeHtml(trackingId);
  const normalizedMime = String(mimeType || '').trim().toLowerCase();
  const normalizedFileName = String(fileName || '').trim();
  const normalizedUrl = String(url || '').trim();
  const normalizedFileNameLower = normalizedFileName.toLowerCase();
  const safeFileName = escapeHtml(normalizedFileName);

  const isBlobOrDataUrl = /^(blob:|data:)/i.test(normalizedUrl);
  const isPdf =
    normalizedMime.includes('pdf') ||
    normalizedFileNameLower.endsWith('.pdf') ||
    /\.pdf(\?|#|$)/i.test(normalizedUrl);
  const isEpub =
    normalizedMime.includes('epub') ||
    normalizedFileNameLower.endsWith('.epub') ||
    /\.epub(\?|#|$)/i.test(normalizedUrl);
  const canPreview = isPdf || (!isEpub && (normalizedMime.startsWith('text/') || normalizedMime.includes('html')));
  const showPreviewUnavailable = !canPreview && (isEpub || isBlobOrDataUrl || Boolean(normalizedMime) || Boolean(normalizedFileName));

  const tab = providedTab && !providedTab.closed ? providedTab : window.open('', '_blank');
  if (!tab) {
    throw new Error('Popup blocked. Please allow popups to open the reader.');
  }

  try {
    tab.document.open();
    tab.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeAppTitle}</title>
    <link rel="icon" type="image/svg+xml" href="${safeFaviconSrc}" />
    <link rel="shortcut icon" href="${safeFaviconSrc}" />
    <style>
      html, body { height: 100%; margin: 0; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Apple Color Emoji", "Segoe UI Emoji"; background: #0b1220; color: #e5e7eb; }
      .bar { padding: 10px 14px; background: #111827; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .brand img { width: 18px; height: 18px; flex: none; }
      .title { font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .actions { display: flex; align-items: center; gap: 10px; }
      a { color: #22d3ee; text-decoration: none; font-weight: 600; font-size: 12px; }
      a:hover { text-decoration: underline; }
      button { appearance: none; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.06); color: #e5e7eb; border-radius: 10px; padding: 7px 10px; font-weight: 800; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; }
      button:hover { background: rgba(255,255,255,0.10); border-color: rgba(34,211,238,0.35); }
      .frame { width: 100%; height: calc(100% - 44px); border: 0; background: #0b1220; }
      .fallback { padding: 16px; font-size: 13px; color: #cbd5e1; }
    </style>
  </head>
  <body>
    <div class="bar">
      <div class="brand">
        <img src="${safeFaviconSrc}" alt="" aria-hidden="true" />
        <div class="title" title="${safeTitle}">${safeTitle}</div>
      </div>
      <div class="actions">
        <button id="elibrary-back" type="button" aria-label="Back to eLibrary">Back</button>
        <a href="${safeUrl}" target="_blank" rel="noreferrer noopener">Open file</a>
      </div>
    </div>
    ${
      showPreviewUnavailable
        ? `<div class="fallback">
            <div style="font-weight:700;margin-bottom:6px;">Preview not available in-browser.</div>
            <div style="color:#94a3b8;line-height:1.5;">
              ${isEpub ? 'This looks like an EPUB file.' : 'This file type may not be supported for preview.'}
              ${safeFileName ? ` File: <span style="color:#e5e7eb">${safeFileName}</span>.` : ''}
              Use <strong>Open file</strong> to download/open it with an external reader app.
            </div>
          </div>`
        : `<iframe class="frame" src="${safeUrl}" title="${safeTitle}"></iframe>`
    }
    <script>
      (function () {
        var trackingId = "${safeTrackingId}";
        var homeHref = "${safeHomeHref}";
        var backBtn = document.getElementById("elibrary-back");
        if (backBtn) {
          backBtn.addEventListener("click", function () {
            try {
              if (window.opener && !window.opener.closed) {
                try {
                  window.opener.postMessage({ source: "elibrary-reader", type: "navigate-home" }, "*");
                } catch (error) {}
                try {
                  window.opener.location.href = homeHref || "/";
                } catch (error) {}
                try { window.opener.focus(); } catch (error) {}
                try { window.close(); } catch (error) {}
                return;
              }
            } catch (error) {}
            try { window.location.href = homeHref || "/"; } catch (error) {}
          });
        }
        var timer = null;
        function post(type) {
          try {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ source: "elibrary-reader", trackingId: trackingId, type: type }, "*");
            }
          } catch (error) {}
        }
        function isActive() {
          try {
            return document.visibilityState === "visible" && document.hasFocus();
          } catch (error) {
            return true;
          }
        }
        function stopTimer() {
          if (timer) {
            clearInterval(timer);
            timer = null;
          }
        }
        function startTimer() {
          stopTimer();
          if (!isActive()) return;
          timer = setInterval(function () {
            if (!isActive()) return;
            post("heartbeat");
          }, 30000);
        }
        startTimer();
        window.addEventListener("focus", startTimer);
        window.addEventListener("blur", stopTimer);
        document.addEventListener("visibilitychange", function () {
          if (isActive()) startTimer();
          else stopTimer();
        });
        window.addEventListener("beforeunload", function () {
          stopTimer();
          post("closed");
        });
      })();
    </script>
    <noscript>
      <div class="fallback">JavaScript is required to display this document. <a href="${safeUrl}">Open file</a></div>
    </noscript>
  </body>
</html>`);
    tab.document.close();
    if (tracking) {
      wireReadingTracking(tab, tracking, trackingId);
    }
  } catch {
    tab.location.href = url;
  }
}
