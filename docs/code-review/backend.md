# 后端代码审查报告

> 项目：`mood_health_server`（大学生情绪健康管理平台后端）
> 技术栈：Node.js + TypeScript + Express 5 + MySQL(mysql2/promise) + Redis(ioredis) + Jest
> 审查方式：只读分析 + 实跑验证（`tsc --noEmit`、`jest` 单测、集成测试）。未修改任何源码、未提交、未生成 dist。
> 源码规模：123 个 `.ts` 文件，约 21,173 行；测试约 (tests 目录，单测 245 例)。

---

## 一、概览与评分

| 维度 | 评分(0-10) | 简述 |
|---|---|---|
| 代码质量 | 6.0 | `strict` 类型检查通过、参数化 SQL 贯彻良好；但 `any` 出现 93 次、263 处魔法 HTTP 状态码、1683 行 god-file、单处控制器越层直连 DB、死代码、存在吞错。 |
| 架构与解耦 | 7.0 | controller/service/repository 三层总体清晰，关键仓库有事务；但 `activityController` 越层直查 DB、`requirePermission` 运行时读库而 `rolePermissions` 内存映射又作为种子源（双份权限模型易漂移）、无全局鉴权、存在未启用的 feature-flag 死代码。 |
| 测试 | 7.0 | `tsc` 0 错、单测 55 套 245 例全绿、集成 9 例全绿；但覆盖率门槛偏低（函数 45%/行 45%）、集成仅覆盖 moods、多个仓库（mood/post/activity/achievement/course/music/relax/management）无独立单测。 |
| 安全 | 6.5 | 无 SQL 注入、鉴权/授权模型完整、日志脱敏到位、note 加密、AI 安全审计已接入；但存在**权限提升**、**Redis 宕机时登录暴力破解防护被静默关闭**、**AI 限流只配置不生效**、token 无服务端吊销、AI 内部 token 默认空串等隐患。 |
| **总评** | **6.6** | 工程完成度高、基础扎实，可上线学习演示；但在**授权边界、Redis 依赖的健壮性、AI 成本控制、类型纯净度**上需重点加固。 |

---

## 二、源码地图与启动流程

### 2.1 目录分层

```
src/
├── server.ts              启动入口（加载 dotenv → connectMysql → createApp().listen）
├── app.ts                 构建 Express 实例（中间件/路由挂载/健康检查），导出 createApp
├── config/                mysql.ts / aiConfig.ts / featureFlags.ts / sqlite.ts(死代码)
├── routes/                25 个路由文件（按业务域拆分，如 moodRoutes、postRoutes…）
├── controllers/           对应控制器（解析 req、调 service、组装响应）
├── services/              业务逻辑（authService、moodService、caseService、ai*…）
├── repositories/         数据访问层（参数化 SQL、事务）
├── middleware/            auth(鉴权/授权) / csrf / errorHandler / validateRequest / requestId / featureFlag
├── utils/                 logger / errors / apiResponse / encryption / cache / redis.client / operationLogger / password
│   └── ai/                aiClient / aiCallService / aiSafetyService / contentAuditService / moodAnalysisService / recommendService
├── models/                aiModel.ts（1683 行：类型 + 缓存辅助 + 遗留 SQLite 模型）
├── contracts/             moodAnalysis 校验契约
├── db/                    migrate / migrationRunner / seeds（含 coreSeed 将 rolePermissions 写入库）
├── scripts/               test_role_permissions.ts / verifyDemoUsers.ts
└── types/                 express.d.ts
```

### 2.2 启动流程（`server.ts` → `app.ts`）

