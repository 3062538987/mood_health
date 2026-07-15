# 部署指南

本文档用于将项目部署到生产或准生产环境。当前仓库包含三个核心服务：

- 前端静态站点（Vite 构建产物）
- Node API 服务（mood_health_server/dist/server.js）
- Python AI 服务（mood_health_server/main.py）

命令以 `docs/COMMANDS.md` 为统一索引；本文件仅保留部署场景下最关键命令，避免多处重复维护。

## 1. 前置依赖

- Node.js 22+
- Python 3.8+
- Docker 与 Docker Compose
- MySQL 8.4 LTS
- Redis 7.4
- PM2（可选，推荐用于常驻）
- Nginx（可选，用于反向代理）

## 2. 配置文件

项目中提供了可直接复制的环境模板，请按实际环境创建：

- 根目录 `.env`（前端 Vite 变量）
- `mood_health_server/.env`（后端与 AI 服务变量）

可参考模板：

- `.env.production.example`（前端生产）
- `mood_health_server/.env.production.no-ai.example`（后端 2核2G 无 AI 推理）
- `mood_health_server/.env.example`（后端通用示例）

建议至少校验以下变量：

- `VITE_API_BASE_URL`
- `NODE_ENV`
- `FRONTEND_URL`
- `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_DATABASE`
- `MYSQL_APP_USER`、`MYSQL_APP_PASSWORD`
- `MYSQL_MIGRATOR_USER`、`MYSQL_MIGRATOR_PASSWORD`
- `JWT_SECRET`、`ENCRYPTION_KEY`
- `REDIS_URL`
- `AI_ENABLED`（2核2G 建议 `false`）
- `AI_SERVICE_BASE_URL`（仅 `AI_ENABLED=true` 时需要）
- `OLLAMA_URL`、`OLLAMA_MODEL`

## 3. 安装与构建

在仓库根目录执行：

```bash
npm run setup
npm run build:all
```

如果你要直接做首发部署，Linux 上建议优先用一键脚本：

```bash
npm run deploy:linux
```

这个脚本会做下面几件事：

- 如果 `mood_health_server/.env` 不存在，就先从 `mood_health_server/.env.production.no-ai.example` 复制
- 自动生成 `JWT_SECRET` 和 `ENCRYPTION_KEY`
- 使用环境模板中的 MySQL 连接配置
- 安装依赖、构建前后端、启动 PM2、检查 `http://127.0.0.1:3000/health`

安装 Python 依赖：

```bash
# Linux/macOS
python -m venv .venv
source .venv/bin/activate
pip install -r mood_health_server/requirements.txt

# Windows（可选脚本）
npm run setup:python
```

## 4. 数据初始化

```bash
# Schema Migration
npm --prefix mood_health_server run db:migrate

# Reference + Demo + Test Seed
npm run demo:init:all
```

可通过环境变量设置密码：

```bash
# Linux/macOS
export DEMO_PASSWORD='请设置本地演示密码'

# Windows PowerShell
$env:DEMO_PASSWORD="请设置本地演示密码"
```

## 5. 生产启动

### 方案 A：PM2（推荐）

Windows 下可直接使用：

```powershell
npm run start-all:check
npm run start-all:no-ai
```

Linux/macOS 下可使用：

```bash
chmod +x ./start-project.sh
npm run start-all:linux
npm run start-all:linux:no-ai
```

如果你是第一次上线，建议先执行：

```bash
npm run deploy:linux
```

这会先执行 `doctor`，再启动 `mood-health-server`，并根据 `AI_ENABLED` 决定是否启动 `mood-ai-server`。

当前仓库内置启动脚本仅托管 `mood-health-server`（Node API）。

- `-NoAi` / `--no-ai`：将 `AI_ENABLED=false` 注入进程环境（推荐 2核2G）
- `-WithAi` / `--with-ai`：将 `AI_ENABLED=true` 注入进程环境（需额外部署 Python AI 服务）

命令行也可显式覆盖：

```powershell
powershell -ExecutionPolicy Bypass -File ./start-project.ps1 -NoAi
powershell -ExecutionPolicy Bypass -File ./start-project.ps1 -WithAi
```

```bash
bash ./start-project.sh --no-ai
bash ./start-project.sh --with-ai
```

如需启用 AI，请单独常驻 Python 服务（例如 systemd/PM2/supervisor），并确保 `AI_SERVICE_BASE_URL` 可达。

常用命令：

```bash
npm run pm2:status
npm run pm2:logs
npm run pm2:stop
```

### 方案 B：手动启动

```bash
# 终端 1：Node API
npm --prefix mood_health_server run build
npm --prefix mood_health_server run start

# 终端 2：Python AI
cd mood_health_server
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

说明：后端活动运行时只连接 MySQL；旧 SQLite 文件仅作离线备份，不参与启动。

可使用严格模式：

```bash
npm run doctor:strict
```

## 7. Nginx 反向代理（示例）

可参考仓库根目录 `nginx.conf`、`nginx.linux.conf` 与 `mood_health_server/nginx.conf.example`。

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
bash ./start-project.sh --no-ai
curl -fsS http://127.0.0.1:3000/health
```

### 回滚

```bash
git revert <commit>
npm run build:all
npm run start-all
```

## 9. 故障排查

1. `doctor` 报 `dist/server.js missing`

- 执行 `npm --prefix mood_health_server run build`
- 如果 `mood_health_server/.env` 不存在，先复制 `mood_health_server/.env.production.no-ai.example` 到 `mood_health_server/.env`

2. 启动脚本提示 `Environment file missing`

- 执行 `cp mood_health_server/.env.production.no-ai.example mood_health_server/.env`
- 然后检查 `JWT_SECRET` 和 `ENCRYPTION_KEY` 是否已经填好

3. AI 服务读取 `.env` 报编码错误（Windows）

- 设置 `PYTHONUTF8=1`，`start-project.ps1` 已自动设置

4. PM2 频繁重启

- 检查 3000/8000 端口占用、Python 模型加载内存、`.env` 配置

5. Redis 不可达

- 服务可降级运行，但缓存与部分性能能力会受影响
