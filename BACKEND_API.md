# E-Library Backend API (Endpoint Guide)

This repo currently contains the **frontend UI** in `frontend/`. The UI is wired to call a backend API via `VITE_API_BASE_URL` (see `frontend/src/service/apiClient.ts`).

This document is a **backend developer guide**: which endpoints to build (grouped by feature), the request/response shapes that work well with the existing frontend code, and the minimum set needed to replace mock data (`MOCK_BOOKS`, `NEW_ARRIVALS` in `frontend/src/types.ts`).

## Base URL + CORS

- Base URL: `http://<host>:8000`
- Frontend dev server: `http://localhost:3000` (Vite script uses port 3000)
- Enable CORS for the frontend origin(s), and allow `Authorization` header.

### Production API note (observed)

If you point the frontend to `https://elibrary.pncproject.site`, `GET /api/books` returns an envelope like:

```json
{
  "success": true,
  "message": "Approved books retrieved successfully.",
  "data": [],
  "meta": { "current_page": 1, "last_page": 1, "per_page": 15, "total": 0 }
}
```

## Auth (Bearer token)

The frontend automatically sends `Authorization: Bearer <token>` when `localStorage.token` exists (`frontend/src/service/apiClient.js`).

### Response conventions (recommended)

- Success: JSON object (or `{ data: ... }`)
- Validation error (recommended): status `422`
  - `{ "message": "Validation error", "errors": { "email": ["..."], "password": ["..."] } }`
- Auth error: status `401`
  - `{ "message": "Unauthenticated" }`

The frontend login/register code is tolerant, but this is the cleanest response shape:

```json
{
  "token": "jwt_or_api_token_here",
  "user": {
    "id": "1",
    "firstname": "Alex",
    "lastname": "Johnson",
    "email": "alex@example.com",
    "role": "user"
  }
}
```

### Endpoints

- `POST /api/auth/login`
  - Body: `{ "email": "user@example.com", "password": "secret" }`
  - Optional accepted fields (frontend may send these): `role`, `role_id`
- `POST /api/auth/register` (commonly used)
  - Body: `{ "firstname": "...", "lastname": "...", "email": "...", "password": "...", "password_confirmation": "...", "role": "user" }`
  - Optional accepted fields: `role_id` (numeric)
- `GET /api/me` (optional but recommended)
  - Returns the current authenticated user
- `POST /api/logout` (optional)
  - Can revoke token; frontend also supports client-side logout

## Books

The UI needs: list books, book details, similar books, and download link/stream.

### Endpoints

- `GET /api/books`
  - Query (recommended):
    - `q`: search text (title/author/category)
    - `category`: category id or name
    - `page`, `per_page`
    - `sort`: `newest | rating | popular`
  - Response (recommended):
    - `{ "data": [Book], "meta": { "page": 1, "per_page": 20, "total": 123 } }`
- `GET /api/books/{id}`
  - Response: `{ "data": Book }` (or the book object directly)
- `GET /api/books/{id}/similar` (optional)
  - Response: `{ "data": [Book] }`
- `POST /api/books/{id}/download` (recommended)
  - Response:
    - `{ "download_url": "https://..." }` (pre-signed URL), or
    - `{ "stream_url": "https://..." }`

### Book model (align with frontend `BookType`)

Minimum fields used everywhere:

```json
{
  "id": "1",
  "title": "The Great Gatsby",
  "author": "F. Scott Fitzgerald",
  "cover": "https://...",
  "category": "Classic",
  "rating": 4.8
}
```

Optional (already supported in UI types):

- `description`, `pages`, `reviews`
- Reading state: `progress` (0–100), `status` (`Want to Read` / `Currently Reading` / `Completed`)
- Download UI: `size`, `downloadProgress`, `speed`

## Categories

The current UI shows a category sidebar and filters books by category.

### Endpoints

- `GET /api/categories`
  - Response (recommended): `{ "data": [Category] }`
