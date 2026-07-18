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
set MYSQL_DATABASE=mood_health_e2e
set REDIS_REQUIRED=false
set ALLOW_DEMO_SEED=true
set DEMO_PASSWORD=E2eDemoPass123!
set JWT_SECRET=e2e-jwt-secret-for-local-playwright-only
set ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
echo [wrapper] starting backend on port %E2E_BACKEND_PORT% with mysql %E2E_MYSQL_PORT% > tests/e2e/scripts/start-backend.log 2>&1
node mood_health_server/dist/server.js >> tests/e2e/scripts/start-backend.log 2>&1
echo [wrapper] backend exited with code %ERRORLEVEL% >> tests/e2e/scripts/start-backend.log 2>&1
exit %ERRORLEVEL%
