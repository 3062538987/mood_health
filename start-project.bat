@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
if /I "%~1"=="--no-check" (
	powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%start-project.ps1"
) else (
	call npm run start-all:check
)
endlocal