- `GET /api/categories/{id}`
  - Response: `{ "data": Category }`
- `GET /api/categories/{id}/books`
  - Query: `page`, `per_page`, `q`
  - Response: `{ "data": [Book], "meta": ... }`

### Category model

```json
{
  "id": "10",
  "name": "Sci-Fi",
  "book_count": 210
}
```

## Authors

The current UI navigates using the **author name** string (`frontend/src/pages/AuthorDetails.tsx`). For a robust backend, consider adding `author_id` to books and navigating by id; until then you can support lookup-by-name.

### Endpoints

- `GET /api/authors`
  - Query: `q`, `page`, `per_page`
  - Response: `{ "data": [Author], "meta": ... }`
- `GET /api/authors/{id}` (recommended)
  - Response: `{ "data": Author }`
- `GET /api/authors/by-name/{name}` (optional helper for the current UI)
  - Response: `{ "data": Author }`

### Author model

```json
{
  "id": "a_1",
  "name": "Emily St. John Mandel",
  "bio": "...",
  "photo": "https://...",
  "followers": 12400,
  "avg_rating": 4.8
}
```

## Favorites

The Favorites page is currently mock-only, but the UI has a clear path to an API.

### Endpoints

- `GET /api/favorites`
  - Response: `{ "data": [Book] }`
- `POST /api/favorites`
  - Body: `{ "book_id": "1" }`
- `DELETE /api/favorites/{book_id}`

## Reviews / Comments

`frontend/src/pages/BookDetails.tsx` displays reviews/comments with rating, likes, and edit support.

### Endpoints

- `GET /api/books/{book_id}/reviews`
  - Query: `page`, `per_page`, `sort` (`newest|top`)
  - Response: `{ "data": [Review], "meta": ... }`
- `POST /api/books/{book_id}/reviews`
  - Body: `{ "text": "....", "rating": 5 }`
- `PATCH /api/reviews/{id}`
  - Body: `{ "text": "..." }`
- `DELETE /api/reviews/{id}`
- `POST /api/reviews/{id}/like` / `POST /api/reviews/{id}/unlike` (optional)

### Review model

```json
{
  "id": "r_1",
  "user": { "id": "1", "name": "Sarah Miller", "avatar": "https://..." },
  "text": "Absolutely loved it...",
  "rating": 5,
  "likes": 24,
  "replies": 12,
  "created_at": "2026-03-14T10:00:00Z"
}
```

## Downloads

The Downloads page is currently mock-only; if you want server-side tracking:

### Endpoints

- `GET /api/downloads`
  - Response: `{ "data": [Download] }`
- `POST /api/books/{book_id}/downloads`
  - Response: `{ "data": Download }`
- `PATCH /api/downloads/{id}`
  - Body: `{ "status": "paused" | "downloading" | "canceled" }`
- `DELETE /api/downloads/{id}`

## Notifications

### Endpoints

- `GET /api/notifications`
  - Response: `{ "data": [Notification] }`
- `POST /api/notifications/read-all`
- `PATCH /api/notifications/{id}/read`
- `DELETE /api/notifications/{id}`

## Profile / Settings

### Endpoints

- `PATCH /api/me`
  - Body: `{ "name": "...", "photo": "https://..." }` (extend as needed)
- `PATCH /api/me/settings`
  - Body: `{ "automatic_downloads": true, "reading_reminders": true, "public_profile": false, "theme": "dark" }`

## Search

You can implement search via `GET /api/books?q=...` or a dedicated endpoint:

- `GET /api/search`
  - Query: `q`, `page`, `per_page`
  - Response: `{ "data": { "books": [Book], "authors": [Author], "categories": [Category] } }`

## Minimum viable backend (to start integrating)

If you want the frontend to start replacing mocks with real data quickly, implement these first:

1. Auth: `POST /api/auth/login`, `POST /api/auth/user_registration`
2. Books: `GET /api/books`, `GET /api/books/{id}`
3. Categories: `GET /api/categories`
