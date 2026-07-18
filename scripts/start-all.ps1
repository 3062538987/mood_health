# 一键启动所有服务
# 使用: .\scripts\start-all.ps1

param(
    [int]$NodePort = 3000,
    [int]$AiPort = 8001
)

Write-Host "=== 一键启动 Mood Health 全栈服务 ===" -ForegroundColor Cyan
Write-Host ""

# 设置环境变量
$env:FASTAPI_BASE_URL = "http://127.0.0.1:${AiPort}"

# 启动 FastAPI
Write-Host "[1/2] 启动 FastAPI 情绪分析服务 (端口 $AiPort)..." -ForegroundColor Yellow
$aiJob = Start-Job -Name "fastapi" -ScriptBlock {
    param($port)
    Set-Location $using:PWD
    Set-Location mood_health_ai_service
    $env:MOOD_AI_SERVICE_PORT = $port
    uvicorn app.main:app --host 0.0.0.0 --port $port --reload
} -ArgumentList $AiPort

# 等待 FastAPI 启动
Start-Sleep -Seconds 3

# 启动 Node
Write-Host "[2/2] 启动 Node 后端服务 (端口 $NodePort)..." -ForegroundColor Yellow
$nodeJob = Start-Job -Name "node" -ScriptBlock {
    Set-Location $using:PWD
    Set-Location mood_health_server
    npm run dev
}

Write-Host ""
Write-Host "=== 所有服务已启动 ===" -ForegroundColor Green
Write-Host "FastAPI: http://127.0.0.1:${AiPort}/api/health" -ForegroundColor Green
Write-Host "Node:    http://127.0.0.1:${NodePort}" -ForegroundColor Green
Write-Host ""
Write-Host "按 Ctrl+C 停止所有服务..." -ForegroundColor Yellow

try {
    # 等待作业
    Wait-Job -Name "fastapi", "node" | Out-Null
} finally {
    Write-Host ""
    Write-Host "正在停止服务..." -ForegroundColor Yellow
    Stop-Job -Name "fastapi", "node" -ErrorAction SilentlyContinue
    Remove-Job -Name "fastapi", "node" -ErrorAction SilentlyContinue
    Write-Host "所有服务已停止。" -ForegroundColor Green
}