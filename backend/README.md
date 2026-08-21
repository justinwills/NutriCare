# NutriCare Backend

Express and PostgreSQL API for authentication, pantry inventory, OCR review, confirmed meal nutrition, notifications, doctor-patient links, and doctor-supervised nutrition plans.

From this directory on Windows PowerShell:

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run migrate
npm.cmd start
```

Run the database-backed supervision test while the backend is running:

```powershell
npm.cmd run test:supervision
```

The test creates isolated accounts and removes them after verifying linking, permissions, plan management, daily totals, limit warnings, OCR possible-purchase warnings, deduplication, and notification read status.

See the repository [README](../README.md) for environment variables, OCR setup, all Windows commands, route documentation, and known nutrition-calculation limitations.
