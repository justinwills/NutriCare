# NutriCare

NutriCare is a Next.js and Express application for pantry tracking, confirmed meal logging, nutrition estimates, alerts, and doctor-supervised nutrition plans for actively linked hospital patients.

## Requirements

- Windows PowerShell
- Node.js 20 or newer
- PostgreSQL, or a Supabase PostgreSQL connection string
- Python virtual environment with PaddleOCR and PaddlePaddle only when receipt OCR is required

## Backend Setup (Windows)

Open PowerShell in the repository root:

```powershell
Set-Location .\backend
npm.cmd install
Copy-Item .env.example .env
notepad .env
```

Set these values in `backend\.env`:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
DATABASE_SSL=true
JWT_SECRET=replace-with-a-long-random-secret
PORT=3002
PYTHON_EXECUTABLE=C:/path/to/.venv/Scripts/python.exe
```

Use `DATABASE_SSL=false` for a local PostgreSQL server that does not use TLS. `PYTHON_EXECUTABLE` is optional unless OCR is used. Do not commit `.env`.

Apply every unapplied numbered migration:

```powershell
npm.cmd run migrate
```

Start the backend:

```powershell
npm.cmd start
```

The backend is available at `http://localhost:3002`. Verify it in another PowerShell window:

```powershell
Invoke-RestMethod http://localhost:3002/health
```

For automatic restarts during backend development, use `npm.cmd run dev`. On Windows, use `npm.cmd start` if `node --watch` leaves a stale child process on port 3002.

## Frontend Setup (Windows)

Open a second PowerShell window in the repository root:

```powershell
Set-Location .\frontend
npm.cmd install
Copy-Item .env.local.example .env.local
npm.cmd run dev
```

The frontend is available at `http://localhost:3000` and expects this value in `frontend\.env.local`:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:3002
```

## OCR Setup (Windows)

From the repository root:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install paddleocr paddlepaddle
```

Set `PYTHON_EXECUTABLE` in `backend\.env` to the absolute path of `.venv\Scripts\python.exe`, then restart the backend.

OCR suggestions are review-only. A receipt can suggest a purchased food name and package quantity, but it never confirms consumption. The patient must edit or confirm the food name, consumed quantity, and unit in the meal journal before nutrition totals are updated.

Plate photo recognition uses an OpenAI-compatible vision API. Set `OPENAI_API_KEY` in `backend\.env` (and optionally `OPENAI_VISION_MODEL` or `OPENAI_BASE_URL`), restart the backend, then use **Recognize plate** in the meal journal. The returned foods and estimated portion weights are only suggestions; the patient must review them before logging.

## Doctor Supervision Flow

1. Register one `hospital_patient` account and one `doctor` account.
2. Copy the patient user ID shown in the patient interface.
3. Sign in as the doctor and link that patient on `/doctor`.
4. Select the linked patient and manage conditions, daily limits, avoid foods, and foods to consume more often.
5. Sign in as the patient and open `/dashboard` to view the read-only care plan and current daily totals.
6. Log a meal with a manually confirmed quantity and unit.
7. Open `/notifications` as the patient or doctor to view saved alerts.

Daily boundaries use the patient browser's IANA timezone when supplied during meal logging, with `UTC` as the database default. Daily-limit warnings are deduplicated per recipient, limit, and local date.

## Supervision Routes

| Method   | Route                                                           | Access                                                                    |
| -------- | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `GET`    | `/doctor/patients`                                              | Doctor                                                                    |
| `POST`   | `/doctor/link-patient`                                          | Doctor; hospital patients only                                            |
| `GET`    | `/doctor/patients/:patientId/plan`                              | Actively linked doctor                                                    |
| `PUT`    | `/doctor/patients/:patientId/conditions`                        | Actively linked doctor                                                    |
| `POST`   | `/doctor/patients/:patientId/limits`                            | Actively linked doctor                                                    |
| `PATCH`  | `/doctor/patients/:patientId/limits/:limitId`                   | Owning, actively linked doctor                                            |
| `DELETE` | `/doctor/patients/:patientId/limits/:limitId`                   | Owning, actively linked doctor                                            |
| `POST`   | `/doctor/patients/:patientId/recommendations`                   | Actively linked doctor                                                    |
| `PATCH`  | `/doctor/patients/:patientId/recommendations/:recommendationId` | Owning, actively linked doctor                                            |
| `DELETE` | `/doctor/patients/:patientId/recommendations/:recommendationId` | Owning, actively linked doctor                                            |
| `GET`    | `/supervision`                                                  | Hospital patient, own plan only                                           |
| `GET`    | `/supervision/daily-totals`                                     | Hospital patient, own totals only                                         |
| `PUT`    | `/supervision/timezone`                                         | Hospital patient                                                          |
| `POST`   | `/ocr/check-foods`                                              | Hospital patient; possible-purchase check only                            |
| `POST`   | `/food-gallery`                                                 | Authenticated; save own plate photo and recognition results               |
| `GET`    | `/food-gallery`                                                 | Authenticated; view own saved food photos                                 |
| `GET`    | `/food-gallery/patient/:patientId`                              | Doctor with an active link to the patient                                 |
| `POST`   | `/meals`                                                        | Authenticated; supervision calculation is automatic for hospital patients |

Legacy `/doctor/nutrition-targets` and `/doctor/check-nutrition` routes remain available for compatibility. New supervision plans use `/doctor/patients/:patientId/*`, and meal logging performs checks automatically.

## Testing

Keep the migrated backend running on port 3002. In another PowerShell window:

```powershell
Set-Location .\backend
npm.cmd run test:supervision
```

The integration test registers temporary accounts, verifies the complete doctor/patient flow, confirms cumulative sodium totals and notification deduplication, checks OCR possible-purchase wording, tests unauthorized `403` responses, and deletes the temporary accounts in `finally`.

Run static backend and frontend checks:

```powershell
Set-Location .\backend
Get-ChildItem .\src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }

Set-Location ..\frontend
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```

## Nutrition Limit Coverage

The bundled USDA-derived database calculates calories, protein, carbohydrates, fat, fibre, sugar, and sodium for matched foods. Ingredient limits are calculated from confirmed meal item quantities when the logged unit is compatible with the limit unit, such as tablespoons of oil converted to millilitres. Custom limits remain stored and visible even when the local food database has no matching calculated metric.

Nutrition results are estimates for informational and supervision support. NutriCare records doctor-entered conditions and guidance; it does not diagnose patients or make unsupported medical claims.
