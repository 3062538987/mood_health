param(
    [switch]$NoAi,
    [switch]$WithAi,
    [switch]$Clean,
    [int]$NodePort = 3000,
    [int]$AiPort = 8001
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

if ($Clean) {
    Get-Job -Name 'mood-health-node', 'mood-health-ai' -ErrorAction SilentlyContinue |
        Stop-Job -PassThru |
        Remove-Job -Force
}

if ($NoAi -and $WithAi) {
    throw 'Cannot use -NoAi and -WithAi together.'
}

if (-not $NoAi) {
    & (Join-Path $Root 'scripts\start-all.ps1') -NodePort $NodePort -AiPort $AiPort
    exit $LASTEXITCODE
}

Write-Host '=== Starting Mood Health Node service only ===' -ForegroundColor Cyan
Push-Location (Join-Path $Root 'mood_health_server')
try {
    $env:PORT = [string]$NodePort
    npm run dev
} finally {
    Pop-Location
}
