# Rating And Reviews Backend Guide

This document explains the backend contract for the rating and review UI, based on:

- `frontend/src/pages/BookDetails.tsx`
- `frontend/src/service/reviewService.ts`
- `frontend/src/service/bookService.ts`
- `frontend/src/types.ts`

Use this together with the root `BACKEND_API.md`.

## What the frontend currently does

There are two rating-related UI layers today:

1. Book cards and book details show a book-level rating summary
2. Book Details shows review/comment cards with per-review ratings

Important current state:

- `BookDetails.tsx` still uses local mock comments in component state
- `reviewService.ts` already defines the backend endpoints the frontend plans to use
- Book-level rating is already read from backend-friendly fields like:
  - `rating`
  - `avg_rating`
  - `average_rating`
- Book-level review count can come from:
  - `reviews`
  - `reviews_count`

Because of that, the best backend rollout is:

1. Return correct rating summary fields on books
2. Implement review CRUD endpoints
3. Implement like/unlike endpoints for reviews
4. Wire `BookDetails.tsx` to the backend later

## Authentication

The shared API client automatically sends:

```http
Authorization: Bearer <token>
```

when `localStorage.token` exists.

Recommended auth behavior:

- `GET /api/books/{id}/reviews` can be public
- Creating, editing, deleting, liking, and unliking reviews should require auth
- Return `401` for missing or invalid tokens
- Return `403` when the user is authenticated but not allowed to edit a review they do not own

Recommended validation error format:

```json
{
  "message": "Validation error",
  "errors": {
    "rating": ["The rating must be between 1 and 5."]
  }
}
```

## Book-level rating fields

These fields are used throughout the UI for stars and summary text.

Recommended book response shape:

```json
{
  "id": 123,
  "title": "Clean Code",
  "author_name": "Robert C. Martin",
  "average_rating": 4.8,
  "reviews_count": 1204
}
```

The frontend can already read:

- `average_rating` for the displayed star value
- `reviews_count` for the review total

Recommended rules:

- Keep `average_rating` numeric
- Return a decimal like `4.8`, not a formatted string like `"4.8/5"`
- Return `reviews_count` as a number

## Minimum required endpoints

### `GET /api/books/{book_id}/reviews`

Purpose:

- Load the review list shown in Book Details

Supported query params from `reviewService.ts`:

- `page`
- `per_page`
- `sort`

Accepted sort values:

- `newest`
- `top`

Recommended response:

```json
{
  "success": true,
  "data": [
    {
      "id": "r_1",
      "user": {
        "id": "u_1",
        "name": "Sarah Miller",
        "avatar": "https://example.com/uploads/users/sarah.jpg"
      },
      "text": "Absolutely loved the character development in this one.",
      "rating": 5,
      "likes": 24,
      "replies": 12,
      "created_at": "2026-03-14T10:00:00Z",
      "can_edit": false,
      "can_delete": false,
      "liked_by_me": false
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 4,
    "per_page": 10,
    "total": 36
  }
}
```

Minimum useful fields per review:

- `id`
- `user.name`
- `user.avatar`
- `text`
- `rating`
- `likes`
- `replies`
- `created_at`

Strongly recommended optional fields:

- `can_edit`
- `can_delete`
- `liked_by_me`

### `POST /api/books/{book_id}/reviews`

Purpose:

- Create a new review for a book

Current frontend payload shape:

```json
{
  "text": "Great book.",
  "rating": 5
}
```

Recommended response:

```json
{
  "success": true,
  "message": "Review created successfully.",
  "data": {
    "id": "r_99",
    "user": {
      "id": "u_1",
      "name": "Alex Johnson",
      "avatar": "https://example.com/uploads/users/alex.jpg"
    },
    "text": "Great book.",
    "rating": 5,
    "likes": 0,
    "replies": 0,
    "created_at": "2026-03-20T12:00:00Z",
    "can_edit": true,
    "can_delete": true,
    "liked_by_me": false
  }
}
```

Recommended validation:

- `text`: required, string, 1-2000 chars
- `rating`: required, numeric or integer, between `1` and `5`

Recommended business rules:

- One user can have one review per book, or
- Allow multiple reviews if that matches your product

