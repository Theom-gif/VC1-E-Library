# E-Library Frontend

## Run locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Configure backend URL (create `frontend/.env.local`):

```bash
VITE_API_BASE_URL="https://elibrary.pncproject.site"
VITE_API_PROXY_TARGET="http://localhost:8000"
```

3. Start dev server: `npm run dev`

---

## Backend API contract (Home page + approval workflow)

The Home page (`frontend/src/pages/Home.tsx`) renders books from `LibraryProvider` (`frontend/src/context/LibraryContext.tsx`), which calls `bookService.list()` (`frontend/src/service/bookService.ts`).

### What Home needs

Home uses a single list of **approved** books and derives sections from it:

- "New Arrivals": first 5 books returned
- "Recently Read / Trending / Top Rated": slices of the same list

Minimum fields required for the UI:

```json
{
  "id": 123,
  "title": "Atomic Habits",
  "author_name": "James Clear",
  "category_name": "Self-Help",
  "cover_image_url": "storage/covers/atomic-habits.jpg",
  "average_rating": 4.8,
  "status": "approved"
}
```

Notes:

- `cover_image_url` can be absolute or relative. If it's relative (like `storage/...`), the UI will normalize it using `VITE_API_BASE_URL`.
- Optional fields like `progress` / `timeLeft` are not required by the backend.

### Public endpoints (reader)

The frontend calls these endpoints to display books:

- `GET /api/books` (preferred)
- Fallback: `GET /api/auth/books` (only if `/api/books` returns 404)

Recommended response envelope:

```json
{
  "success": true,
  "message": "Books retrieved successfully.",
  "data": [/* approved books */],
  "meta": { "current_page": 1, "last_page": 10, "per_page": 50, "total": 500 }
}
```

Approval rule:

- Best: return **approved books only** from `GET /api/books`.
- If you include approval fields, use one of:
  - `status: "approved"`, or
  - `is_approved: 1` / `true`, or
  - `approval_status: "approved"`

### Upload + admin approval workflow (recommended)

1. Author uploads a book (created as pending)
2. Admin approves/rejects the book
3. Approved books appear in `GET /api/books` and will show on Home

Suggested endpoints:

- `POST /api/author/books` (multipart upload; creates `status=pending`)
- `GET /api/admin/books?status=pending`
- `PATCH /api/admin/books/{id}/approve` (sets `status=approved`, sets `published_at`)
- `PATCH /api/admin/books/{id}/reject`

### How "show after approval" works in the UI

The UI refreshes the book list on:

- app start
- tab focus (when returning to the page)
- periodic polling (about once per minute)

So after an admin approves a book, it will appear on Home automatically.

---

## Laravel routes example (for your new Reader controllers)

If your new backend controllers live in:

- `App\\Http\\Controllers\\Api\\Reader\\BookController`
- `App\\Http\\Controllers\\Api\\Reader\\FavoriteController`
- `App\\Http\\Controllers\\Api\\Reader\\RatingController`
- `App\\Http\\Controllers\\Api\\Reader\\ReadingProgressController`

…you can wire them in `routes/api.php` like this (adjust method names if yours differ):

```php
use App\Http\Controllers\Api\Reader\BookController;
use App\Http\Controllers\Api\Reader\FavoriteController;
use App\Http\Controllers\Api\Reader\RatingController;
use App\Http\Controllers\Api\Reader\ReadingProgressController;
use Illuminate\Support\Facades\Route;

// Public: approved books for Home
Route::get('/books', [BookController::class, 'index']);
Route::get('/books/{book}', [BookController::class, 'show']);

// Authenticated reader actions
Route::middleware('auth:sanctum')->group(function () {
    Route::patch('/reading-progress', [ReadingProgressController::class, 'update']);
    Route::post('/books/{book}/rate', [RatingController::class, 'store']);

    Route::get('/favorites', [FavoriteController::class, 'index']);
    Route::post('/favorites', [FavoriteController::class, 'store']);
    Route::delete('/favorites/{book}', [FavoriteController::class, 'destroy']);
});
```