1. `server.ts:1-3` 加载 dotenv；`startServer()` 先 `connectMysql()`（带 3 次重试，`mysql.ts:95`），再 `createApp().listen(port, host)`。
2. `app.ts:63 createApp()` 顺序：
   - `validateEnv()`（app.ts:41）检查 `JWT_SECRET/MYSQL_*` 等必填环境变量；
   - `helmet`（CSP 按环境区分，app.ts:98）+ `app.disable('x-powered-by')`；
   - `requestIdMiddleware` → `cookieParser` → **`csrfMiddleware`(挂载于 `/api`)** → `cors` → `express.json({limit:'1mb'})` + `compression`；
   - `morgan` 自定义 JSON 日志（写入 winston，并对 body 做脱敏摘要）；
   - 登录路由限流 `rateLimit` 仅挂在 `/api/auth/login`（app.ts:182）；
   - 路由挂载（**注意：除 `/api/moods`、`/api/questionnaires`、`/api/auth` 外，多数 `/api/*` 路由未在 app 层统一加 `authenticate`，而是在各自 router 内逐路由加**，已逐文件核对均加了鉴权，见第六章）；
   - `/health`（依赖 `checkMysql` + `redisClient.ping`）、`/__e2e/ready`；
   - `notFoundHandler` → `errorHandler`（统一错误中间件）。
3. **DB/Redis 初始化**：MySQL 在 `server.ts` 启动前 `connectMysql()` 连接池懒创建（`getMysqlPool` 单例）；**Redis 无显式初始化**——`redisClient` 是模块级单例（`redis.client.ts:235`），在 import 时即 `new Redis(...)` 尝试建连，健康检查在 `/health` 时才 `ping()`。若 Redis 为必需依赖，启动不会因 Redis 不可用而快速失败。

---

## 三、代码质量

### 3.1 命名 / 长度 / 圈复杂度热点
- 最大文件：`src/models/aiModel.ts` **1683 行**（类型 + 缓存工具函数 + 遗留 SQLite 模型混在一起，见 3.4）；`moodRepository.ts` 856、`moodService.ts` 663、`assessmentRepository.ts` 580、`managementRepository.ts` 492、`activityController.ts` 481、`managementController.ts` 470、`moodController.ts` 461、`auth.ts` 415、`postController.ts` 394。
- `auth.ts` 内含约 127 行的 `rolePermissions` 权限映射表（auth.ts:92-218），与数据库 `role_permissions` 表**双份定义**（见 4.2）。
- 控制器普遍存在 `try { ... } catch (error) { logger.error(...); res.status(500)... }` 样板，重复度高。

### 3.2 重复代码 / 死代码 / 魔法值
- **死代码**：`src/config/sqlite.ts`（约 266 行，`node:sqlite` 遗留路径）在运行中完全未被引用，由 `tests/unit/architecture/noSqliteActivePath.test.ts` 反向确认“SQLite 路径未启用”。`app.ts:57` 的 `NON_CORE_ROUTES = []` 与 `featureFlag.requireNonCoreModules` 实际为空操作（所有非核心路由都已挂载，feature flag 未真正启用）。
- **魔法数字/字符串**：
  - 263 处 `res.status(400|401|403|404|409|429|500|502)` 直接字面量（控制器内），缺少统一 HTTP 状态常量模块。
  - 角色字面量在多处硬编码：`['user','admin','super_admin']`（managementController.ts:42,69）、`auth.ts` 的 `UserRole`，与 `UserRole` 类型重复定义；`expiresIn: '7d'`（authService.ts:186）魔数字面量。
- **重复类型**：`aiHistoryController.ts:11-13` 自行定义 `AuthRequest` 接口，与 `middleware/auth.ts` 的 `AuthRequest` 重复。

### 3.3 错误处理
- 统一错误中间件 `errorHandler`（`errorHandler.ts:15`）存在且按环境隐藏内部错误、统一业务码（`apiFailure`），整体规范。
- **吞错隐患**：
  - `achievementRepository.ts:118`：`catch { return 0 }` 静默吞掉查询异常，掩盖真实故障。
  - `redis.client.ts` `execute/set` 在 `fallbackEnabled=true`（默认）时，出错**只 warn 并返回 null/false**，不抛异常——见 6（登录限流被静默绕过）。
  - `encryption.ts:78` `decrypt` 失败时 `return encryptedData`（返回密文而非抛错），可能把密文当明文入库/返回。

### 3.4 日志质量
- 使用 **winston + 按天滚动文件**，非裸 `console`（仅在 `server.ts` 启动横幅与 `logger.ts` 进程守护里用 `console`，可接受）。
- `logger.ts` 做了较完善的脱敏：key 级（`password/token/secret/...`）置 `[REDACTED]`，值级正则擦除 Bearer/JWT/身份证；`summarizeRequestBody` 只记录字段名与敏感字段标记，不落具体值；AI 内容截断。整体**日志安全良好**。
- 个别脚本（`scripts/`、`db/seed.ts`、`db/migrate.ts`）用 `console.log` 打印种子/迁移进度，属 CLI 工具，可接受。

