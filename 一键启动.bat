@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/k','cd /d \"%CD%\mood_health_ai_service\" && uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload' -WindowStyle Normal; Start-Sleep 3; Start-Process cmd -ArgumentList '/k','cd /d \"%CD%\mood_health_server\" && npm run dev' -WindowStyle Normal; Start-Sleep 5; Start-Process cmd -ArgumentList '/k','cd /d \"%CD%\" && npm run dev' -WindowStyle Normal; Start-Sleep 8; Start-Process http://localhost:3001"
pause