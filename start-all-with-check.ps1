<#
One-click start + self-check script (Windows PowerShell)
Starts:
- Frontend (Vite): http://localhost:3001
- Backend (Node): http://localhost:3000/health
- Redis: localhost:6379
- AI API (FastAPI): http://localhost:8000/health
#>

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendDir = $root
$backendDir = Join-Path $root "mood-health-server"
$redisDir = Join-Path $root "redis"

function Test-PortOpen([int]$Port) {
    try {
        $result = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue
        return [bool]$result.TcpTestSucceeded
    } catch {
        return $false
    }
}

function Wait-Port([int]$Port, [int]$TimeoutSec = 30) {
    $end = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $end) {
        if (Test-PortOpen -Port $Port) { return $true }
        Start-Sleep -Milliseconds 800
    }
    return $false
}

function Get-PythonCmd {
    $candidates = @(
        (Join-Path $root ".venv\Scripts\python.exe"),
        (Join-Path $root "venv\Scripts\python.exe"),
        (Join-Path $root "env\Scripts\python.exe")
    )

    foreach ($p in $candidates) {
        if (Test-Path $p) { return $p }
    }

    if (Get-Command python -ErrorAction SilentlyContinue) {
        return (Get-Command python).Source
    }

    if (Get-Command py -ErrorAction SilentlyContinue) {
        return (Get-Command py).Source
    }

    throw "Python not found."
}

function Start-ServiceIfNeeded {
    param(
        [string]$Name,
        [int]$Port,
        [scriptblock]$StartAction
    )

    if (Test-PortOpen -Port $Port) {
        Write-Host "[SKIP] $Name already running on port $Port" -ForegroundColor Yellow
        return
    }

    & $StartAction
}

Write-Host "== Checking prerequisites ==" -ForegroundColor Cyan
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js not found." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm not found." }
$pythonCmd = Get-PythonCmd
Write-Host "Python: $pythonCmd" -ForegroundColor Gray

Write-Host "== Starting services ==" -ForegroundColor Cyan

Start-ServiceIfNeeded -Name "Redis" -Port 6379 -StartAction {
    $redisServer = Join-Path $redisDir "redis-server.exe"
    $redisConf = Join-Path $redisDir "redis.windows.conf"
    if (-not (Test-Path $redisServer)) { throw "redis-server.exe not found under redis/." }

    Start-Process -FilePath $redisServer -ArgumentList @($redisConf) -WorkingDirectory $redisDir | Out-Null
    Write-Host "[START] Redis" -ForegroundColor Green
}

Start-ServiceIfNeeded -Name "Frontend" -Port 3001 -StartAction {
    Start-Process -FilePath "powershell" -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location -LiteralPath '$frontendDir'; npm run dev"
    ) -WorkingDirectory $frontendDir | Out-Null
    Write-Host "[START] Frontend" -ForegroundColor Green
}

Start-ServiceIfNeeded -Name "Backend" -Port 3000 -StartAction {
    Start-Process -FilePath "powershell" -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location -LiteralPath '$backendDir'; npm run dev"
    ) -WorkingDirectory $backendDir | Out-Null
    Write-Host "[START] Backend" -ForegroundColor Green
}

Start-ServiceIfNeeded -Name "AI API" -Port 8000 -StartAction {
    Start-Process -FilePath "powershell" -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location -LiteralPath '$backendDir'; `$env:PYTHONUTF8='1'; & '$pythonCmd' -m uvicorn main:app --host 0.0.0.0 --port 8000"
    ) -WorkingDirectory $backendDir | Out-Null
    Write-Host "[START] AI API" -ForegroundColor Green
}

Write-Host "== Waiting for ports ==" -ForegroundColor Cyan
$feOk = Wait-Port -Port 3001 -TimeoutSec 40
$beOk = Wait-Port -Port 3000 -TimeoutSec 40
$rdOk = Wait-Port -Port 6379 -TimeoutSec 20
$aiOk = Wait-Port -Port 8000 -TimeoutSec 40

function Try-Health([string]$Name, [string]$Url) {
    try {
        $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 8
        return @{ Name = $Name; Ok = $true; Code = $resp.StatusCode; Body = $resp.Content }
    } catch {
        return @{ Name = $Name; Ok = $false; Code = 0; Body = $_.Exception.Message }
    }
}

$beHealth = Try-Health -Name "Backend" -Url "http://localhost:3000/health"
$aiHealth = Try-Health -Name "AI API" -Url "http://localhost:8000/health"

Write-Host ""
Write-Host "== Self-check summary ==" -ForegroundColor Cyan
Write-Host ("Frontend 3001: {0}" -f ($(if ($feOk) { "OK" } else { "FAIL" })))
Write-Host ("Backend  3000: {0}" -f ($(if ($beOk) { "OK" } else { "FAIL" })))
Write-Host ("Redis    6379: {0}" -f ($(if ($rdOk) { "OK" } else { "FAIL" })))
Write-Host ("AI API   8000: {0}" -f ($(if ($aiOk) { "OK" } else { "FAIL" })))

Write-Host ("Backend /health: {0} (HTTP {1})" -f ($(if ($beHealth.Ok) { "OK" } else { "FAIL" }), $beHealth.Code))
Write-Host ("AI API  /health: {0} (HTTP {1})" -f ($(if ($aiHealth.Ok) { "OK" } else { "FAIL" }), $aiHealth.Code))

Write-Host ""
Write-Host "Frontend: http://localhost:3001"
Write-Host "Backend : http://localhost:3000"
Write-Host "AI API  : http://localhost:8000"

if (-not ($feOk -and $beOk -and $rdOk -and $aiOk -and $beHealth.Ok -and $aiHealth.Ok)) {
    exit 1
}

exit 0
