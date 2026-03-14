@echo off
rem 启动脚本（Windows 批处理）
set ROOT=D:\桌面\Code\大学生情绪健康\mood-health-web

echo 检查系统依赖...
where node >nul 2>&1 || (echo Node.js 未找到，请安装并确保 node 在 PATH。& pause & exit /b 1)
where npm >nul 2>&1 || (echo npm 未找到，请安装 Node.js/npm 并确保 npm 在 PATH。& pause & exit /b 1)
rem 检测项目虚拟环境优先使用
set "PYTHON="
if exist "%ROOT%\.venv\Scripts\python.exe" set "PYTHON=%ROOT%\\.venv\\Scripts\\python.exe"
if exist "%ROOT%\venv\Scripts\python.exe" set "PYTHON=%ROOT%\\venv\\Scripts\\python.exe"
if "%PYTHON%"=="" (
  where python >nul 2>&1 && set "PYTHON=python"
  if "%PYTHON%"=="" where py >nul 2>&1 && set "PYTHON=py"
)
if "%PYTHON%"=="" (
  echo Python 未找到，请安装 Python 并确保 python/py 在 PATH。& pause & exit /b 1
)

rem 确保 uvicorn 和 fastapi（使用选定的 python）
%PYTHON% -m pip show uvicorn >nul 2>&1 || %PYTHON% -m pip install uvicorn fastapi
if %ERRORLEVEL% neq 0 (
  echo 自动安装 uvicorn/fastapi 失败，请手动安装。
  pause
)

where ollama >nul 2>&1 || echo WARNING: 未检测到 Ollama（可选），若需使用请安装 Ollama 并拉取模型 deepseek-r1:1.5b

echo 启动前端...
start "Frontend" cmd /k "cd /d %ROOT% && npm run dev"

echo 启动后端...
start "Backend" cmd /k "cd /d %ROOT%\mood-health-server && npm run dev"

echo 启动 AI 服务 (uvicorn)...
start "AI" cmd /k "cd /d %ROOT%\mood-health-server && python -m uvicorn main:app --host 0.0.0.0 --port 8000"

echo 已在新窗口中启动所有服务。
echo - 前端: http://localhost:5173
echo - 后端: http://localhost:5000
echo - AI 服务: http://localhost:8000
pause
