Applying migrations
===================

This repository includes SQL migrations under `supabase/migrations`.

Quick steps (recommended):

1. Export your database URL (Supabase connection string) into `DATABASE_URL`:

Windows PowerShell:

```powershell
$env:DATABASE_URL = 'postgres://postgres:password@db.host:5432/postgres'
pwsh ./scripts/apply-migrations.ps1
```

Or use the Supabase CLI to run SQL files against your project database.

Notes:
- The script uses `psql`; ensure it is installed and on `PATH`.
- The migrations include RLS and policies; review them before applying to production.
