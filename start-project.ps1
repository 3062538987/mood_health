param(
    [switch]$NoAi,
    [switch]$WithAi,
    [switch]$Clean,
    [int]$NodePort = 3000,
    [int]$AiPort = 8001,
    [int]$FrontendPort = 3001
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

if ($Clean) {
    Write-Host "Cleaning old windows..." -ForegroundColor Yellow
    Get-Process powershell -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowTitle -like '*MoodHealth*' } |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "Cleaned." -ForegroundColor Green
    exit 0
}

if ($NoAi -and $WithAi) {
    throw 'Cannot use -NoAi and -WithAi together.'
}

# Clean old windows
Get-Process powershell -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -like '*MoodHealth*' } |
    Stop-Process -Force -ErrorAction SilentlyContinue

# 1. Start backend (FastAPI + Node)
if (-not $NoAi) {
    & "$Root\scripts\start-all.ps1" -NodePort $NodePort -AiPort $AiPort
}

# 2. Start frontend
Write-Host "[3/3] Starting Vite frontend (port $FrontendPort)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-Command',
    "`$host.UI.RawUI.WindowTitle='MoodHealth - Frontend'; Write-Host '=== Vite Frontend (port $FrontendPort) ===' -ForegroundColor Cyan; Set-Location '$Root'; npm run dev"
)

Write-Host ""
Write-Host "=== All services started ===" -ForegroundColor Green
Write-Host "Frontend: http://localhost:${FrontendPort}" -ForegroundColor Green
Write-Host "Backend:  http://localhost:${NodePort}" -ForegroundColor Green
if (-not $NoAi) {
    Write-Host "FastAPI:  http://127.0.0.1:${AiPort}/api/health" -ForegroundColor Green
}
Write-Host ""
Write-Host "Tip: If Node window closes immediately, check MySQL and .env config." -ForegroundColor Yellow
Write-Host "Close each window to stop the corresponding service." -ForegroundColor Yellow