param(
  [SecureString]$Password,
  [switch]$All
)

$ErrorActionPreference = "Stop"

function Convert-SecureStringToPlainText {
  param([SecureString]$Value)

  if ($null -eq $Value) {
    return $null
  }

  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

$serverPath = Join-Path $PSScriptRoot "mood_health_server"

$passwordText = Convert-SecureStringToPlainText -Value $Password

if ([string]::IsNullOrWhiteSpace($passwordText)) {
  $passwordText = $env:DEMO_PASSWORD
}

if (-not (Test-Path $serverPath)) {
  throw "Backend directory not found: $serverPath"
}

Write-Host "Initializing demo accounts and demo data..." -ForegroundColor Cyan
Write-Host "Backend directory: $serverPath" -ForegroundColor DarkGray

$target = "db:seed:demo"
if ($All) {
  $target = "db:seed:all"
}

Write-Host "Using backend script: $target" -ForegroundColor DarkGray

$previousAllowDemoSeed = $env:ALLOW_DEMO_SEED
$previousDemoPassword = $env:DEMO_PASSWORD

try {
  $env:ALLOW_DEMO_SEED = "true"
  if (-not [string]::IsNullOrWhiteSpace($passwordText)) {
    $env:DEMO_PASSWORD = $passwordText
  }

  npm --prefix $serverPath run $target
}
finally {
  $env:ALLOW_DEMO_SEED = $previousAllowDemoSeed
  $env:DEMO_PASSWORD = $previousDemoPassword
}

if ($LASTEXITCODE -ne 0) {
  throw "Demo data initialization failed with exit code: $LASTEXITCODE"
}

Write-Host "Demo data initialization completed." -ForegroundColor Green
