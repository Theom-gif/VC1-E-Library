# Authors Page Backend Guide

This document explains the backend contract used by:

- `frontend/src/pages/Authors.tsx`
- `frontend/src/service/authorService.ts`

Use this with root `BACKEND_API.md`.

## What the Authors page does

The Authors page:

- Calls `GET /api/authors` with query params:
  - `q` (search keyword, optional)
  - `per_page` (currently `60`)
  - `page` (optional)
- Displays author cards with:
  - name
  - bio
  - photo
  - books count
  - average rating
  - followers

## Required endpoint

### `GET /api/authors`

Recommended as a **public** endpoint so authors can be browsed without login.

#### Query parameters

- `q` (optional): search by author name/bio
- `page` (optional): for pagination
- `per_page` (optional): page size

#### Recommended response

```json
{
  "success": true,
  "data": [
    {
      "id": "a_1",
      "name": "Emily St. John Mandel",
      "bio": "Award-winning novelist...",
      "photo": "https://example.com/storage/authors/emily.jpg",
      "followers": 12400,
      "avg_rating": 4.8,
      "books_count": 9
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "per_page": 60,
    "total": 1
  }
}
```

The frontend is tolerant and can also read these list shapes:

- `{ data: [...] }`
- `{ data: { data: [...] } }`
- `{ authors: [...] }`
- bare array `[...]`

## Author field mapping in frontend

`authorService` maps these backend aliases:

- `id`: `id` or `author_id` or `slug`
- `name`: `name` or `author_name` or `title`
- `bio`: `bio` or `description`
- `photo`: `photo` or `avatar` or `image_url`
- `avg_rating`: `avg_rating` or `average_rating`
- `books_count`: `books_count` or `book_count`

## Image URL behavior

For `photo`:

- absolute URL (`https://...`) works directly
- `data:` URL works directly
- relative paths are normalized against `VITE_API_URL` / `VITE_API_BASE_URL`

Examples:

- `/storage/authors/emily.jpg`
- `storage/authors/emily.jpg`

## Fallback behavior (important)

If `GET /api/authors` returns status `401`, `403`, `404`, or `405`, frontend falls back to deriving authors from `GET /api/books`.

That fallback keeps the page usable, but it has limitations:

- generic bios
- no real followers/photo unless available in books data
- less accurate author metadata

To avoid fallback mode, implement `GET /api/authors` with `200` and a proper list.

## Optional detail endpoints

Not required for the Authors list page itself, but useful for details pages:

- `GET /api/authors/{id}`
- `GET /api/authors/by-name/{name}`

