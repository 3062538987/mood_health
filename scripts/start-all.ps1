# Start backend services (Node + FastAPI) in separate windows
# Usage: .\scripts\start-all.ps1

param(
    [int]$NodePort = 3000,
    [int]$AiPort = 8001
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "=== Starting Mood Health backend services ===" -ForegroundColor Cyan
Write-Host ""

# Clean old windows
Get-Process powershell -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -like '*MoodHealth*' } |
    Stop-Process -Force -ErrorAction SilentlyContinue

# 1. Start FastAPI
Write-Host "[1/2] Starting FastAPI AI service (port $AiPort)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-Command',
    "`$host.UI.RawUI.WindowTitle='MoodHealth - FastAPI AI'; Write-Host '=== FastAPI AI (port $AiPort) ===' -ForegroundColor Cyan; `$env:MOOD_AI_SERVICE_PORT='$AiPort'; `$env:HF_HUB_OFFLINE='1'; `$env:TRANSFORMERS_OFFLINE='1'; Set-Location '$Root\mood_health_ai_service'; python -m uvicorn app.main:app --host 0.0.0.0 --port $AiPort --reload"
)

# 2. Start Node
Write-Host "[2/2] Starting Node backend (port $NodePort)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-Command',
    "`$host.UI.RawUI.WindowTitle='MoodHealth - Node Backend'; Write-Host '=== Node Backend (port $NodePort) ===' -ForegroundColor Cyan; `$env:PORT='$NodePort'; `$env:AI_SERVICE_BASE_URL='http://127.0.0.1:${AiPort}'; `$env:FASTAPI_BASE_URL='http://127.0.0.1:${AiPort}'; Set-Location '$Root\mood_health_server'; npm run dev"
)

Write-Host ""
Write-Host "=== Backend services started in new windows ===" -ForegroundColor Green
Write-Host "FastAPI: http://127.0.0.1:${AiPort}/api/health" -ForegroundColor Green
Write-Host "Node:    http://127.0.0.1:${NodePort}/health" -ForegroundColor Green
Write-Host ""
Write-Host "Tip: If Node window closes immediately, check MySQL and .env settings." -ForegroundColor Yellow
Write-Host "Close each window to stop the corresponding service." -ForegroundColor Yellow