### 3.5 类型安全
- `tsconfig.json`：`strict: true`、`noImplicitAny` 随之开启 → **`tsc --noEmit` 实跑 0 错误**（见第五章）。
- 但源码仍有 **93 处 `any`**（`grep -rnE ": any|as any|<any>|any\[\]" src` 统计），典型位置：
  - `utils/errors.ts:15,21`（`AppError.data: any` 等基类字段）；
  - `utils/redis.client.ts:90-93`（`execute<T>(command: (...args: any[])...)`）；
  - `utils/ai/moodAnalysisService.ts`、`services/analysisDispatcher.ts`、`controllers/moodAnalysisController.ts`、`controllers/counselingController.ts` 等用 `any` 解析 AI 返回结构。
  - 这些 `any` 关闭了严格类型检查，是潜在缺陷温床。

---

## 四、架构与解耦

### 4.1 三层分离
- 多数调用链规范：`controller → service → repository → mysql2`。例如 mood 流程：`moodController → moodService → moodRepository`，AI 流程：`*Controller → aiClient/callChatCompletion → FastAPI`。
- **越层违规（确凿）**：`src/controllers/activityController.ts:3-4` 直接 `import { getMysqlPool } from '../config/mysql'`，并在 `:395` 取 pool、`:426` 用 `pool.query(\`SELECT COUNT(*) ... WHERE 1=1${dateFilter}\`)` 直写统计 SQL——应下沉到 `activityRepository`/service。这是唯一一处控制器直连 DB。
- `services/analysisDispatcher.ts:13` 也直接 `import { getMysqlPool }`，属轻度越层（服务层应经由 repository 访问 DB）。

### 4.2 授权模型双份定义（易漂移）
- 运行时鉴权 `requirePermission`（`middleware/auth.ts:386`）查的是**数据库**：`accessRepository.hasPermission` 连 `roles/role_permissions/permissions` 三表（accessRepository.ts:10-25）。
- 同时 `middleware/auth.ts:92-218` 定义了约 127 行内存 `rolePermissions` 映射，并由 `db/seeds/coreSeed.ts:240` 作为**种子源**写入库。
- 风险：代码映射与库表两份权限，若只改其一（尤其 `forbidden` 列表）将导致“认为禁止、实际放行/反之”。且该映射里 `auth.register.role_assign` 在所有角色均标 `forbidden`、且无任何路由要求其放行 → 该权限**形同虚设/永不授予**（与 `register` 已在 service 层禁止 body 带 role 重复防御，属冗余且易误导）。

### 4.3 循环依赖
- 主要依赖：`middleware/auth → repositories/{access,audit}Repository → config/mysql`；`controllers → services → repositories`。未发现相互 `require` 的循环依赖。架构在依赖方向上基本健康。

### 4.4 对 Express 耦合 / 配置管理
- 配置较分散：`JWT_SECRET/MYSQL_*/REDIS_*/AI_*` 等多处 `process.env` 直读（`mysql.ts` 有 `readMysqlConfig` 收敛；`aiConfig.ts` 有 `getEnv` 收敛；但 `redis.client.ts`、`auth.ts`、`aiClient.ts` 仍裸读 `process.env`）。建议统一一个 `config` 模块聚合。
- `app.ts` `validateEnv()` 在 `createApp` 内调用，而 `server.ts` 先 `connectMysql()`，缺环境变量时走 MySQL 报错分支（顺序略别扭）。

### 4.5 事务处理
- 参数化事务正确：已使用事务的仓库 6 个——`activityRepository / assessmentRepository / knowledgeAssistantRepository / moodRepository / postRepository / userRepository`（grep `begin|commit|rollback` 命中 59 处）。
- 正面样例：`moodRepository.ts:240-267` 批量插 `mood_emotions/mood_tags` 在 `connection` 事务中，`catch → rollback → throw`，集成测试 `rejects delete for wrong user` / `rolls back on partial failure` 已验证回滚正确。
- **需审计**：部分多写操作未必包裹事务（如 `caseService` 建案+干预、`managementService` 改角色等），建议对所有“多语句写”流程复盘是否缺 `BEGIN/COMMIT/ROLLBACK`。

