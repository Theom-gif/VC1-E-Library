# Favorites UI → Backend endpoints

This document describes the backend endpoints used for **Favorites**.

Frontend code reference:
- API client: `frontend/src/service/favoriteService.ts`

## Authentication

All favorites endpoints are expected to be **user-scoped** (return and modify favorites for the authenticated user).

Recommended:
- Require `Authorization: Bearer <token>` for all endpoints below.

## Endpoints

### 1) List favorites

`GET /api/favorites`

Recommended response (return full book objects so the UI can render cards without extra requests):
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "title": "Love never fails",
      "author_name": "Alex Rivera",
      "category_name": "Romance",
      "cover_image_url": "https://api.example.com/storage/covers/123.jpg",
      "average_rating": 4.8,
      "status": "approved"
    }
  ]
}
```

Accepted alternatives:
- Return IDs only (not recommended):
  ```json
  { "success": true, "data": [123, 456] }
  ```
  If you do this, the frontend must fetch each book separately.

Rules:
- Favorites list should only include **approved** books for reader users.
- If a favorited book becomes unapproved/deleted, return it as removed or exclude it.

### 2) Add a favorite

`POST /api/favorites`

Request body (as used by the frontend):
```json
{ "book_id": 123 }
```

Recommended responses:
- `201 Created` when added.
- `200 OK` if already exists (idempotent add).

Example:
```json
{
  "success": true,
  "message": "Added to favorites",
  "data": { "book_id": 123 }
}
```

Validation:
- `book_id` required
- Must be an existing book
- Must be **approved** for reader users (otherwise return `403` or `404`)

### 3) Remove a favorite

`DELETE /api/favorites/{bookId}`

Example:
```json
{
  "success": true,
  "message": "Removed from favorites"
}
```

Recommended behavior:
- Return `200 OK` even if it was already removed (idempotent delete).

## Covers (important for Favorites cards)

The UI uses cover URLs directly in `<img src="...">`.

Recommended:
- Covers should be **public** (no Bearer token required), or use signed public URLs.
- If no cover exists, return `cover_image_url: null` and the UI will show **No cover**.

## Suggested database schema (Laravel example)

Table: `favorites`
- `id`
- `user_id`
- `book_id`
- `created_at`, `updated_at`

Constraints:
- Unique index: `(user_id, book_id)`

