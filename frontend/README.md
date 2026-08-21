# Person 1 — Frontend

Next.js (App Router) + TypeScript. This is a partial build — see
"What's built so far" below for exactly what's done vs. what's left.

## Setup

You need **both** the backend and this frontend running at the same
time, on different ports.

**1. Backend** (Person 2's project, separately):

```bash
cd path/to/backend
npm install
# .env should already have your Supabase DATABASE_URL, JWT_SECRET, and
# PORT=3002 (confirmed from your real .env — port 3002, not the
# Express default of 3000)
npm run dev
```

**2. This frontend:**

```bash
npm install
cp .env.local.example .env.local
# NEXT_PUBLIC_API_BASE_URL defaults to http://localhost:3002 — matches
# the backend's real PORT. Only change this if your backend runs
# somewhere else.
npm run dev
```

Open http://localhost:3000 — Next.js dev server defaults to 3000,
which doesn't collide with the backend's 3002.

## What's built so far

- **Login** (`/login`) and **Register** (`/register`, with role
  selection built into the same form — the backend requires a role at
  registration time, so it can't be a separate later step)
- Session handling (`lib/auth/context.tsx`) and a route guard
  (`components/RequireAuth.tsx`) for gating pages behind sign-in and,
  optionally, a specific role
- The full API client layer (`lib/api/`) and verified response types
  (`lib/types/api.ts`) for every endpoint your backend exposes —
  written and tested against your actual running server, not guessed

**Not yet built:** pantry screen, OCR upload/confirm flow, meal
logging, medication reminders, doctor dashboard. The API functions
for pantry/meals/notifications/doctor already exist in `lib/api/` and
are verified against the real backend — the screens that call them
aren't built yet.

## Verified vs. not yet verified

**Actually run and confirmed working** (not just read for syntax):
- `npx tsc --noEmit` — zero type errors across the whole project
- `npm run build` — full production build succeeds (this caught a
  real bug: `/login` needed a `<Suspense>` boundary around
  `useSearchParams()` or the build hard-fails; already fixed)
- The backend's actual `/auth/register` → `/auth/login` flow, hit
  directly, confirms the request/response shapes `lib/api/auth.ts`
  and `lib/types/api.ts` assume are correct

**Not yet verified — needs your own click-through:**
- The actual browser flow (fill in the login/register forms, click
  submit, watch it redirect) was not exercised end-to-end here — the
  build environment this was developed in has firewalled network
  access, so I could confirm the API calls work and the pages render,
  but not the full "click a button in a real browser" path. This is
  the main thing worth sanity-checking on your machine before I build
  more screens on top.
- If you're on a normal internet connection, `next/font/google`
  (Fraunces, Inter) should fetch with no issue. If you see a warning
  about failing to fetch Google Fonts, that's a network problem on
  your end worth checking, not expected behavior.

## Backend integration fixes

The backend now exposes a camelCase `fullName` alias on registration,
uses one transaction for meal deductions plus meal writes, accepts all
frontend measurement units in `meal_items`, and restricts nutrition checks
to the patient or an actively linked doctor.

## Key contract notes for whoever builds against `lib/api/`

- Request bodies are camelCase; most responses come back snake_case,
  straight from Postgres (`RETURNING *` / `SELECT *`, unmapped). See
  the comments in `lib/types/api.ts` for the exact shape of every
  endpoint, verified against the live server.
- Pantry quantities (`remaining_quantity`, `initial_quantity`) come
  back as **strings**, not numbers — Postgres `NUMERIC` via the `pg`
  driver. `lib/api/parse.ts` handles the conversion; use the parsed
  `PantryItemView` type in components, not the raw type, unless you
  have a specific reason to touch the raw response.
- The backend's unit converter (`units.js`) deliberately **rejects**
  converting a volume unit (tsp, tbsp, cup) against a gram-based
  pantry item, or a mass unit against an ml-based item — a teaspoon of
  sugar and a teaspoon of oil aren't the same mass, so it refuses to
  guess. Any form offering unit choices needs to only offer units
  matching the target item's dimension.
