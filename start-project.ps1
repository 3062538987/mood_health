param(
    [switch]$NoAi,
    [switch]$WithAi,
    [switch]$PrepareInfrastructure,
    [switch]$Clean,
    [int]$NodePort = 3000,
    [int]$AiPort = 8001,
    [int]$FrontendPort = 3001
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Pm2Cli = Join-Path $Root 'node_modules\pm2\bin\pm2'
$BackendEntry = Join-Path $Root 'mood_health_server\dist\server.js'
$PythonExe = Join-Path $Root 'mood_health_ai_service\.venv\Scripts\python.exe'

function Remove-Pm2ProcessIfExists {
    param([Parameter(Mandatory)][string]$Name)

    & node $Pm2Cli delete $Name *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Verbose "PM2 process $Name did not exist."
    }
}

function Read-DotEnvFile {
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Environment file was not found: $Path"
    }

    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*#' -or $line -notmatch '^\s*([^=]+?)\s*=\s*(.*)\s*$') {
            continue
        }

        $value = $Matches[2]
        if ($value.Length -ge 2 -and
            (($value.StartsWith('"') -and $value.EndsWith('"')) -or
             ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $values[$Matches[1].Trim()] = $value
    }
    return $values
}

function Get-RequiredValue {
    param(
        [Parameter(Mandatory)][hashtable]$Values,
        [Parameter(Mandatory)][string]$Name
    )

    $value = [string]$Values[$Name]
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Missing required value $Name in the project .env file."
    }
    return $value
}

function New-InternalServiceToken {
    $bytes = New-Object byte[] 32
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    } finally {
        $generator.Dispose()
    }
    return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}

function Test-TcpPortAvailable {
    param([Parameter(Mandatory)][int]$Port)

    $listener = [System.Net.Sockets.TcpListener]::new(
        [System.Net.IPAddress]::Loopback,
        $Port
    )
    try {
        $listener.Start()
        return $true
    } catch {
        return $false
    } finally {
        $listener.Stop()
    }
}

function Get-AvailableTcpPort {
    param(
        [Parameter(Mandatory)][int]$PreferredPort,
        [int]$SearchLimit = 10
    )

    for ($offset = 0; $offset -lt $SearchLimit; $offset++) {
        $candidate = $PreferredPort + $offset
        if (Test-TcpPortAvailable -Port $candidate) {
            return $candidate
        }
    }
    throw "No free TCP port found from $PreferredPort to $($PreferredPort + $SearchLimit - 1)."
}

function Get-ComposePublishedPort {
    param(
        [Parameter(Mandatory)][string]$Service,
        [Parameter(Mandatory)][int]$ContainerPort
    )

    $mapping = & docker compose -p mood-health-ccooddee port $Service $ContainerPort 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $mapping) {
        return $null
    }

    $lastMapping = [string]@($mapping)[-1]
    if ($lastMapping -match ':(\d+)$') {
        return [int]$Matches[1]
    }
    return $null
}

