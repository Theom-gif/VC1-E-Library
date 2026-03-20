# Reading Activity Time Tracking Guide

This document explains how the backend can track a reader's active reading time for the **Reading Activity** chart shown in `frontend/src/pages/Profile.tsx`.

Frontend references:
- `frontend/src/pages/Profile.tsx`
- `frontend/src/pages/BookDetails.tsx`
- `frontend/src/pages/Downloads.tsx`

## What the UI shows today

The profile page currently renders a mock bar chart:

- Range options:
  - `Last 7 Days`
  - `Last 30 Days`
  - `This Year`
- Each bar tooltip shows time in `mins`
- The chart expects **ordered time buckets**
- The chart is **per user**

Right now the data is hardcoded in the frontend, so this guide focuses on the backend contract and tracking logic needed to replace it with real data.

## What the backend should measure

The chart should represent **active reading time**, not just "book opened".

Recommended rule:
- Count time only while the user is actively reading in the browser or offline reader.

Recommended events to count:
- User opens a book reader
- Reader remains visible and active
- User continues reading and sends heartbeat updates

Do not count:
- A book detail page visit by itself
- A tab left open in the background for a long time
- Idle time after the user stops interacting

## Recommended tracking model

Use a session-based model.

### 1) Start a reading session

When a user opens a book for reading, create a session.

Recommended endpoint:

`POST /api/reading-sessions/start`

Example request:

```json
{
  "book_id": 123,
  "started_at": "2026-03-19T09:15:00+07:00",
  "source": "web"
}
```

Recommended response:

```json
{
  "success": true,
  "data": {
    "session_id": "rs_1001",
    "book_id": 123,
    "started_at": "2026-03-19T09:15:00+07:00"
  }
}
```

### 2) Send heartbeats while reading

While the reader stays open and active, send a heartbeat every `30-60` seconds.

Recommended endpoint:

`POST /api/reading-sessions/{sessionId}/heartbeat`

Example request:

```json
{
  "occurred_at": "2026-03-19T09:16:00+07:00",
  "seconds_since_last_ping": 45,
  "progress_percent": 18
}
```

Recommended backend behavior:
- Add only the reported active seconds
- Ignore duplicate heartbeats
- Cap unusually large gaps
  - Example: if a single heartbeat claims `900` seconds, cap it to `60-120`

### 3) Finish the session

When the user closes the reader, switches away for too long, or finishes reading, close the session.

Recommended endpoint:

`POST /api/reading-sessions/{sessionId}/finish`

Example request:

```json
{
  "ended_at": "2026-03-19T09:42:00+07:00",
  "progress_percent": 26
}
```

Recommended response:

```json
{
  "success": true,
  "data": {
    "session_id": "rs_1001",
    "duration_seconds": 1620
  }
}
```

## Idle-time rules

This is the most important part for accurate analytics.

Recommended backend rules:
- If no heartbeat arrives for more than `120` seconds, mark the session inactive
- Do not keep counting time after inactivity
- If the same user opens the same book in multiple tabs, avoid double-counting overlapping time
- If the user opens a different book, close or pause the earlier session

Recommended frontend rules later:
- Pause heartbeats when the tab becomes hidden
- Resume with a new heartbeat when the tab becomes visible again
- Finish the session on reader close/unload when possible

## Minimum endpoint the chart needs

Even if session tracking is added later, the Profile page ultimately needs one analytics endpoint:

`GET /api/me/reading-activity`

Recommended query params:
- `range=7d | 30d | 1y`
- `timezone=Asia/Phnom_Penh`

Recommended response for `range=7d`:

```json
{
  "success": true,
  "data": [
    { "key": "2026-03-16", "label": "Mon", "minutes": 45 },
    { "key": "2026-03-17", "label": "Tue", "minutes": 80 },
    { "key": "2026-03-18", "label": "Wed", "minutes": 30 },
    { "key": "2026-03-19", "label": "Thu", "minutes": 95 },
    { "key": "2026-03-20", "label": "Fri", "minutes": 60 },
    { "key": "2026-03-21", "label": "Sat", "minutes": 40 },
    { "key": "2026-03-22", "label": "Sun", "minutes": 75 }
  ],
  "meta": {
    "range": "7d",
    "unit": "minutes",
    "total_minutes": 425
  }
}
```

