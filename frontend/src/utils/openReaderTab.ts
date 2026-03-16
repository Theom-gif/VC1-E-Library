type OpenReaderTabArgs = {
  title: string;
  url: string;
};

// Use explicit Unicode escapes to avoid mojibake on systems that read files as non-UTF8.
const APP_TAB_TITLE = '\u1782\u1798\u17d2\u1787\u17b8_Elibrary';

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function openReaderTab({title, url}: OpenReaderTabArgs) {
  const safeTitle = escapeHtml(title || 'Reader');
  const safeAppTitle = escapeHtml(APP_TAB_TITLE);
  const safeUrl = escapeHtml(url);

  const tab = window.open('', '_blank');
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
    <style>
      html, body { height: 100%; margin: 0; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Apple Color Emoji", "Segoe UI Emoji"; background: #0b1220; color: #e5e7eb; }
      .bar { padding: 10px 14px; background: #111827; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .title { font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      a { color: #22d3ee; text-decoration: none; font-weight: 600; font-size: 12px; }
      a:hover { text-decoration: underline; }
      .frame { width: 100%; height: calc(100% - 44px); border: 0; background: #0b1220; }
      .fallback { padding: 16px; font-size: 13px; color: #cbd5e1; }
    </style>
  </head>
  <body>
    <script>try{window.opener=null;}catch(e){}</script>
    <div class="bar">
      <div class="title" title="${safeTitle}">${safeTitle}</div>
      <a href="${safeUrl}" target="_blank" rel="noreferrer noopener">Open file</a>
    </div>
    <iframe class="frame" src="${safeUrl}" title="${safeTitle}"></iframe>
    <noscript>
      <div class="fallback">JavaScript is required to display this document. <a href="${safeUrl}">Open file</a></div>
    </noscript>
  </body>
</html>`);
    tab.document.close();
  } catch {
    tab.location.href = url;
  }
}
