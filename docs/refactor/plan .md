# R0 代码重构实施计划

## 1. 计划状态

- 文档状态：已批准
- 批准日期：2026-07-14
- 当前阶段：R0 代码重构与架构稳定
- 上游设计：[大学生情绪健康管理平台渐进式定向重构设计](../docs/superpowers/specs/2026-07-14-mood-health-platform-optimization-design.md)
- 架构决策：[ADR-001](../docs/architecture/ADR-001.md)
- 后续门禁：本计划批准后编写数据库迁移方案；两份文档均批准后才执行代码重构

## 2. 目标

在不整体重写项目的前提下，修复工程基线、隔离非核心旧模块、统一 API 契约，随后把现有核心能力渐进迁移到 MySQL 和 Repository。R0 完成后，项目应具备可重复构建、测试、启动、迁移、Seed 和回退能力，为 P0/v1.0 PRD 与业务开发提供稳定基础。

R0 不新增风险个案等 P0 业务功能，不接入正式 AI API，也不重做 UI、路由系统或全部 Model。

## 3. 当前证据

- `mood_health_server/src/config/database.ts` 仍按环境在 SQLite 与 SQL Server 之间分流。
- 后端源码中存在 25 个直接 `mssql` 导入和 26 个直接 SQLite 配置导入，Model 与 Controller 仍存在直接数据库访问。
- `mood_health_server/src/app.ts` 启动时挂载社区、活动、课程、音乐、放松和成就路由，无法保证 P0 环境零 SQLite 访问。
- `src/utils/request.ts` 已经解包 `data`，但 `src/stores/userStore.ts` 等调用方仍有二次 `.data` 读取。
- PM2 配置名为 `mood_health_server`，启动脚本使用 `mood-health-server`，启动契约不一致。
- 测试使用固定用户 `999999` 且依赖旧数据库状态，无法证明干净环境可重复运行。
- Git 当前追踪 `venv/`、`venv.backup/`、SQLite 数据库/WAL/SHM 和 Redis dump 等运行产物。

## 4. 依赖关系

```text
可重复基线、重构前性能采样与备份
        ↓
应用可测试化 + API 契约基础
        ↓
非核心功能前后端停用
        ↓
核心接口契约修复
        ↓
数据库迁移方案审核通过
        ↓
Docker/MySQL/Migration/Seed 基础
        ↓
用户认证 → RBAC/审计 → 情绪 → 心理测评 → 管理聚合
        ↓
SQL Server 清退 + SQLite 活动路径清退
        ↓
R0 架构稳定验收
        ↓
P0/v1.0 PRD
```

## 5. 全局完成标准

每个任务除自身验收条件外，还必须满足：

1. 一次提交只处理一个逻辑目标，能够独立回退。
2. 相关测试通过，前后端构建和类型检查无新增错误。
3. 不新增 SQLite、SQL Server 或页面二次解包依赖。
4. 不记录真实心理隐私数据，不修改未经确认的心理评分或风险规则。
5. 文档、环境示例、Migration、Seed 与代码保持一致。
6. R0 完成时使用与重构前相同的资源限制、数据规模和负载复测性能；没有数据支持时不得声称性能提升。

## 6. 任务拆解

### 贯穿 R0：性能基线任务

## Task PERF：记录重构前后性能基线

**Description：** 使用同一套可重复脚本，在 R0 实施前和全部重构完成后各执行一次性能采样。测试环境固定为 2 核 2G 或等价资源限制，使用相同演示数据规模、预热次数、请求次数和并发度。项目当前没有独立首页业务 API，因此首页指标记录 `GET /` 的 TTFB 与总响应时间；若首页首次加载触发业务接口，则单独记录对应调用。

**Acceptance criteria：**
- [ ] 重构前、重构后均记录首页访问、`POST /api/auth/login`、代表性数据库查询的平均值、P50 和 P95 响应时间。
- [ ] 同时记录 Node.js API、MySQL/旧数据库和 Redis 的平均/峰值 CPU 与内存占用，并完整记录硬件、容器限制、数据量和负载参数。
- [ ] 对比报告展示绝对值、变化量和变化比例；只有数据支持时才写“性能改善”，否则客观说明持平、退化或测试限制。

**Verification：**
- [ ] 使用同一脚本分别生成重构前、重构后原始 JSON 数据，每个场景至少预热后独立运行 3 次。
- [ ] 人工核对两个测量窗口的资源限制、Seed 规模、请求参数和并发度一致。
- [ ] 论文引用的数据能够从原始结果重新计算，不只保留截图或结论。

