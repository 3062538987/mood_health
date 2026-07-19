@echo off
chcp 65001 >nul
title 一键启动 - 心理健康平台

echo.
echo ╔══════════════════════════════════════════╗
echo ║     心理健康平台 - 一键启动脚本          ║
echo ╚══════════════════════════════════════════╝
echo.
echo  正在启动服务，请稍候...
echo.

cd /d "%~dp0"

:: ============================================
:: 1. 启动 Python AI 服务 (端口 8001)
:: ============================================
echo  [1/3] 启动 Python AI 分析服务...
start "Python AI 服务" cmd /c "cd /d mood_health_ai_service && echo Python AI 服务启动中... && uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload && pause"

:: 等待 Python 服务启动
timeout /t 3 /nobreak >nul

:: ============================================
:: 2. 启动 Node.js 后端服务 (端口 3000)
:: ============================================
echo  [2/3] 启动 Node.js 后端服务...
start "Node.js 后端" cmd /c "cd /d mood_health_server && echo Node.js 后端启动中... && npm run dev && pause"

:: 等待后端启动
timeout /t 5 /nobreak >nul

:: ============================================
:: 3. 启动 Vue 前端服务 (端口 3001)
:: ============================================
echo  [3/3] 启动 Vue 前端服务...
start "Vue 前端" cmd /c "cd /d . && echo Vue 前端启动中... && npm run dev && pause"

:: 等待前端启动
timeout /t 8 /nobreak >nul

:: ============================================
:: 4. 打开浏览器
:: ============================================
echo.
echo  ✓ 所有服务已启动，正在打开浏览器...
start http://localhost:3001

echo.
echo ╔══════════════════════════════════════════╗
echo ║  服务端口:                               ║
echo ║  前端:       http://localhost:3001       ║
echo ║  后端 API:   http://localhost:3000       ║
echo ║  Python AI:  http://localhost:8001       ║
echo ╚══════════════════════════════════════════╝
echo.
echo  按任意键关闭此窗口 (不会关闭服务)...
pause >nul