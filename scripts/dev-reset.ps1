param(
  [switch]$NoStart
)

$ErrorActionPreference = "Stop"

function Stop-PortProcess {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq "Listen" -and $_.OwningProcess -gt 0 } |
    Select-Object -ExpandProperty OwningProcess -Unique

  if (-not $connections) {
    Write-Host "Port $Port is free." -ForegroundColor DarkGray
    return
  }

  foreach ($processId in $connections) {
    try {
      $proc = Get-Process -Id $processId -ErrorAction Stop
      Stop-Process -Id $processId -Force -ErrorAction Stop
      Write-Host "Stopped process $($proc.ProcessName) (PID=$processId) on port $Port" -ForegroundColor Yellow
    }
    catch {
      Write-Warning "Failed to stop PID=$($processId) on port $($Port): $($_.Exception.Message)"
    }
  }
}

$ports = @(3001, 3000, 8000)
Write-Host "Cleaning development ports: $($ports -join ', ')" -ForegroundColor Cyan

foreach ($port in $ports) {
  Stop-PortProcess -Port $port
}

if ($NoStart) {
  Write-Host "Port cleanup complete. Start skipped due to -NoStart." -ForegroundColor Green
  exit 0
}

Write-Host "Starting frontend and backend dev servers..." -ForegroundColor Cyan
npm run dev:all
exit $LASTEXITCODE
