# 命令总览

本文件汇总仓库中常用命令，按场景组织，优先作为日常开发与排障的速查表。

## 0. 按角色快速入口

### 开发者（前后端联调）

```bash
npm run setup
npm run doctor
npm run dev:all
```

### 测试同学（提交前验证）

```bash
npm run doctor
npm run test:all
npm run build:all
```

### 运维同学（服务启动与巡检）

```bash
# Windows
npm run start-all:check
npm run pm2:status

# Linux/macOS
chmod +x ./start-project.sh
npm run start-all:linux
npm run pm2:status
```

前提：后端服务器使用 Node.js 22+；MySQL 与 Redis 由 Docker Compose 管理。

## 1. 项目根命令

| 场景                       | 命令                            | 说明                                                   |
| -------------------------- | ------------------------------- | ------------------------------------------------------ |
| 安装依赖                   | `npm run setup`                 | 安装根目录和 `mood_health_server` 的 Node 依赖         |
| Python 环境（Windows）     | `npm run setup:python`          | 调用 `create_venv.ps1` 创建 `.venv` 并安装 Python 依赖 |
| 环境自检                   | `npm run doctor`                | 检查命令可用性、关键文件、端口连通性                   |
| 严格自检                   | `npm run doctor:strict`         | Warning 也视为失败                                     |
| 开发（前端）               | `npm run dev`                   | 启动 Vite 开发服务                                     |
| 开发（前后端并行）         | `npm run dev:all`               | 同时启动前端 Vite 和后端 nodemon                       |
| 开发重置并启动（Windows）  | `npm run dev:reset`             | 清理 3001/3000/8001 占用并启动 `dev:all`               |
| 仅清理开发端口（Windows）  | `npm run dev:reset:clean`       | 仅清理 3001/3000/8001 占用，不启动服务                 |
| 构建（前端）               | `npm run build`                 | 前端构建                                               |
| 构建（前后端）             | `npm run build:all`             | 前端 + 后端构建                                        |
| 测试（前端 watch）         | `npm run test`                  | Vitest watch 模式                                      |
| 测试（前端单次）           | `npm run test:run`              | Vitest 单次执行                                        |
| 测试（前端覆盖率）         | `npm run test:coverage`         | Vitest 覆盖率                                          |
| 测试（前后端）             | `npm run test:all`              | 前端单次 + 后端 Jest                                   |
| 演示数据（基础）           | `npm run demo:init`             | 执行 MySQL Reference + Demo Seed                       |
| 演示数据（全量）           | `npm run demo:init:all`         | 执行 MySQL Reference + Demo + Test Seed                |
| 数据初始化别名             | `npm run db:init`               | 等价于 `demo:init:all`                                 |
| 启动服务（Windows）        | `npm run start-all`             | 执行 `start-project.ps1`                               |
| 启动服务（Windows，无 AI） | `npm run start-all:no-ai`       | 执行 `start-project.ps1 -NoAi`（2核2G 推荐）           |
| 启动服务（Windows，启用 AI） | `npm run start-all:with-ai`     | 执行 `start-project.ps1 -WithAi`（需独立 AI 服务）     |
| 启动服务（Linux/macOS）    | `npm run start-all:linux`       | 执行 `start-project.sh`                                |
| 启动服务（Linux，无 AI）   | `npm run start-all:linux:no-ai` | 执行 `start-project.sh --no-ai`（2核2G 推荐）          |
| 启动服务（Linux，启用 AI） | `npm run start-all:linux:with-ai` | 执行 `start-project.sh --with-ai`（需独立 AI 服务）   |
| 启动前检查（Windows）      | `npm run start-all:check`       | 先 `doctor` 再 `start-all`                             |
| 清理后重启（Windows）      | `npm run start-all:clean`       | 先删 PM2 进程再重启                                    |
| PM2 状态                   | `npm run pm2:status`            | 查看 PM2 进程状态                                      |
| PM2 日志                   | `npm run pm2:logs`              | 查看 PM2 日志                                          |
| PM2 停止                   | `npm run pm2:stop`              | 删除 `mood-health-server` 和 `mood-ai-server`          |

## 2. 后端命令（mood_health_server）

