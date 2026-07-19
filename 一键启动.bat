@echo off
cd /d "%~dp0"

:: Try pwsh first (PowerShell 7), fallback to powershell
where pwsh >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    pwsh -NoProfile -ExecutionPolicy Bypass -File ".\一键启动.ps1"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File ".\一键启动.ps1"
)

pause