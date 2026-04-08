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

## 1. 项目根命令

| 场景                       | 命令                            | 说明                                                   |
| -------------------------- | ------------------------------- | ------------------------------------------------------ |
| 安装依赖                   | `npm run setup`                 | 安装根目录和 `mood_health_server` 的 Node 依赖         |
| Python 环境（Windows）     | `npm run setup:python`          | 调用 `create_venv.ps1` 创建 `.venv` 并安装 Python 依赖 |
| 环境自检                   | `npm run doctor`                | 检查命令可用性、关键文件、端口连通性                   |
| 严格自检                   | `npm run doctor:strict`         | Warning 也视为失败                                     |
| 开发（前端）               | `npm run dev`                   | 启动 Vite 开发服务                                     |
| 开发（前后端并行）         | `npm run dev:all`               | 同时启动前端 Vite 和后端 nodemon                       |
| 开发重置并启动（Windows）  | `npm run dev:reset`             | 清理 3001/3000/8000 占用并启动 `dev:all`               |
| 仅清理开发端口（Windows）  | `npm run dev:reset:clean`       | 仅清理 3001/3000/8000 占用，不启动服务                 |
| 构建（前端）               | `npm run build`                 | 前端构建                                               |
| 构建（前后端）             | `npm run build:all`             | 前端 + 后端构建                                        |
| 测试（前端 watch）         | `npm run test`                  | Vitest watch 模式                                      |
| 测试（前端单次）           | `npm run test:run`              | Vitest 单次执行                                        |
| 测试（前端覆盖率）         | `npm run test:coverage`         | Vitest 覆盖率                                          |
| 测试（前后端）             | `npm run test:all`              | 前端单次 + 后端 Jest                                   |
| 演示数据（基础）           | `npm run demo:init`             | 初始化基础演示数据                                     |
| 演示数据（全量）           | `npm run demo:init:all`         | 初始化并验证演示账号                                   |
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
| 生产启动     | `npm --prefix mood_health_server run start`                 | 启动 `dist/app.js`             |
| 后端自检     | `npm --prefix mood_health_server run doctor`                | 检查 `dist/app.js` 是否存在    |
| 测试（稳定） | `npm --prefix mood_health_server run test`                  | 默认稳定测试集（无数据库依赖） |
| 集成测试     | `npm --prefix mood_health_server run test:integration`      | 需要数据库环境                 |
| 测试覆盖率   | `npm --prefix mood_health_server run test:coverage`         | Jest 覆盖率                    |
| 测试观察     | `npm --prefix mood_health_server run test:watch`            | Jest watch                     |
| 角色权限测试 | `npm --prefix mood_health_server run test:role-permissions` | 权限脚本测试                   |
| 种子数据     | `npm --prefix mood_health_server run seed:demo -- 123456`   | 初始化演示用户和数据           |
| 全量种子     | `npm --prefix mood_health_server run seed:demo:all`         | 初始化并验证演示账号           |

## 3. 操作系统相关命令

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

### SQLite 上线前回归（建议）

```bash
npm run sqlite:preflight
npm run sqlite:db:status
npm run release:smoke
```

可选：仅验证核心链路并跳过 AI 路由检查。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/release-smoke.ps1 -SkipAiRouteCheck
```

说明：`doctor` 中 Redis 端口检查由 `REDIS_REQUIRED` 控制；2核2G 无 AI 场景建议保持 `REDIS_REQUIRED=false`。

```powershell
# 1) 设定 SQLite 环境变量（建议绝对路径）
$env:DB_CLIENT='sqlite'
$env:SQLITE_DB_PATH='D:/deploy/mood-health/data/mood-health.db'

# 2) 后端构建
npm --prefix mood_health_server run build

# 3) 初始化 SQLite schema
npm --prefix mood_health_server run db:init:sqlite

# 4) 初始化演示数据（可按需替换为生产初始化脚本）
npm --prefix mood_health_server run seed:demo:all

# 5) SQLite 冒烟测试
npm --prefix mood_health_server run test:sqlite-smoke

# 6) 启动前健康自检
npm run doctor
```

## 5. 相关文档

遗留脚本提示：`mood_health_server/src/scripts/addAuditFields.ts`、`mood_health_server/src/scripts/addEncryptionFields.ts`、`mood_health_server/src/scripts/createCourseTable.ts`、`mood_health_server/src/scripts/createMusicTable.ts`、`mood_health_server/src/scripts/createLikeTables.ts`、`mood_health_server/src/scripts/createTreeHoleTables.ts` 为历史 SQL Server 专用脚本，SQLite 部署请使用 `db:init:sqlite` 与 `seed:demo:all`。

- 部署：`DEPLOYMENT.md`
- 测试：`docs/TESTING.md`
- API：`docs/API.md`
- SQLite 发布当天操作单：`docs/SQLITE_RELEASE_DAY_CHECKLIST.md`
- SQLite 留档模板：`docs/SQLITE_RELEASE_REPORT_TEMPLATE.md`
- SQLite 留档样例：`docs/SQLITE_RELEASE_REPORT_2026-03-30.md`

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
