# NutriCare Frontend

Next.js App Router frontend for pantry inventory, editable OCR review, confirmed meal logging, expandable nutrition estimates, notifications, patient care plans, and the doctor supervision workspace.

From this directory on Windows PowerShell:

```powershell
npm.cmd install
Copy-Item .env.local.example .env.local
npm.cmd run dev
```

The frontend expects the backend at `http://localhost:3002` and runs at `http://localhost:3000` by default.

For production deployment, set `NEXT_PUBLIC_API_BASE_URL` in your frontend hosting provider
to your public backend origin (for example `https://api.yourdomain.com`). If this points
to `localhost` or is unset, requests like `/auth/register` will fail.

Run frontend verification:

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```

See the repository [README](../README.md) for complete backend setup, migrations, OCR setup, the doctor-patient workflow, route documentation, and integration testing.
