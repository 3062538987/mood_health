param(
    [string]$PythonPath = '',
    [switch]$Recreate,
    [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$AiRoot = Join-Path $ProjectRoot 'mood_health_ai_service'
$VenvPath = Join-Path $AiRoot '.venv'
$CandidatePath = Join-Path $AiRoot '.venv-python311-new'
$BackupPath = Join-Path $AiRoot 'venv.backup'

function Get-PythonVersion {
    param([Parameter(Mandatory)][string]$Executable)

    if (-not (Test-Path -LiteralPath $Executable)) {
        return $null
    }
    $version = & $Executable -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')" 2>$null
    if ($LASTEXITCODE -ne 0) {
        return $null
    }
    return [string]$version
}

function Find-Python311 {
    $candidates = New-Object System.Collections.Generic.List[string]
    if (-not [string]::IsNullOrWhiteSpace($PythonPath)) {
        $candidates.Add($PythonPath)
    }
    if (-not [string]::IsNullOrWhiteSpace($env:MOOD_HEALTH_PYTHON)) {
        $candidates.Add($env:MOOD_HEALTH_PYTHON)
    }

    $pyLauncher = Get-Command py -ErrorAction SilentlyContinue
    if ($pyLauncher) {
        $resolved = & $pyLauncher.Source -3.11 -c "import sys; print(sys.executable)" 2>$null
        if ($LASTEXITCODE -eq 0 -and $resolved) {
            $candidates.Add([string]$resolved)
        }
    }

    $conda = Get-Command conda -ErrorAction SilentlyContinue
    if ($conda) {
        try {
            $condaInfo = (& $conda.Source env list --json | ConvertFrom-Json)
            foreach ($prefix in $condaInfo.envs) {
                $candidates.Add((Join-Path ([string]$prefix) 'python.exe'))
            }
        } catch {
            Write-Verbose "Could not enumerate Conda environments: $($_.Exception.Message)"
        }
    }

    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($python) {
        $candidates.Add($python.Source)
    }

    foreach ($candidate in $candidates | Select-Object -Unique) {
        $version = Get-PythonVersion -Executable $candidate
        if ($version -and $version.StartsWith('3.11.')) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    throw 'Python 3.11 was not found. Install Python 3.11 or pass -PythonPath with its python.exe path.'
}

try {
    $currentPython = Join-Path $VenvPath 'Scripts\python.exe'
    $currentVersion = Get-PythonVersion -Executable $currentPython
    if ($currentVersion -and $currentVersion.StartsWith('3.11.') -and -not $Recreate) {
        Write-Host "Using existing Python $currentVersion environment: $VenvPath" -ForegroundColor Green
        & $currentPython -m pip install -r (Join-Path $AiRoot 'requirements-dev.txt')
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
        & $currentPython -m pip check
        if ($LASTEXITCODE -ne 0) { throw 'Python dependency check failed.' }
        exit 0
    }

    if ((Test-Path -LiteralPath $VenvPath) -and -not $Recreate) {
        throw "Existing .venv uses Python $currentVersion. Run npm run setup:python:recreate to replace it with Python 3.11 while preserving a backup."
    }
    if (Test-Path -LiteralPath $CandidatePath) {
        throw "Temporary environment already exists: $CandidatePath"
    }
    if ((Test-Path -LiteralPath $VenvPath) -and (Test-Path -LiteralPath $BackupPath)) {
        throw "Backup already exists: $BackupPath. Move it elsewhere before recreating .venv."
    }

    $basePython = Find-Python311
    Write-Host "Creating Python 3.11 environment with $basePython" -ForegroundColor Cyan
    & $basePython -m venv $CandidatePath
    if ($LASTEXITCODE -ne 0) { throw 'Virtual environment creation failed.' }

    $candidatePython = Join-Path $CandidatePath 'Scripts\python.exe'
    & $candidatePython -m pip install --upgrade pip
    if ($LASTEXITCODE -ne 0) { throw 'pip upgrade failed.' }
    & $candidatePython -m pip install -r (Join-Path $AiRoot 'requirements-dev.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    & $candidatePython -m pip check
    if ($LASTEXITCODE -ne 0) { throw 'Python dependency check failed.' }

    if (Test-Path -LiteralPath $VenvPath) {
        Move-Item -LiteralPath $VenvPath -Destination $BackupPath
    }
    Move-Item -LiteralPath $CandidatePath -Destination $VenvPath

    $installedPython = Join-Path $VenvPath 'Scripts\python.exe'
    $installedVersion = Get-PythonVersion -Executable $installedPython
    if (-not $installedVersion.StartsWith('3.11.')) {
        throw "Installed environment has unexpected Python version: $installedVersion"
    }
    Write-Host "Python $installedVersion environment is ready: $VenvPath" -ForegroundColor Green
} finally {
    if (-not $NoPause -and $Host.Name -eq 'ConsoleHost') {
        Read-Host 'Press Enter to close'
    }
}