### 4.6 调用外部 AI 服务（mood_health_ai_service）
- 两类客户端：
  - `services/fastApiClient.ts`：调用 FastAPI 微服务，**HMAC-SHA256 签名**（`generateAuthHeaders` 用 `AI_SERVICE_INTERNAL_TOKEN` 对 `body+timestamp+token` 签名，`X-Signature/X-Timestamp/X-Nonce`），带指数退避重试，设计合理。
  - `utils/ai/aiClient.ts` `callChatCompletion`：POST 到 `AI_SERVICE_BASE_URL/api/ai/chat`，同样用 `generateAuthHeaders` 签名；缺省 `AI_SERVICE_BASE_URL=http://127.0.0.1:8001`（aiClient.ts:220）。
- 超时：`aiConfig.timeout` 默认 30000ms，axios `timeout` 已设置；失败按 status 细分（401/400/422/429/502/ECONNREFUSED）并包装为 `AiServiceError`。
- **问题**：见 6（限流只配置不生效、内部 token 默认空串）。

---

## 五、测试评估（含实跑结果）

### 5.1 测试文件枚举（tests/）
- `tests/unit/`：55 个 `.test.ts`，覆盖 controllers（auth/management/audit/aiHistory/questionnaire/mood/counseling/knowledgeAssistant/case…）、services（auth/case/audit/assessment/counseling/management/aiContext/analysisDispatcher/unifiedAssistant…）、repositories（user/assessment/audit/case/prompt/access/knowledgeAssistant）、middleware（auth/errorHandler）、db（migration/seed）、config、architecture。
- `tests/integration/`：**仅 1 个** `moodCrud.integration.test.ts`（9 例，覆盖 mood 仓库 CRUD + 跨用户删除拒绝 + 事务回滚）。
- `tests/contract/`：`moodAnalysisContract.test.ts`。
- `tests/utils/ai/counselingService.test.ts`（位于 tests/utils，非标准 testMatch 目录，可能未被 `jest tests/unit` 收集——需确认其是否被执行；`jest.config` 的 `roots` 含 `tests` 与 `src`，`testMatch: **/*.test.ts`，故 `tests/utils/**` 也会被收集，但文件名 `counselingService.test.ts` 符合，应被执行）。

### 5.2 覆盖率估算
- 有独立单测的 service/controller/repository 较多（见上）；**缺少独立单测**的仓库：`moodRepository`（仅靠集成测）、`postRepository`、`activityRepository`、`achievementRepository`、`courseRepository`、`musicRepository`、`relaxRepository`、`managementRepository`、`userProfileService`、`moodService`（仅 contract 测）。
- `jest.config.js` 覆盖率门槛仅 `functions 45% / lines 45% / branches 30% / statements 50%`，门槛偏低。

### 5.3 测试质量
- 大量使用 mock/注入：如 `authService` 通过 `createAuthService({repository, signJwt, jwtSecret, now, randomSuffix})` 注入依赖（`authService.ts:101`），`aiHistoryController` 通过 `AiHistoryControllerDeps.repo` 注入，`accessRepository` 有 `setAccessRepository` 测试钩子（`auth.ts:71`）——DI 设计利于测试，质量较好。
- 未发现“空 `it`/不调用 expect”的假通过；断言充实（含异常断言 `rejects.toThrow`、回滚断言）。
- 集成测试用真实临时用户 `+ cleanupTestData`，结构良好。

### 5.4 实跑结果（真实命令输出）

**① 类型检查**（`npx tsc --noEmit`）
```
EXIT:0   （无输出，0 错误；strict 模式通过）
```

**② 单元测试**（`npx jest tests/unit --runInBand`）
```
Test Suites: 55 passed, 55 total
Tests:       245 passed, 245 total
Time: 27.183 s   EXIT:0
```
（全部通过；仅 dotenv 注入 .env 的 console 提示，无失败）

