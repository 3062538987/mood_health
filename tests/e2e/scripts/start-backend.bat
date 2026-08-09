@echo off
if "%E2E_BACKEND_PORT%"=="" set E2E_BACKEND_PORT=3100
if "%E2E_FRONTEND_PORT%"=="" set E2E_FRONTEND_PORT=3101
if "%E2E_MYSQL_PORT%"=="" set E2E_MYSQL_PORT=3316
set NODE_ENV=test
set HOST=127.0.0.1
set PORT=%E2E_BACKEND_PORT%
set FRONTEND_URL=http://127.0.0.1:%E2E_FRONTEND_PORT%
set MYSQL_HOST=127.0.0.1
set MYSQL_PORT=%E2E_MYSQL_PORT%
if "%E2E_MYSQL_DATABASE%"=="" set E2E_MYSQL_DATABASE=mood_health_e2e
set MYSQL_DATABASE=%E2E_MYSQL_DATABASE%
set REDIS_REQUIRED=false
set ALLOW_DEMO_SEED=true
set DEMO_PASSWORD=E2eDemoPass123!
set JWT_SECRET=e2e-jwt-secret-for-local-playwright-only
set ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
if "%E2E_AI_SERVICE_BASE_URL%"=="" set E2E_AI_SERVICE_BASE_URL=http://127.0.0.1:8001
if "%E2E_AI_TIMEOUT%"=="" set E2E_AI_TIMEOUT=1000
if "%E2E_AI_MAX_RETRIES%"=="" set E2E_AI_MAX_RETRIES=0
set AI_SERVICE_BASE_URL=%E2E_AI_SERVICE_BASE_URL%
set AI_TIMEOUT=%E2E_AI_TIMEOUT%
set AI_MAX_RETRIES=%E2E_AI_MAX_RETRIES%
echo [wrapper] starting backend on port %E2E_BACKEND_PORT% with mysql %E2E_MYSQL_PORT% > tests/e2e/scripts/start-backend.log 2>&1
call npm --prefix mood_health_server run build >> tests/e2e/scripts/start-backend.log 2>&1
if errorlevel 1 exit /b %ERRORLEVEL%
powershell -NoProfile -ExecutionPolicy Bypass -File tests\e2e\scripts\provision-database.ps1 -DatabaseName "%E2E_MYSQL_DATABASE%" >> tests/e2e/scripts/start-backend.log 2>&1
if errorlevel 1 exit /b %ERRORLEVEL%
node mood_health_server/dist/server.js >> tests/e2e/scripts/start-backend.log 2>&1
echo [wrapper] backend exited with code %ERRORLEVEL% >> tests/e2e/scripts/start-backend.log 2>&1
exit %ERRORLEVEL%
