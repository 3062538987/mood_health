# Mood Health - One Click Start
# Double-click this file to start all services

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host ""
Write-Host "======================================"
Write-Host "  Mood Health - One Click Start"
Write-Host "======================================"
Write-Host ""

# 1. Python AI Service
Write-Host "[1/3] Starting Python AI Service..."
Start-Process cmd -ArgumentList '/k', "cd /d `"$root\mood_health_ai_service`" && uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload" -WindowStyle Normal
Write-Host "  Waiting 3s..."
Start-Sleep -Seconds 3

# 2. Node.js Backend
Write-Host "[2/3] Starting Node.js Backend..."
Start-Process cmd -ArgumentList '/k', "cd /d `"$root\mood_health_server`" && npm run dev" -WindowStyle Normal
Write-Host "  Waiting 5s..."
Start-Sleep -Seconds 5

# 3. Vue Frontend
Write-Host "[3/3] Starting Vue Frontend..."
Start-Process cmd -ArgumentList '/k', "cd /d `"$root`" && npm run dev" -WindowStyle Normal
Write-Host "  Waiting 8s..."
Start-Sleep -Seconds 8

# 4. Open Browser
Write-Host ""
Write-Host "Done! Opening browser..."
Start-Process "http://localhost:3001"

Write-Host ""
Write-Host "======================================"
Write-Host "  Frontend:   http://localhost:3001"
Write-Host "  Backend:    http://localhost:3000"
Write-Host "  AI Service: http://localhost:8001"
Write-Host "======================================"
Write-Host ""
Write-Host "Press any key to close..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")