# Profile Backend Guide

This document is a focused backend guide for the profile area of the frontend, based on:

- `frontend/src/pages/Profile.tsx`
- `frontend/src/pages/Settings.tsx`
- `frontend/src/service/profileService.ts`
- `frontend/src/App.tsx`

Use this together with the root `BACKEND_API.md`. That file describes the overall API surface; this file narrows the scope to the profile-related data the frontend already shows or is likely to need next.

## What the frontend currently uses

The current profile page is still mostly UI-driven and mock-based:

- `Profile.tsx` receives `user` as props with:
  - `name`
  - `photo`
  - `membership`
- Editing currently updates local React state only
- The "Currently Reading" section is built from `useLibrary().books`
- Reading activity, achievements, and friends are currently hardcoded in the page
- `profileService.ts` already expects these endpoints:
  - `GET /api/me`
  - `PATCH /api/me`
  - `PATCH /api/me/settings`

Because of that, the best backend rollout is:

1. Implement authenticated profile read/update first
2. Implement account settings second
3. Add optional profile widgets after that

## Auth and headers

The frontend API client automatically sends:

```http
Authorization: Bearer <token>
```

when `localStorage.token` exists.

Recommended behavior:

- Require auth for all `/api/me*` routes
- Return `401` for missing or invalid tokens
- Return validation errors as `422`

Recommended error format:

```json
{
  "message": "Validation error",
  "errors": {
    "name": ["The name field is required."]
  }
}
```

## Minimum required endpoints

### `GET /api/me`

Purpose:
- Load the current signed-in user profile

Recommended response:

```json
{
  "data": {
    "id": "u_1",
    "name": "Alex Johnson",
    "email": "alex@example.com",
    "photo": "https://example.com/uploads/users/alex.jpg",
    "membership": "Premium Member",
    "role": "user"
  }
}
```

Notes:

- `name` maps directly to `Profile.tsx`
- `photo` should be a full URL if possible
- `membership` is shown in the app header and profile page
- `email` is not used in `Profile.tsx` today, but it is useful for `Settings.tsx`

### `PATCH /api/me`

Purpose:
- Update the editable fields from the profile page

Current frontend payload expectation:

```json
{
  "name": "Alex Johnson",
  "photo": "https://example.com/uploads/users/alex-new.jpg"
}
```

Recommended successful response:

```json
{
  "message": "Profile updated successfully.",
  "data": {
    "id": "u_1",
    "name": "Alex Johnson",
    "email": "alex@example.com",
    "photo": "https://example.com/uploads/users/alex-new.jpg",
    "membership": "Premium Member",
    "role": "user"
  }
}
```

Validation suggestions:

- `name`: required, string, 2-100 chars
- `photo`: nullable, valid URL if sent as text

Implementation note:

- The current page edits a photo URL string, not a file upload
- If you want real uploads later, add a separate upload endpoint rather than breaking this shape

### `PATCH /api/me/settings`

Purpose:
- Save settings shown in `Settings.tsx`

Recommended payload:

```json
{
  "automatic_downloads": true,
  "reading_reminders": true,
  "public_profile": false,
  "theme": "light"
}
```

Recommended response:

```json
{
  "message": "Settings updated successfully.",
  "data": {
    "automatic_downloads": true,
    "reading_reminders": true,
    "public_profile": false,
    "theme": "light"
  }
}
```

Suggested accepted values:

- `automatic_downloads`: boolean
- `reading_reminders`: boolean
- `public_profile`: boolean
- `theme`: `light | dark | system`

## Recommended extended endpoints

These are not strictly required for the current UI to render, but they will let the profile page stop relying on hardcoded values.

### `GET /api/me/stats`

Purpose:
- Replace the top badges in `Profile.tsx`

Recommended response:

```json
{
  "data": {
    "books_read": 124,
    "reading_streak_days": 12,
    "followers": 842,
    "member_since": "2022-01-15"
  }
}
```

UI mapping:

