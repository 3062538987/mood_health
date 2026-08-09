@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
cd /d "%ROOT%"
set "PYTHONUTF8=1"

title MoodHealth One Click Starter
echo.
echo ==========================================
echo   Mood Health Platform - One Click Start
echo ==========================================
echo.

if not exist "%ROOT%package.json" (
  echo [ERROR] package.json was not found.
  echo Current folder: %ROOT%
  echo Put this bat file in the project root folder and run it again.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Please install Node.js 22 or later.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found. Please check your Node.js installation.
  echo.
  pause
  exit /b 1
)

echo [1/5] Project folder:
echo %ROOT%
echo.

echo [2/5] Checking Node.js dependencies...
if not exist "%ROOT%node_modules" (
  echo Root node_modules not found. Running npm install...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed in project root.
    pause
    exit /b 1
  )
)

if not exist "%ROOT%mood_health_server\node_modules" (
  echo Backend node_modules not found. Installing backend dependencies...
  call npm --prefix mood_health_server install
  if errorlevel 1 (
    echo [ERROR] Backend dependency install failed.
    pause
    exit /b 1
  )
)

echo.
echo [3/5] Checking isolated Python environment...
set "AI_DIR=%ROOT%mood_health_ai_service"
set "AI_VENV=%AI_DIR%\.venv"
set "AI_PYTHON=%AI_VENV%\Scripts\python.exe"

if not exist "%AI_DIR%\requirements.txt" (
  echo [ERROR] AI requirements file was not found:
  echo %AI_DIR%\requirements.txt
  pause
  exit /b 1
)

if not exist "%AI_PYTHON%" (
  echo Creating project Python environment...
  where py >nul 2>nul
  if not errorlevel 1 (
    py -3 -m venv "%AI_VENV%"
  ) else (
    where python >nul 2>nul
    if errorlevel 1 (
      echo [ERROR] Python 3 was not found. Please install Python 3.11 or later.
      pause
      exit /b 1
    )
    python -m venv "%AI_VENV%"
  )
  if errorlevel 1 (
    echo [ERROR] Failed to create the project Python environment.
    pause
    exit /b 1
  )
)

call "%AI_VENV%\Scripts\activate.bat"
python -c "import fastapi, uvicorn, pydantic_settings" >nul 2>nul
if errorlevel 1 (
  echo Installing FastAPI AI dependencies into the project environment...
  python -m pip install --disable-pip-version-check -r "%AI_DIR%\requirements.txt"
  if errorlevel 1 (
    echo [ERROR] Failed to install FastAPI AI dependencies.
    pause
    exit /b 1
  )
)

echo.
echo [4/5] Preparing Docker infrastructure and starting services...
echo This will open 3 windows:
echo   FastAPI AI : http://127.0.0.1:8001/api/health
echo   Node API   : http://localhost:3000/health
echo   Vue Web    : http://localhost:3001
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%start-project.ps1" -WithAi -PrepareInfrastructure
if errorlevel 1 (
  echo.
  echo [ERROR] start-project.ps1 failed. Please check the error above.
  pause
  exit /b 1
)

echo.
echo [5/5] All services passed readiness checks. Opening browser...
start "" "http://localhost:3001"

echo.
echo Docker infrastructure and all 3 application services are ready.
echo If a service window closes, check the error message in that window.
echo.
pause
