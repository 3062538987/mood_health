param(
    [Parameter(Mandatory=$true)]
    [string]$Port,
    [Parameter(Mandatory=$true)]
    [string]$FrontendPort
)

$logFile = ".tmp-webserver-$Port.log"
"Starting backend on port $Port" | Out-File -FilePath $logFile -Encoding utf8

try {
    $env:NODE_ENV='test'
    $env:HOST='127.0.0.1'
    $env:PORT=$Port
    $env:VITE_API_BASE_URL="http://127.0.0.1:$Port"
    $env:FRONTEND_URL="http://127.0.0.1:$FrontendPort"
    $env:MYSQL_HOST='127.0.0.1'
    $env:MYSQL_PORT=$env:E2E_MYSQL_PORT
    $env:MYSQL_DATABASE='mood_health_e2e'
    $env:MYSQL_APP_USER='mood_app'
    $env:MYSQL_APP_PASSWORD='Jyf350721$'
    $env:MYSQL_MIGRATOR_USER='mood_app'
    $env:MYSQL_MIGRATOR_PASSWORD='Jyf350721$'
    $env:REDIS_REQUIRED='false'
    $env:ALLOW_DEMO_SEED='true'
    $env:DEMO_PASSWORD='E2eDemoPass123!'
    $env:JWT_SECRET='e2e-jwt-secret-for-local-playwright-only'
    $env:ENCRYPTION_KEY='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

    & node mood_health_server/dist/server.js 2>&1 | Tee-Object -FilePath $logFile -Append
} catch {
    "ERROR: $_" | Out-File -FilePath $logFile -Append
    exit 1
}