function Stop-StaleWorkspaceServices {
    param([Parameter(Mandatory)][int[]]$Ports)

    $serviceMarkers = @(
        'MoodHealth - FastAPI AI',
        'MoodHealth - Node Backend',
        'MoodHealth - Frontend'
    )
    $workspaceWrappers = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $commandLine = [string]$_.CommandLine
            $belongsToWorkspace = $commandLine.IndexOf($Root, [StringComparison]::OrdinalIgnoreCase) -ge 0
            $isServiceWrapper = $serviceMarkers | Where-Object { $commandLine.Contains($_) }
            $belongsToWorkspace -and $isServiceWrapper
        }
    foreach ($wrapper in $workspaceWrappers) {
        Write-Host "Stopping stale workspace process tree (PID $($wrapper.ProcessId))..." -ForegroundColor Yellow
        & taskkill.exe /PID $wrapper.ProcessId /T /F *> $null
    }

    foreach ($port in $Ports) {
        $owners = & netstat -ano -p TCP |
            Select-String -Pattern "^\s*TCP\s+\S+:$port\s+.*LISTENING\s+(\d+)\s*$" |
            ForEach-Object { if ($_.Line -match 'LISTENING\s+(\d+)\s*$') { [int]$Matches[1] } } |
            Sort-Object -Unique
        foreach ($ownerPid in $owners) {
            $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerPid" -ErrorAction SilentlyContinue
            if ($processInfo -and
                $processInfo.CommandLine -and
                $processInfo.CommandLine.IndexOf($Root, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
                Write-Host "Stopping stale workspace service on port $port (PID $ownerPid)..." -ForegroundColor Yellow
                Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

function Wait-ServiceEndpoint {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Uri,
        [int]$TimeoutSeconds = 90
    )

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 3
            if ($response.StatusCode -eq 200) {
                Write-Host "$Name is ready: $Uri" -ForegroundColor Green
                return
            }
        } catch {
            # The service may still be starting. Retry until the deadline.
        }

        Start-Sleep -Seconds 2
    } while ([DateTime]::UtcNow -lt $deadline)

    throw "Timed out waiting for $Name at $Uri. Check the $Name service window for errors."
}

function Sync-MySqlAppCredentials {
    $syncScript = @'
set -eu
user_hex="$(printf '%s' "$MYSQL_USER" | od -An -tx1 | tr -d ' \n')"
password_hex="$(printf '%s' "$MYSQL_PASSWORD" | od -An -tx1 | tr -d ' \n')"

MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket --user=root --batch --execute="
SET @user_name = CONVERT(0x${user_hex} USING utf8mb4);
SET @user_password = CONVERT(0x${password_hex} USING utf8mb4);
SET @account = CONCAT(QUOTE(@user_name), '@''%''');
SET @create_sql = CONCAT('CREATE USER IF NOT EXISTS ', @account, ' IDENTIFIED BY ', QUOTE(@user_password));
PREPARE create_user FROM @create_sql;
EXECUTE create_user;
DEALLOCATE PREPARE create_user;
SET @alter_sql = CONCAT('ALTER USER ', @account, ' IDENTIFIED BY ', QUOTE(@user_password));
PREPARE alter_user FROM @alter_sql;
EXECUTE alter_user;
DEALLOCATE PREPARE alter_user;
"
'@

    $syncScript | & docker compose -p mood-health-ccooddee exec -T mysql sh -s
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not synchronize the MySQL application credentials.'
    }
}

function Initialize-LocalInfrastructure {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker Desktop is required but docker.exe was not found.'
    }

    & docker info *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Docker Desktop is stopped. Starting it now...' -ForegroundColor Yellow
        & docker desktop start --timeout 120
        if ($LASTEXITCODE -ne 0) {
            throw 'Docker Desktop did not become ready within 120 seconds.'
        }
    }

    $projectEnv = Read-DotEnvFile -Path "$Root\.env"
    $backendEnv = Read-DotEnvFile -Path "$Root\mood_health_server\.env"
    $mysqlPort = Get-ComposePublishedPort -Service 'mysql' -ContainerPort 3306
    if (-not $mysqlPort) {
        $mysqlPort = Get-AvailableTcpPort -PreferredPort 3316
    }
    $redisPort = Get-ComposePublishedPort -Service 'redis' -ContainerPort 6379
    if (-not $redisPort) {
        $redisPort = Get-AvailableTcpPort -PreferredPort 6379
    }

    $env:MYSQL_HOST = '127.0.0.1'
    $env:MYSQL_PORT = [string]$mysqlPort
    $env:MYSQL_DATABASE = Get-RequiredValue -Values $projectEnv -Name 'MYSQL_DATABASE'
    $env:MYSQL_APP_USER = Get-RequiredValue -Values $projectEnv -Name 'MYSQL_APP_USER'
    $env:MYSQL_APP_PASSWORD = Get-RequiredValue -Values $projectEnv -Name 'MYSQL_APP_PASSWORD'
    $env:MYSQL_MIGRATOR_USER = $env:MYSQL_APP_USER
    $env:MYSQL_MIGRATOR_PASSWORD = $env:MYSQL_APP_PASSWORD
    $env:REDIS_HOST = '127.0.0.1'
    $env:REDIS_PORT = [string]$redisPort
    $env:REDIS_PASSWORD = Get-RequiredValue -Values $projectEnv -Name 'REDIS_PASSWORD'
    $env:REDIS_URL = "redis://127.0.0.1:${redisPort}/0"

    Write-Host "Starting isolated MySQL ($mysqlPort) and Redis ($redisPort)..." -ForegroundColor Yellow
    & docker compose -p mood-health-ccooddee up -d --wait --wait-timeout 120 mysql redis
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Compose could not start the local MySQL and Redis services.'
    }

    Write-Host 'Synchronizing MySQL application credentials...' -ForegroundColor Yellow
    Sync-MySqlAppCredentials

    Write-Host 'Running database migrations...' -ForegroundColor Yellow
    & npm --prefix mood_health_server run db:migrate
    if ($LASTEXITCODE -ne 0) {
        throw 'Database migration failed.'
    }

    Write-Host 'Seeding required reference data...' -ForegroundColor Yellow
    & npm --prefix mood_health_server run db:seed:reference
    if ($LASTEXITCODE -ne 0) {
        throw 'Database reference seed failed.'
    }

    if ([string]$backendEnv['ALLOW_DEMO_SEED'] -eq 'true') {
        Write-Host 'Seeding enabled demo accounts...' -ForegroundColor Yellow
        & npm --prefix mood_health_server run db:seed:demo
        if ($LASTEXITCODE -ne 0) {
            throw 'Database demo seed failed.'
        }
    }
}

