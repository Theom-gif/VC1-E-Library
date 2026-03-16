# Downloads UI → Backend endpoints

This document describes what the **Downloads** page needs from the backend.

The frontend stores offline files on the **device** using IndexedDB (no backend DB storage for downloaded bytes).

## Flow (what the UI does)

1) User clicks **Download** on a book.
2) Frontend calls a **download resolver** endpoint to get a `download_url`.
3) Frontend `fetch()`es the returned file URL and:
   - shows progress (needs `Content-Length`)
   - stores the bytes offline (IndexedDB)
4) User opens the book offline (Blob URL opened in a new tab).

## Required endpoints

### 1) List books (approved only)

`GET /api/books`

Return only admin-approved books for reader users.

Minimal fields used by the UI:
- `id`
- `title`
- `author_name` (or `author`)
- `cover_image_url` (optional; if missing, UI shows **No cover**)

Example:
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "title": "Love never fails",
      "author_name": "Alex Rivera",
      "status": "approved",
      "cover_image_url": "https://api.example.com/storage/covers/123.jpg"
    }
  ]
}
```

### 2) Resolve a downloadable file URL (used for download + read)

`POST /api/books/{id}/download`

The response must include one of:
- `download_url` (recommended)
- `stream_url`
- `url`

Recommended response:
```json
{
  "success": true,
  "data": {
    "download_url": "/storage/books/123.pdf",
    "mime_type": "application/pdf",
    "file_name": "Love never fails.pdf",
    "size_bytes": 15623012
  }
}
```

Auth:
- If your API is protected, accept `Authorization: Bearer <token>`.

Important:
- The frontend only attaches the Bearer token to the **file fetch** if the `download_url` is **same-origin** as `VITE_API_BASE_URL`.
  - Best: return a **relative URL** like `/storage/books/123.pdf`.
  - If you return S3/CloudFront/etc, return a **public or signed** URL that does not require the Bearer token.

### 3) Serve the actual book file

`GET {download_url}`

The browser fetch must work (CORS if needed).

Headers required/recommended:
- `Content-Type`: `application/pdf` or `application/epub+zip`
- `Content-Length`: required for accurate progress percentage
- `Content-Disposition`: recommended for filename
  - `inline; filename="Love never fails.pdf"`

If the file is cross-origin, expose headers:
- `Access-Control-Expose-Headers: Content-Length, Content-Disposition, Content-Type`

## Covers (important for Downloads cards)

Cover image URLs are used directly in `<img src="...">`.

Recommended:
- Covers should be **public** (no Bearer token required), or use signed public URLs.
- For Laravel storage: create the symlink and return `Storage::url($path)`:
  - `php artisan storage:link`

## Approval rules (backend)

Recommended behavior:
- `/api/books` returns only approved books.
- `/api/books/{id}/download` returns `403` or `404` for non-approved books.

