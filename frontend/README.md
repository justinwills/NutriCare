# NutriCare Frontend

Next.js App Router frontend for pantry inventory, editable OCR review, confirmed meal logging, expandable nutrition estimates, notifications, patient care plans, and the doctor supervision workspace.

From this directory on Windows PowerShell:

```powershell
npm.cmd install
Copy-Item .env.local.example .env.local
npm.cmd run dev
```

The frontend expects the backend at `http://localhost:3002` and runs at `http://localhost:3000` by default.

For separate frontend/backend deployments, set `NEXT_PUBLIC_API_BASE_URL` in your frontend
hosting provider to the public backend origin (for example `https://api.yourdomain.com`).
NutriCare automatically adds the `/api` prefix. For a same-origin Vercel Services deployment,
leave this variable unset so requests such as `/api/auth/register` use the top-level rewrite.

Run frontend verification:

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```

See the repository [README](../README.md) for complete backend setup, migrations, OCR setup, the doctor-patient workflow, route documentation, and integration testing.
