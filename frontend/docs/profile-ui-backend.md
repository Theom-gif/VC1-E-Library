# Profile UI Backend Guide

This guide explains what the backend should provide for `frontend/src/pages/Profile.tsx`.

## Required now

### `GET /api/me/profile`

Return:

- `name`
- `photo`
- `member_since`
- `membership`

Example:

```json
{
  "success": true,
  "data": {
    "id": 12,
    "name": "liheang heng",
    "email": "reader@example.com",
    "photo": "https://your-domain.com/storage/profiles/12.jpg",
    "member_since": "2026-03-20T08:15:00+07:00",
    "membership": "Reader Member"
  }
}
```

### `PATCH /api/me/profile`

The UI edits:

- `name`
- `photo` file

Recommended request:

- `multipart/form-data`
- `name`
- `photo`

### `GET /api/me/currently-reading`

Return the 2 active reading cards.

Required book fields:

- `id`
- `title`
- `author`
- `cover`
- `progress`

Example:

```json
{
  "success": true,
  "data": [
    {
      "id": 101,
      "title": "Atomic Habits",
      "author": "James Clear",
      "cover": "https://your-domain.com/storage/covers/atomic-habits.jpg",
      "progress": 48
    }
  ]
}
```

### `GET /api/me/reading-activity?range=7d|30d|1y`

Use the detailed contract in:

- `frontend/docs/reading-activity-tracking.md`

## Optional later

- `GET /api/me/achievements`
- `GET /api/me/friends`

## Important notes

- `member_since` should be a real backend date, not a UI string.
- The profile page now uses file explorer upload for the photo, so backend image upload support is recommended.
- Validation errors should return `422` with `{ message, errors }`.
