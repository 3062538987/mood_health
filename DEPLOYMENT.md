# 部署指南

本文档用于将项目部署到生产或准生产环境。当前仓库包含三个核心服务：

- 前端静态站点（Vite 构建产物）
- Node API 服务（mood-health-server/dist/app.js）
- Python AI 服务（mood-health-server/main.py）

命令以 `docs/COMMANDS.md` 为统一索引；本文件仅保留部署场景下最关键命令，避免多处重复维护。

## 1. 前置依赖

- Node.js 18+
- Python 3.8+
- Redis（建议）
- SQL Server（按项目配置）
- PM2（可选，推荐用于常驻）
- Nginx（可选，用于反向代理）

## 2. 配置文件

项目中未统一提供 `.env.example`，请按实际环境创建：

- 根目录 `.env`（前端 Vite 变量）
- `mood-health-server/.env`（后端与 AI 服务变量）

建议至少校验以下变量：

- `VITE_API_BASE_URL`
- `NODE_ENV`
- `FRONTEND_URL`
- `DB_SERVER`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`
- `JWT_SECRET`、`ENCRYPTION_KEY`
- `REDIS_URL`
- `OLLAMA_URL`、`OLLAMA_MODEL`

## 3. 安装与构建

在仓库根目录执行：

```bash
npm run setup
npm run build:all
```

安装 Python 依赖：

```bash
# Linux/macOS
python -m venv .venv
source .venv/bin/activate
pip install -r mood-health-server/requirements.txt

# Windows（可选脚本）
npm run setup:python
```

## 4. 数据初始化

```bash
# 基础演示数据
npm run demo:init

# 全量演示数据 + 校验
npm run demo:init:all
```

可通过环境变量设置密码：

```bash
# Linux/macOS
export DEMO_USER_PASSWORD=123456

# Windows PowerShell
$env:DEMO_USER_PASSWORD="123456"
```

## 5. 生产启动

### 方案 A：PM2（推荐）

Windows 下可直接使用：

```powershell
npm run start-all:check
```

Linux/macOS 下可使用：

```bash
chmod +x ./start-project.sh
npm run start-all:linux
```

这会先执行 `doctor`，再启动 `mood-health-server` 与 `mood-ai-server`。

常用命令：

```bash
npm run pm2:status
npm run pm2:logs
npm run pm2:stop
```

### 方案 B：手动启动

```bash
# 终端 1：Node API
npm --prefix mood-health-server run build
npm --prefix mood-health-server run start

# 终端 2：Python AI
cd mood-health-server
python main.py

# 终端 3：前端（开发或静态服务）
npm run dev
# 或将 dist/ 交由 Nginx 托管
```

## 6. 健康检查

```bash
npm run doctor
```

`doctor` 会检查：

- node/npm/python/pm2 可用性
- 关键文件与目录存在性
- 端口 5173/3000/8000/6379 连通性

可使用严格模式：

```bash
npm run doctor:strict
```

## 7. Nginx 反向代理（示例）

可参考仓库根目录 `nginx.conf` 与 `mood-health-server/nginx.conf.example`。

典型策略：

- `/` -> 前端静态文件
- `/api` -> Node API（3000）
- `/ai` 或对应路径 -> Python AI（8000）

## 8. 更新与回滚

### 更新

```bash
git pull
npm run setup
npm run build:all
npm run start-all
```

### 回滚

```bash
git revert <commit>
npm run build:all
npm run start-all
```

## 9. 故障排查

1. `doctor` 报 `dist/app.js missing`

- 执行 `npm --prefix mood-health-server run build`

2. AI 服务读取 `.env` 报编码错误（Windows）

- 设置 `PYTHONUTF8=1`，`start-project.ps1` 已自动设置

3. PM2 频繁重启

- 检查 3000/8000 端口占用、Python 模型加载内存、`.env` 配置

4. Redis 不可达

- 服务可降级运行，但缓存与部分性能能力会受影响