**Dependencies：** Task 1 后采集重构前数据；Task 27 后采集重构后数据并完成任务

**Files likely touched：**
- `scripts/performance-baseline.mjs`
- `docs/refactor/R0-performance-baseline.md`
- `docs/refactor/performance/R0-before.json`
- `docs/refactor/performance/R0-after.json`

**Estimated scope：** M（分两个固定测量窗口完成）

### 阶段 A：基线与仓库治理

## Task 1：记录可重复的重构前基线

**Description：** 在不修复问题的情况下运行现有诊断、构建和测试命令，将成功项、失败项、环境依赖和错误摘要记录为 R0 基线，后续任务只与该基线比较。

**Acceptance criteria：**
- [ ] 记录前端、后端的安装版本、构建结果、测试结果和启动结果。
- [ ] 每个失败项包含复现命令与错误摘要，不使用“偶发失败”等模糊描述。
- [ ] 基线不依赖手工修改旧 SQLite 数据才能生成。

**Verification：**
- [ ] 执行 `npm run doctor`、`npm run build:all`、`npm run test:all` 并保存退出码。
- [ ] 人工确认基线文档能够让新环境复现同一检查过程。

**Dependencies：** None

**Files likely touched：**
- `docs/refactor/R0-baseline.md`

**Estimated scope：** S

## Task 2：保护 SQLite 备份并清理仓库运行产物

**Description：** 为旧 SQLite 主库建立只读备份与 SHA-256 清单，不迁移其中数据；扩充忽略规则，并在独立机械提交中停止追踪虚拟环境、测试数据库、WAL/SHM、Redis dump 和临时视觉文件。

**Acceptance criteria：**
- [ ] 旧 SQLite 备份存在、校验值可复核，且不位于活动数据目录。
- [ ] `git ls-files` 不再包含虚拟环境、数据库运行文件或 Redis dump。
- [ ] 源代码、用户资料和论文资料未被误删。

**Verification：**
- [ ] `Get-FileHash <backup> -Algorithm SHA256` 与清单一致。
- [ ] 使用 `git status --short` 人工复核批量移除范围。

**Dependencies：** Task 1

**Files likely touched：**
- `.gitignore`
- `docs/refactor/legacy-backup-manifest.md`
- 现有被追踪的运行产物（仅机械取消追踪）

**Estimated scope：** M（批量机械变更，必须独立提交）

## Task 3：统一启动入口与进程名称

**Description：** 将 PM2 进程名统一为 `mood-health-server`，同步 Windows、Linux 和根目录脚本，消除“配置可构建但无法按名称启动”的问题。

**Acceptance criteria：**
- [ ] ecosystem、PowerShell、Shell 和 npm 脚本使用同一进程名。
- [ ] 重复启动不会产生两个后端进程。
- [ ] 停止命令只清理项目自己的进程。

**Verification：**
- [ ] 后端构建后运行 `npm run start-all:no-ai`。
- [ ] 运行 `npm run pm2:status`，确认只有一个 `mood-health-server`。

**Dependencies：** Task 1

**Files likely touched：**
- `mood_health_server/ecosystem.config.js`
- `start-project.ps1`
- `start-project.sh`
- `package.json`

**Estimated scope：** M

### Checkpoint A

- [ ] 基线已经记录且未被后续结果覆盖。
- [ ] Task PERF 已使用固定测试协议采集重构前性能数据。
- [ ] SQLite 备份可验证，仓库运行产物范围已复核。
- [ ] 现有应用仍能以统一进程名启动或给出已记录的基线错误。
- [ ] 用户确认后进入边界治理。

### 阶段 B：应用边界与功能停用

## Task 4：拆分应用创建与服务器启动

**Description：** 将 Express 应用创建与 `listen()`/数据库连接分离，使 API 能在测试中被导入而不自动启动端口或连接旧数据库。

**Acceptance criteria：**
- [ ] 导入应用工厂不会监听端口或执行数据库连接。
- [ ] 生产启动入口仍执行配置校验、数据库连接和监听。
- [ ] 测试可创建独立 app 实例。

**Verification：**
- [ ] 后端 TypeScript 构建通过。
- [ ] 新增应用工厂单元测试，导入后无端口占用。

**Dependencies：** Checkpoint A

**Files likely touched：**
- `mood_health_server/src/app.ts`
- `mood_health_server/src/server.ts`
- `mood_health_server/tests/unit/appFactory.test.ts`
- `mood_health_server/package.json`

**Estimated scope：** M

## Task 5：建立统一 API 响应与错误工具

