# Follow Author API (Backend Guide)

This document describes recommended backend endpoints for the **Follow Author** feature.

Frontend UI references:

- `frontend/src/pages/BookDetails.tsx` (Follow button near the author name)
- `frontend/src/pages/AuthorDetails.tsx` (Follow Author button on the author profile header)

## Auth

Follow/unfollow is user-specific, so it should require:

```http
Authorization: Bearer <token>
```

## Concepts

- A "follow" is a relationship between the authenticated user and an author.
- Authors can be represented by an `authors` table (recommended), or by user accounts with `role=author`.
- The UI needs:
  - `followers_count` (to display the author’s follower count)
  - `is_following` (to render Follow vs Following)

## Recommended endpoints

### 1) Follow an author

`POST /api/authors/{authorId}/follow`

Response (recommended):

```json
{
  "success": true,
  "data": {
    "author_id": "a_1",
    "is_following": true,
    "followers_count": 12401
  }
}
```

Notes:

- Idempotent: returning `200` if already following is fine.
- If the author does not exist: return `404`.

### 2) Unfollow an author

`DELETE /api/authors/{authorId}/follow`

Response (recommended):

```json
{
  "success": true,
  "data": {
    "author_id": "a_1",
    "is_following": false,
    "followers_count": 12400
  }
}
```

Notes:

- Idempotent: returning `200` even if not following is fine.

### 3) List authors the current user follows

`GET /api/me/following/authors`

Recommended response (return author cards directly so the UI can render without extra calls):

```json
{
  "success": true,
  "data": [
    {
      "id": "a_1",
      "name": "Emily St. John Mandel",
      "photo": "https://example.com/storage/authors/emily.jpg",
      "followers_count": 12400,
      "is_following": true
    }
  ],
  "meta": { "current_page": 1, "last_page": 1, "per_page": 20, "total": 1 }
}
```

### 4) Get author details (include follow state)

If you already expose `GET /api/authors/{id}`, include follow state when authenticated:

`GET /api/authors/{authorId}`

Recommended fields (additive; keep your existing shape):

```json
{
  "success": true,
  "data": {
    "id": "a_1",
    "name": "Emily St. John Mandel",
    "bio": "...",
    "photo": "https://example.com/storage/authors/emily.jpg",
    "followers_count": 12400,
    "is_following": true
  }
}
```

## Notifications (optional)

If you support role-based notifications (see `frontend/docs/NOTIFICATIONS_API.md`), consider emitting an author notification when someone follows:

- Audience: `author`
- Type: `system` or `goal`
- Message: `"Alex Johnson followed you."`

## Suggested database schema (Laravel example)

Table: `author_follows`

- `id`
- `user_id` (follower)
- `author_id`
- `created_at`, `updated_at`

Constraints:

- Unique index: `(user_id, author_id)`

