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

$serverPath = Join-Path $PSScriptRoot "mood-health-server"

$passwordText = Convert-SecureStringToPlainText -Value $Password

if ([string]::IsNullOrWhiteSpace($passwordText)) {
  $passwordText = $env:DEMO_USER_PASSWORD
}
if ([string]::IsNullOrWhiteSpace($passwordText)) {
  $passwordText = "123456"
}

if (-not (Test-Path $serverPath)) {
  throw "Backend directory not found: $serverPath"
}

Write-Host "Initializing demo accounts and demo data..." -ForegroundColor Cyan
Write-Host "Backend directory: $serverPath" -ForegroundColor DarkGray

$target = "seed:demo"
if ($All) {
  $target = "seed:demo:all"
}

Write-Host "Using backend script: $target" -ForegroundColor DarkGray

npm --prefix $serverPath run $target -- $passwordText

if ($LASTEXITCODE -ne 0) {
  throw "Demo data initialization failed with exit code: $LASTEXITCODE"
}

Write-Host "Demo data initialization completed." -ForegroundColor Green