**Description：** 增加统一成功/失败响应工具，将业务码与 HTTP 状态码分离，并先覆盖 404、参数错误、内部错误和健康检查。

**Acceptance criteria：**
- [ ] 成功响应固定为 `{ code: 0, message, data }`。
- [ ] 失败响应使用非零业务码和正确 HTTP 状态，不再返回 `success: false` 等并行格式。
- [ ] 5xx 在生产环境不泄露堆栈或原始数据库错误。

**Verification：**
- [ ] 响应工具和错误中间件单元测试通过。
- [ ] 404、400、500 契约测试分别断言 HTTP 状态与响应结构。

**Dependencies：** Task 4

**Files likely touched：**
- `mood_health_server/src/utils/apiResponse.ts`
- `mood_health_server/src/middleware/errorHandler.ts`
- `mood_health_server/src/app.ts`
- `mood_health_server/tests/unit/middleware/errorHandler.test.ts`

**Estimated scope：** M

## Task 6：后端停用非核心路由

**Description：** 引入显式功能开关，默认不挂载活动、社区、课程、音乐、放松和成就路由；关闭状态下不得导入或执行其 SQLite 初始化链路。

**Acceptance criteria：**
- [ ] R0/v1.0 默认配置只挂载用户、情绪、测评和必要管理路由。
- [ ] 被关闭接口返回统一“功能未启用”响应，不落到旧数据库。
- [ ] 自动化测试证明关闭状态不会触发 SQLite 连接或建表。

**Verification：**
- [ ] 运行后端路由挂载测试。
- [ ] 启动后调用一个被关闭接口，确认响应契约和日志均无 SQLite 操作。

**Dependencies：** Task 5

**Files likely touched：**
- `mood_health_server/src/config/featureFlags.ts`
- `mood_health_server/src/app.ts`
- `mood_health_server/tests/unit/config/featureFlags.test.ts`
- `mood_health_server/.env.example`

**Estimated scope：** M

## Task 7：前端停用非核心入口

**Description：** 使用与后端语义一致的前端功能开关过滤导航和路由，保留源码但阻止用户进入已停用页面。

**Acceptance criteria：**
- [ ] 默认构建不显示活动、社区、课程、音乐、放松和成就入口。
- [ ] 直接访问停用 URL 时进入统一不可用页或 404，不发出旧接口请求。
- [ ] 情绪、测评、用户和必要管理入口不受影响。

**Verification：**
- [ ] 路由单元测试覆盖开关开启与关闭状态。
- [ ] 前端构建通过，人工检查导航与直接 URL。

**Dependencies：** Task 6

**Files likely touched：**
- `src/config/featureFlags.ts`
- `src/router/index.ts`
- `src/router/guards.ts`
- `src/__tests__/router/featureFlags.test.ts`

**Estimated scope：** M

### Checkpoint B

- [ ] 后端关闭路由不访问 SQLite。
- [ ] 前端入口与后端开关一致。
- [ ] 应用可在测试中导入，统一错误契约已经生效。
- [ ] 用户确认后进入核心接口契约修复。

### 阶段 C：核心接口契约稳定化

## Task 8：固定 `request.ts` 单次解包契约

**Description：** 为 `request.ts` 增加契约测试，统一判断 `code === 0` 并返回业务 `data`；旧 `code === 200` 或无 `code` 兼容必须集中、可追踪且有删除条件。

**Acceptance criteria：**
- [ ] 页面调用者只接收业务类型 `T`。
- [ ] HTTP 错误与非零业务码分别得到一致错误对象和提示。
- [ ] 兼容逻辑只存在于请求层，并标记删除门槛。

**Verification：**
- [ ] 运行 `request.ts` 的成功、业务失败、401、500 和旧格式测试。
- [ ] `rg` 确认新增代码未在页面复制 `code/message/data` 判断。

**Dependencies：** Task 5

**Files likely touched：**
- `src/utils/request.ts`
- `src/types/api.ts`
- `src/__tests__/utils/request.test.ts`

**Estimated scope：** M

## Task 9：修复认证与刷新恢复契约

**Description：** 统一注册、登录、`/me` 的 DTO 与响应格式，修复 `userStore` 二次 `.data` 解包，保证刷新后身份恢复可重复验证。

**Acceptance criteria：**
- [ ] 登录返回业务数据 `{ token, user }`，`/me` 返回 `{ user }`。
- [ ] `fetchUserInfo()` 直接消费已解包数据，刷新后恢复用户与角色。
- [ ] 错误响应不泄露密码或 JWT 配置细节。

**Verification：**
- [ ] 认证 Controller 契约测试与 `userStore` 测试通过。
- [ ] 人工执行“登录 → 刷新 → 仍保持登录”。

