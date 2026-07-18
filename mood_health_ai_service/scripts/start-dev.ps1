# FastAPI 情绪分析服务开发模式启动脚本
# 使用: .\scripts\start-dev.ps1

param(
    [int]$Port = 8001,
    [switch]$Reload = $true
)

$env:MOOD_AI_SERVICE_PORT = $Port

Write-Host "=== 启动 FastAPI 情绪分析服务 ===" -ForegroundColor Cyan
Write-Host "端口: $Port" -ForegroundColor Yellow
Write-Host "API 文档: http://127.0.0.1:${Port}/api/docs" -ForegroundColor Green
Write-Host "健康检查: http://127.0.0.1:${Port}/api/health" -ForegroundColor Green
Write-Host ""

$reloadFlag = if ($Reload) { "--reload" } else { "" }

uvicorn app.main:app --host 0.0.0.0 --port $Port $reloadFlag