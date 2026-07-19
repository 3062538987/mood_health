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
    Write-Host "清理旧窗口..." -ForegroundColor Yellow
    Get-Process powershell -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowTitle -like '*MoodHealth*' } |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "清理完成" -ForegroundColor Green
    exit 0
}

if ($NoAi -and $WithAi) {
    throw 'Cannot use -NoAi and -WithAi together.'
}

# 清理旧窗口
Get-Process powershell -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -like '*MoodHealth*' } |
    Stop-Process -Force -ErrorAction SilentlyContinue

# 1. 启动后端（FastAPI + Node）
if (-not $NoAi) {
    & "$Root\scripts\start-all.ps1" -NodePort $NodePort -AiPort $AiPort
}

# 2. 启动前端
Write-Host "[3/3] 启动前端 Vite 服务 (端口 $FrontendPort)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-Command',
    "`$host.UI.RawUI.WindowTitle='MoodHealth - Frontend'; Write-Host '=== 前端 Vite (端口 $FrontendPort) ===' -ForegroundColor Cyan; Set-Location '$Root'; npm run dev"
)

Write-Host ""
Write-Host "=== 全栈服务启动完成 ===" -ForegroundColor Green
Write-Host "前端:    http://localhost:${FrontendPort}" -ForegroundColor Green
Write-Host "后端:    http://localhost:${NodePort}" -ForegroundColor Green
if (-not $NoAi) {
    Write-Host "FastAPI: http://127.0.0.1:${AiPort}/api/health" -ForegroundColor Green
}
Write-Host ""
Write-Host "提示：如果 Node 窗口闪退，请检查 MySQL 是否已启动以及 .env 配置是否正确" -ForegroundColor Yellow
Write-Host "关闭各个窗口即可停止对应服务。" -ForegroundColor Yellow