**Dependencies：** Task 8

**Files likely touched：**
- `mood_health_server/src/controllers/authController.ts`
- `mood_health_server/tests/unit/controllers/authController.test.ts`
- `src/stores/userStore.ts`
- `src/__tests__/stores/userStore.test.ts`

**Estimated scope：** M

## Task 10：统一情绪核心接口契约

**Description：** 只处理现有情绪记录、列表、趋势和描述性统计接口，统一响应 DTO，不改造心理风险算法或新增分析模型。

**Acceptance criteria：**
- [ ] 情绪接口的列表、详情、写操作和趋势返回类型明确且统一。
- [ ] 前端情绪 API 不再依赖 Axios 响应壳或重复 `.data`。
- [ ] 现有业务行为保持不变。

**Verification：**
- [ ] 后端情绪 Controller 契约测试通过。
- [ ] 前端情绪 API 测试和构建通过。

**Dependencies：** Task 8

**Files likely touched：**
- `mood_health_server/src/controllers/moodController.ts`
- `mood_health_server/tests/unit/controllers/moodController.test.ts`
- `src/api/mood.ts`
- `src/__tests__/api/mood.test.ts`

**Estimated scope：** M

## Task 11：统一心理测评接口契约

**Description：** 修复问卷列表、详情、提交、结果和历史记录的响应与前端消费方式；具体量表和评分规则仍保持待定，不在本任务新增或改写。

**Acceptance criteria：**
- [ ] 问卷提交能保存并返回结构化筛查结果。
- [ ] 页面只消费业务 DTO，不直接判断后端响应壳。
- [ ] 文案统一使用筛查、风险提示和风险分层，不出现自动诊断。

**Verification：**
- [ ] 后端测评契约测试覆盖提交和历史记录。
- [ ] 前端问卷 API 测试和人工提交路径通过。

**Dependencies：** Task 8

**Files likely touched：**
- `mood_health_server/src/controllers/questionnaireController.ts`
- `mood_health_server/tests/unit/controllers/questionnaireController.test.ts`
- `src/api/questionnaire.ts`
- `src/views/improve/Questionnaire.vue`
- `src/views/improve/QuestionnaireResult.vue`

**Estimated scope：** M

## Task 12：统一管理与审计接口契约

**Description：** 统一当前管理统计和审计接口的响应结构，保留最小必要访问原则，不在 R0 新增风险个案功能。

**Acceptance criteria：**
- [ ] 管理和审计成功/失败响应符合统一契约。
- [ ] 普通管理统计不返回无需展示的心理内容正文。
- [ ] 前端管理 API 只消费业务 DTO。

**Verification：**
- [ ] 管理与审计 Controller 契约测试通过。
- [ ] 运行权限回归测试，确认学生不能访问管理接口。

**Dependencies：** Task 8

**Files likely touched：**
- `mood_health_server/src/controllers/managementController.ts`
- `mood_health_server/src/controllers/auditController.ts`
- `mood_health_server/tests/unit/controllers/managementController.test.ts`
- `src/api/admin.ts`

**Estimated scope：** M

### Checkpoint C

- [ ] 登录恢复、情绪、测评、管理/审计接口契约测试通过。
- [ ] 页面层不存在新增的响应壳解析。
- [ ] 旧响应兼容项已形成可删除清单。
- [ ] 在进入阶段 D 前，必须完成并批准独立数据库迁移方案。

### 阶段 D：MySQL 基础设施（受数据库迁移方案约束）

## Task 13：建立 Docker Compose 依赖环境

**Description：** 只编排 MySQL 与 Redis 的本地依赖环境，写入 2 核 2G 初始资源限制；Node/Vite 仍在宿主机热更新。

**Acceptance criteria：**
- [ ] `docker compose up -d mysql redis` 可重复启动并通过健康检查。
- [ ] MySQL `max_connections=30`，Redis `maxmemory=128mb` 且采用 `allkeys-lru`。
- [ ] 密码只从环境变量读取，Volume 重启后数据仍存在。

**Verification：**
- [ ] `docker compose config` 通过。
- [ ] 容器健康检查和重启持久化测试通过。

**Dependencies：** Checkpoint C、数据库迁移方案批准

**Files likely touched：**
- `compose.yaml`
- `docker/mysql/my.cnf`
- `docker/redis/redis.conf`
- `.env.production.example`

**Estimated scope：** M

## Task 14：建立 MySQL 连接池与健康检查

