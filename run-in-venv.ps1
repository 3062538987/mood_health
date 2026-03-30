[CmdletBinding()]
param(
    [switch]$Activate,

    [Parameter(Position = 0)]
    [string]$Program = "python",

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ProgramArgs
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
    Write-Error $Message
    exit 1
}

$root = Split-Path -Parent $PSCommandPath
$venvCandidates = @(
    (Join-Path $root ".venv"),
    (Join-Path $root "venv"),
    (Join-Path $root "venv.backup")
)

$venvPath = $null
foreach ($candidate in $venvCandidates) {
    if (Test-Path (Join-Path $candidate "Scripts\python.exe")) {
        $venvPath = $candidate
        break
    }
}

if (-not $venvPath) {
    Fail "No project virtual environment found. Expected .venv, venv, or venv.backup."
}

$scriptsPath = Join-Path $venvPath "Scripts"
$pythonPath = Join-Path $scriptsPath "python.exe"

$env:VIRTUAL_ENV = $venvPath
$env:PATH = "$scriptsPath;$env:PATH"
$env:PYTHONUTF8 = "1"

if ($Activate) {
    $activateScript = Join-Path $scriptsPath "Activate.ps1"
    if (-not (Test-Path $activateScript)) {
        Fail "Activate script not found: $activateScript"
    }

    $escapedActivate = $activateScript.Replace("'", "''")
    $escapedRoot = $root.Replace("'", "''")
    Write-Host "Using venv: $venvPath"
    Write-Host "Opening an interactive shell with venv activated..."
    powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location '$escapedRoot'; . '$escapedActivate'"
    exit $LASTEXITCODE
}

Write-Host "Using venv: $venvPath"
Write-Host "Running: $Program $($ProgramArgs -join ' ')"

if ($Program -ieq "python") {
    & $pythonPath @ProgramArgs
} else {
    & $Program @ProgramArgs
}

exit $LASTEXITCODE