- `books_read` -> "Books Read"
- `reading_streak_days` -> "Reading Streak"
- `followers` -> "Followers"
- `member_since` can replace the hardcoded "Member since 2022" text

### `GET /api/me/reading-activity`

Purpose:
- Replace the hardcoded weekly bar chart

Recommended query:

- `range=7d | 30d | 1y`

Recommended response:

```json
{
  "data": [
    { "label": "Mon", "minutes": 45 },
    { "label": "Tue", "minutes": 80 },
    { "label": "Wed", "minutes": 30 },
    { "label": "Thu", "minutes": 95 },
    { "label": "Fri", "minutes": 60 },
    { "label": "Sat", "minutes": 40 },
    { "label": "Sun", "minutes": 75 }
  ]
}
```

Backend notes:

- The frontend chart expects ordered data
- Keep `minutes` numeric
- For `30d` and `1y`, you can return grouped labels like dates or months

### `GET /api/me/currently-reading`

Purpose:
- Feed the "Currently Reading" cards without depending on the general books list

Recommended response:

```json
{
  "data": [
    {
      "id": "b_1",
      "title": "The Great Gatsby",
      "author": "F. Scott Fitzgerald",
      "cover": "https://example.com/storage/covers/gatsby.jpg",
      "progress": 65,
      "category": "Classic",
      "rating": 4.8
    }
  ]
}
```

Important fields:

- `id`
- `title`
- `author`
- `cover`
- `progress`

If you do not want a dedicated endpoint yet, this data can also come from `GET /api/books` as long as each returned book includes per-user reading progress.

### `GET /api/me/achievements`

Purpose:
- Replace the hardcoded achievement grid

Recommended response:

```json
{
  "data": [
    { "code": "streak", "label": "Streak", "unlocked": true },
    { "code": "elite", "label": "Elite", "unlocked": true },
    { "code": "fast", "label": "Fast", "unlocked": true },
    { "code": "scholar", "label": "Scholar", "unlocked": true },
    { "code": "critic", "label": "Critic", "unlocked": true }
  ]
}
```

### `GET /api/me/friends`

Purpose:
- Replace the placeholder friends list

Recommended response:

```json
{
  "data": [
    {
      "id": "u_2",
      "name": "Friend Name 1",
      "photo": "https://example.com/uploads/users/friend-1.jpg",
      "reading": {
        "book_id": "b_10",
        "title": "The Hobbit"
      }
    }
  ]
}
```

## Suggested profile model

This model will cover both `Profile.tsx` and `Settings.tsx` cleanly:

```json
{
  "id": "u_1",
  "name": "Alex Johnson",
  "email": "alex@example.com",
  "photo": "https://example.com/uploads/users/alex.jpg",
  "membership": "Premium Member",
  "role": "user",
  "settings": {
    "automatic_downloads": true,
    "reading_reminders": true,
    "public_profile": false,
    "theme": "light"
  },
  "stats": {
    "books_read": 124,
    "reading_streak_days": 12,
    "followers": 842,
    "member_since": "2022-01-15"
  }
}
```

## Backend implementation tips

- Prefer full URLs for `photo` and book `cover` fields
- Keep response envelopes consistent: `{ "data": ... }`
- Store per-user reading progress separately from the base book record if needed
- If membership is derived from subscription data, still expose a simple `membership` string for the UI
- Avoid returning frontend-only labels when a stable raw field is better
  - Example: return `member_since` as a date, not `"Member since 2022"`

## Integration order

Recommended order for backend work:

1. `GET /api/me`
2. `PATCH /api/me`
3. `PATCH /api/me/settings`
4. `GET /api/me/stats`
5. `GET /api/me/reading-activity`
6. `GET /api/me/currently-reading`
7. `GET /api/me/achievements`
8. `GET /api/me/friends`

## Frontend note

Right now, `Profile.tsx` saves edits only to local component state through `onUpdateUser`. To make the page fully backend-driven later, wire `handleSave()` to `profileService.updateProfile()` first, then refresh the local user state from the API response.
