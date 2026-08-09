param(
  [string]$DatabaseName = 'mood_health_e2e'
)

$ErrorActionPreference = 'Stop'

if ($DatabaseName -notmatch '^[A-Za-z0-9_]+$') {
  throw 'E2E database name may contain only letters, numbers, and underscores.'
}

$containerScript = @'
set -eu
MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --user=root --execute="CREATE DATABASE IF NOT EXISTS ${E2E_MYSQL_DATABASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON ${E2E_MYSQL_DATABASE}.* TO '${MYSQL_USER}'@'%';"
'@

$containerScript | docker compose -p mood-health-ccooddee exec -T `
  -e "E2E_MYSQL_DATABASE=$DatabaseName" mysql sh

if ($LASTEXITCODE -ne 0) {
  throw "Failed to provision E2E database '$DatabaseName'."
}
