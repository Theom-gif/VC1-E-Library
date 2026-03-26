# E-Library Web App

React + Vite frontend for a digital library experience (browse books, categories, favorites, downloads, profile, notifications, search). The UI talks to a backend API via `VITE_API_URL` / `VITE_API_BASE_URL`. Backend endpoint expectations are documented in `BACKEND_API.md`.

## Repo layout
- `frontend/` – React 19 + Vite 6 app (see `frontend/README.md` for page flow and API shapes)
- `scripts/prepare-deploy.mjs` – copies `frontend/dist` into `build/` for static hosting bundles
- `build/` – created by `npm run build:deploy`

## Prerequisites
- Node.js 18+ (Vite 6 and React 19 require modern Node)
- npm

## Quick start (dev)
```bash
# from repo root
npm run install:frontend   # or: cd frontend && npm install
Copy-Item frontend/.env.example frontend/.env.local
# edit .env.local to point at your backend (VITE_API_URL / VITE_API_BASE_URL)
npm run dev                # starts Vite on http://localhost:3000
```

## Build & deploy
- `npm run build` – Vite production build into `frontend/dist`
- `npm run build:deploy` – build then copy artifacts to `build/` (ready for any static host)

## Environment keys (see `frontend/.env.example`)
- `VITE_API_URL`, `VITE_API_BASE_URL` – backend base URL for all API calls
- `VITE_API_PROXY_TARGET` / `VITE_API_BACKEND_TARGET` – optional dev proxy to avoid CORS
- `VITE_ALLOW_GUEST` – `"true"` to let visitors browse without logging in
- `GEMINI_API_KEY`, `APP_URL` – only needed if you use the bundled AI helpers

## Scripts (root)
- `npm run dev` – run frontend dev server
- `npm run lint` – type-checks via `tsc --noEmit`
- `npm run build` – production build
- `npm run build:deploy` – copy build output to `build/`
- `npm run install:frontend` – install frontend dependencies

## Backend expectations
The UI already handles the approval flow, favorites, downloads, reviews, and notifications. Implement the REST endpoints outlined in `BACKEND_API.md` (books, categories, authors, auth, favorites, downloads, reviews). Home page expects **approved books** from `GET /api/books` with fields: `id`, `title`, `author_name`, `category_name`, `cover_image_url`, `average_rating`, `status="approved"`.

## Need more detail?
- Frontend behavior and API contract examples: `frontend/README.md`
- Full endpoint guide for your backend team: `BACKEND_API.md`