**Description：** 使用 `mysql2/promise` 建立单一连接池和配置校验，连接池上限初始为 10；Redis 失败只降级缓存，MySQL 失败不得回写 SQLite。

**Acceptance criteria：**
- [ ] 后端使用 MySQL 连接池且启动时校验必要环境变量。
- [ ] `/health` 分别报告 API、MySQL、Redis 状态，响应符合统一契约。
- [ ] MySQL 不可用时核心写操作失败，不触发 SQLite。

**Verification：**
- [ ] MySQL/Redis 正常、Redis 关闭、MySQL 关闭三种健康检查测试通过。
- [ ] 后端构建通过。

**Dependencies：** Task 13

**Files likely touched：**
- `mood_health_server/package.json`
- `mood_health_server/src/config/database.ts`
- `mood_health_server/src/controllers/healthController.ts`
- `mood_health_server/src/app.ts`
- `mood_health_server/tests/integration/health.test.ts`

**Estimated scope：** M

## Task 15：建立版本化 Migration 执行器

**Description：** 建立最小 SQL Migration 机制和版本表，支持状态查询、升级失败回滚与重复执行保护；具体表结构来自独立数据库迁移方案。

**Acceptance criteria：**
- [ ] Migration 按版本顺序只执行一次并记录校验信息。
- [ ] 单个版本失败时事务回滚，后续版本不执行。
- [ ] 禁止 Model 或应用启动过程自动建表。

**Verification：**
- [ ] 在空库执行 migrate、重复 migrate、故意失败 migrate 三类集成测试。
- [ ] `rg` 建立并记录运行时 `CREATE TABLE` 清退清单。

**Dependencies：** Task 14

**Files likely touched：**
- `mood_health_server/src/db/migrate.ts`
- `mood_health_server/src/db/migrationRunner.ts`
- `mood_health_server/src/db/migrations/0000_migration_table.sql`
- `mood_health_server/tests/integration/migrationRunner.test.ts`
- `mood_health_server/package.json`

**Estimated scope：** M

## Task 16：建立确定性 Seed 与测试库生命周期

**Description：** 创建可重复、高质量、完全虚构的演示 Seed，并让集成测试自行创建用户和清理数据，不再依赖固定用户 `999999` 或旧库状态。

**Acceptance criteria：**
- [ ] Seed 可在空库重复执行，不产生重复主数据。
- [ ] 每个集成测试创建自身数据并在结束后清理。
- [ ] 测试与演示数据不包含真实个人信息或旧 SQLite 数据。

**Verification：**
- [ ] 连续执行两次 Seed 后数量与关键账号一致。
- [ ] 在全新测试库运行后端测试，无手工初始化步骤。

**Dependencies：** Task 15

**Files likely touched：**
- `mood_health_server/src/db/seed.ts`
- `mood_health_server/src/db/seeds/coreSeed.ts`
- `mood_health_server/tests/setup.ts`
- `mood_health_server/tests/helpers/testDatabase.ts`
- `mood_health_server/package.json`

**Estimated scope：** M

### Checkpoint D

- [ ] 空 MySQL 能完成 Migration、Seed 和重复执行验证。
- [ ] Redis 故障不影响业务事实，MySQL 故障不回退 SQLite。
- [ ] 后端测试不依赖旧数据库或固定用户。
- [ ] 用户确认后开始按领域切换。

### 阶段 E：现有核心领域垂直迁移

## Task 17：迁移用户与认证领域

**Description：** 按数据库迁移方案增加用户表 Migration、User Repository 和 Auth Service，将认证 Controller 从旧 Model 切换到 Service。

**Acceptance criteria：**
- [ ] 注册、登录、`/me` 全部通过 User Repository 访问 MySQL。
- [ ] 密码哈希、唯一约束和 JWT 行为保持正确。
- [ ] 认证活动路径不再引用 SQLite 或 SQL Server。

**Verification：**
- [ ] 用户 Repository 集成测试和认证 API 测试通过。
- [ ] 人工执行注册、登录、刷新恢复。

**Dependencies：** Checkpoint D

**Files likely touched：**
- `mood_health_server/src/db/migrations/0010_users.sql`
- `mood_health_server/src/repositories/userRepository.ts`
- `mood_health_server/src/services/authService.ts`
- `mood_health_server/src/controllers/authController.ts`
- `mood_health_server/tests/integration/auth.mysql.test.ts`

**Estimated scope：** M

## Task 18：迁移轻量 RBAC 与审计基础

**Description：** 增加内置角色、权限映射与审计日志的 Migration/Repository，调整鉴权中间件只依赖已定义的三类角色和权限。

