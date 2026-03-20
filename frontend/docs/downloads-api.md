# Download Backend Guide

This document explains the backend contract for the download flow implemented in:

- `frontend/src/context/DownloadContext.tsx`
- `frontend/src/service/bookService.ts`
- `frontend/src/offline/downloadsDb.ts`
- `frontend/src/utils/openReaderTab.ts`

The frontend stores downloaded files on the device with IndexedDB. The backend does **not** need to store the downloaded bytes per user session unless you want analytics or audit logs.

## What the frontend does

When a user downloads a book, the UI does this:

1. Calls `POST /api/books/{id}/download`
2. Reads a file URL from the JSON response
3. Downloads the file with `fetch()`
4. Tracks progress from the response stream
5. Stores the blob locally in IndexedDB
6. Opens the stored blob later in a new tab for offline reading

Important consequence:

- The backend is responsible for resolving a valid file URL
- The actual file response should include useful headers
- The frontend currently supports **pause/cancel/retry from the beginning**
- The frontend does **not** implement byte-range resume yet

## Minimum required endpoints

### `GET /api/books`

Purpose:

- Show only downloadable, approved books in the reader UI

Minimum fields used by the frontend:

```json
{
  "id": 123,
  "title": "Love Never Fails",
  "author_name": "Alex Rivera",
  "category_name": "Education",
  "cover_image_url": "https://api.example.com/storage/books/covers/123.png",
  "status": "approved"
}
```

Accepted field variants:

- `author_name` or `author`
- `category_name` or `category`
- `cover_image_url`, `cover_url`, `cover`, or `cover_image_path`

Recommended response:

```json
{
  "success": true,
  "message": "Approved books retrieved successfully.",
  "data": [
    {
      "id": 123,
      "title": "Love Never Fails",
      "author_name": "Alex Rivera",
      "category_name": "Education",
      "cover_image_url": "https://api.example.com/storage/books/covers/123.png",
      "status": "approved"
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "per_page": 15,
    "total": 1
  }
}
```

Notes:

- Return only approved books for public reader browsing
- `per_page` is used by the frontend
- The current frontend prefers `GET /api/books`
- `GET /api/auth/books` is treated only as a legacy fallback

### `POST /api/books/{id}/download`

Purpose:

- Resolve the real file URL for a book download

This endpoint is required by `DownloadContext.startDownload()`.

The frontend accepts any of these fields:

- `download_url`
- `stream_url`
- `url`

Those fields may be returned either at the top level or inside `data`.

Recommended response:

```json
{
  "success": true,
  "message": "Download link generated successfully.",
  "data": {
    "download_url": "/storage/books/pdfs/love-never-fails.pdf",
    "mime_type": "application/pdf",
    "file_name": "Love Never Fails.pdf",
    "size_bytes": 15623012
  }
}
```

Also accepted by the frontend:

```json
{
  "download_url": "/storage/books/pdfs/love-never-fails.pdf"
}
```

Behavior expectations:

- Return `404` if the book does not exist
- Return `403` or `404` for books that are not approved for the reader
- Return a usable public URL, signed URL, or same-origin storage URL

## File delivery requirements

After the resolver endpoint returns a URL, the frontend performs:

`GET {download_url}`

That file request should work directly in the browser.

Recommended headers:

- `Content-Type: application/pdf` or `application/epub+zip`
- `Content-Length: <bytes>`
- `Content-Disposition: inline; filename="Love Never Fails.pdf"`

Why these matter:

- `Content-Length` allows the UI to show an accurate percent complete
- `Content-Disposition` lets the frontend infer a friendly filename
- `Content-Type` is stored with the offline blob and helps with later opening

If `Content-Length` is missing:

- The download still works
- Progress percentage may stay indeterminate

## Auth behavior

The resolver request uses the shared API client, so it automatically sends:

```http
Authorization: Bearer <token>
```

when `localStorage.token` exists.

The actual file fetch behaves differently:

- The frontend only attaches `Authorization: Bearer <token>` when the returned file URL is the **same origin** as `VITE_API_BASE_URL`
- If you return a cross-origin file URL, it should be public or already signed

Best backend choices:

1. Return a relative same-origin URL like `/storage/books/pdfs/file.pdf`
2. Or return a pre-signed S3 / CloudFront / CDN URL

Avoid:

- Cross-origin private file URLs that still require the bearer token

## CORS and exposed headers

If the file URL is cross-origin, configure CORS so browser `fetch()` can read the response.

Recommended:

```http
Access-Control-Allow-Origin: <frontend-origin>
Access-Control-Expose-Headers: Content-Length, Content-Disposition, Content-Type
```

Without `Access-Control-Expose-Headers`, the frontend may download successfully but not be able to read the size or filename metadata.

## Approval and safety rules

Recommended backend rules:

- `/api/books` returns only approved books
- `/api/books/{id}/download` allows only approved books for reader-facing access
- Unapproved, rejected, or soft-deleted books should not produce valid public download URLs

Recommended statuses:

- `404` when the book id does not exist
- `403` when the user is authenticated but not allowed
- `401` when auth is required and the token is missing or invalid

## Current frontend capabilities

The backend team should know these current limits:

- Pause works by aborting the current request
- Resume restarts the download from the beginning
- Offline files are stored only on the current device
- Removing a download deletes only the local IndexedDB copy
- The backend does not currently need endpoints for:
  - download progress updates
  - pause state sync
  - resume offsets
  - offline library listing

## Optional backend extensions

These are not required today, but would fit the frontend well later:

### `GET /api/downloads`

Purpose:

- Return server-side download history / analytics if you want cross-device history

### `POST /api/books/{id}/downloads`

Purpose:

- Record that a download started or completed

This is optional because the current frontend already works without it.

## Laravel implementation notes

If you store files with Laravel:

1. Save the PDF path in storage
2. Run `php artisan storage:link`
3. Return `Storage::url($path)` or a signed file URL

For same-origin behavior, a response like this works well:

```php
return response()->json([
    'success' => true,
    'data' => [
        'download_url' => Storage::url($book->pdf_path),
        'mime_type' => $book->pdf_mime_type ?? 'application/pdf',
        'file_name' => ($book->title ?? 'book') . '.pdf',
        'size_bytes' => $book->file_size_bytes,
    ],
]);
```

## Backend checklist

- `GET /api/books` returns approved books only
- `POST /api/books/{id}/download` returns `download_url`, `stream_url`, or `url`
- The returned file URL is reachable by browser `fetch()`
- File response includes `Content-Type`
- File response includes `Content-Length` when possible
- File response includes `Content-Disposition` when possible
- Cross-origin file responses expose `Content-Length`, `Content-Disposition`, and `Content-Type`
- Non-approved books do not leak downloadable URLs
