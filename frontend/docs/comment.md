# Comment UI Backend Guide

This document explains the backend contract for the comment and review UI used by the frontend.

It is based on:

- `frontend/src/pages/BookDetails.tsx`
- `frontend/src/service/reviewService.ts`
- `frontend/src/service/apiClient.ts`

Use this together with the root backend API documentation and `frontend/docs/rating.md`.

## Current frontend state

The comment area is shown in the `Community Discussion` section of Book Details.

Important current state:

- `BookDetails.tsx` still renders comments from local React state
- the UI already supports the comment shape the backend should return
- `reviewService.ts` already defines the intended API contract
- the current edit UI only edits comment text
- like and unlike buttons exist visually, but are not fully wired yet
- replies are displayed as a count only, not as a threaded conversation yet

Because of that, the easiest backend rollout is:

1. Implement list and create endpoints first
2. Implement edit and delete next
3. Implement like and unlike endpoints
4. Add reply APIs later if needed

## Authentication

The shared API client automatically sends:

```http
Authorization: Bearer <token>
```

when `localStorage.token` exists.

Recommended auth behavior:

- `GET /api/books/{book}/reviews` can be public
- `POST /api/books/{book}/reviews` should require auth
- `PATCH /api/reviews/{id}` should require auth
- `DELETE /api/reviews/{id}` should require auth
- `POST /api/reviews/{id}/like` should require auth
- `POST /api/reviews/{id}/unlike` should require auth

Recommended status codes:

- `401` when the token is missing or invalid
- `403` when the user is authenticated but cannot edit or delete that review
- `404` when the book or review does not exist
- `422` for validation errors

Recommended validation error shape:

```json
{
  "message": "Validation error",
  "errors": {
    "text": ["The text field is required."]
  }
}
```

## What the UI needs for each comment

The current comment cards in `BookDetails.tsx` use these fields:

- `id`
- `user`
- `avatar`
- `text`
- `time`
- `likes`
- `replies`
- `rating`

Recommended backend response shape:

```json
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
  "created_at": "2026-03-20T09:30:00Z",
  "updated_at": "2026-03-20T09:30:00Z",
  "liked_by_me": false,
  "can_edit": false,
  "can_delete": false
}
```

Frontend mapping recommendation:

- `user.name` -> comment author name
- `user.avatar` -> avatar image
- `text` -> body text
- `rating` -> small star score shown on the card
- `likes` -> likes count
- `replies` -> reply count
- `created_at` -> convert to relative text like `2 hours ago`
- `can_edit` -> show edit button only when true
- `can_delete` -> show delete button only when true
- `liked_by_me` -> useful when the like button becomes interactive

If the backend cannot return nested `user`, this flat alternative is also workable:

```json
{
  "id": "r_1",
  "user_name": "Sarah Miller",
  "user_avatar": "https://example.com/uploads/users/sarah.jpg",
  "text": "Great book.",
  "rating": 5,
  "likes": 24,
  "replies": 12,
  "created_at": "2026-03-20T09:30:00Z"
}
```

## Required endpoints

### `GET /api/books/{book}/reviews`

Purpose:

- load the comment list for the book details page

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
  "message": "Comments retrieved successfully.",
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
      "created_at": "2026-03-20T09:30:00Z",
      "updated_at": "2026-03-20T09:30:00Z",
      "liked_by_me": false,
      "can_edit": false,
      "can_delete": false
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 3,
    "per_page": 10,
    "total": 24
  }
}
```

Notes:

- `data` should be an array of comments
- `meta` is recommended for future pagination support
- keep numeric fields numeric
- only approved books should expose public comments if that matches your book visibility rules

### `POST /api/books/{book}/reviews`

Purpose:

- create a new comment or review for a book

Current frontend payload from `reviewService.ts`:

```json
{
  "text": "Great book.",
  "rating": 5
}
```

Recommended validation:

- `text`: required, string, 1 to 2000 chars
- `rating`: required, integer, `1` to `5`

Recommended response:

```json
{
  "success": true,
  "message": "Comment created successfully.",
  "data": {
    "id": "r_99",
    "user": {
      "id": "u_8",
      "name": "Alex Johnson",
      "avatar": "https://example.com/uploads/users/alex.jpg"
    },
    "text": "Great book.",
    "rating": 5,
    "likes": 0,
    "replies": 0,
    "created_at": "2026-03-20T10:00:00Z",
    "updated_at": "2026-03-20T10:00:00Z",
    "liked_by_me": false,
    "can_edit": true,
    "can_delete": true
  }
}
```

Business rule recommendation:

- one user can have one review per book, or
- allow multiple comments if your product wants an open discussion model

If you choose one-review-per-book, the safest behavior is:

- either update the existing row, or
- return `409` or `422` with a clear error message

## Update and delete endpoints

### `PATCH /api/reviews/{id}`

Purpose:

- edit an existing comment

Current service payload:

```json
{
  "text": "Updated comment text",
  "rating": 4
}
```

Important UI note:

- the current edit form in `BookDetails.tsx` edits text only
- the backend should still allow updating both `text` and `rating`

Recommended response:

```json
{
  "success": true,
  "message": "Comment updated successfully.",
  "data": {
    "id": "r_99",
    "text": "Updated comment text",
    "rating": 4,
    "updated_at": "2026-03-20T10:15:00Z"
  }
}
```

### `DELETE /api/reviews/{id}`

Purpose:

- remove a comment

Recommended response:

```json
{
  "success": true,
  "message": "Comment deleted successfully."
}
```

Ownership rule:

- only the comment owner should be able to edit or delete it

## Like and unlike endpoints

### `POST /api/reviews/{id}/like`

Purpose:

- like a comment

Recommended response:

```json
{
  "success": true,
  "message": "Comment liked.",
  "data": {
    "id": "r_1",
    "likes": 25,
    "liked_by_me": true
  }
}
```

### `POST /api/reviews/{id}/unlike`

Purpose:

- remove the current user's like from a comment

Recommended response:

```json
{
  "success": true,
  "message": "Comment unliked.",
  "data": {
    "id": "r_1",
    "likes": 24,
    "liked_by_me": false
  }
}
```

## Sorting

The frontend service already supports:

- `sort=newest`
- `sort=top`

Recommended backend behavior:

- `newest`: newest `created_at` first
- `top`: highest rating first, then most likes, then newest

## Suggested database fields

A practical backend model for the current UI would include:

- `id`
- `book_id`
- `user_id`
- `text`
- `rating`
- `likes_count`
- `replies_count`
- `created_at`
- `updated_at`

Optional but helpful:

- `deleted_at` for soft deletes
- a separate review likes table keyed by `review_id` and `user_id`

## Backend checklist

- `GET /api/books/{book}/reviews` returns comments for the book
- `GET /api/books/{book}/reviews` supports `page`, `per_page`, and `sort`
- `POST /api/books/{book}/reviews` accepts `{ text, rating }`
- `PATCH /api/reviews/{id}` accepts partial updates
- `DELETE /api/reviews/{id}` removes only the owner's comment
- `POST /api/reviews/{id}/like` works for authenticated users
- `POST /api/reviews/{id}/unlike` works for authenticated users
- each returned comment includes author identity, text, rating, counts, and timestamps
- timestamps are real ISO strings, not preformatted relative text

## Integration note

Right now, the frontend UI is still using local mock comment state in `BookDetails.tsx`.

To fully connect it later, the frontend will replace the mock handlers with:

1. `reviewService.listForBook()`
2. `reviewService.createForBook()`
3. `reviewService.update()`
4. `reviewService.remove()`
5. `reviewService.like()`
6. `reviewService.unlike()`
