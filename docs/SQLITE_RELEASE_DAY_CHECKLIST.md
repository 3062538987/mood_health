# SQLite 发布当天操作单

## 0. 前提确认

- 已固定 `DB_CLIENT=sqlite`
- 已固定 `SQLITE_DB_PATH` 为绝对路径
- `ENCRYPTION_KEY` 为合法 64 位 hex

## 1. 构建与预检

```powershell
npm --prefix mood-health-server run build
npm run sqlite:preflight
```

## 2. 启动服务

```powershell
npm --prefix mood-health-server run start
```

## 3. 基础可用性检查

```powershell
Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:3000/health'
```

## 3.1 一键冒烟（推荐）

```powershell
npm run release:smoke
```

如需跳过 AI 路由检查：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/release-smoke.ps1 -SkipAiRouteCheck
```

## 4. 核心接口最小回归

```powershell
$u = 'release_check_' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$regBody = @{ username = $u; email = ($u + '@example.com'); password = 'Pass123456' } | ConvertTo-Json
$null = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:3000/api/auth/register' -ContentType 'application/json' -Body $regBody

$loginBody = @{ username = $u; password = 'Pass123456' } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:3000/api/auth/login' -ContentType 'application/json' -Body $loginBody
$headers = @{ Authorization = ('Bearer ' + $login.data.token) }

$types = Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:3000/api/moods/types' -Headers $headers
$firstTypeId = $types.data[0].id

$recordBody = @{ emotions = @(@{ emotionTypeId = $firstTypeId; intensity = 7 }); tagIds = @(); trigger = 'release-check'; event = 'release-check-event'; recordDate = (Get-Date -Format 'yyyy-MM-dd') } | ConvertTo-Json -Depth 6
$record = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:3000/api/moods/record' -Headers $headers -ContentType 'application/json' -Body $recordBody

$list = Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:3000/api/moods/list?page=1&size=10' -Headers $headers
$trend = Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:3000/api/moods/trend?range=week' -Headers $headers
$weekly = Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:3000/api/moods/weekly-report' -Headers $headers
$analysis = Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:3000/api/moods/analysis?range=week' -Headers $headers

[PSCustomObject]@{
  username=$u
  recordCode=$record.code
  listCode=$list.code
  trendCode=$trend.code
  weeklyCode=$weekly.code
  analysisCode=$analysis.code
} | ConvertTo-Json -Depth 4
```

## 5. 落库核验

```powershell
$script = @'
const fs = require('fs')
const path = require('path')
const { DatabaseSync } = require('node:sqlite')

const envPath = path.join(process.cwd(), 'mood-health-server', '.env')
const envText = fs.readFileSync(envPath, 'utf8')
const lines = envText.split(/\r?\n/)
const pathLine = lines.find((line) => line.startsWith('SQLITE_DB_PATH='))

if (!pathLine) {
  throw new Error('未在 mood-health-server/.env 中找到 SQLITE_DB_PATH')
}

const rawDbPath = pathLine.slice('SQLITE_DB_PATH='.length).trim()
const resolvedDbPath = path.resolve(process.cwd(), rawDbPath)
const db = new DatabaseSync(resolvedDbPath, { open: true })
const users = db.prepare('SELECT COUNT(*) as c FROM users').get().c
const moods = db.prepare('SELECT COUNT(*) as c FROM moods').get().c
const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check
console.log(JSON.stringify({ dbPath: resolvedDbPath, users, moods, integrity }, null, 2))
'@
Set-Content -Path 'scripts/_tmp_release_db_check.cjs' -Value $script -Encoding UTF8
node scripts/_tmp_release_db_check.cjs
Remove-Item 'scripts/_tmp_release_db_check.cjs' -Force
```

## 6. 留档

- 复制 [docs/SQLITE_RELEASE_REPORT_TEMPLATE.md](docs/SQLITE_RELEASE_REPORT_TEMPLATE.md)
- 按当日结果填写并保存为 `docs/SQLITE_RELEASE_REPORT_YYYY-MM-DD.md`

## 7. 回滚

1. 停止后端服务
2. 还原 SQLite 备份文件
3. 回退代码到稳定版本
4. 重启并执行最小回归
