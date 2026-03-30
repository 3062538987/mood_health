param(
  [string]$SqliteDbPath = '',
  [switch]$SkipSeed,
  [switch]$SkipSmoke
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($SqliteDbPath)) {
  $SqliteDbPath = Join-Path $repoRoot 'mood-health-server/data/mood-health-preflight.db'
}

$resolvedSqliteDbPath = [System.IO.Path]::GetFullPath($SqliteDbPath)

$env:DB_CLIENT = 'sqlite'
$env:SQLITE_DB_PATH = $resolvedSqliteDbPath

Write-Host "[sqlite-preflight] DB_CLIENT=$($env:DB_CLIENT)"
Write-Host "[sqlite-preflight] SQLITE_DB_PATH=$($env:SQLITE_DB_PATH)"

Write-Host '[sqlite-preflight] Building backend...'
npm --prefix mood-health-server run build

Write-Host '[sqlite-preflight] Initializing sqlite schema...'
npm --prefix mood-health-server run db:init:sqlite

if (-not $SkipSeed) {
  Write-Host '[sqlite-preflight] Seeding demo data...'
  npm --prefix mood-health-server run seed:demo:all
} else {
  Write-Host '[sqlite-preflight] Skip seeding demo data.'
}

if (-not $SkipSmoke) {
  Write-Host '[sqlite-preflight] Running sqlite smoke test...'
  npm --prefix mood-health-server run test:sqlite-smoke
} else {
  Write-Host '[sqlite-preflight] Skip sqlite smoke test.'
}

Write-Host '[sqlite-preflight] Running doctor check...'
npm run doctor

Write-Host '[sqlite-preflight] Completed successfully.'