If you choose one-review-per-book:

- Return `409` or `422` for duplicates, or
- Treat posting again as an update

### `PATCH /api/reviews/{id}`

Purpose:

- Edit an existing review

Current frontend payload shape:

```json
{
  "text": "Updated review text",
  "rating": 4
}
```

Note:

- `reviewService.ts` allows partial payloads
- The current UI edit form in `BookDetails.tsx` only edits the text
- The backend should still allow updating both `text` and `rating`

Recommended response:

```json
{
  "success": true,
  "message": "Review updated successfully.",
  "data": {
    "id": "r_99",
    "text": "Updated review text",
    "rating": 4
  }
}
```

### `DELETE /api/reviews/{id}`

Purpose:

- Remove a review

Recommended response:

```json
{
  "success": true,
  "message": "Review deleted successfully."
}
```

### `POST /api/reviews/{id}/like`

Purpose:

- Like a review

Recommended response:

```json
{
  "success": true,
  "message": "Review liked.",
  "data": {
    "id": "r_1",
    "likes": 25,
    "liked_by_me": true
  }
}
```

### `POST /api/reviews/{id}/unlike`

Purpose:

- Remove the current user's like from a review

Recommended response:

```json
{
  "success": true,
  "message": "Review unliked.",
  "data": {
    "id": "r_1",
    "likes": 24,
    "liked_by_me": false
  }
}
```

## Suggested review model

This model fits the current and near-future UI well:

```json
{
  "id": "r_1",
  "book_id": "b_1",
  "user": {
    "id": "u_1",
    "name": "Sarah Miller",
    "avatar": "https://example.com/uploads/users/sarah.jpg"
  },
  "text": "Absolutely loved it...",
  "rating": 5,
  "likes": 24,
  "replies": 12,
  "liked_by_me": false,
  "can_edit": false,
  "can_delete": false,
  "created_at": "2026-03-14T10:00:00Z",
  "updated_at": "2026-03-14T10:00:00Z"
}
```

## Suggested book summary fields

To keep list pages and detail pages consistent, return these fields on book payloads:

```json
{
  "id": "b_1",
  "title": "Clean Code",
  "average_rating": 4.8,
  "reviews_count": 1204
}
```

UI mapping:

- `average_rating` -> book stars and numeric rating text
- `reviews_count` -> summary label like `(1,204 reviews)`

## Sorting recommendations

The frontend service already supports:

- `sort=newest`
- `sort=top`

Recommended backend behavior:

- `newest`: newest `created_at` first
- `top`: highest rating first, then most likes, then newest

## Ownership and permissions

Recommended rules:

- Only the author of a review can edit or delete it
- Any authenticated user can like/unlike a review
- Guests can read reviews if the book is public

Recommended status codes:

- `401` unauthenticated
- `403` authenticated but forbidden
- `404` review or book not found
- `422` validation error

## Backend implementation tips

- Prefer full URLs for user avatars
- Keep `rating` numeric
- Keep `likes` and `replies` numeric
- Return a stable `id` for each review
- Keep response envelopes consistent: `{ "data": ... }`
- Recalculate and persist `average_rating` and `reviews_count` on the book, or compute them efficiently

## Integration note

Right now, `BookDetails.tsx` still uses mock local comments and a hardcoded posting flow.

To fully connect the frontend later:

1. Load reviews with `reviewService.listForBook()`
2. Post reviews with `reviewService.createForBook()`
3. Update reviews with `reviewService.update()`
4. Delete reviews with `reviewService.remove()`
5. Like/unlike with `reviewService.like()` and `reviewService.unlike()`

## Backend checklist

- Book payloads include `average_rating`
- Book payloads include `reviews_count`
- `GET /api/books/{book_id}/reviews` supports `page`, `per_page`, and `sort`
- `POST /api/books/{book_id}/reviews` accepts `{ text, rating }`
- `PATCH /api/reviews/{id}` accepts partial updates
- `DELETE /api/reviews/{id}` removes only the owner's review
- `POST /api/reviews/{id}/like` works for authenticated users
- `POST /api/reviews/{id}/unlike` works for authenticated users
