# Apply employee finances / THR migration and regenerate Prisma client.
# Stop Next.js first (avoids Windows Prisma DLL lock), then from repo root:
#   powershell -ExecutionPolicy Bypass -File scripts/apply-employee-finances-migration.ps1
# Restart: npm run dev

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

$dbLine = Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $dbLine) { throw "DATABASE_URL missing from .env" }
$env:DIRECT_URL = $dbLine.Substring("DATABASE_URL=".Length)

Write-Host "Generating Prisma client..."
npx prisma generate
Write-Host "Deploying migrations..."
npx prisma migrate deploy
Write-Host "Done. Restart npm run dev and refresh Employees (Finances) / Finance → THR."