**Acceptance criteria：**
- [ ] `student`、`counselor`、`super_admin` 由 Seed 初始化且不可通过注册接口指定。
- [ ] 权限校验通过 Repository/Service 获取，不在 Controller 直接 SQL。
- [ ] 越权访问和关键操作均产生可追踪审计记录。

**Verification：**
- [ ] RBAC 矩阵测试覆盖三类角色的允许与拒绝路径。
- [ ] 审计 Repository 集成测试通过。

**Dependencies：** Task 17

**Files likely touched：**
- `mood_health_server/src/db/migrations/0020_rbac_audit.sql`
- `mood_health_server/src/repositories/accessRepository.ts`
- `mood_health_server/src/services/accessService.ts`
- `mood_health_server/src/middleware/auth.ts`
- `mood_health_server/tests/integration/rbac.mysql.test.ts`

**Estimated scope：** M

### Checkpoint E1

- [ ] 用户、认证、RBAC 和审计活动路径全部使用 MySQL。
- [ ] 三角色权限矩阵通过。
- [ ] 用户确认后迁移业务数据领域。

## Task 19：迁移情绪记录领域

**Description：** 增加情绪相关 Migration、Mood Repository 和 Mood Service，将现有记录、列表、趋势与描述性统计切换到 MySQL，不新增心理诊断逻辑。

**Acceptance criteria：**
- [ ] 情绪写入、查询、更新、删除和趋势均由 Repository 完成。
- [ ] Service/Controller 不包含 SQL，结果与迁移前核心行为一致。
- [ ] 情绪活动路径不再访问旧数据库。

**Verification：**
- [ ] Mood Repository 集成测试和 API 回归测试通过。
- [ ] 人工完成“记录 → 历史 → 趋势”。

**Dependencies：** Checkpoint E1

**Files likely touched：**
- `mood_health_server/src/db/migrations/0030_moods.sql`
- `mood_health_server/src/repositories/moodRepository.ts`
- `mood_health_server/src/services/moodService.ts`
- `mood_health_server/src/controllers/moodController.ts`
- `mood_health_server/tests/integration/moods.mysql.test.ts`

**Estimated scope：** M

## Task 20：迁移心理测评存储领域

**Description：** 按待定量表的通用数据结构迁移量表版本、题目、作答、结果和规则来源记录；只迁移现有能力，不确定具体量表、不改写评分规则。

**Acceptance criteria：**
- [ ] 测评记录保存量表版本、逐题答案、结果和规则版本。
- [ ] 评分通过心理评估规则能力调用，Repository 只负责数据访问。
- [ ] 测评活动路径不再访问旧数据库。

**Verification：**
- [ ] Questionnaire Repository 集成测试和提交/历史 API 测试通过。
- [ ] 人工完成一次通用测试量表提交，确认仅展示筛查提示。

**Dependencies：** Task 19

**Files likely touched：**
- `mood_health_server/src/db/migrations/0040_assessments.sql`
- `mood_health_server/src/repositories/assessmentRepository.ts`
- `mood_health_server/src/services/assessmentService.ts`
- `mood_health_server/src/controllers/questionnaireController.ts`
- `mood_health_server/tests/integration/assessments.mysql.test.ts`

**Estimated scope：** M

## Task 21：迁移管理聚合读取

**Description：** 将现有管理统计改为基于 MySQL Repository 的匿名聚合查询，删除管理 Controller 直接 SQL，不在 R0 新增风险个案页面。

**Acceptance criteria：**
- [ ] Controller 不直接导入数据库驱动或执行 SQL。
- [ ] counselor 只得到匿名聚合数据，super_admin 的访问也被审计。
- [ ] 管理统计不依赖已停用模块的数据表。

**Verification：**
- [ ] 管理 Repository 集成测试和数据范围测试通过。
- [ ] 静态搜索确认管理 Controller 无 SQL 和数据库驱动导入。

**Dependencies：** Task 18、Task 19、Task 20

**Files likely touched：**
- `mood_health_server/src/repositories/managementRepository.ts`
- `mood_health_server/src/services/managementService.ts`
- `mood_health_server/src/controllers/managementController.ts`
- `mood_health_server/tests/integration/management.mysql.test.ts`

**Estimated scope：** M

### Checkpoint E2

- [ ] 登录恢复、情绪、测评和管理聚合核心链路全部使用 MySQL。
- [ ] Repository 是上述领域唯一数据库访问边界。
- [ ] 社区、活动、课程、音乐、放松和成就仍保持关闭。
- [ ] 用户确认后开始旧数据库清退。

### 阶段 F：旧架构清退与 R0 验收

