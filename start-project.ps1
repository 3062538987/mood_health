<#
启动脚本（PowerShell）
功能：
- 检查 Node.js / npm / Python
- 检查并安装 Python 包：uvicorn, fastapi
- 检查 Ollama（提示，不强制）
- 在新窗口中分别启动前端（npm run dev）、后端（mood-health-server npm run dev）和 AI 服务（uvicorn ollama_server:app）
#>

# 配置：根据你的路径修改（已使用你提供的路径）
$root = "D:\\桌面\\Code\\大学生情绪健康\\mood-health-web"
$frontendDir = $root
$backendDir = Join-Path $root "mood-health-server"

function Fail([string]$msg){ Write-Error $msg; exit 1 }

function Check-Command([string]$name){
    return (Get-Command $name -ErrorAction SilentlyContinue) -ne $null
}

Write-Host "检查系统依赖..."
if (-not (Check-Command node)) { Fail "Node.js 未找到，请安装并将 node 添加到 PATH。" }
if (-not (Check-Command npm)) { Fail "npm 未找到，请安装 Node.js/npm 并确保 npm 在 PATH。" }

# 找到 Python 可执行文件（优先项目虚拟环境，其次系统 python/py）
$pythonCmd = $null
# 常见项目虚拟环境路径
$venvCandidates = @(
    Join-Path $root ".venv\Scripts\python.exe",
    Join-Path $root "venv\Scripts\python.exe",
    Join-Path $root "env\Scripts\python.exe"
)
foreach ($p in $venvCandidates) {
    if (Test-Path $p) { $pythonCmd = $p; Write-Host "使用项目虚拟环境 Python: $pythonCmd"; break }
}
if (-not $pythonCmd) {
    if (Check-Command python) { $pythonCmd = (Get-Command python).Source }
    elseif (Check-Command py) { $pythonCmd = (Get-Command py).Source }
}
if (-not $pythonCmd) { Fail "Python 未找到，请安装并将 python/py 添加到 PATH，或在项目根创建虚拟环境 (.venv)。" }

Write-Host "使用 Python: $pythonCmd"

function Ensure-PyPkg([string]$pkg){
    Write-Host "检查 Python 包：$pkg ..."
    & $pythonCmd -m pip show $pkg > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "$pkg 未安装，尝试通过 pip 安装..."
        & $pythonCmd -m pip install $pkg
        if ($LASTEXITCODE -ne 0) { Fail "自动安装 $pkg 失败，请手动安装：$pythonCmd -m pip install $pkg" }
    } else {
        Write-Host "$pkg 已安装"
    }
}

Ensure-PyPkg uvicorn
Ensure-PyPkg fastapi

# 检查 Ollama（可选）
if (-not (Check-Command ollama)) {
    Write-Warning "未检测到 Ollama，可选服务。若需使用，请安装 Ollama 并拉取模型 deepseek-r1:1.5b（或本地替代）。脚本将继续启动其他服务。"
} else {
    Write-Host "检测到 Ollama，可用来运行本地模型（若需要）。"
}

Write-Host "准备在新终端中启动服务..."

# 启动前端（新 PowerShell 窗口）
Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location -LiteralPath '$frontendDir'; Write-Host '启动前端: http://localhost:5173'; npm run dev"
) -WorkingDirectory $frontendDir

# 启动后端（新 PowerShell 窗口）
Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location -LiteralPath '$backendDir'; Write-Host '启动后端: http://localhost:5000'; npm run dev"
) -WorkingDirectory $backendDir

# 启动 AI 服务（新 PowerShell 窗口）
Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location -LiteralPath '$backendDir'; Write-Host '启动 AI 服务: http://localhost:8000'; & '$pythonCmd' -m uvicorn ollama_server:app --host 0.0.0.0 --port 8000"
) -WorkingDirectory $backendDir

Write-Host "已在新窗口中启动所有服务。访问地址："
Write-Host "- 前端: http://localhost:5173"
Write-Host "- 后端: http://localhost:5000"
Write-Host "- AI 服务: http://localhost:8000"

Write-Host "如果你希望将它们合并到一个终端窗口运行，请使用 start-all-concurrently.ps1（需要 npx concurrently）。"
