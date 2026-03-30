$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$envPath = Join-Path $repoRoot 'mood-health-server/.env'
if (-not (Test-Path $envPath)) {
  throw "Missing env file: $envPath"
}

$envText = Get-Content $envPath -Raw -Encoding UTF8

function Get-EnvValue([string]$key) {
  $pattern = "(?m)^" + [Regex]::Escape($key) + "=(.*)$"
  $match = [Regex]::Match($envText, $pattern)
  if ($match.Success) {
    return $match.Groups[1].Value.Trim()
  }
  return ''
}

$dbClient = Get-EnvValue 'DB_CLIENT'
$sqliteDbPathRaw = Get-EnvValue 'SQLITE_DB_PATH'

if ([string]::IsNullOrWhiteSpace($dbClient)) {
  $dbClient = 'sqlite'
}

if ($dbClient.ToLower() -ne 'sqlite') {
  Write-Host ("DB_CLIENT is '{0}', not sqlite." -f $dbClient)
  exit 1
}

if ([string]::IsNullOrWhiteSpace($sqliteDbPathRaw)) {
  $sqliteDbPathRaw = 'data/mood-health.db'
}

$script = @'
const fs = require('fs')
const path = require('path')
const { DatabaseSync } = require('node:sqlite')

const rawPath = process.argv[2]
const resolvedPath = path.resolve(process.cwd(), rawPath)

if (!fs.existsSync(resolvedPath)) {
  console.log(JSON.stringify({
    exists: false,
    rawPath,
    resolvedPath
  }, null, 2))
  process.exit(0)
}

const db = new DatabaseSync(resolvedPath, { open: true })
const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name)

const targets = [
  'users','moods','emotion_types','tags','mood_emotions','mood_tags',
  'activities','activity_participants','questionnaires','questions','user_answers',
  'posts','comments','operation_logs'
]

const counts = {}
for (const t of targets) {
  if (tables.includes(t)) {
    counts[t] = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get().c
  }
}

console.log(JSON.stringify({
  exists: true,
  rawPath,
  resolvedPath,
  integrity,
  tableCount: tables.length,
  counts
}, null, 2))
'@

$tempScript = Join-Path $repoRoot 'scripts/_tmp_sqlite_status.cjs'
Set-Content -Path $tempScript -Value $script -Encoding UTF8

try {
  node $tempScript $sqliteDbPathRaw
} finally {
  if (Test-Path $tempScript) {
    Remove-Item $tempScript -Force
  }
}