**③ 集成测试**（`npx jest --config jest.integration.config.js --runInBand`）
```
Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total   EXIT:0
```
说明：集成测试依赖真实 MySQL（`MYSQL_HOST=127.0.0.1`、库 `mood_health_e2e`、用户 `mood_app`），当前环境**实际存在可用 MySQL**，故 9 例全部通过（含事务回滚验证）。若在无 MySQL 环境运行会因 `beforeAll` 连接失败而整体失败——非代码缺陷，属环境依赖。

---

## 六、安全评估

- **SQL 注入**：全量参数化。所有用户输入均经 `?` 占位符；动态片段（表名/列名/分组格式）均来自**固定白名单映射**而非用户输入：`achievementRepository.ts:57 getMetricTable`（switch 白名单）、`managementRepository.ts:307 groupFormat`（由 `granularity` 推导固定串）、`activityRepository.ts:275-286` / `promptRepository.ts:139-148`（字段白名单）、`moodRepository.ts:243,253`（`(?)` 占位符由数组长度生成）。**未发现拼接用户输入的 SQL**。✅
- **鉴权（JWT）**：`authenticate`（`auth.ts:277`）优先读 HttpOnly Cookie `auth_token`，回退 `Authorization: Bearer`；用 `JWT_SECRET`（`process.env`）验签，非法/过期返回 401；非法 role 回退 `user` 并 warn。注册在 service 层拒绝 body 携带 `role/isAdmin`（`authService.ts:111`），默认建 `student`，无越权注册。✅
- **授权（RBAC）**：运行时 `requirePermission` 查库三表；`requireAdmin`/`requireRole` 守卫；审计日志 `auditAccessDenied` 记录越权尝试。路由逐文件核对均已挂鉴权（见 2.2）。⚠️ 但存在权限提升（见下表 P1）。
- **输入校验**：`express-validator` + `validateRequest` 在多数写接口使用（auth/mood/post/case/management/questionnaire/aiInterpretation/knowledgeAssistant 等）；但**仍有路由仅有鉴权而无字段校验**（如 `moodRoutes` 的 GET 列表、`aiHistory` 的保存仅校验“非空”），部分 AI 类接口校验较弱。
- **密钥管理**：`.env` 未被 git 跟踪（`git check-ignore .env` 命中，靠父级 `.gitignore` 忽略；仓库内仅跟踪 `.env.example` 等样例）。源码无硬编码密钥（扫描 `apiKey|secret|password|token = '<字面量>'` 为空）。⚠️ 但**仓库内无本地 `.gitignore`**，仅靠父目录忽略，存在误提交风险；建议补本地 `.gitignore`（含 `.env`、`dist`、`logs`、`coverage`、`node_modules`）。
- **CORS / 限流 / 防暴破**：
  - CORS：`app.ts:78-94` 显式 origin 白名单 + `credentials:true`；无 origin 请求放行（`if (!origin) callback(null,true)`）——对 Postman/探针友好，结合凭据需注意；生产环境建议收紧。
  - 限流：仅 `/api/auth/login` 有 `express-rate-limit`（生产 20/min）；**AI 类接口无限流**（见 P1）；全局无统一限流。
  - 防暴破：登录失败 5 次/15 分钟锁（`authService.ts:9,82`），但**依赖 Redis**，Redis 不可用时被静默跳过（见 P1）。

---

## 七、缺陷与风险清单（表格）

> 严重度：P0=必须立即修（安全/数据损坏）；P1=高危应尽快修；P2=中低危/质量债。