| 场景         | 命令                                                        | 说明                           |
| ------------ | ----------------------------------------------------------- | ------------------------------ |
| 开发         | `npm --prefix mood_health_server run dev`                   | nodemon + ts-node              |
| 构建         | `npm --prefix mood_health_server run build`                 | TypeScript 编译到 `dist/`      |
| 生产启动     | `npm --prefix mood_health_server run start`                 | 启动 `dist/server.js`          |
| 后端自检     | `npm --prefix mood_health_server run doctor`                | 检查 `dist/server.js` 是否存在 |
| 测试（稳定） | `npm --prefix mood_health_server run test`                  | 默认稳定测试集（无数据库依赖） |
| 集成测试     | `npm --prefix mood_health_server run test:integration`      | 需要数据库环境                 |
| 测试覆盖率   | `npm --prefix mood_health_server run test:coverage`         | Jest 覆盖率                    |
| 测试观察     | `npm --prefix mood_health_server run test:watch`            | Jest watch                     |
| 角色权限测试 | `npm --prefix mood_health_server run test:role-permissions` | 权限脚本测试                   |
| Schema 迁移  | `npm --prefix mood_health_server run db:migrate`            | 执行待应用的 MySQL Migration   |
| Demo Seed    | `npm --prefix mood_health_server run db:seed:demo`          | 初始化虚构演示账号和情绪数据   |
| 全量 Seed    | `npm --prefix mood_health_server run db:seed:all`           | 执行 Reference、Demo、Test Seed |

## 3. 操作系统相关命令

### RAG 知识助手（Windows）

```powershell
npm run start-all:with-ai
```

该命令通过现有 FastAPI 服务初始化中文向量模型与知识库索引。启动器会等待
`/api/health/ready` 中的 `checks.rag=true` 后才报告就绪。登录产品后访问
`/ai/knowledge-assistant` 即可使用；不需要单独启动 Streamlit，也不依赖 8501 端口。

如启动超时，先运行 `npm run doctor`，检查输出中的 FastAPI RAG readiness，再查看 AI
服务窗口里的模型或索引初始化错误。诊断命令不会输出内部签名令牌。

### Windows PowerShell

```powershell
npm run setup
npm run doctor
npm run start-all:check
npm run dev:all
```

### Linux/macOS

```bash
npm run setup
npm run doctor
chmod +x ./start-project.sh
npm run start-all:linux
npm run dev:all
```

### 2核2G（无 AI 推理）

```bash
# Linux/macOS
export AI_ENABLED=false
npm run start-all:linux:no-ai
```

```powershell
# Windows PowerShell
$env:AI_ENABLED='false'
npm run start-all:no-ai
```

## 4. 常见组合流程

### 本地首次启动

```bash
npm run setup
npm run setup:python   # Windows 可选
docker compose up -d mysql redis
npm --prefix mood_health_server run db:migrate
npm run doctor
npm run demo:init:all
npm run start-all:check
npm run dev:all
```

### 提交前最小检查

```bash
npm run doctor
npm run test:all
npm run build:all
```

### MySQL 上线前回归（建议）

```bash
docker compose config
docker compose up -d mysql redis
docker compose ps
npm --prefix mood_health_server run db:migrate
npm run demo:init:all
npm run release:smoke
```

可选：仅验证核心链路并跳过 AI 路由检查。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/release-smoke.ps1 -SkipAiRouteCheck
```

说明：`doctor` 中 Redis 端口检查由 `REDIS_REQUIRED` 控制；2核2G 无 AI 场景建议保持 `REDIS_REQUIRED=false`。

## 5. 相关文档

- 部署：`DEPLOYMENT.md`
- 测试：`docs/TESTING.md`
- API：`docs/API.md`
- 历史 SQLite 发布操作单：`docs/SQLITE_RELEASE_DAY_CHECKLIST.md`（仅留档，不可作为 R0 命令）
- 历史 SQLite 留档模板：`docs/SQLITE_RELEASE_REPORT_TEMPLATE.md`
- 历史 SQLite 留档样例：`docs/SQLITE_RELEASE_REPORT_2026-03-30.md`

## 6. 标准目录树索引

目录规范以 `README.txt` 的“最终标准目录树（完整版）”为唯一维护源；本节保留执行视角的精简索引。

```text
mood-health-web/
├── src/                        # 前端
├── mood_health_server/         # 后端 Node + Python AI
├── scripts/                    # 根级脚本
├── docs/                       # 文档
├── health/                     # 健康检查说明
├── public/                     # 静态资源
├── DEPLOYMENT.md               # 部署文档
├── README.txt                  # 项目总览与完整目录树
└── package.json                # 根命令入口
```
