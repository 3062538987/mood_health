# 模块1：系统总体架构文档

> 状态：已生效（基于代码现状）
> 日期：2026-07-16
> 版本：v1.0
> 适用阶段：P0/v1.0 及后续所有开发

---

## 1. 项目整体架构

### 1.1 架构概览

大学生情绪健康管理平台采用**前后端分离 + 单体后端**架构：

```
┌─────────────────────────────────────────────────────────────┐
│                    用户浏览器 (Browser)                       │
├─────────────────────────────────────────────────────────────┤
│  前端 SPA (Vue 3 + Vite + TypeScript)                       │
│  - 路由: Vue Router 4                                       │
│  - 状态管理: Pinia                                          │
│  - UI 组件: 自研组件库                                       │
│  - HTTP 客户端: Axios (封装于 src/utils/request.ts)          │
│  运行端口: 3001 (Vite dev) / 构建后由 Nginx 托管             │
├─────────────────────────────────────────────────────────────┤
│                     HTTP/HTTPS (RESTful API)                 │
├─────────────────────────────────────────────────────────────┤
│  后端服务 (Node.js + Express + TypeScript)                   │
│  - 进程管理: PM2 (单进程)                                    │
│  - 运行端口: 3000                                            │
│  ├── Controller 层 (路由处理、请求校验、响应格式化)           │
│  ├── Service 层 (业务逻辑、事务编排、加密/解密)               │
│  ├── Repository 层 (数据访问、SQL 执行、行映射)               │
│  ├── Middleware 层 (认证、权限、错误处理、限流)               │
│  └── Utils 层 (API 响应、加密、日志、Redis 客户端)            │
├─────────────────────────────────────────────────────────────┤
│  数据层                                                      │
│  ├── MySQL 8.4.10 (InnoDB, utf8mb4) — 唯一业务数据库         │
│  └── Redis 7-alpine — 缓存（非事实来源，故障可降级）          │
├─────────────────────────────────────────────────────────────┤
│  基础设施 (Docker Compose)                                    │
│  ├── MySQL 容器 (cpus: 1.0, mem: 768M)                      │
│  └── Redis 容器 (cpus: 0.5, mem: 256M)                      │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈明细

| 层次 | 技术 | 版本 | 说明 |
|---|---|---|---|
| 前端框架 | Vue 3 | ^3.x | Composition API |
| 构建工具 | Vite | ^5.x | 开发服务器 + 生产构建 |
| 前端语言 | TypeScript | ^5.x | 严格模式 |
| 后端运行时 | Node.js | 22+ | LTS |
| 后端框架 | Express | ^4.x | 手动分层，无 ORM |
| 后端语言 | TypeScript | ^5.x | 编译到 dist/ |
| 数据库 | MySQL | 8.4.10 | InnoDB 引擎 |
| 缓存 | Redis | 7-alpine | allkeys-lru 淘汰策略 |
| 容器编排 | Docker Compose | v2+ | 仅管理 MySQL + Redis |
| 进程管理 | PM2 | ^5.x | 单进程 `mood-health-server` |

### 1.3 部署架构

```
┌──────────────────────────────────────┐
│  WSL2 / Linux 宿主机                 │
│  ┌────────────────────────────────┐  │
│  │  Docker Compose                │  │
│  │  ┌──────────┐  ┌──────────┐   │  │
│  │  │ MySQL    │  │ Redis    │   │  │
│  │  │ 8.4.10   │  │ 7-alpine │   │  │
│  │  └──────────┘  └──────────┘   │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  PM2                            │  │
│  │  └── mood-health-server (3000) │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  Nginx (可选)                   │  │
│  │  ├── / → 前端静态文件           │  │
│  │  └── /api → localhost:3000     │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

- **开发环境**: 前端 Vite (3001) + 后端 nodemon (3000) + Docker MySQL/Redis
- **生产环境**: Nginx 托管前端静态文件 + PM2 管理后端进程 + Docker MySQL/Redis
- **2核2G约束**: MySQL max_connections=30, Node.js connectionLimit=10, MySQL innodb_buffer_pool_size=256M, Redis maxmemory=128MB, Node.js 单进程 512MB

---

## 2. 后端分层标准

### 2.1 分层架构图

