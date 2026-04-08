param(
    [switch]$NoPause
)

$ErrorActionPreference = "Stop"

function Write-Info([string]$Message) {
    Write-Host "[INFO] $Message"
}

function Write-Ok([string]$Message) {
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Fail([string]$Message) {
    Write-Error $Message
    if (-not $NoPause) {
        Read-Host "Press Enter to exit"
    }
    exit 1
}

$root = Split-Path -Parent $PSCommandPath
$venvPath = Join-Path $root ".venv"
$pythonExe = Join-Path $venvPath "Scripts\python.exe"
$requirementsRoot = Join-Path $root "requirements.txt"
$requirementsBackend = Join-Path $root "mood_health_server\requirements.txt"

Write-Info "Checking Python availability"
$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCommand) {
    Fail "Python not found in PATH. Install Python 3.8+ first."
}

Write-Info "Creating virtual environment at .venv"
Push-Location $root
try {
    & python -m venv .venv
}
finally {
    Pop-Location
}

if (-not (Test-Path $pythonExe)) {
    Fail "Virtual environment creation failed: $pythonExe not found"
}
Write-Ok "Virtual environment ready: $venvPath"

Write-Info "Upgrading pip"
& $pythonExe -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) {
    Fail "Failed to upgrade pip"
}

if (Test-Path $requirementsBackend) {
    Write-Info "Installing backend requirements from mood_health_server/requirements.txt"
    & $pythonExe -m pip install -r $requirementsBackend
    if ($LASTEXITCODE -ne 0) {
        Fail "Failed to install backend requirements"
    }
    Write-Ok "Backend requirements installed"
} elseif (Test-Path $requirementsRoot) {
    Write-Warn "Backend requirements not found, fallback to root requirements.txt"
    & $pythonExe -m pip install -r $requirementsRoot
    if ($LASTEXITCODE -ne 0) {
        Fail "Failed to install root requirements"
    }
    Write-Ok "Root requirements installed"
} else {
    Write-Warn "No requirements.txt found. Skipped package installation."
}

Write-Info "Python executable"
& $pythonExe -c "import sys; print(sys.executable)"

Write-Ok "Python environment setup completed"

if (-not $NoPause) {
    Read-Host "Press Enter to exit"
}