## Task 22：清退核心路径 SQL Server 分支

**Description：** 删除数据库总入口、核心 Model 和核心脚本中的 SQL Server 分支，保留已验证的 MySQL 实现；不在此任务处理非核心模块。

**Acceptance criteria：**
- [ ] 用户、认证、RBAC、审计、情绪、测评和管理路径无 `mssql` 导入。
- [ ] 数据库配置只接受 MySQL，不再通过 `DB_CLIENT` 切换。
- [ ] 核心构建和测试通过。

**Verification：**
- [ ] 对核心目录执行 `rg "mssql|SQL Server|isSqliteClient"`，结果为空或仅为迁移说明。
- [ ] MySQL 环境完成核心冒烟测试。

**Dependencies：** Checkpoint E2

**Files likely touched：**
- `mood_health_server/src/config/database.ts`
- `mood_health_server/src/models/userModel.ts`
- `mood_health_server/src/models/moodModel.ts`
- `mood_health_server/src/models/questionnaireModel.ts`
- `mood_health_server/tests/setup.ts`

**Estimated scope：** M

## Task 23：清退活动与社区模块的 SQL Server 残余

**Description：** 在功能保持关闭的前提下，只删除活动、帖子和评论模型的 SQL Server 分支；不迁移到 MySQL，不恢复入口。

**Acceptance criteria：**
- [ ] 三个遗留模型无 `mssql` 导入或 SQL Server 分支。
- [ ] 功能开关仍默认关闭，代码没有被意外启用。
- [ ] 后端构建通过。

**Verification：**
- [ ] 对目标文件执行静态搜索并运行后端构建。
- [ ] 调用关闭接口，确认仍不访问 SQLite。

**Dependencies：** Task 22

**Files likely touched：**
- `mood_health_server/src/models/activityModel.ts`
- `mood_health_server/src/models/postModel.ts`
- `mood_health_server/src/models/commentModel.ts`

**Estimated scope：** M

## Task 24：清退资源类模块的 SQL Server 残余

**Description：** 在功能保持关闭的前提下，只删除课程、音乐、放松、成就和建议模型的 SQL Server 分支；SQLite 遗留实现暂存到 P1/P2 迁移。

**Acceptance criteria：**
- [ ] 目标模型无 `mssql` 导入或 SQL Server 分支。
- [ ] 未新增 MySQL 兼容层，未恢复被关闭入口。
- [ ] 后端构建通过。

**Verification：**
- [ ] 对目标文件执行静态搜索并运行后端构建。
- [ ] 功能开关回归测试通过。

**Dependencies：** Task 23

**Files likely touched：**
- `mood_health_server/src/models/courseModel.ts`
- `mood_health_server/src/models/musicModel.ts`
- `mood_health_server/src/models/relaxModel.ts`
- `mood_health_server/src/models/achievementModel.ts`
- `mood_health_server/src/models/adviceModel.ts`

**Estimated scope：** M

## Task 25：删除 SQL Server 依赖与废弃脚本

**Description：** 在全仓源代码零 SQL Server 引用后，独立删除 `mssql`、类型依赖和只服务 SQL Server 的初始化/迁移脚本。

**Acceptance criteria：**
- [ ] `package.json` 与 lockfile 不再包含 `mssql` 或 `@types/mssql`。
- [ ] 活动源码没有 SQL Server 导入、配置或启动参数。
- [ ] 删除范围经 `git diff --stat` 人工复核。

**Verification：**
- [ ] 运行 `rg "mssql|SQL Server|DB_SERVER"`，只允许历史文档命中。
- [ ] 重新安装依赖后后端构建和测试通过。

**Dependencies：** Task 24

**Files likely touched：**
- `mood_health_server/package.json`
- `mood_health_server/package-lock.json`
- `mood_health_server/src/scripts/` 下已确认废弃的 SQL Server 脚本（机械删除）
- `mood_health_server/.env.example`

**Estimated scope：** M（脚本删除必须独立提交）

## Task 26：实现 SQLite 活动运行路径零访问

**Description：** 删除核心领域的 SQLite 分支、初始化和运行配置；非核心模块的遗留实现保留源码但不得由应用入口导入或执行，最终删除留到 P1/P2。

**Acceptance criteria：**
- [ ] 默认启动、核心 API、Migration、Seed 和测试均不创建或打开 SQLite 文件。
- [ ] SQLite 引用只存在于明确标记的停用模块或历史工具中。
- [ ] 运行应用后仓库内不会新生成 `.db`、`.db-wal` 或 `.db-shm`。