```
┌──────────────────────────────────────────────────────────┐
│  Router (routes/)                                         │
│  - 路由注册、中间件绑定、请求校验规则                       │
│  - 不包含业务逻辑                                         │
├──────────────────────────────────────────────────────────┤
│  Controller (controllers/)                                │
│  - 提取请求参数、调用 Service                             │
│  - 组装统一响应格式 (apiSuccess / apiFailure)             │
│  - 不包含 SQL、不直接操作数据库                            │
├──────────────────────────────────────────────────────────┤
│  Service (services/)                                      │
│  - 业务逻辑编排、事务管理                                  │
│  - 加密/解密、数据校验、业务规则                          │
│  - 调用 Repository，不直接写 SQL                          │
├──────────────────────────────────────────────────────────┤
│  Repository (repositories/)                               │
│  - 唯一数据访问边界                                       │
│  - 接收领域参数，返回领域对象                              │
│  - 不返回 mysql2 原始 RowDataPacket                       │
│  - SQL 全部使用参数化占位符                                │
├──────────────────────────────────────────────────────────┤
│  Middleware (middleware/)                                  │
│  - auth.ts: JWT 认证、角色校验、权限校验                   │
│  - errorHandler.ts: 全局错误处理、404 处理                 │
│  - validateRequest.ts: express-validator 结果检查          │
├──────────────────────────────────────────────────────────┤
│  Utils (utils/)                                           │
│  - apiResponse.ts: 统一响应格式                            │
│  - encryption.ts: AES-256-GCM 加解密                      │
│  - password.ts: bcrypt 哈希                               │
│  - errors.ts: 业务异常类                                  │
│  - logger.ts: 结构化日志                                  │
│  - operationLogger.ts: 审计日志工具                       │
│  - redis.client.ts / redisClient.ts: Redis 客户端          │
└──────────────────────────────────────────────────────────┘
```

### 2.2 各层职责边界

| 层 | 允许 | 禁止 |
|---|---|---|
| Router | 注册路由、绑定中间件、定义校验规则 | 写业务逻辑、调用 Service/Repository |
| Controller | 提取参数、调用 Service、组装响应 | 写 SQL、导入 mysql2、直接操作数据库 |
| Service | 业务逻辑、事务编排、加密/解密、校验 | 写 SQL、导入 mysql2、直接操作数据库 |
| Repository | 执行 SQL、行映射、事务连接管理 | 写业务逻辑、调用其他 Repository |
| Middleware | 认证鉴权、请求校验、错误格式化 | 写业务逻辑、调用 Service |

### 2.3 调用路径

```
Router → Middleware (认证/权限) → Controller → Service → Repository → MySQL
```

**禁止跨层调用**：Controller 不得直接调用 Repository，Service 不得直接操作数据库连接。

---

## 3. Repository 模式编码规范

### 3.1 文件组织

```
mood_health_server/src/repositories/
├── userRepository.ts        # 用户数据访问
├── accessRepository.ts      # 权限校验数据访问
├── auditRepository.ts       # 审计日志数据访问
├── moodRepository.ts        # 情绪记录数据访问
├── assessmentRepository.ts  # 心理测评数据访问
├── caseRepository.ts        # 风险个案数据访问
├── managementRepository.ts  # 管理聚合数据访问
└── promptRepository.ts      # Prompt 模板数据访问
```

### 3.2 实体类规范

- 实体接口命名：使用领域语义，如 `AuthUser`、`PublicUser`、`MoodRecord`、`CaseDto`
- 字段映射：数据库 `snake_case` 列名映射为 TypeScript `camelCase` 属性
- 行映射函数：每个 Repository 内部定义 `mapXxx()` 函数，将 `RowDataPacket` 转换为领域对象
- 时间类型：数据库 `DATETIME(3)` 映射为 TypeScript `Date` 或 ISO 字符串

### 3.3 Repository 接口规范

- 每个 Repository 通过工厂函数 `createXxxRepository()` 创建，返回对象字面量
- 接受可选 `db` 参数，默认使用 `getMysqlPool()`，便于测试注入
- 方法命名：`findByXxx`（查询单个）、`listByXxx`（查询列表）、`createXxx`（插入）、`updateXxx`（更新）、`deleteXxx`（删除）
- 事务连接：Service 通过 `db.getConnection()` 获取连接，Repository 的 `create`/`update` 方法接受 `connection` 参数

### 3.4 数据库映射规则

| 数据库 | TypeScript |
|---|---|
| `VARCHAR(n)` | `string` |
| `TEXT` | `string \| null` |
| `INT UNSIGNED` | `number` |
| `SMALLINT UNSIGNED` | `number` |
| `TINYINT(1)` | `number`（映射为 `boolean` 时通过 `Number(x) === 1` 判断） |
| `DECIMAL(8,2)` | `number`（通过 `Number()` 转换） |
| `DATETIME(3)` | `Date` 或 `string`（ISO 8601） |
| `JSON` | `object`（通过 `JSON.parse` / `JSON.stringify`） |
| `CHAR(64)` | `string` |

### 3.5 SQL 编写规范

- 所有 SQL 使用参数化占位符 `?`，禁止字符串拼接用户输入
- 字段列表必须显式写出，禁止 `SELECT *`
- 表名使用反引号（可选），字段名不加反引号
- 复杂查询优先使用 JOIN，避免 N+1 查询
- 分页使用 `LIMIT ? OFFSET ?`
- 时间写入使用 `UTC_TIMESTAMP(3)`，读时由应用层转换时区

---

## 4. 部署规范

### 4.1 WSL2 / Docker 部署标准

**前置条件**：
- Windows 10/11 启用 WSL2 和 Virtual Machine Platform
- 安装 Docker Desktop（WSL2 后端）

