<#
并行启动（单窗口）
说明：使用 npx concurrently 在同一终端窗口运行所有服务（可看到合并输出）。
要求：npm (含 npx)，或安装 concurrently 全局。
#>

$root = "D:\\桌面\\Code\\大学生情绪健康\\mood-health-web"
$frontendDir = $root
$backendDir = Join-Path $root "mood-health-server"

function Fail([string]$msg){ Write-Error $msg; exit 1 }
function Check-Command([string]$name){ return (Get-Command $name -ErrorAction SilentlyContinue) -ne $null }

if (-not (Check-Command node)) { Fail "Node.js 未找到，请安装并将 node 添加到 PATH。" }
if (-not (Check-Command npm)) { Fail "npm 未找到，请安装 Node.js/npm 并确保 npm 在 PATH。" }

# 找到 Python
$pythonCmd = $null
if (Check-Command python) { $pythonCmd = (Get-Command python).Source }
elseif (Check-Command py) { $pythonCmd = (Get-Command py).Source }
if (-not $pythonCmd) { Fail "Python 未找到，请安装并将 python/py 添加到 PATH。" }

Write-Host "检查并确保 uvicorn/fastapi 已安装..."
& $pythonCmd -m pip show uvicorn > $null 2>&1
if ($LASTEXITCODE -ne 0) { & $pythonCmd -m pip install uvicorn fastapi }

if (-not (Check-Command npx)) { Write-Warning "未检测到 npx；若无法使用，可执行：npm i -g concurrently，然后手动运行 concurrently。"; exit 1 }

$cmd1 = "cd /d `"$frontendDir`" && npm run dev"
$cmd2 = "cd /d `"$backendDir`" && npm run dev"
$cmd3 = "cd /d `"$backendDir`" && `$pythonCmd -m uvicorn main:app --host 0.0.0.0 --port 8000"

Write-Host "使用 npx concurrently 合并输出（按 Ctrl+C 停止）..."
& npx concurrently --names "FE,BE,AI" --prefix "[{name}]" "$cmd1" "$cmd2" "$cmd3"