if ($Clean) {
    Write-Host "Cleaning old windows..." -ForegroundColor Yellow
    Get-Process powershell -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowTitle -like '*MoodHealth*' } |
        ForEach-Object { & taskkill.exe /PID $_.Id /T /F *> $null }
    Stop-StaleWorkspaceServices -Ports @($NodePort, $AiPort, $FrontendPort)
    Remove-Pm2ProcessIfExists -Name 'mood-health-server'
    Write-Host "Cleaned." -ForegroundColor Green
    exit 0
}

if ($NoAi -and $WithAi) {
    throw 'Cannot use -NoAi and -WithAi together.'
}

if ($PrepareInfrastructure) {
    Initialize-LocalInfrastructure
}

$serviceEnv = Read-DotEnvFile -Path "$Root\mood_health_server\.env"
if ([string]::IsNullOrWhiteSpace($env:MYSQL_HOST)) {
    $env:MYSQL_HOST = Get-RequiredValue -Values $serviceEnv -Name 'MYSQL_HOST'
}
if ([string]::IsNullOrWhiteSpace($env:MYSQL_PORT)) {
    $env:MYSQL_PORT = Get-RequiredValue -Values $serviceEnv -Name 'MYSQL_PORT'
}
if ([string]::IsNullOrWhiteSpace($env:MYSQL_APP_USER)) {
    $env:MYSQL_APP_USER = Get-RequiredValue -Values $serviceEnv -Name 'MYSQL_APP_USER'
}
if ([string]::IsNullOrWhiteSpace($env:MYSQL_APP_PASSWORD)) {
    $env:MYSQL_APP_PASSWORD = Get-RequiredValue -Values $serviceEnv -Name 'MYSQL_APP_PASSWORD'
}
if ([string]::IsNullOrWhiteSpace($env:REDIS_HOST)) {
    $env:REDIS_HOST = Get-RequiredValue -Values $serviceEnv -Name 'REDIS_HOST'
}
if ([string]::IsNullOrWhiteSpace($env:REDIS_PORT)) {
    $env:REDIS_PORT = Get-RequiredValue -Values $serviceEnv -Name 'REDIS_PORT'
}
if ([string]::IsNullOrWhiteSpace($env:REDIS_PASSWORD)) {
    $env:REDIS_PASSWORD = [string]$serviceEnv['REDIS_PASSWORD']
}

