param(
  [string]$Password
)

$ErrorActionPreference = "Stop"

$serverPath = Join-Path $PSScriptRoot "mood-health-server"

if ([string]::IsNullOrWhiteSpace($Password)) {
  throw "A demo password must be provided with -Password or DEMO_USER_PASSWORD."
}

if (-not (Test-Path $serverPath)) {
  throw "Backend directory not found: $serverPath"
}

Write-Host "Initializing demo accounts and demo data..." -ForegroundColor Cyan
Write-Host "Backend directory: $serverPath" -ForegroundColor DarkGray

npm --prefix $serverPath run seed:demo -- $Password

if ($LASTEXITCODE -ne 0) {
  throw "Demo data initialization failed with exit code: $LASTEXITCODE"
}

Write-Host "Demo data initialization completed." -ForegroundColor Green