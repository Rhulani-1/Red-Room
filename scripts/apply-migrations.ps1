<#
Apply SQL migrations in supabase/migrations in lexicographic order against a Postgres database.

Prerequisites:
- `psql` must be installed and available in PATH
- Set environment variable `DATABASE_URL` to your Supabase database connection string

Usage:
pwsh ./scripts/apply-migrations.ps1
#>

$ErrorActionPreference = 'Stop'

if (-not $env:DATABASE_URL) {
  Write-Error "DATABASE_URL environment variable is not set. Export it before running this script."
  exit 2
}

$migrationsPath = Join-Path $PSScriptRoot '..' 'supabase' 'migrations'
Write-Host "Applying migrations from: $migrationsPath"

Get-ChildItem -Path $migrationsPath -Filter '*.sql' | Sort-Object Name | ForEach-Object {
  $file = $_.FullName
  Write-Host "Applying $($_.Name)..."
  & psql $env:DATABASE_URL -f $file
  if ($LASTEXITCODE -ne 0) {
    Write-Error "psql failed applying $($_.Name)"
    exit $LASTEXITCODE
  }
}

Write-Host "All migrations applied."
