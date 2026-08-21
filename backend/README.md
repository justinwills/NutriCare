# Person 2 — Backend

Express + PostgreSQL. Everything below has actually been run against a
real Postgres instance and a real running server — not just read for
syntax. See "What's been tested" at the bottom for exactly what that
covers.

## Setup

```bash
npm install
cp .env.example .env
# edit .env: set DATABASE_URL (Supabase connection string, or local Postgres)
# use PORT=3002 so the Next.js frontend can reach the backend
npm run migrate
npm run dev
```

If your Postgres doesn't have `pgcrypto` yet (needed for
`gen_random_uuid()` in the migrations), run this once before migrating:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Supabase has this enabled by default. A bare local Postgres install
usually doesn't — see the "Supabase-specific notes" section below.

## Project layout

```
migrations/          numbered .sql files, run in order by src/db/migrate.js
src/db/pool.js        pg connection pool
src/db/migrate.js     migration runner (tracks applied files, safe to re-run)
src/services/         actual logic: units.js, pantryService.js,
                       notificationService.js, authService.js
src/middleware/auth.js  JWT verification + role guard
src/routes/            thin HTTP layer, calls into services/
src/server.js          wires it all together
```

The routes are intentionally thin. If you're debugging "why did this
number come out wrong," the answer is almost certainly in `services/`,
not `routes/`.

## Endpoints

| Method | Path                          | Auth        | Notes |
|--------|-------------------------------|-------------|-------|
| POST   | /auth/register                | —           | |
| POST   | /auth/login                   | —           | returns JWT |
| POST   | /pantry                       | any         | save a confirmed OCR/manual item |
| GET    | /pantry                       | any         | list current user's pantry |
| POST   | /pantry/:id/deduct            | any         | converts unit, subtracts, checks low-stock |
| POST   | /pantry/check-expiring        | any         | manual trigger for the expiry scan |
| POST   | /meals                        | any         | logs a meal with N items, deducts each |
| GET    | /meals                        | any         | list meals with their items |
| GET    | /notifications                | any         | `?unread=true` to filter |
| PATCH  | /notifications/:id/read       | any         | |
| POST   | /doctor/link-patient          | doctor      | |
| GET    | /doctor/patients              | doctor      | |
| POST   | /doctor/nutrition-targets     | doctor      | set/update a min/max per nutrient |
| POST   | /doctor/check-nutrition       | linked doctor or patient | Person 3 calls this after computing a meal's nutrients |

All authenticated routes read `Authorization: Bearer <token>`.

## Integration points for Person 1 and Person 3

**Person 3 → you:** after OCR + confirmation, Person 1's frontend
should call `POST /pantry` with the confirmed item (matches the
integration contract's confirmed-item JSON in the jobdesk doc).

**Person 3 → you, for nutrition:** once Person 3 calculates a meal's
nutrients, call `POST /doctor/check-nutrition` once per nutrient that
has a target set, so out-of-range values create a notification. This
endpoint accepts the patient themself or a doctor with an active link to
that patient, so the calculation flow cannot report values for arbitrary
patient IDs.

**Person 1 → you, for meals:** `POST /meals` accepts an `items` array.
Each item can have a `pantryItemId` (real deduction happens) or omit
it (manual entry — a dash of salt with nothing tracked in pantry,
recorded for nutrition math only, no deduction).

## Known simplifications (said out loud, not hidden)

- **`toBaseUnit` refuses volume↔mass conversion** (e.g. "3 tsp" against
  a `g`-based item). This is deliberate — a teaspoon of sugar and a
  teaspoon of oil are different masses, and guessing a density would
  silently produce wrong nutrition numbers. If this bites you, the
  actual fix is deciding which unit each product should be stored in
  (salt/sugar/pepper → `g` and require gram input; oil/sauces → `ml`
  and tsp/tbsp/cup all work) — not adding a fake universal density.
- **Low-stock threshold (15%) and expiring-soon window (3 days) are
  hardcoded** in `pantryService.js`, not per-user or per-item
  configurable. Fine for a demo; flag as a "future work" line if asked.
- **Meal logging uses one transaction for the meal, deductions, and any
  low-stock/out-of-stock alert.** If an item fails, earlier deductions
  roll back with the meal.
- **`check-nutrition` accepts the patient themself or a doctor with an
  active patient link.** Arbitrary authenticated users cannot trigger
  alerts for someone else's patient ID.
- **Expiry checking is a manual-trigger endpoint**
  (`POST /pantry/check-expiring`), not a real cron. Good enough to
  demo live; wire it to `node-cron` or a Supabase scheduled function
  if you want it running unattended.

## Supabase-specific notes

- Use the **direct connection string** (not the pooled "Transaction"
  one) for `DATABASE_URL` when running `npm run migrate` — the
  migration runner opens a single long-lived connection and pooled
  connections can behave oddly with `CREATE TYPE`/DDL.
- Supabase Storage (not this backend) is the right place for the
  actual screenshot/receipt image files — store the Storage URL as a
  new column if you need to keep the original image referenced from
  `pantry_items`, which the current schema doesn't have yet.
- `pgcrypto` is enabled by default on Supabase, so `gen_random_uuid()`
  in the migrations should just work.

## What's been tested

The backend JavaScript is syntax-checked and the Express server has been
smoke-tested locally. Full data-flow verification requires a PostgreSQL
instance configured through `DATABASE_URL`.

Previously verified against a live Postgres 16 instance and a live Express
server, via real HTTP requests:

- All migrations run clean, and re-running `npm run migrate` correctly
  skips already-applied files
- register → login → JWT issued
- `POST /pantry` → `POST /meals` (with a `pantryItemId`) → deduction
  lands correctly: 500g − 150g = 350g remaining, matching the jobdesk's
  own integration-contract example exactly
- Unit conversion for same-dimension units: 2 tbsp correctly converts
  to 29.58ml and deducts from a `ml`-based item
- Unit conversion correctly **refuses** cross-dimension conversion
  (tsp against a `g` item) instead of silently producing a wrong number
- Low-stock notification fires automatically when remaining drops
  under 15% of initial — checked via `GET /notifications`
- Insufficient-stock deduction is rejected with a 400, not allowed to
  go negative
- Doctor registration → link-patient → set nutrition target →
  `check-nutrition` with an out-of-range value → `nutrition_high`
  notification created, correct message

Not yet exercised end-to-end: the expiring-soon scan (logic reviewed,
not run against a live near-expiry item), and role-based 403 rejection
on doctor-only routes (middleware logic is straightforward but wasn't
separately hit with a non-doctor token).
