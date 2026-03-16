# Frontend API Integration Workflow

This folder (`frontend/src/service`) is the **API layer** for the UI. Today it contains:

- `apiClient.js`: fetch wrapper + base URL + error handling + Bearer token header
- `authService.js`: login/register helpers that store `localStorage.token`

The UI pages in `frontend/src/pages/` currently render from mock data (`MOCK_BOOKS`, `NEW_ARRIVALS` in `frontend/src/types.ts`). Use the workflow below to integrate real backend endpoints into the UI safely and incrementally.

## 1) Configure the backend URL

Create `frontend/.env.local`:

```bash
VITE_API_BASE_URL="https://elibrary.pncproject.site"
```

`apiClient` will call `${VITE_API_BASE_URL}/...` and automatically attach:

- `Authorization: Bearer <token>` when `localStorage.token` exists

## 2) Implement a feature service

Create one service module per feature (books, categories, favorites, reviews, ...). Keep pages free of URL strings.

Pattern:

- Put the endpoint calls in `frontend/src/service/<feature>Service.ts`
- Accept an object for query params / payload
- Use `apiClient.get/post/patch/delete`
- Normalize the backend response to something the UI can render easily

Examples included in this folder:

- `bookService.ts`
- `categoryService.ts`
- `favoriteService.ts`
- `reviewService.ts`
- `notificationService.ts`
- `profileService.ts`
- `index.ts` (barrel exports)

## 3) Wire the service into a page

Recommended page workflow:

1. Start with a **loading** state and optional **fallback** to mock data
2. Call the service inside `useEffect`
3. Handle errors using `try/catch` (the thrown `Error` from `apiClient` includes `.status` and `.data`)

Skeleton:

```ts
const [data, setData] = useState<any>(null);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  let alive = true;
  setIsLoading(true);
  setError(null);
  (async () => {
    try {
      const response = await someService.someCall();
      if (alive) setData(response);
    } catch (e: any) {
      if (alive) setError(e?.data?.message || e?.message || 'Request failed');
    } finally {
      if (alive) setIsLoading(false);
    }
  })();
  return () => {
    alive = false;
  };
}, []);
```

## 4) Keep endpoint + UI in sync

For backend developers, the expected endpoints are documented in `BACKEND_API.md` at the repo root.

When you add/adjust an endpoint:

- Update the relevant `*Service.ts`
- Update `frontend/src/types.ts` if the UI needs new fields
- Keep error responses consistent (`{ message, errors }`) so the UI can show validation messages

## Known endpoints on `https://elibrary.pncproject.site` (observed)

- `GET /api/books` returns `{ success, message, data, meta }`
  - Example message: `"Approved books retrieved successfully."`
  - Supports `per_page` (and typically `page`)
- `POST /api/auth/login` (GET returns 405)
- `POST /api/auth/register` (GET returns 405)
