# Notifications API (Backend Guide)

The app supports notifications for users, authors, and admins.

## Preferred endpoints

- `POST /api/reading/start`
- `POST /api/reading/finish`
- `GET /api/user/notifications`
- `POST /api/user/notifications/{id}/read`
- `GET /api/author/notifications`
- `GET /api/admin/notifications`
- `POST /api/admin/notifications/send`

## Backward-compatible aliases (optional)

The existing frontend `notificationService` may call these older routes. Supporting them keeps older clients working:

- `GET /api/notifications` (alias of `GET /api/user/notifications`)
- `POST /api/notifications/read-all`
- `PATCH /api/notifications/{id}/read` (alias of `POST /api/user/notifications/{id}/read`)
- `DELETE /api/notifications/{id}`

## Auth

All endpoints are intended to be **authenticated** (Bearer token).

## Response conventions (recommended)

- List responses: `{ "success": true, "data": [...], "meta": { ... } }`
- Mutations: `{ "success": true, "data": ... }` (or `{ "success": true }`)
- Auth error: HTTP `401` with `{ "message": "Unauthenticated" }`

## Notification model

Minimum recommended fields:

```json
{
  "id": "n_123",
  "type": "goal",
  "title": "Achievement Unlocked",
  "message": "You unlocked the Fast badge!",
  "created_at": "2026-03-27T02:10:00Z",
  "read_at": null
}
```

Field notes:

- `type`: examples used in the UI: `new`, `download`, `goal`, `system`
- `read_at`: `null` means unread; non-null means read

Optional but useful fields:

- `action_url`: deep link for "View Details" (e.g. `/books/1`)
- `payload`: structured metadata (e.g. `{ "book_id": 1 }`)

## Endpoints

### `POST /api/reading/start`

Starts a reading session for the authenticated user.

Body (recommended):

```json
{ "book_id": 1 }
```

Response:

```json
{ "success": true, "data": { "started_at": "2026-03-27T02:10:00Z" } }
```

### `POST /api/reading/finish`

Finishes a reading session and (optionally) creates a reading log entry. This endpoint can also trigger achievement checks and generate "Achievement Unlocked" notifications.

Body (one of these is recommended):

```json
{ "book_id": 1, "total_seconds": 1800 }
```

or

```json
{ "book_id": 1, "minutes": 30 }
```

Response (recommended):

```json
{
  "success": true,
  "data": {
    "reading_log": { "id": 1, "book_id": "1", "total_seconds": 1800, "logged_at": "2026-03-27T02:40:00Z" },
    "newly_unlocked": ["fast"],
    "notifications": [{ "id": "n_1", "title": "Achievement Unlocked" }]
  }
}
```

### `GET /api/user/notifications`

Recommended query params:

- `page`, `per_page` (optional)
- `unread=1` (optional)

Recommended response:

```json
{
  "success": true,
  "data": [{ "...": "..." }],
  "meta": { "current_page": 1, "last_page": 1, "per_page": 20, "total": 1, "unread_count": 1 }
}
```

### `POST /api/user/notifications/{id}/read`

Marks a single notification as read for the authenticated user.

Recommended response:

```json
{ "success": true, "data": { "id": "n_123", "read_at": "2026-03-27T02:22:00Z" } }
```

### `GET /api/author/notifications`

Same response shape as `GET /api/user/notifications`, but intended for users with the `author` role.

### `GET /api/admin/notifications`

Returns notifications for admin dashboards. Recommended to allow filtering with `user_id`, `page`, and `unread`.

### `POST /api/admin/notifications/send`

Sends a notification as an admin.

Body (recommended):

```json
{
  "title": "System Update",
  "message": "New themes are now available in settings.",
  "type": "system",
  "audience": "all",
  "action_url": "/settings"
}
```

Notes:

- If `user_id` is provided, send only to that user.
- Otherwise, send by `audience` (recommended: `all | author | admin`).

### `DELETE /api/notifications/{id}`

Deletes (or archives) a single notification (per user).

