# 可测试性评估报告 - ccooddee 项目

> **生成日期**：2026-07-18
> **评估类型**：可测试性静态评估
> **评估范围**：全栈代码（Vue 3 + TypeScript 前端，Express.js + TypeScript 后端，MySQL + Redis 数据层）
> **评估方法**：纯静态代码分析，基于六大维度逐项评估

---

## 目录

- [1. 项目技术栈与架构简述](#1-项目技术栈与架构简述)
- [2. 评估维度明细](#2-评估维度明细)
  - [2.1 耦合度](#21-耦合度)
  - [2.2 依赖注入（DI）情况](#22-依赖注入di情况)
  - [2.3 边界与异常处理](#23-边界与异常处理)
  - [2.4 代码可观察性](#24-代码可观察性)
  - [2.5 测试钩子与设计](#25-测试钩子与设计)
  - [2.6 状态管理复杂度](#26-状态管理复杂度)
- [3. 关键代码问题清单](#3-关键代码问题清单)
  - [3.1 后端问题清单](#31-后端问题清单)
  - [3.2 前端问题清单](#32-前端问题清单)
- [4. 整体评价与建议方向](#4-整体评价与建议方向)

---

## 1. 项目技术栈与架构简述

| 层级 | 技术栈 | 架构模式 |
|------|--------|----------|
| **前端** | Vue 3 + TypeScript + Pinia + Element Plus + Axios | 组合式 API、Store 模式、Composable 模式 |
| **后端** | Express.js + TypeScript | Controller → Service → Repository 三层分层 |
| **数据库** | MySQL (mysql2 promise 连接池) | Repository 模式、参数化查询 |
| **缓存** | Redis (ioredis) | 单例客户端、getOrSet 模式 |
| **日志** | Winston + morgan | 结构化 JSON 日志 |
| **认证** | JWT + bcryptjs + HttpOnly Cookie | 中间件管道 |

**后端中间件管道**：`helmet → cors → requestLogger → rateLimiter → cookieParser → csrfMiddleware → jsonParser → routes → authenticate → requireRole → requirePermission → controllers`

**后端依赖创建模式**：工厂函数 `createXxx()` 在模块顶层调用，创建单例实例。控制器直接引用这些模块级单例。

**前端依赖模式**：Pinia stores 和 composables 直接 import API 函数；`request.ts` 导出单例 axios 实例。

---

## 2. 评估维度明细

### 2.1 耦合度

**评分**：⚠️ 一般（后端）/ ⚠️ 一般（前端）

**现状**：

**后端** — 采用 Controller → Service → Repository 三层架构，层次分离清晰。但存在以下耦合问题：

- **模块级单例硬绑定**：所有控制器（18 处）在模块顶层通过 `const xxxService = createXxxService()` 直接创建并引用服务实例。例如 `moodController.ts:8` 的 `const moodService = createMoodService()`。这使得控制器与服务之间形成编译时硬绑定，单元测试时无法替换为 mock 实现（除非使用 jest.mock 等模块级 mock 工具）。
- **跨层直接依赖**：`activityController.ts` 既使用 `activityRepo`（Repository 层），又直接使用 `getMysqlPool()` 和 `setCache`/`getCache`（底层工具），打破了分层隔离。
- **中间件与数据库耦合**：`auth.ts` 中间件通过 `getAccessRepository()` 和 `getAuditRepository()` 直接访问数据库，导致认证中间件测试需要数据库环境。

**前端** — 组件、Store、API 三层耦合紧密：

- **组件直接依赖 Store 和 API**：`MoodRecord.vue`、`TreeHole.vue` 等视图组件直接 import 并使用 Pinia store 和 API 函数，无法在组件测试中替换。
- **axios 实例与 UI 库耦合**：`request.ts` 的拦截器直接调用 `ElLoading.service()`、`ElMessage.error()` 和 `router.push()`，将网络层与 UI 层紧密绑定。
- **document.cookie 直接访问**：`request.ts:14` 的 `getCookie` 函数直接操作 `document.cookie`，测试时依赖浏览器环境。

**测试影响**：后端控制器和服务测试需要完整的模块 mock 机制（jest.mock）；前端组件测试需要 mock Pinia、axios、Element Plus 和 Vue Router。

---

### 2.2 依赖注入（DI）情况

**评分**：❌ 差（后端，部分有 DI 接口但未使用）/ ❌ 差（前端，完全无 DI）

**现状**：

**后端 — 有 DI 设计但未落地**：

| 文件 | DI 接口定义 | 实际使用 |
|------|------------|----------|
| `authService.ts:17-24` | `AuthServiceDependencies` 接口（repository、hashPassword、comparePassword、signJwt、jwtSecret、now、randomSuffix） | ✅ 工厂函数 `createAuthService(dependencies)` 支持注入，但控制器调用时未传参：`createAuthService()` |
| `moodService.ts:32-37` | `MoodServiceDependencies` 接口（repository、encryptField、decryptField、now） | ❌ 工厂函数 `createMoodService` 未暴露此接口，无法注入 |
| `app.ts:55-57` | `AppDependencies` 接口（health） | ✅ 仅 `createHealthHandler` 正确使用了 DI 模式 |
| `healthController.ts:6-9` | `HealthDependencies` 接口（checkMysql、checkRedis、timeoutMs） | ✅ 唯一完整实现 DI 的控制器 |

**DI 缺失的具体位置**（18 处模块级单例）：

- `moodController.ts:8-9` — `createMoodService()` / `createMoodAlertService()`
- `authController.ts:8` — `createAuthService()`
- `activityController.ts:13-14` — `createActivityRepository()` / `createActivityFeedbackService()`
- `postController.ts:10-11` — `createPostRepository()` / `createAuditService()`
- `courseController.ts:5` — `createCourseRepository()`
- `musicController.ts:5` — `createMusicRepository()`
- `relaxController.ts:7` — `createRelaxRepository()`
- `achievementController.ts:6` — `createAchievementRepository()`
- `auditController.ts:6` — `createAuditService()`
- `caseController.ts:7` — `createCaseService()`
- `aiHistoryController.ts:15` — `createAiHistoryRepository()`
- `feedbackController.ts:6` — `createFeedbackService()`
- `managementController.ts:9-10` — `createManagementService()` / `createAssessmentService()`
- `questionnaireController.ts:8` — `createAssessmentService()`

**Service 层内部也缺少 DI**：

- `moodAlertService.ts:38` — 直接调用 `getMysqlPool()`，无连接注入
- `aiContextService.ts:33-34` — 模块级调用 `createMoodRepository()` / `createAssessmentRepository()`

**前端 — 完全无 DI**：

- `userStore.ts:3` — 直接 `import request from '@/utils/request'`
- `moodStore.ts:3` — 直接 `import { submitMoodRecord, ... } from '@/api/mood'`
- `relaxStore.ts:3` — 直接 `import relaxAPI from '@/api/relax'`
- 所有 composables 直接 import API 函数

**测试影响**：后端测试需要 jest.mock 对每个模块级依赖进行全局 mock；前端测试无法替换 API 调用、router 或 UI 库。

---

### 2.3 边界与异常处理

**评分**：✅ 良好（后端）/ ✅ 良好（前端）

**现状**：

**后端 — 边界处理较好**：

- `authService.ts` 的 `register` 函数对 `input.role`、`input.isAdmin` 做了显式拒绝
- `moodService.ts` 的 `normalizeEmotions` 函数对 emotionTypeId、intensity 做了完整校验
- `contentFilter.ts` 有 `MAX_CONTENT_LENGTH = 10000` 的 DoS 防护
- `activityController.ts` 对 page/limit 参数做了范围限制
- `moodController.ts` 有 `guardUserId` 函数做统一的用户认证检查

**存在的边界缺失**：

| 位置 | 问题 | 影响 |
|------|------|------|
| `postController.ts:19` | `req.user!.userId` 使用非空断言，未 guard | 若中间件未正确设置 user，导致运行时崩溃 |
| `moodAlertService.ts` | 查询结果未做空值检查，直接访问 `rows[0]` | 空结果可能导致 undefined 传播 |
| `moodController.ts` 的 `recordMood` | 旧版路径使用 `moodTypeNames.map(...)` 无长度校验 | 超长数组可能导致性能问题 |

**前端 — 边界处理较好**：

- `request.ts` 的 `unwrapResponse` 函数对 API 响应做了完整校验
- `userStore.ts` 有 `getErrorMessage` 统一错误提取
- `request.ts` 对所有 HTTP 状态码（401/403/404/500/502/503）做了分类处理

**测试影响**：后端大部分边界已覆盖，遗漏的边界点（如 `req.user!`）难以通过单元测试发现，因为这是运行时中间件协调问题。

---

### 2.4 代码可观察性

**评分**：✅ 良好（后端）/ ⚠️ 一般（前端）

**现状**：

**后端 — 日志覆盖较好**：

- Winston + DailyRotateFile 提供结构化日志（14 天保留、20MB 切割）
- morgan 中间件提供 HTTP 请求级别结构化日志（JSON 格式）
- 认证/权限中间件有详细的 `logger.warn` 记录（`auth.ts:290`、`auth.ts:305`）
- 缓存操作有 `logger.warn` 错误记录（`cache.ts`）

**仍使用 console 的位置**：

| 位置 | 代码 | 建议 |
|------|------|------|
| `moodController.ts:282,298,310,332,350,364,404,422` | `console.error(error)` | 应替换为 `logger.error` |
| `postController.ts` 多处 | `console.error` | 应替换为 `logger.error` |
| `cache.ts:48` | `console.log` | 应替换为 `logger.info` |
| `moodAlertService.ts` | 无日志记录 | 应添加关键操作日志 |
| `authService.ts:95` | `console.error` | 应替换为 `logger.error` |

**前端 — 日志不足**：

- 仅在 `request.ts:189` 有 `console.error('API Error:', error)`
- 无结构化日志，无法追踪前端错误
- 无用户行为埋点或性能监控

**测试影响**：console 日志在测试中会污染输出，且无法通过日志级别控制；结构化日志（Winston）可以在测试中捕获并断言。

---

### 2.5 测试钩子与设计

**评分**：✅ 良好（后端，有较多纯函数）/ ⚠️ 一般（前端）

**现状**：

**后端 — 纯函数与可测试单元**：

| 类型 | 文件 | 函数 | 可测试性 |
|------|------|------|---------|
| 纯函数 | `moodService.ts` | `normalizeEmotions`、`toDateString`、`resolveTrendStartDate`、`buildTrendSummary`、`roundOneDecimal`、`roundTwoDecimals` | ✅ 无副作用，纯输入输出 |
| 纯函数 | `authService.ts` | `buildDefaultEmail`、`toPublicUser` | ✅ 无副作用 |
| 纯函数 | `contentFilter.ts` | `filterContent`、`shouldAutoReject`、`shouldMarkForReview` | ✅ 纯函数 |
| 纯函数 | `encryption.ts` | `encrypt`、`decrypt`、`encryptField`、`decryptField` | ⚠️ 依赖 `getKey()` → `process.env` |
| 纯函数 | `app.ts` | `validateEnv`、`createApp` | ✅ 可接受 deps 注入 |
| 工厂函数 | `healthController.ts` | `createHealthHandler` | ✅ 完美的 DI 设计 |
| 工厂函数 | `authService.ts` | `createAuthService` | ✅ 有 DI 接口 |
| 工厂函数 | 所有 Repository | `createXxxRepository` | ⚠️ 可接受 db 参数，但控制器不传 |

**副作用直接内联的位置**：

| 位置 | 副作用类型 | 可测试性 |
|------|-----------|---------|
| `moodController.ts` 所有 handler | 直接调用 `moodService.xxx()` 和 `clearMoodCache()` | ❌ 无法隔离测试 |
| `activityController.ts:427-470` | 直接调用 `pool.query()` 和 `setCache()` | ❌ 绕过 Service 层 |
| `postController.ts` | 直接调用 `contentAuditService` | ❌ AI 调用内联在控制器中 |
| `auth.ts` 中间件 | 直接调用 `getAccessRepository()`、`getAuditRepository()` | ❌ 中间件测试需要数据库 |

**前端 — 纯函数较少**：

| 类型 | 文件 | 函数 | 可测试性 |
|------|------|------|---------|
| 纯函数 | `contentFilter.ts`（如存在） | 内容过滤 | ✅ 可测试 |
| 工具类 | `storageUtil.ts` | StorageUtil 类 | ⚠️ 依赖 localStorage |

**副作用内联**：

- 所有 composables 直接调用 API 函数（`usePosts.ts`、`useComments.ts`）
- 所有 Pinia stores 直接调用 API 函数（`userStore.ts`、`moodStore.ts`、`relaxStore.ts`）
- 视图组件直接调用 store actions 和 API

**测试影响**：后端纯函数层较丰富，可以独立进行单元测试；但控制器和中间件层由于副作用内联，需要集成测试环境。前端几乎无可独立测试的纯逻辑单元。

---

### 2.6 状态管理复杂度

**评分**：⚠️ 一般（后端）/ ✅ 良好（前端）

**现状**：

**后端 — 模块级可变全局状态**：

| 位置 | 变量 | 类型 | 风险 |
|------|------|------|------|
| `mysql.ts:67-68` | `pool`、`poolConfig` | 模块级可变 | 测试间共享连接池，需 `closeMysqlPool()` 重置 |
| `redis.client.ts:7-12` | `isConnected`、`reconnectAttempts`、`lastError` | 实例可变状态 | RedisClient 单例，测试间状态污染 |
| `cache.ts:4` | `activityCacheKeys` | 模块级 Set | 测试间缓存 key 累积 |
| `moodService.ts:6` | `emotionTypesCache` | 模块级可变 | 测试间缓存共享 |
| `auth.ts:53-54` | `accessRepository`、`auditRepository` | 模块级可变 | 中间件测试间共享 |

**前端 — Pinia 状态管理较好**：

| 位置 | 变量 | 类型 | 风险 |
|------|------|------|------|
| `request.ts:43-47` | `loadingCount`、`loadingInstance`、`unauthorizedRedirectPending` | 模块级可变 | 测试间状态污染，需要重置 |
| Pinia stores | Store 实例 | 按需创建 | ✅ `defineStore` 支持 `$reset()` |

**测试影响**：后端模块级全局状态导致测试用例间需要手动清理（`closeMysqlPool()`、`activityCacheKeys.clear()`），否则测试间互相干扰。前端 `request.ts` 的模块级状态同样需要测试间重置。

---

## 3. 关键代码问题清单

### 3.1 后端问题清单

| 编号 | 优先级 | 位置 | 问题描述 | 对测试的影响 |
|------|--------|------|---------|-------------|
| TST-001 | **P0** | `moodController.ts:8-9` 等 18 处控制器 | 模块级单例创建服务/仓库，无法注入 mock | 控制器单元测试必须使用 jest.mock 全局替换，增加测试复杂度和维护成本 |
| TST-002 | **P0** | `auth.ts:53-64` | 中间件通过 `getAccessRepository()` / `getAuditRepository()` 直接访问数据库 | 认证/权限中间件测试需要完整数据库环境，无法独立单元测试 |
| TST-003 | **P0** | `moodService.ts` 的 `createMoodService` | 定义了 `MoodServiceDependencies` 接口但工厂函数未暴露，无法注入 | 服务层测试无法替换 repository 和加密函数 |
| TST-004 | **P1** | `moodAlertService.ts:38` | 直接调用 `getMysqlPool()` 无连接注入 | 告警服务测试需要完整 MySQL 连接 |
| TST-005 | **P1** | `aiContextService.ts:33-34` | 模块级调用 `createMoodRepository()` / `createAssessmentRepository()` | AI 上下文服务测试需要 mock 两个仓库 |
| TST-006 | **P1** | `activityController.ts:427-470` | 控制器直接调用 `pool.query()` 和 `setCache()`，绕过 Service 层 | 控制器测试需要 mock 数据库和缓存 |
| TST-007 | **P1** | `postController.ts` | 直接调用 `contentAuditService`（AI 审核） | AI 审核调用内联在控制器中，无法单独测试控制器逻辑 |
| TST-008 | **P1** | `encryption.ts:8-20` | `getKey()` 直接依赖 `process.env.ENCRYPTION_KEY` | 加密函数测试需要设置环境变量，无法通过参数注入 key |
| TST-009 | **P2** | `moodController.ts` 多处 | `console.error(error)` 而非 `logger.error` | 测试中无法通过日志级别过滤，污染输出 |
| TST-010 | **P2** | `mysql.ts:67-68` | 模块级可变 `pool` 和 `poolConfig` | 测试间需要手动调用 `closeMysqlPool()` 清理状态 |
| TST-011 | **P2** | `redis.client.ts:7-12` | RedisClient 单例的可变状态 `isConnected` 等 | 测试间 Redis 状态可能互相污染 |

### 3.2 前端问题清单

| 编号 | 优先级 | 位置 | 问题描述 | 对测试的影响 |
|------|--------|------|---------|-------------|
| TST-012 | **P0** | `request.ts:123-129` | axios 实例导出为单例，拦截器直接绑定 UI 库（ElLoading、ElMessage、router） | 无法在测试中替换 axios 实例；测试需要 mock Element Plus 和 Vue Router |
| TST-013 | **P0** | 所有 Pinia stores | Store 直接 import `request` 或 API 函数，无 DI | Store 测试必须 mock 整个请求层 |
| TST-014 | **P1** | 所有 composables | `usePosts.ts`、`useComments.ts` 直接 import API 函数 | Composable 测试需要 mock API 模块 |
| TST-015 | **P1** | `request.ts:43-47` | 模块级可变状态 `loadingCount`、`loadingInstance`、`unauthorizedRedirectPending` | 测试间状态污染，需要手动重置 |
| TST-016 | **P1** | `request.ts:14` | `getCookie` 函数直接操作 `document.cookie` | 测试需要 jsdom 环境或 mock document |
| TST-017 | **P2** | 所有视图组件 | 组件直接 import 并使用 store 和 API | 组件测试需要提供完整的 store 和 API mock |
| TST-018 | **P2** | `storageUtil.ts` | 直接操作 `localStorage` | 测试需要 mock localStorage |

---

## 4. 整体评价与建议方向

### 整体可测试性评分：⚠️ 一般

**评分依据**：

| 维度 | 后端评分 | 前端评分 | 说明 |
|------|---------|---------|------|
| 耦合度 | ⚠️ 一般 | ⚠️ 一般 | 三层架构清晰但模块级单例绑定过紧 |
| 依赖注入 | ❌ 差 | ❌ 差 | 后端有 DI 接口设计但未使用；前端完全无 DI |
| 边界与异常处理 | ✅ 良好 | ✅ 良好 | 大部分边界已覆盖，遗漏较少 |
| 可观察性 | ✅ 良好 | ⚠️ 一般 | 后端日志完善，但仍有 console 残留；前端缺少结构化日志 |
| 测试钩子 | ✅ 良好 | ⚠️ 一般 | 后端有较多纯函数，前端纯逻辑较少 |
| 状态管理 | ⚠️ 一般 | ✅ 良好 | 后端模块级全局状态较多；前端 Pinia 管理较好 |

### 主要障碍总结

1. **最大障碍 — 模块级单例**：后端 18 处控制器使用模块级单例，前端 axios 实例为全局单例。这导致所有测试都需要 jest.mock 或 vi.mock 进行模块级替换，增加测试编写和维护成本。

2. **第二障碍 — DI 未落地**：后端 `authService`、`moodService` 等已定义 DI 接口，但控制器调用时未传入依赖，导致 DI 设计形同虚设。`healthController` 是唯一正确实现 DI 的控制器。

3. **第三障碍 — 副作用内联**：控制器直接调用数据库、缓存和 AI 服务，中间件直接访问数据库，前端组件直接调用 API。无法在单元测试中隔离。

### 建议优化方向（仅方向，不实现）

1. **控制器层 DI 改造**：将控制器改为工厂函数模式（参考 `createHealthHandler`），接收依赖作为参数。例如 `createMoodController({ moodService, moodAlertService })`。

2. **中间件依赖注入**：`auth.ts` 的 `authenticate`、`requirePermission` 等中间件应接收 `AccessRepository`、`AuditRepository` 作为参数，而非内部通过 `getAccessRepository()` 获取。

3. **消除模块级全局状态**：将 `mysql.ts` 的 pool、`cache.ts` 的 `activityCacheKeys`、`moodService.ts` 的 `emotionTypesCache` 封装到可注入的类或工厂函数中。

4. **前端 axios 实例可注入**：将 `request.ts` 的 axios 实例创建封装为工厂函数，允许测试中替换。

5. **前端 API 层抽象**：Stores 和 composables 通过接口/参数接收 API 函数，而非直接 import。

6. **console 替换为 logger**：将所有 `console.error`/`console.log` 替换为 `logger.error`/`logger.info`，便于测试中捕获和过滤。

---

## 总结

本报告基于六大维度对 ccooddee 项目进行了可测试性静态评估。项目在**代码分层架构、边界处理、日志可观察性**方面表现良好，后端纯函数层丰富。

**核心问题**是依赖注入设计未落地：虽然后端部分服务定义了 DI 接口，但控制器层和前端完全不使用 DI，导致模块间形成编译时硬绑定。这使得单元测试需要大量模块级 mock，集成测试需要完整的环境搭建。

**预期收益**：若能完成控制器层 DI 改造，后端控制器单元测试的 mock 代码量可减少 60% 以上，测试用例编写效率提升 2-3 倍。