**Verification：**
- [ ] 启动前后比较数据库文件清单，确认无新增或修改。
- [ ] 静态检查应用入口到 SQLite 模块不存在可达导入路径。

**Dependencies：** Task 25

**Files likely touched：**
- `mood_health_server/src/config/sqlite.ts`
- `mood_health_server/src/app.ts`
- `mood_health_server/package.json`
- `scripts/sqlite-preflight.ps1`
- `scripts/sqlite-db-status.ps1`

**Estimated scope：** M

## Task 27：删除前端旧响应兼容并完成 R0 验收

**Description：** 在所有活动核心接口完成统一契约后，删除 `request.ts` 中 `code === 200`、无 `code` 等临时兼容，执行干净环境验收并更新基线结果。

**Acceptance criteria：**
- [ ] 前端请求层只接受 `code === 0` 的统一响应。
- [ ] 干净环境可完成 Compose 启动、Migration、Seed、构建、测试和核心冒烟。
- [ ] R0 验收报告证明活动路径零 SQL Server、零 SQLite，非核心功能仍关闭。

**Verification：**
- [ ] `docker compose config` 与依赖容器健康检查通过。
- [ ] `npm run build:all`、`npm run test:all` 全部通过。
- [ ] 人工完成“注册/登录/刷新 → 情绪记录/趋势 → 测评提交/历史 → 管理权限隔离”。

**Dependencies：** Task 26

**Files likely touched：**
- `src/utils/request.ts`
- `src/__tests__/utils/request.test.ts`
- `scripts/doctor.mjs`
- `docs/refactor/R0-acceptance-report.md`

**Estimated scope：** M

### Checkpoint F：R0 完成

- [ ] 所有任务验收条件满足。
- [ ] Task PERF 已完成相同条件复测，并形成可追溯的重构前后性能对比。
- [ ] 所有自动化测试、构建、类型检查和部署冒烟通过。
- [ ] Repository 是核心领域唯一数据库访问边界，Service 无直接 SQL。
- [ ] MySQL 是活动运行时唯一业务数据库，Redis 不是事实来源。
- [ ] 非核心模块保持关闭且不访问 SQLite。
- [ ] 未实现风险个案新功能，未接入正式 AI。
- [ ] 用户批准 R0 验收后，才进入 P0/v1.0 PRD。

## 7. 风险与控制

| 风险 | 影响 | 控制方式 |
|---|---|---|
| 把数据库迁移变成整体重写 | 工期失控、回归困难 | 每个领域最多一个垂直切片，旧代码只在切换成功后删除 |
| 为修测试继续维护 SQLite | 产生临时架构债务 | 旧测试只记录基线，新集成测试直接使用独立 MySQL 测试库 |
| 功能开关只隐藏前端 | 后端仍访问旧库 | 后端不挂载路由并验证无 SQLite 导入/建表 |
| 过早删除旧库导致无法回退 | 数据或功能丢失 | 先备份、校验，再按核心领域验证后独立清退 |
| 非核心源码阻碍 SQLite 最终删除 | 长期遗留 | v1.0 保证运行路径零访问，P1/P2 逐模块迁移后物理删除 |
| API 兼容层永久存在 | 契约继续混乱 | Task 27 设置明确删除门槛 |
| 心理规则在重构中被顺手修改 | 科学性和答辩风险 | R0 只迁移存储与边界，不改变未批准规则 |
| 2 核 2G 内存不足 | 容器重启、演示不稳定 | MySQL 30 连接、Redis 128MB、Node 单进程 512MB，并在冒烟测试校准 |
| 前后性能测试条件不一致 | 无法在论文中得出可信结论 | 固定硬件限制、Seed、预热、请求量和并发度，保留原始结果并至少重复 3 次 |

## 8. 明确不在本计划内

- 风险个案、转介、结案等 P0 新功能开发。
- 具体心理量表选型和评分规则确认。
- AI 分析、AI 建议、AI 报告、Prompt 管理和 `input_summary` 表实现。
- 社区、活动、课程、音乐、放松和成就的 MySQL 迁移与重新启用。
- UI 视觉重做、微服务、消息队列、Kubernetes 或自建模型。

## 9. 下一份文档

本计划审核通过后，下一步编写独立的数据库迁移方案，至少包括：

1. MySQL 核心表数据字典和 ER 关系。
2. Migration 版本序列、事务与失败恢复方式。
3. 确定性 Seed 与演示账号设计。
4. SQLite 备份、对照、运行路径清退和最终删除门槛。
5. 各领域 Repository 接口与集成测试策略。

数据库迁移方案未批准前，不执行阶段 D 及后续任务。
