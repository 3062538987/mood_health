param(
  [string]$BaseUrl = 'http://127.0.0.1:3000',
  [switch]$SkipAiRouteCheck
)

$ErrorActionPreference = 'Stop'

function Assert-CodeZero {
  param(
    [string]$Name,
    $Response
  )

  if ($null -eq $Response) {
    throw "$Name failed: empty response"
  }

  if ($Response.code -ne 0 -and $Response.code -ne 200) {
    throw "$Name failed: code=$($Response.code)"
  }
}

$BaseUrl = $BaseUrl.TrimEnd('/')
$username = 'release_smoke_' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

$registerBody = @{ username = $username; email = ($username + '@example.com'); password = 'Pass123456' } | ConvertTo-Json
$null = Invoke-RestMethod -Method Post -Uri ($BaseUrl + '/api/auth/register') -ContentType 'application/json' -Body $registerBody -TimeoutSec 20

$loginBody = @{ username = $username; password = 'Pass123456' } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri ($BaseUrl + '/api/auth/login') -ContentType 'application/json' -Body $loginBody -TimeoutSec 20
Assert-CodeZero -Name 'login' -Response $login

$token = $login.data.token
if ([string]::IsNullOrWhiteSpace($token)) {
  throw 'login failed: token is empty'
}

$headers = @{ Authorization = ('Bearer ' + $token) }

$health = Invoke-RestMethod -Method Get -Uri ($BaseUrl + '/health') -TimeoutSec 10
if ($health.status -ne 'ok') {
  throw "health failed: status=$($health.status)"
}

$types = Invoke-RestMethod -Method Get -Uri ($BaseUrl + '/api/moods/types') -Headers $headers -TimeoutSec 20
Assert-CodeZero -Name 'moods/types' -Response $types

if ($types.data.Count -lt 1) {
  throw 'moods/types failed: empty emotion type list'
}

$firstTypeId = $types.data[0].id
$recordBody = @{ emotions = @(@{ emotionTypeId = $firstTypeId; intensity = 7 }); tagIds = @(); trigger = 'release-smoke'; event = 'release-smoke-event'; recordDate = (Get-Date -Format 'yyyy-MM-dd') } | ConvertTo-Json -Depth 6
$record = Invoke-RestMethod -Method Post -Uri ($BaseUrl + '/api/moods/record') -Headers $headers -ContentType 'application/json' -Body $recordBody -TimeoutSec 20
Assert-CodeZero -Name 'moods/record' -Response $record

$list = Invoke-RestMethod -Method Get -Uri ($BaseUrl + '/api/moods/list?page=1&size=10') -Headers $headers -TimeoutSec 20
Assert-CodeZero -Name 'moods/list' -Response $list

$trend = Invoke-RestMethod -Method Get -Uri ($BaseUrl + '/api/moods/trend?range=week') -Headers $headers -TimeoutSec 20
Assert-CodeZero -Name 'moods/trend' -Response $trend

$analysis = Invoke-RestMethod -Method Get -Uri ($BaseUrl + '/api/moods/analysis?range=week') -Headers $headers -TimeoutSec 20
Assert-CodeZero -Name 'moods/analysis' -Response $analysis

$aiCheck = 'skipped'
if (-not $SkipAiRouteCheck) {
  $aiBody = @{ message = '我最近压力有点大'; mood = @('焦虑') } | ConvertTo-Json -Depth 6
  $aiResponse = Invoke-RestMethod -Method Post -Uri ($BaseUrl + '/api/ai/counseling') -Headers $headers -ContentType 'application/json' -Body $aiBody -TimeoutSec 20

  if ($aiResponse.code -eq 0 -or $aiResponse.code -eq 200) {
    $aiCheck = 'ok'
  } else {
    throw "ai/counseling failed: code=$($aiResponse.code)"
  }
}

[PSCustomObject]@{
  baseUrl = $BaseUrl
  username = $username
  healthStatus = $health.status
  redisStatus = $health.redis
  moodsRecordCode = $record.code
  moodsListCode = $list.code
  moodsTrendCode = $trend.code
  moodsAnalysisCode = $analysis.code
  aiRouteCheck = $aiCheck
  timestamp = (Get-Date).ToString('s')
} | ConvertTo-Json -Depth 5