# FastAPI uses MYSQL_USER/MYSQL_PASSWORD while Node uses MYSQL_APP_*.
$env:MYSQL_USER = $env:MYSQL_APP_USER
$env:MYSQL_PASSWORD = $env:MYSQL_APP_PASSWORD
$configuredInternalToken = [string]$serviceEnv['AI_SERVICE_INTERNAL_TOKEN']
$env:AI_SERVICE_INTERNAL_TOKEN = if ([string]::IsNullOrWhiteSpace($configuredInternalToken)) {
    New-InternalServiceToken
} else {
    $configuredInternalToken
}

# Clean old windows
Get-Process powershell -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -like '*MoodHealth*' } |
    ForEach-Object { & taskkill.exe /PID $_.Id /T /F *> $null }
Stop-StaleWorkspaceServices -Ports @($NodePort, $AiPort, $FrontendPort)

# 1. Start backend (FastAPI + Node)
if (-not $NoAi) {
    if (-not (Test-Path -LiteralPath $PythonExe)) {
        throw 'Python environment is missing. Run npm run setup:python first.'
    }
    $pythonVersion = & $PythonExe -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
    if ($LASTEXITCODE -ne 0 -or $pythonVersion -ne '3.11') {
        throw "The AI service requires Python 3.11, but .venv reports $pythonVersion. Run npm run setup:python."
    }
    Write-Host "[1/3] Starting FastAPI AI service (port $AiPort)..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList @(
        '-NoExit',
        '-Command',
        "`$host.UI.RawUI.WindowTitle='MoodHealth - FastAPI AI'; `$env:MOOD_AI_SERVICE_PORT='$AiPort'; `$env:HF_HUB_OFFLINE='1'; `$env:TRANSFORMERS_OFFLINE='1'; Set-Location '$Root\mood_health_ai_service'; &'$PythonExe' -m uvicorn app.main:app --host 0.0.0.0 --port $AiPort"
    )
}

Write-Host '[2/3] Building and starting Node backend through PM2...' -ForegroundColor Yellow
& npm --prefix mood_health_server run build
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $BackendEntry)) {
    throw 'Node backend production build failed.'
}
Remove-Pm2ProcessIfExists -Name 'mood-health-server'
$env:PORT = [string]$NodePort
$env:AI_SERVICE_BASE_URL = "http://127.0.0.1:${AiPort}"
$env:FASTAPI_BASE_URL = "http://127.0.0.1:${AiPort}"
& node $Pm2Cli start "$Root\mood_health_server\ecosystem.config.js" --only mood-health-server --update-env
if ($LASTEXITCODE -ne 0) {
    throw 'PM2 could not start mood-health-server.'
}

# 2. Start frontend
Write-Host "[3/3] Starting Vite frontend (port $FrontendPort)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-Command',
    "`$host.UI.RawUI.WindowTitle='MoodHealth - Frontend'; Write-Host '=== Vite Frontend (port $FrontendPort) ===' -ForegroundColor Cyan; Set-Location '$Root'; npm run dev"
)

Write-Host ""
Write-Host "Waiting for application services..." -ForegroundColor Yellow
Wait-ServiceEndpoint -Name 'Node backend' -Uri "http://127.0.0.1:${NodePort}/health"
if (-not $NoAi) {
    try {
        Wait-ServiceEndpoint -Name 'FastAPI RAG readiness' -Uri "http://127.0.0.1:${AiPort}/api/health/ready" -TimeoutSeconds 180
    } catch {
        throw "FastAPI RAG is not ready. Check whether the embedding model or vector index can initialize, then inspect the AI service window. $($_.Exception.Message)"
    }
}
Wait-ServiceEndpoint -Name 'Vue frontend' -Uri "http://127.0.0.1:${FrontendPort}/"

Write-Host ""
Write-Host "=== All services are ready ===" -ForegroundColor Green
Write-Host "Frontend: http://localhost:${FrontendPort}" -ForegroundColor Green
Write-Host "Backend:  http://localhost:${NodePort}" -ForegroundColor Green
if (-not $NoAi) {
    Write-Host "FastAPI:  http://127.0.0.1:${AiPort}/api/health/ready" -ForegroundColor Green
}
Write-Host ""
Write-Host "Tip: If Node window closes immediately, check MySQL and .env config." -ForegroundColor Yellow
Write-Host "Close each window to stop the corresponding service." -ForegroundColor Yellow
