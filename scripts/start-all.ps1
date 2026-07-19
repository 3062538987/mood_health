# 一键启动后端服务（Node + FastAPI）
# 每个服务独立窗口，输出可见，方便排查问题
# 使用: .\scripts\start-all.ps1

param(
    [int]$NodePort = 3000,
    [int]$AiPort = 8001
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "=== 启动 Mood Health 后端服务 ===" -ForegroundColor Cyan
Write-Host ""

# 清理旧窗口残留
Get-Process powershell -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -like '*MoodHealth*' } |
    Stop-Process -Force -ErrorAction SilentlyContinue

# 1. 启动 FastAPI
Write-Host "[1/2] 启动 FastAPI AI 服务 (端口 $AiPort)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-Command',
    "`$host.UI.RawUI.WindowTitle='MoodHealth - FastAPI AI'; Write-Host '=== FastAPI AI 服务 (端口 $AiPort) ===' -ForegroundColor Cyan; `$env:MOOD_AI_SERVICE_PORT='$AiPort'; Set-Location '$Root\mood_health_ai_service'; uvicorn app.main:app --host 0.0.0.0 --port $AiPort --reload"
)

# 2. 启动 Node
Write-Host "[2/2] 启动 Node 后端服务 (端口 $NodePort)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-Command',
    "`$host.UI.RawUI.WindowTitle='MoodHealth - Node Backend'; Write-Host '=== Node 后端服务 (端口 $NodePort) ===' -ForegroundColor Cyan; `$env:PORT='$NodePort'; `$env:FASTAPI_BASE_URL='http://127.0.0.1:${AiPort}'; Set-Location '$Root\mood_health_server'; npm run dev"
)

Write-Host ""
Write-Host "=== 后端服务已在新窗口中启动 ===" -ForegroundColor Green
Write-Host "FastAPI: http://127.0.0.1:${AiPort}/api/health" -ForegroundColor Green
Write-Host "Node:    http://127.0.0.1:${NodePort}/health" -ForegroundColor Green
Write-Host ""
Write-Host "提示：如果 Node 窗口闪退，请检查 MySQL 是否已启动以及 .env 配置是否正确" -ForegroundColor Yellow
Write-Host "关闭各个窗口即可停止对应服务。" -ForegroundColor Yellow