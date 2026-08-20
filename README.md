# Sanity-check package

Two folders:

- `backend/` — your real Person 2 backend (from `backend_-_Copy.zip`),
  copied as-is, source unmodified. No `.env` included — copy your own
  in (you already have it, DATABASE_URL pointed at Supabase).
- `frontend/` — the Person 1 Next.js frontend, so far: login,
  register + role selection, session handling, and the full API layer
  for pantry/meals/notifications/doctor (verified against your
  backend, screens not built yet).

## To sanity-check

1. `cd backend && npm install`, put your real `.env` back, `npm run dev`
   (should say "Backend running on http://localhost:3002")
2. `cd frontend && npm install && cp .env.local.example .env.local`,
   `npm run dev`
3. Open http://localhost:3000/register, create an account, confirm it
   redirects to `/login` with a "account created" message, log in,
   confirm it redirects to `/dashboard` (this route doesn't exist yet —
   expect a 404 there, that's expected at this stage, not a bug)

See `frontend/README.md` for the full breakdown of what's verified vs.
not, and two real bugs found in the backend along the way.
