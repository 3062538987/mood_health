param(
  [switch]$Clean,
  [switch]$NoAi,
  [switch]$WithAi
)

$ErrorActionPreference = 'Stop'

function Remove-Pm2ProcessIfExists {
  param([string]$Name)

  $pidOutput = (node $pm2Bin pid $Name 2>$null | Out-String).Trim()
  if ($LASTEXITCODE -eq 0 -and $pidOutput -match '\d+') {
    node $pm2Bin delete $Name 2>$null | Out-Null
  }
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pm2Bin = Join-Path $scriptRoot 'node_modules\pm2\bin\pm2'
$ecosystemFile = Join-Path $scriptRoot 'mood_health_server\ecosystem.config.js'
$distApp = Join-Path $scriptRoot 'mood_health_server\dist\app.js'

if (-not (Test-Path $pm2Bin)) {
  throw "PM2 not found at $pm2Bin. Run npm install in repository root first."
}

if (-not (Test-Path $ecosystemFile)) {
  throw "Ecosystem file missing: $ecosystemFile"
}

Push-Location $scriptRoot
try {
  if ($NoAi -and $WithAi) {
    throw 'NoAi and WithAi cannot be used together.'
  }

  if ($NoAi) {
    $env:AI_ENABLED = 'false'
    Write-Host '[start-project] AI_ENABLED=false (NoAi mode)'
  } elseif ($WithAi) {
    $env:AI_ENABLED = 'true'
    Write-Host '[start-project] AI_ENABLED=true (WithAi mode)'
  }

  if ($Clean) {
    Remove-Pm2ProcessIfExists -Name 'mood-health-server'
  }

  if (-not (Test-Path $distApp)) {
    Write-Host '[start-project] dist/app.js missing, building backend...'
    npm --prefix mood_health_server run build
    if ($LASTEXITCODE -ne 0) {
      throw 'Backend build failed.'
    }
  }

  # Ensure old process does not conflict with updated env.
  Remove-Pm2ProcessIfExists -Name 'mood-health-server'

  node $pm2Bin start $ecosystemFile --only mood-health-server --update-env
  if ($LASTEXITCODE -ne 0) {
    throw 'Failed to start mood-health-server.'
  }

  node $pm2Bin save | Out-Null
  node $pm2Bin status
}
finally {
  Pop-Location
}