**启动流程**：
```bash
# 1. 启动基础设施
docker compose up -d mysql redis

# 2. 等待健康检查通过
docker compose ps

# 3. 执行数据库迁移
npm --prefix mood_health_server run db:migrate

# 4. 初始化种子数据
npm run demo:init:all

# 5. 启动应用
npm run start-all:no-ai
```

**资源限制（2核2G）**：

| 配置项 | 值 |
|---|---|
| MySQL `max_connections` | 30 |
| Node.js MySQL Pool `connectionLimit` | 10 |
| MySQL `innodb_buffer_pool_size` | 256M |
| Redis `maxmemory` | 128MB |
| Redis 淘汰策略 | allkeys-lru |
| Node.js API | 单进程，容器 512MB |
| MySQL 容器 CPU | 1.0 |
| MySQL 容器内存 | 768M |
| Redis 容器 CPU | 0.5 |
| Redis 容器内存 | 256M |

### 4.2 环境变量

核心环境变量（`.env` 文件，不提交 Git）：

| 变量 | 说明 | 示例 |
|---|---|---|
| `MYSQL_ROOT_PASSWORD` | MySQL root 密码 | （必填） |
| `MYSQL_APP_USER` | 应用数据库账号 | `mood_app` |
| `MYSQL_APP_PASSWORD` | 应用数据库密码 | （必填） |
| `MYSQL_DATABASE` | 数据库名 | `mood_health` |
| `MYSQL_PORT` | MySQL 端口 | `3306` |
| `REDIS_PASSWORD` | Redis 密码 | （必填） |
| `REDIS_PORT` | Redis 端口 | `6379` |
| `JWT_SECRET` | JWT 签名密钥 | （必填） |
| `ENCRYPTION_KEY` | AES 加密密钥 | （必填） |
| `FRONTEND_URL` | 前端地址（CORS） | `http://localhost:3001` |
| `NODE_ENV` | 运行环境 | `development` / `production` |
| `ALLOW_DEMO_SEED` | 允许演示种子数据 | `true` / `false` |
| `DEMO_PASSWORD` | 演示账号密码 | （必填） |

### 4.3 数据库账号权限

| 账号 | 权限 | 使用场景 |
|---|---|---|
| `root` | 全部权限 | 容器初始化、紧急运维 |
| `mood_app` | SELECT/INSERT/UPDATE/DELETE | Node.js API 运行时 |
| `mood_test` | 独立测试库全部权限 | 自动化测试 |

应用账号不得拥有 `DROP`、`ALTER`、`CREATE USER` 等管理权限。生产环境不将 MySQL 端口暴露到公网。

---

## 5. 非核心功能状态

以下模块在 R0 阶段已停用，P1/P2 阶段已完成 MySQL 迁移并重新启用：

| 模块 | 路由前缀 | 状态 |
|---|---|---|
| 活动 | `/api/activities` | P1/P2 已启用 |
| 树洞帖子 | `/api/posts` | P1/P2 已启用 |
| 音乐 | `/api/music` | P1/P2 已启用 |
| 课程 | `/api/courses` | P1/P2 已启用 |
| 放松 | `/api/relax` | P1/P2 已启用 |
| 成就 | `/api/achievements` | P1/P2 已启用 |

这些模块已从 SQLite 模型迁移至 MySQL Repository 模式，前端 feature flag 已调整，可通过对应路由正常访问。

---

## 6. 项目目录结构

```
mood-health-web/
├── src/                          # 前端源码 (Vue 3 + Vite)
│   ├── api/                      # API 调用层
│   ├── components/               # 通用组件
│   ├── composables/              # 组合式函数
│   ├── constants/                # 常量定义
│   ├── router/                   # 路由配置
│   ├── stores/                   # Pinia 状态管理
│   ├── types/                    # TypeScript 类型定义
│   ├── utils/                    # 前端工具函数
│   └── views/                    # 页面视图
├── mood_health_server/           # 后端源码
│   └── src/
│       ├── config/               # 配置（MySQL、功能开关）
│       ├── controllers/          # 控制器
│       ├── db/                   # 数据库（迁移、种子、引导）
│       ├── middleware/           # 中间件
│       ├── repositories/         # 数据访问层
│       ├── routes/               # 路由注册
│       ├── services/             # 业务逻辑层
│       ├── types/                # 类型定义
│       └── utils/                # 工具函数
├── docker/                       # Docker 配置
│   ├── mysql/my.cnf              # MySQL 配置
│   └── redis/redis.conf          # Redis 配置
├── docs/                         # 项目文档
│   ├── prd/                      # PRD 文档
│   ├── refactor/                 # R0 重构文档
│   ├── database/                 # 数据库迁移方案
│   └── tech-design/              # 技术设计文档（本文档）
├── scripts/                      # 运维脚本
├── compose.yaml                  # Docker Compose 编排
├── package.json                  # 根级 npm 脚本
└── .env                          # 环境变量（不提交 Git）
```