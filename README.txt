# 大学生情绪健康系统

一个面向大学生的情绪健康平台，包含前端应用、Node API 服务、Python AI 服务与运维脚本。

## 模块概览

- 前端：Vue 3 + TypeScript + Vite
- 后端：Node.js + Express + TypeScript
- AI 服务：Python + FastAPI（可接入本地模型/Ollama）
- 缓存：Redis（可选，但建议启用）

## 目录结构（核心）

```text
mood-health-web/
├── src/                        # 前端源码
├── mood-health-server/         # 后端与 AI 服务
│   ├── src/                    # Node API 代码
│   ├── main.py                 # Python AI 服务入口
│   ├── ecosystem.config.js     # PM2 进程编排
│   └── requirements.txt        # Python 依赖
├── scripts/
│   ├── doctor.mjs              # 环境/端口/依赖自检
│   └── demo-init.mjs           # 演示数据初始化
├── docs/
│   ├── API.md                  # API 文档（权威）
│   └── TESTING.md              # 测试与压测文档
├── DEPLOYMENT.md               # 部署指南
├── start-project.ps1           # 一键启动（Windows）
└── package.json                # 根命令入口
```

## 服务端口

- 前端开发服务：3001
- Node API：3000
- Python AI API：8000
- Redis：6379
- Ollama（可选）：11434

说明：当前以 `vite.config.ts` 与 `scripts/doctor.mjs` 为准，前端开发端口为 3001。若看到历史文档中的 5173，请以本 README 与项目配置为准。

## 启动顺序（部署建议）

1. 先启动 Redis（6379），确保缓存可用。
2. 启动后端与 AI 服务（PM2 管理，端口 3000/8000）。
3. 最后启动前端开发服务（3001）。

## 环境依赖清单

| 依赖项   | 版本要求                   | 安装方式                    | 备注                   |
| -------- | -------------------------- | --------------------------- | ---------------------- |
| Node.js  | 18.x 或 20.x               | nvm / 官方安装包            | 必须包含 npm           |
| Python   | 3.9 ~ 3.11                 | pyenv / 官方安装包          | 虚拟环境建议使用 .venv |
| Redis    | 6.x+                       | apt / yum / 源码安装        | 建议配置密码           |
| PM2      | 本地安装                   | npm install（脚本自动处理） | 无需全局安装           |
| 系统工具 | git, curl, build-essential | 系统包管理器                | 编译与联调依赖         |

## 快速开始（Windows）

```powershell
# 1) 安装前后端依赖
npm run setup

# 2) 可选：创建 Python 虚拟环境并安装 AI 依赖
npm run setup:python

# 3) 启动前做环境体检
npm run doctor

# 4) 一键启动后端与 AI（PM2）
npm run start-all:check

# 5) 同时启动前端+后端开发服务
npm run dev:all
```

## 快速开始（Linux/macOS）

```bash
# 1) 安装前后端依赖
npm run setup

# 2) 安装 Python 依赖（根据你的虚拟环境）
python -m venv .venv
source .venv/bin/activate
pip install -r mood-health-server/requirements.txt

# 3) 自检
npm run doctor

# 4) 一键启动后端与 AI（Linux/macOS）
chmod +x ./start-project.sh
npm run start-all:linux

# 5) 同时启动前端+后端开发服务
npm run dev:all
```

## 统一命令入口

### 项目级

- `npm run setup`：安装根与后端 Node 依赖
- `npm run setup:python`：创建 `.venv` 并安装 Python 依赖（Windows）
- `powershell -ExecutionPolicy Bypass -File ./run-in-venv.ps1 <command> [args...]`：自动选择项目虚拟环境并执行命令（默认优先 `.venv`）
- `powershell -ExecutionPolicy Bypass -File ./run-in-venv.ps1 -Activate`：打开一个已激活虚拟环境的交互式 PowerShell
- `npm run doctor`：环境、文件、端口健康检查
- `npm run doctor:strict`：严格模式（warning 也视为失败）
- `npm run start-all`：通过 `start-project.ps1` 启动 PM2 服务
- `npm run start-all:no-ai`：通过 `start-project.ps1 -NoAi` 启动（推荐 2核2G）
- `npm run start-all:with-ai`：通过 `start-project.ps1 -WithAi` 启动（需独立 AI 服务）
- `npm run start-all:linux`：通过 `start-project.sh` 启动 PM2 服务（Linux/macOS）
- `npm run start-all:linux:no-ai`：通过 `start-project.sh --no-ai` 启动（推荐 2核2G）
- `npm run start-all:linux:with-ai`：通过 `start-project.sh --with-ai` 启动（需独立 AI 服务）
- `npm run start-all:check`：先 `doctor` 再 `start-all`
- `npm run start-all:clean`：先清理进程再重启
- 低配主机建议：2核2G 场景下将 `AI_ENABLED=false`，不在本机运行大模型推理；如需 AI，请单独部署 Python AI 服务并配置 `AI_SERVICE_BASE_URL`。

### 构建与测试

- `npm run build`：构建前端
- `npm run build:all`：构建前端 + 后端
- `npm run dev:all`：并行启动前端 + 后端开发服务
- `npm run dev:reset`：Windows 下清理开发端口并重启前后端联调
- `npm run test`：前端 Vitest watch
- `npm run test:run`：前端 Vitest 单次运行
- `npm run test:coverage`：前端覆盖率
- `npm run test:all`：前端 + 后端测试

### 演示数据

- `npm run demo:init`：初始化基础演示数据
- `npm run demo:init:all`：初始化 + 账号验证
- `npm run db:init`：别名，等价于 `demo:init:all`

可通过环境变量覆盖默认演示密码：

```powershell
$env:DEMO_USER_PASSWORD="123456"
npm run demo:init:all
```

## 后端命令（mood-health-server）

```bash
npm --prefix mood-health-server run dev
npm --prefix mood-health-server run build
npm --prefix mood-health-server run test
npm --prefix mood-health-server run seed:demo -- 123456
npm --prefix mood-health-server run seed:demo:all
```

## 文档索引

- 命令总览：`docs/COMMANDS.md`
- API 文档（权威）：`docs/API.md`
- 测试文档：`docs/TESTING.md`
- 部署文档：`DEPLOYMENT.md`
- 健康检查说明：`health/README.md`

命令维护策略：所有命令优先在 `docs/COMMANDS.md` 更新，再同步到其它文档的场景说明。

## 常见问题

1. `doctor` 报告 `dist/app.js missing`

- 执行 `npm --prefix mood-health-server run build`

2. Windows 下 Python `.env` 编码问题

- 启动前设置 `PYTHONUTF8=1`（`start-project.ps1` 已处理）

3. PM2 命令不可用

- 根目录执行 `npm install`，使用本地 PM2 入口（脚本已自动处理）

4. 端口冲突

- 先停止占用进程，或修改 `.env` / 服务配置后重试

## 许可

仅用于教学与学习交流。