Recommended response for `range=30d`:

```json
{
  "success": true,
  "data": [
    { "key": "2026-02-18", "label": "Feb 18", "minutes": 15 },
    { "key": "2026-02-19", "label": "Feb 19", "minutes": 0 },
    { "key": "2026-02-20", "label": "Feb 20", "minutes": 32 }
  ],
  "meta": {
    "range": "30d",
    "unit": "minutes"
  }
}
```

Recommended response for `range=1y`:

```json
{
  "success": true,
  "data": [
    { "key": "2026-01", "label": "Jan", "minutes": 420 },
    { "key": "2026-02", "label": "Feb", "minutes": 510 },
    { "key": "2026-03", "label": "Mar", "minutes": 635 }
  ],
  "meta": {
    "range": "1y",
    "unit": "minutes"
  }
}
```

Rules for this endpoint:
- Always return data in display order
- Include zero-minute buckets
  - Example: if the user did not read on Wednesday, still return `{ "minutes": 0 }`
- Return minutes as numbers, not strings
- Aggregate using the user's local timezone when possible

## Recommended database design

You can support this with one raw session table and one aggregated daily table.

### Option A: Raw sessions only

Table: `reading_sessions`

Suggested columns:
- `id`
- `user_id`
- `book_id`
- `started_at`
- `ended_at`
- `duration_seconds`
- `last_heartbeat_at`
- `source`
- `created_at`
- `updated_at`

Pros:
- Simple to start
- Good audit trail

Cons:
- Chart queries become heavier over time

### Option B: Sessions + daily aggregates

Table: `reading_sessions`
- Same as above

Table: `reading_activity_daily`

Suggested columns:
- `id`
- `user_id`
- `activity_date`
- `minutes_read`
- `seconds_read`
- `books_opened_count`
- `created_at`
- `updated_at`

Recommended unique index:
- `(user_id, activity_date)`

Pros:
- Fast chart queries
- Easy to compute weekly and monthly totals

Recommended approach:
- Store raw sessions
- Update `reading_activity_daily` whenever a session finishes or a heartbeat is accepted

## Aggregation rules

Recommended calculation:

1. Save heartbeats as active time increments
2. Convert total seconds into per-day totals
3. Aggregate by:
   - day for `7d`
   - day for `30d`
   - month for `1y`
4. Return rounded whole minutes for the chart

Recommended rounding:
- Store seconds in the database
- Return rounded minutes in the API

Example:
- `2680` seconds stored
- API returns `45` minutes

## Validation and anti-abuse checks

Recommended safeguards:
- Require authentication for all tracking endpoints
- Ensure `book_id` belongs to a readable, approved book
- Reject impossible timestamps far in the future
- Cap heartbeat increments to avoid inflated totals
- Prevent overlapping active sessions from double-counting the same time window

## Suggested rollout order

If you want the backend work to land incrementally:

1. Implement `GET /api/me/reading-activity` with mock or derived data
2. Add `reading_sessions` storage
3. Add `start`, `heartbeat`, and `finish` endpoints
4. Add daily aggregation
5. Wire the frontend reader to send session events

## Frontend integration note

Today, `frontend/src/pages/Profile.tsx` uses this static array:

```ts
[45, 80, 30, 95, 60, 40, 75]
```

That should eventually be replaced by the response from `GET /api/me/reading-activity`.

Suggested frontend mapping:
- `minutes` -> tooltip text like `45 mins`
- `label` -> `Mon`, `Tue`, `Wed`, ...
- Use the largest `minutes` value in the returned dataset to scale bar heights

## Short version for backend

If you only want the minimum contract:

- Track active reading in seconds
- Use a session + heartbeat model
- Stop counting after inactivity
- Aggregate by day
- Return ordered chart buckets from `GET /api/me/reading-activity`
- Include `minutes` and `label` for each bar
