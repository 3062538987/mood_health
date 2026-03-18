<#
One-click startup with local PM2 (path-agnostic).
- No global pm2 requirement
- No absolute paths
- Uses node to execute local PM2 entry script
#>

[CmdletBinding()]
param(
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSCommandPath
$backendDir = Join-Path $root "mood-health-server"
$ecosystem = Join-Path $backendDir "ecosystem.config.js"
$logDir = Join-Path $backendDir "logs"
$pm2Entry = Join-Path $root "node_modules\pm2\bin\pm2"

function Fail([string]$msg) {
    Write-Error $msg
    exit 1
}

function Test-Command([string]$name) {
    return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Invoke-Pm2 {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Args
    )
    & node $pm2Entry @Args
}

if (-not (Test-Path $backendDir)) { Fail "Backend directory not found: $backendDir" }
if (-not (Test-Path $ecosystem)) { Fail "PM2 ecosystem not found: $ecosystem" }

Write-Host "[1/6] Checking dependencies..."
if (-not (Test-Command node)) { Fail "Node.js is not available in PATH" }
if (-not (Test-Command npm)) { Fail "npm is not available in PATH" }

$pythonCmd = $null
$venvCandidates = @(
    (Join-Path $root "venv\Scripts\python.exe"),
    (Join-Path $root ".venv\Scripts\python.exe"),
    (Join-Path $root "env\Scripts\python.exe")
)
foreach ($p in $venvCandidates) {
    if (Test-Path $p) {
        $pythonCmd = $p
        break
    }
}
if (-not $pythonCmd) {
    if (Test-Command python) { $pythonCmd = (Get-Command python).Source }
    elseif (Test-Command py) { $pythonCmd = (Get-Command py).Source }
}
if (-not $pythonCmd) { Fail "Python is not available. Install it or create a project venv." }
Write-Host "Python: $pythonCmd"

Write-Host "[2/6] Ensuring local PM2..."
if (-not (Test-Path $pm2Entry)) {
    npm install --save-dev pm2
}
if (-not (Test-Path $pm2Entry)) {
    Fail "Local PM2 not found after install. Check npm install logs."
}
Write-Host "PM2 entry: node node_modules/pm2/bin/pm2"

Write-Host "[3/6] Building Node backend..."
Push-Location $backendDir
try {
    npm run build
}
finally {
    Pop-Location
}
if (-not (Test-Path (Join-Path $backendDir "dist\app.js"))) {
    Fail "Build output missing: dist/app.js"
}
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

$env:PYTHON_EXECUTABLE = $pythonCmd
$env:PYTHONUTF8 = "1"

Write-Host "[4/6] Starting PM2 services..."
Push-Location $backendDir
try {
    if ($Clean) {
        Invoke-Pm2 delete mood-health-server,mood-ai-server | Out-Null
    }
    Invoke-Pm2 startOrRestart $ecosystem --update-env
}
finally {
    Pop-Location
}

Write-Host "[5/6] Configuring log rotation..."
$logrotateInstalled = (Invoke-Pm2 module:list) | Select-String "pm2-logrotate"
if (-not $logrotateInstalled) {
    Invoke-Pm2 install pm2-logrotate | Out-Null
}
Invoke-Pm2 set pm2-logrotate:max_size 20M | Out-Null
Invoke-Pm2 set pm2-logrotate:retain 14 | Out-Null
Invoke-Pm2 set pm2-logrotate:compress true | Out-Null
Invoke-Pm2 set pm2-logrotate:dateFormat "YYYY-MM-DD_HH-mm-ss" | Out-Null
Invoke-Pm2 set pm2-logrotate:workerInterval 30 | Out-Null

Write-Host "[6/6] Saving PM2 state and printing status..."
Invoke-Pm2 save | Out-Null
Invoke-Pm2 status

Write-Host ""
Write-Host "Done. Acceptance checks:"
Write-Host "  netstat -ano | findstr :3000"
Write-Host "  netstat -ano | findstr :8000"
Write-Host "  curl.exe -i http://localhost:3000/health"