| # | 严重度 | file:line | 问题描述 | 建议 |
|---|---|---|---|---|
| 1 | P1 | `controllers/managementController.ts:111-157`（`adminUsersUpdateRoleHandler`）；`routes/managementRoutes.ts:62-74`（`roleManageHandler`） | **权限提升**：`user.manage` 持有者（含普通 `admin`）可把任意用户（含自己）`targetRole` 改为 `super_admin`；无“禁止自改/禁止提权到 super_admin”校验。 | 仅 `super_admin` 可分配 `super_admin`；`admin` 的 `targetRole` 限 `user/admin`；禁止把自身提权；操作前二次确认。 |
| 2 | P1 | `services/authService.ts:86-99,151-159`；`utils/redis.client.ts:90-114` | **Redis 宕机时登录暴力破解防护被静默关闭**：`redis.lastError` 时跳过锁定检查、`incrementLoginAttempts` 直接 return；`fallbackEnabled` 默认 true 导致 Redis 错误被吞。 | 区分“缓存可降级”与“安全控制不可降级”：登录锁禁用 Redis 时应 fail-closed（拒绝登录或强制验证码），而非静默放行；不要吞认证相关异常。 |
| 3 | P1 | `config/aiConfig.ts:60-64`（定义）；`utils/ai/aiClient.ts`、`services/fastApiClient.ts`、`services/analysisDispatcher.ts`（均未消费 `enableRateLimit/rateLimit`） | **AI 限流只配置不生效**：`aiConfig.rateLimit` 在代码中无任何强制点，AI 接口（`/api/ai/counseling`、`/api/ai/interpret`、`/api/recommend/content`、counseling）可被无限调用 → 成本失控/DoS。 | 在 `callChatCompletion`/AI 入口用 Redis 或内存计数器实现 per-user/IP 限流；或为 AI 路由挂 `express-rate-limit`。 |
| 4 | P1 | `utils/ai/aiClient.ts:222`；`config/aiConfig.ts:55` | **AI 内部 token 默认空串**：`AI_SERVICE_INTERNAL_TOKEN || ''`、`apiKey || ''`。未配置时 HMAC 以空密钥签名（等同无认证），FastAPI 若未强制校验即可被伪造请求。 | 启动校验 `AI_SERVICE_INTERNAL_TOKEN` 必填（与 `validateEnv` 一致）；缺失则拒绝启动 AI 相关能力。 |
| 5 | P2 | `controllers/authController.ts:50-53`（`logout`）；`authService.ts:183-187` | **Token 无服务端吊销**：登出仅清 Cookie；JWT 有效期 7 天，被盗/登出后令牌仍可用；无刷新令牌与黑名单。 | 引入 Redis 令牌黑名单（登出/改密时拉黑 jti）；或缩短有效期 + 刷新令牌；敏感操作二次校验。 |
| 6 | P2 | `utils/encryption.ts:54-79`（尤其 `:78`） | **解密失败返回密文**：`decrypt` 异常时 `return encryptedData`，可能把密文当明文入库/返回，造成静默数据损坏。 | 解密失败应抛错或返回 `null` 并由调用方显式处理，禁止回退返回原始密文。 |
| 7 | P2 | `routes/postRoutes.ts:91,94,97,121` | **树洞/帖子内容公开可读**：`GET /`、`/:id`、`/:id/comments`、`/:id/ai-reply` 无需鉴权，暴露用户情绪/倾诉内容（隐私）。 | 评估是否需要登录可见或脱敏；至少对含敏感标记的帖子默认不公开 AI 回复。 |
| 8 | P2 | `controllers/activityController.ts:3-4,395,426` | **控制器越层直连 DB**：直接 `getMysqlPool().query(...)` 写统计 SQL，破坏分层、难测试。 | 将统计查询下沉到 `activityRepository`/service。 |
| 9 | P2 | `services/analysisDispatcher.ts:13` | 服务层直接 `import { getMysqlPool }` 访问 DB（轻度越层）。 | 经 repository 访问；或明确这是必要的跨域聚合并加注释。 |
| 10 | P2 | 全仓 93 处 `any`（如 `utils/errors.ts:15`、`utils/redis.client.ts:90-93`、`utils/ai/moodAnalysisService.ts`、`services/analysisDispatcher.ts`） | `any` 关闭严格类型检查，隐藏潜在运行期错误。 | 用具体类型/泛型/`unknown`+类型守卫替代；尤其 AI 返回结构应定义 DTO。 |
| 11 | P2 | 控制器内 263 处 `res.status(400|401|...)` 字面量 | 魔法 HTTP 状态码，易写错、难统一。 | 抽取 `HttpStatus` 常量模块或在 `apiFailure` 旁封装。 |
| 12 | P1 | `config/sqlite.ts`（约 266 行） | **死代码**：遗留 `node:sqlite` 路径，运行从不启用（被 `noSqliteActivePath` 测试反向证明）。 | 删除整个文件与对应测试，减少攻击面与混淆。 |
| 13 | P2 | `models/aiModel.ts`（1683 行） | **god-file**：类型 + 缓存工具 + 遗留 SQLite 模型混杂（`legacySqliteModels.test.ts` 暗示含遗留模型）。 | 拆分为 `types/`、`cache/`、`legacy/`（删除遗留部分），按职责归并。 |
| 14 | P2 | `middleware/auth.ts:92-218`（约 127 行 `rolePermissions`） | **权限模型双份**：内存映射作种子源 + 运行时查库，易漂移；`auth.register.role_assign` 在所有角色 `forbidden` 且永不授予，形同虚设。 | 单一权威来源（以 DB 为准），代码映射仅用于生成种子并加一致性校验测试；清理永不使用的权限码。 |
| 15 | P2 | `repositories/achievementRepository.ts:118` | `catch { return 0 }` 静默吞错，掩盖真实故障。 | 记录 error 并向上抛，或显式返回“不可用”语义。 |
| 16 | P2 | `utils/redis.client.ts`（execute/set/get 在 fallback 时返回 null/false 仅 warn） | 缓存类降级合理，但**认证相关**（登录锁）也走同通道被静默绕过（与 #2 同源）。 | 认证/限流类 Redis 操作 fail-closed；缓存类可 fail-open。 |
| 17 | P2 | `server.ts:10-22`（启动仅 `connectMysql`，Redis 无初始化）；`utils/redis.client.ts:235`（import 即建连） | Redis 不作为启动硬性依赖，缺 Redis 时启动不失败；但代码多处依赖 Redis（登录锁）。 | 明确 Redis 是否必需；必需则在 `startServer` 显式 `connectRedis()` 并在失败时 fail-fast；或提供明确的降级说明。 |
| 18 | P2 | `app.ts:57` `NON_CORE_ROUTES = []`；`middleware/featureFlag.ts` `requireNonCoreModules` | feature-flag 系统实际为空操作（所有非核心路由均已挂载），死代码。 | 实现真正按环境变量启停非核心模块，或删除该机制。 |
| 19 | P2 | `routes/*`（多数在 router 内逐路由加 `authenticate`，app 层未统一） | 鉴权依赖“每个路由自己加”，新增路由易漏（目前核对无遗漏，但脆弱）。 | 在 `app.ts` 对 `/api` 挂**全局 `authenticate`**，再按路由加 `requirePermission`；避免漏鉴权。 |
| 20 | P2 | `middleware/auth.ts:386 requirePermission` / `:352 requireRole` / `:323 requireAdmin` | 这些守卫只检查 `req.user` 存在，**不验证 JWT 签名**；若某路由只用 `requirePermission` 而忘了 `authenticate`，当前因 `req.user` 为空而 401（安全），但属于隐式依赖、易在未来被破坏。 | `requirePermission/Role/Admin` 内部先 `authenticate` 或断言已认证，强制配对。 |
| 21 | P2 | `controllers/aiHistoryController.ts:11-13` | 重复定义 `AuthRequest` 接口，与 `middleware/auth.ts` 不一致风险。 | 统一从 `middleware/auth` 导出复用。 |
| 22 | P2 | `middleware/auth.ts:47` `UserRole` 含 `student` 与 `user` 两套近等价角色 | 角色语义重叠（`student` vs `user` 权限几乎一致），易引发授权混乱。 | 合并或明确区分语义，避免双角色并存。 |
| 23 | P2 | `tests/integration/` 仅 `moodCrud.integration.test.ts`（1 套 9 例） | 集成覆盖极薄：鉴权、权限、帖文、AI、案例等核心链路无集成验证。 | 补充 auth 登录/越权、post 审核流、AI 调用的集成测试（环境已有 MySQL，可直接补）。 |
| 24 | P2 | `jest.config.js` 覆盖率门槛 `functions 45% / lines 45%` | 门槛偏低，难以驱动覆盖核心路径。 | 逐步提高到函数≥70%/行≥70%，并对 `repositories/*` 补单测。 |
| 25 | P2 | `services/moodService.ts`、`repositories/moodRepository.ts`、`postRepository.ts`、`activityRepository.ts` 等无独立单测（仅靠集成/contract） | 核心数据访问层单测缺失，重构风险高。 | 用假 DB（如 `createMoodRepository(mockDb)` 模式，项目已有此 DI 模式）补单测。 |
| 26 | P2 | `app.ts:80-84` CORS 对无 origin 请求放行 + `credentials:true` | 非浏览器客户端可直接调用；生产若 origin 白名单配置不当有 CSRF/滥用面。 | 生产环境收紧 `allowedOrigins`，评估是否对带凭据请求也要求明确 origin。 |
| 27 | P2 | `routes/postRoutes.ts:99-124` 点赞/评论/生成 AI 回复仅 `authenticate`，无频率/防刷 | 可被脚本刷量（点赞、AI 回复生成有成本）。 | 对写操作挂轻量 per-user 限流。 |
| 28 | P2 | `utils/ai/contentAuditService.ts`、`controllers/counselingController.ts` 已有内容安全/危机检测 | （正向）AI 输出安全已接入，但需确认**所有面向用户的 AI 文本**都经过危机/违规检测后再返回。 | 在统一的 AI 响应出口统一做安全过滤，避免某些分支漏检。 |

---

## 八、优先级改进建议

### P0（本次未发现需立即停服的 P0；以下为上线前必须收敛的 P1）
- **#1 权限提升**：在 `managementController` 角色修改处加“仅 super_admin 可分配 super_admin、禁止自我提权、admin 目标角色限 user/admin”的硬约束，并补集成测试模拟 admin→super_admin 应 403。
- **#2 登录暴力破解在 Redis 不可用时的静默绕过**：把“登录失败锁定”与“认证异常”改为 fail-closed（Redis 不可用时拒绝登录或要求图形验证码），不要把安全控制与缓存降级混用。
- **#3 AI 限流**：在 `callChatCompletion` 与 AI 路由落地 per-user/IP 限流（Redis 计数器，带 TTL），否则限流配置形同文档。
- **#4 AI 内部 token 必填**：`validateEnv()` 增加 `AI_SERVICE_INTERNAL_TOKEN`（启用 AI 时）校验；缺失则 AI 能力不可用并明确报错。

### P1/P2（质量与健壮性债务，按优先级）
1. **分层修复**：把 `activityController` 的 DB 直查下沉到 repository；服务层经 repository 访问 DB（#8/#9）。
2. **类型纯净**：逐步消除 93 处 `any`，优先处理 AI 返回解析与 `errors.ts`/`redis.client.ts` 的公共类型（#10）。
3. **消除死代码**：删除 `config/sqlite.ts` 与空 feature-flag（#12/#18）；拆分 `aiModel.ts`（#13）。
4. **统一权限模型**：以 DB 为权威，代码 `rolePermissions` 仅作种子并加一致性测试，清理 `auth.register.role_assign` 等无用权限码（#14）。
5. **鉴权加固**：`/api` 全局 `authenticate` + 路由级 `requirePermission`（#19）；守卫内部强制认证（#20）；合并 `student/user` 双角色（#22）。
6. **Token 生命周期**：引入 jti + Redis 黑名单实现登出/改密吊销，缩短默认有效期或增加刷新令牌（#5）。
7. **错误处理**：`decrypt` 失败抛错而非返回密文（#6）；`achievementRepository` 不再静默吞错（#15）。
8. **隐私**：评估帖子/树洞公开可见性（#7）；统一 AI 出口做安全过滤（#28）。
9. **测试**：补集成测试（auth/越权/post 审核/AI）、提高覆盖率门槛、给核心 repository/service 补单测（#23/#24/#25）。
10. **工程**：补本地 `.gitignore`（`.env/dist/logs/coverage/node_modules`）；CORS 生产收紧（#26）。

---

### 附：实跑命令小结
- `npx tsc --noEmit` → **成功**，0 错误（strict 通过）。
- `npx jest tests/unit --runInBand` → **成功**，`55 suites / 245 tests` 全部通过。
- `npx jest --config jest.integration.config.js --runInBand` → **成功**，`1 suite / 9 tests` 全部通过（环境具备可用 MySQL；无 MySQL 时会因连接失败整体失败，属环境依赖非代码缺陷）。

> 报告基于真实文件读取（含 file:line 证据）与真实命令输出生成，未改动任何源码。
