# Plan P0 v1.0 — 基于代码审计的全链路开发计划

> 生成时间: 2026-07-17
> 基线提交: 533f8c1
> 审计方法: 对 8 个 P0 任务逐一检查前端页面→API→后端路由→服务→数据访问→数据库表→权限→测试的完整链路

---

## 1. 项目现状

| 维度 | 详情 |
|------|------|
| 技术栈 | 前端 Vue 3 + Vite + TypeScript + Pinia + Element Plus + ECharts；后端 Express + TypeScript |
| 前端目录 | `src/` (views, components, api, stores, router, utils) |
| 后端目录 | `mood_health_server/src/` (controllers, services, repositories, routes, middleware, utils, db) |
| 数据库 | MySQL，通过 mysql2 参数化查询，迁移文件在 `mood_health_server/src/db/migrations/` (0010-0250) |
| 鉴权机制 | JWT + HttpOnly Cookie，`authenticate` 中间件，`requirePermission` 权限中间件，基于角色的权限矩阵 |
| AI 服务 | DeepSeek API (Chat Completion)，`aiClient.ts` 封装调用，`aiCallService.ts` 含 Prompt 模板系统 |
| 测试框架 | 前端 Vitest (125 测试)，后端 Jest (175 测试)，共 300 测试全部通过 |
| 构建状态 | 前端 lint 通过，vue-tsc 通过，Vite 生产构建通过；后端 tsc 编译通过 |
| 当前主要风险 | ①AI 服务依赖 DeepSeek 余额，服务不可用时有 fallback 但非结构化 ②管理端分析功能完全缺失 ③AI 建议无持久化，刷新即丢失 |

---

## 2. P0 审计结论摘要

### 已完成并跳过 (0 项)

无。8 个 P0 在本轮审计中均未达到"已完成"标准（注：xlsx 中的 21 个基线任务 U-01~RL-01 已完成，但不属于本轮 8 个 P0 范围）。

### 部分完成 (3 项)

| 任务ID | 已完成部分 | 缺失部分 |
|--------|-----------|---------|
| P0-AI-01 | 前端 AI 对话页、后端 AI 调用、情绪记录表、测评结果表 | 后端上下文聚合、前端数据范围说明、AI 分析记录存储 |
| P0-AI-02 | 前端 AiSuggestCard 组件、后端基础情绪分析 | 四段式结构、非诊断免责声明、AI 实时生成替代硬编码、建议持久化 |
| P0-AI-04 | 前端紧急联系提示、后端敏感词检测、后端超时重试、日志安全 | 非诊断免责声明、输出安全校验、固定安全兜底、非法 JSON 兜底 |

### 未完成 (5 项)

| 任务ID | 说明 |
|--------|------|
| P0-AI-03 | 整条链路缺失：数据库表→后端接口→前端页面→测试 |
| P0-DA-01 | 整条链路缺失：KPI 聚合 SQL→后端接口→前端 KPI 仪表盘→测试 |
| P0-DA-02 | 整条链路缺失：情绪趋势聚合→分布接口→前端图表页→测试 |
| P0-DA-03 | 整条链路缺失：测评分布聚合→前端图表页→测试 |
| P0-DA-04 | 整条链路缺失：跨模块统计→前端对比图→测试 |

### 阻塞任务 (0 项)

无。

### 与既有基础功能重叠的任务

- xlsx 中 AI-01 (基础情绪分析) 和 AI-02 (基础辅助反馈) 已由现有代码实现，但不符合 P0 增强要求。本轮不做重复开发，在现有基础上增强。
- xlsx 中 EM-03 (情绪趋势) 是用户端个人趋势，P0-DA-02 是管理端全局聚合趋势，两者不重叠。

---

## 3. 范围说明

### 本轮必须完成

- P0-AI-01: 后端上下文聚合服务 + AI 分析记录存储
- P0-AI-02: 四段式结构化建议 + 非诊断免责声明
- P0-AI-03: AI 建议历史记录全链路
- P0-AI-04: 安全边界补齐（免责声明、安全兜底、输出校验）
- P0-DA-01: 管理驾驶舱 KPI 全链路
- P0-DA-02: 情绪趋势与分布图全链路
- P0-DA-03: 心理测评分布分析全链路
- P0-DA-04: 模块使用情况统计全链路

### 本轮不包含

- P1、P2 所有功能
- 旧计划中的 `P0-DEMO-*` 项（实际优先级为 P2）
- 前端 UI 美化/重构（非功能性问题）
- 性能优化（除非影响功能正确性）

### 因已有代码而跳过的内容

- 用户注册/登录/认证/权限体系
- 情绪记录/历史/趋势/摘要
- 心理测评量表/评分/反馈
- 树洞社区发布/检测/审核/展示
- 活动模块、放松疗愈模块
- AI 基础分析接口（`/api/ai/counseling`、`/api/ai/mood/analyze` 等已存在，直接复用）

### 因架构原因调整的内容

- P0-AI-02 中"收藏功能"和"完成反馈"拆为 P0 必须项之外的可延后项，因需要独立的收藏/反馈数据模型
- P0-AI-03 的删除策略复用项目现有软删除模式（如 users 表有 deleted_at 字段）

---

## 4. 任务拆解

### 4.1 数据库基础层 (Phase 0)

#### P0-DB-01 新建 AI 分析历史表

| 字段 | 值 |
|------|-----|
| 子任务ID | P0-DB-01 |
| 所属任务 | P0-AI-01, P0-AI-03 |
| 当前状态 | 未完成 |
| 当前代码证据 | 迁移文件最大编号 0250，无 ai_analysis_history 表 |
| 问题描述 | AI 分析结果无持久化，刷新即丢失；无法查询历史 |
| 修改范围 | 新建迁移文件 0260，新建 ai_analysis_history 表 |
| 前端任务 | 无（纯数据库层） |
| 后端任务 | 无（纯数据库层） |
| 数据库任务 | 新建 `ai_analysis_history` 表：id, user_id, mood_record_id, assessment_session_id, analysis_type, input_context, analysis_content, suggestion_content, risk_level, model_version, request_status, created_at。索引：idx_user_id_created_at (user_id, created_at) |
| 权限任务 | 无 |
| 异常处理 | 无 |
| 测试任务 | 迁移文件测试（migrationFiles.test.ts 更新） |
| 验收步骤 | `npm run db:migrate` 执行成功，表结构正确 |
| 完成定义 | 迁移文件存在，迁移执行成功，测试通过 |
| 依赖项 | 无 |
| 风险 | 无 |
| 预计修改文件 | `mood_health_server/src/db/migrations/0260_create_ai_analysis_history.up.sql`、`0260_create_ai_analysis_history.down.sql` |
| 实施顺序 | 1 |

---

### 4.2 AI 上下文聚合与结构化输出 (Phase 1)

#### P0-AI-01-BE-01 后端上下文聚合服务

| 字段 | 值 |
|------|-----|
| 子任务ID | P0-AI-01-BE-01 |
| 所属任务 | P0-AI-01 |
| 当前状态 | 未完成 |
| 当前代码证据 | `moodRepository.ts` 有 `findByUserId` 方法，`assessmentRepository.ts` 有 `findByUserId` 方法，但无聚合服务 |
| 问题描述 | AI 分析仅依赖当前输入文本，不聚合近期情绪记录和测评结果 |
| 修改范围 | 新建 `mood_health_server/src/services/aiContextService.ts`；修改 `aiRoutes.ts` 新增 `/ai/context/analyze` 路由 |
| 前端任务 | 无（后端先行） |
| 后端任务 | 新建 `aiContextService.ts`：聚合近 7 天 mood_records（情绪类型、强度、描述）+ 最近一次 assessment_session（量表名、总分、风险等级）→ 构建结构化上下文 Prompt |
| 数据库任务 | 无（复用现有表） |
| 权限任务 | authenticate 中间件，只查询当前用户数据 |
| 异常处理 | 无历史数据时返回空上下文+提示；查询超时 5s |
| 测试任务 | 单元测试：有历史数据、无历史数据、只有情绪记录无测评、只有测评无情绪记录 |
| 验收步骤 | 同一用户在不同历史数据下获得差异化分析；无历史数据时仍能返回；不同用户数据隔离 |
| 完成定义 | 服务可聚合上下文，测试通过 |
| 依赖项 | P0-DB-01 |
| 风险 | 查询性能：限制 7 天 50 条记录 |
| 预计修改文件 | `mood_health_server/src/services/aiContextService.ts`(新建)、`mood_health_server/src/utils/ai/moodAnalysisService.ts`(修改)、`mood_health_server/src/routes/aiRoutes.ts`(修改) |
| 实施顺序 | 2 |

#### P0-AI-02-BE-01 结构化四段式建议生成

| 字段 | 值 |
|------|-----|
| 子任务ID | P0-AI-02-BE-01 |
| 所属任务 | P0-AI-02 |
| 当前状态 | 部分完成 |
| 当前代码证据 | `moodAnalysisService.ts` 有 AI 分析，`aiCallService.ts` 有模板系统，但输出无结构化 JSON Schema |
| 问题描述 | AI 输出为自由文本，非四段式结构；recommendService.ts 使用硬编码 fallback |
| 修改范围 | 修改 `moodAnalysisService.ts` 输出为四段式 JSON；新建 Prompt 模板 |
| 前端任务 | 无（后端先行） |
| 后端任务 | ①定义四段式 JSON Schema：`{summary, possibleCauses, todayActions, whenToSeekHelp}` ②修改 `moodAnalysisService.ts` 构建四段式 Prompt ③新增 JSON 解析校验 ④AI 失败时返回固定安全兜底 `{ summary: "暂时无法生成分析", possibleCauses: "...", todayActions: [...], whenToSeekHelp: "..." }` |
| 数据库任务 | 无（分析结果存入 P0-DB-01 表） |
| 权限任务 | 无 |
| 异常处理 | JSON 解析失败→返回安全兜底；AI 超时→返回安全兜底；AI 返回空→返回安全兜底 |
| 测试任务 | 正常四段式输出、JSON 解析失败、AI 超时、AI 返回非 JSON、字段缺失 |
| 验收步骤 | 调用接口返回四段式 JSON；AI 异常时返回安全兜底；建议与当前用户情绪相关 |
| 完成定义 | 接口返回结构化四段式，测试通过 |
| 依赖项 | P0-AI-01-BE-01 |
| 风险 | JSON 解析稳定性：使用 try-catch + 安全兜底 |
| 预计修改文件 | `mood_health_server/src/utils/ai/moodAnalysisService.ts`(修改)、`mood_health_server/src/utils/ai/aiCallService.ts`(修改)、`mood_health_server/src/db/seeds/promptSeed.ts`(修改) |
| 实施顺序 | 3 |

#### P0-AI-01-FE-01 前端分析结果展示改造

| 字段 | 值 |
|------|-----|
| 子任务ID | P0-AI-01-FE-01 |
| 所属任务 | P0-AI-01, P0-AI-02 |
| 当前状态 | 部分完成 |
| 当前代码证据 | `Counseling.vue` 有 AI 对话；`AiSuggestCard.vue` 有建议卡片，但非四段式，无数据范围说明 |
| 问题描述 | 前端未展示数据范围，未展示四段式结构，无非诊断免责声明 |
| 修改范围 | 修改 `Counseling.vue` 和 `AiSuggestCard.vue` |
| 前端任务 | ①Counseling.vue 新增数据范围提示（"基于近 7 天 X 条情绪记录和最近测评结果"）②AiSuggestCard.vue 改造为四段式卡片（现状概括/可能原因/今日行动/何时求助）③新增非诊断免责声明组件 ④新增高风险视觉区分（红色边框） |
| 后端任务 | 无（使用已有接口） |
| 数据库任务 | 无 |
| 权限任务 | 无 |
| 异常处理 | 加载/空数据/失败/重试状态（已有，复用） |
| 测试任务 | 四段式渲染、免责声明存在、高风险样式、数据范围提示 |
| 验收步骤 | 页面展示四段式建议、免责声明可见、数据范围提示正确 |
| 完成定义 | 四段式渲染正确，测试通过 |
| 依赖项 | P0-AI-02-BE-01 |
| 风险 | 无 |
| 预计修改文件 | `src/views/counseling/Counseling.vue`(修改)、`src/components/mood/AiSuggestCard.vue`(修改)、`src/api/mood.ts`(修改类型) |
| 实施顺序 | 4 |

---

### 4.3 AI 历史记录 (Phase 2)

#### P0-AI-03-BE-01 后端 AI 历史接口

| 字段 | 值 |
|------|-----|
| 子任务ID | P0-AI-03-BE-01 |
| 所属任务 | P0-AI-03 |
| 当前状态 | 未完成 |
| 当前代码证据 | `aiModel.ts` 有类型定义但无对应表；无 AI 历史相关路由 |
| 问题描述 | AI 分析结果未保存，无历史列表/详情接口 |
| 修改范围 | 新建 `aiHistoryController.ts`、`aiHistoryRoutes.ts`；修改 `aiContextService.ts` 添加保存逻辑 |
| 前端任务 | 无（后端先行） |
| 后端任务 | ①新建 `POST /api/ai/history` 保存分析记录（在 AI 分析成功后调用）②新建 `GET /api/ai/history?page=1&pageSize=20` 当前用户历史列表（按 created_at DESC）③新建 `GET /api/ai/history/:id` 当前用户历史详情 ④所有权校验：只返回当前用户记录 |
| 数据库任务 | 无（复用 P0-DB-01 表） |
| 权限任务 | authenticate 中间件，`history/:id` 校验 user_id 所有权 |
| 异常处理 | 空列表返回空数组+200；不存在的记录返回 404；越权返回 404 |
| 测试任务 | 保存→列表查询→详情查询、空列表、越权访问、分页 |
| 验收步骤 | AI 生成后可在历史列表查看；详情与生成时一致；默认按时间倒序；修改 URL 参数不能访问他人记录 |
| 完成定义 | 保存/列表/详情接口正常，测试通过 |
| 依赖项 | P0-AI-01-BE-01, P0-DB-01 |
| 风险 | 无 |
| 预计修改文件 | `mood_health_server/src/controllers/aiHistoryController.ts`(新建)、`mood_health_server/src/routes/aiHistoryRoutes.ts`(新建)、`mood_health_server/src/app.ts`(注册路由)、`mood_health_server/src/services/aiContextService.ts`(添加保存) |
| 实施顺序 | 5 |

#### P0-AI-03-FE-01 前端 AI 历史页面

| 字段 | 值 |
|------|-----|
| 子任务ID | P0-AI-03-FE-01 |
| 所属任务 | P0-AI-03 |
| 当前状态 | 未完成 |
| 当前代码证据 | `AiSuggestCard.vue` 有组件级 history-panel，但数据来自 props 非 API |
| 问题描述 | 无独立 AI 历史页面、无分页、无详情页 |
| 修改范围 | 新建 `AiHistory.vue` 页面；修改路由；修改 `AiSuggestCard.vue` 接入真实 API |
| 前端任务 | ①新建 `src/views/counseling/AiHistory.vue`：历史列表+分页+空状态+加载+失败+重试 ②新建 `src/api/aiHistory.ts` API 封装 ③路由 `src/router/index.ts` 新增 `/ai-history` ④`AiSuggestCard.vue` 的 history-panel 改为调用真实 API |
| 后端任务 | 无（使用已有接口） |
| 数据库任务 | 无 |
| 权限任务 | 路由守卫检查登录状态 |
| 异常处理 | 加载/空数据/失败/重试/分页边界 |
| 测试任务 | 列表渲染、空列表、分页、加载失败重试、详情跳转 |
| 验收步骤 | 从 AI 分析结果页可跳转历史；历史列表按时间倒序；点击可查看详情 |
| 完成定义 | 页面正常渲染，测试通过 |
| 依赖项 | P0-AI-03-BE-01 |
| 风险 | 无 |
| 预计修改文件 | `src/views/counseling/AiHistory.vue`(新建)、`src/api/aiHistory.ts`(新建)、`src/router/index.ts`(修改)、`src/components/mood/AiSuggestCard.vue`(修改) |
| 实施顺序 | 6 |

---

### 4.4 AI 安全边界补齐 (Phase 3)

#### P0-AI-04-BE-01 输出安全校验与固定兜底

| 字段 | 值 |
|------|-----|
| 子任务ID | P0-AI-04-BE-01 |
| 所属任务 | P0-AI-04 |
| 当前状态 | 部分完成 |
| 当前代码证据 | `contentAuditService.ts` 有敏感词检测，`counselingService.ts` 有自杀关键词检测，`aiClient.ts` 有超时重试 |
| 问题描述 | 缺少输出安全校验、固定安全兜底、非法 JSON 兜底、高风险升级处理 |
| 修改范围 | 修改 `moodAnalysisService.ts`、`counselingService.ts`；新建 `aiSafetyService.ts` |
| 前端任务 | 无（后端先行） |
| 后端任务 | ①新建 `aiSafetyService.ts`：统一的安全兜底消息、输出字段校验 ②修改 `moodAnalysisService.ts`：调用安全服务校验输出，高风险内容追加升级提示 ③修改 `counselingService.ts`：统一安全兜底 ④统一错误码：AI 超时 1503、AI 空响应 1504、AI 格式错误 1505 |
| 数据库任务 | 无 |
| 权限任务 | 无 |
| 异常处理 | 10 种异常场景：普通输入、空输入、超长输入、高风险输入、AI 超时、AI 返回空、AI 返回非法 JSON、AI 返回不完整字段、未登录、越权 |
| 测试任务 | 10 种异常场景测试 |
| 验收步骤 | 高风险输入不返回普通建议；AI 超时返回安全兜底；非法 JSON 不导致崩溃 |
| 完成定义 | 安全兜底生效，测试通过 |
| 依赖项 | P0-AI-02-BE-01 |
| 风险 | 无 |
| 预计修改文件 | `mood_health_server/src/utils/ai/aiSafetyService.ts`(新建)、`mood_health_server/src/utils/ai/moodAnalysisService.ts`(修改)、`mood_health_server/src/utils/ai/counselingService.ts`(修改)、`mood_health_server/src/utils/apiResponse.ts`(新增错误码) |
| 实施顺序 | 7 |

#### P0-AI-04-FE-01 前端安全提示组件

| 字段 | 值 |
|------|-----|
| 子任务ID | P0-AI-04-FE-01 |
| 所属任务 | P0-AI-04 |
| 当前状态 | 部分完成 |
| 当前代码证据 | `Counseling.vue` 有紧急联系信息；`AiSuggestCard.vue` 无免责声明 |
| 问题描述 | 无非诊断免责声明，无高风险视觉区分 |
| 修改范围 | 新建 `AiDisclaimer.vue` 组件；修改 `AiSuggestCard.vue`、`Counseling.vue` |
| 前端任务 | ①新建 `AiDisclaimer.vue`：非诊断免责声明文本组件 ②修改 `AiSuggestCard.vue`：在结果区域底部插入免责声明 ③修改 `Counseling.vue`：高风险消息增加红色边框+警告图标 ④AI 失败/超时/格式错误提示优化 |
| 后端任务 | 无 |
| 数据库任务 | 无 |
| 权限任务 | 无 |
| 异常处理 | 无 |
| 测试任务 | 免责声明存在、高风险样式、错误提示 |
| 验收步骤 | 所有 AI 结果页面显示免责声明；高风险内容有明显视觉区分 |
| 完成定义 | 免责声明渲染正确，测试通过 |
| 依赖项 | P0-AI-01-FE-01 |
| 风险 | 无 |
| 预计修改文件 | `src/components/mood/AiDisclaimer.vue`(新建)、`src/components/mood/AiSuggestCard.vue`(修改)、`src/views/counseling/Counseling.vue`(修改) |
| 实施顺序 | 8 |

---

### 4.5 管理端数据分析 (Phase 4)

#### P0-DA-01-BE-01 管理驾驶舱 KPI 聚合接口

| 字段 | 值 |
|------|-----|
| 子任务ID | P0-DA-01-BE-01 |
| 所属任务 | P0-DA-01 |
| 当前状态 | 未完成 |
| 当前代码证据 | `managementController.ts` 只有列表查询，`managementRepository.ts` 无聚合查询 |
| 问题描述 | 无 KPI 聚合接口 |
| 修改范围 | 修改 `managementController.ts`、`managementService.ts`、`managementRepository.ts`、`managementRoutes.ts` |
| 前端任务 | 无（后端先行） |
| 后端任务 | 新建 `GET /api/admin/kpi?startDate=&endDate=` 聚合接口：返回 `{ totalUsers, newUsers, totalMoodRecords, moodRecordUsers, totalAssessments, assessmentUsers, totalPosts, pendingPosts, totalActivities, activityParticipants, totalAiCalls, aiUsers, totalRelaxSessions }`。每个指标支持时间范围筛选，空结果返回 0 |
| 数据库任务 | 无（使用现有表） |
| 权限任务 | `requirePermission('admin.access')` |
| 异常处理 | 时间参数校验；空结果返回 0；查询超时 5s |
| 测试任务 | 正常查询、时间范围筛选、空数据库、普通用户被拒 |
| 验收步骤 | 管理员可查询指定时间范围；KPI 与数据库统计一致；没有数据返回 0；普通用户被拒 |
| 完成定义 | 接口返回 KPI 数据，测试通过 |
| 依赖项 | 无 |
| 风险 | 查询性能：使用 COUNT 聚合，单次查询 < 2s |
| 预计修改文件 | `mood_health_server/src/controllers/managementController.ts`(修改)、`mood_health_server/src/services/managementService.ts`(修改)、`mood_health_server/src/repositories/managementRepository.ts`(修改)、`mood_health_server/src/routes/managementRoutes.ts`(修改) |
| 实施顺序 | 9 |

#### P0-DA-02-BE-01 情绪趋势与分布聚合接口

| 字段 | 值 |
|------|-----|
| 子任务ID | P0-DA-02-BE-01 |
| 所属任务 | P0-DA-02 |
| 当前状态 | 未完成 |
| 当前代码证据 | `managementController.ts` 无聚合接口 |
| 问题描述 | 无情绪趋势聚合、无情绪类型分布接口 |
| 修改范围 | 修改 `managementController.ts`、`managementService.ts`、`managementRepository.ts` |
| 前端任务 | 无（后端先行） |
| 后端任务 | 新建 `GET /api/admin/analytics/mood-trend?startDate=&endDate=&granularity=day|week` 返回按日/周的情绪记录数+平均强度；新建 `GET /api/admin/analytics/mood-distribution?startDate=&endDate=` 返回情绪类型分布 |
| 数据库任务 | 无 |
| 权限任务 | `requirePermission('admin.access')`，返回聚合数据不包含个人身份信息 |
| 异常处理 | 空日期补零；时间参数校验；空结果返回空数组 |
| 测试任务 | 日/周粒度、时间范围切换、空数据 |
| 验收步骤 | 图表与数据库聚合一致；日/周切换正确；空数据不报错；不暴露个人敏感数据 |
| 完成定义 | 接口返回聚合数据，测试通过 |
| 依赖项 | P0-DA-01-BE-01 |
| 风险 | 无 |
| 预计修改文件 | `mood_health_server/src/controllers/managementController.ts`(修改)、`mood_health_server/src/services/managementService.ts`(修改)、`mood_health_server/src/repositories/managementRepository.ts`(修改) |
| 实施顺序 | 10 |

#### P0-DA-03-BE-01 测评分布聚合接口

| 字段 | 值 |
|------|-----|
| 子任务ID | P0-DA-03-BE-01 |
| 所属任务 | P0-DA-03 |
| 当前状态 | 未完成 |
| 当前代码证据 | `managementController.ts` 有 `getAssessmentList` 列表查询，无聚合 |
| 问题描述 | 无得分区间分布、风险等级分布、各量表参与次数聚合 |
| 修改范围 | 修改 `managementController.ts`、`managementService.ts`、`managementRepository.ts` |
| 前端任务 | 无（后端先行） |
| 后端任务 | 新建 `GET /api/admin/analytics/assessment-distribution?startDate=&endDate=&instrumentId=` 返回 `{ instruments: [{id, name, count}], scoreRanges: [{range, count}], riskLevels: [{level, count}] }` |
| 数据库任务 | 无 |
| 权限任务 | `requirePermission('admin.access')`，不返回个人测评详情 |
| 异常处理 | 空结果返回空数组；量表筛选参数校验 |
| 测试任务 | 量表筛选、区间边界、空数据 |
| 验收步骤 | 分布总数与答卷数量可核对；筛选量表时结果正确；不显示个人测评详情 |
| 完成定义 | 接口返回聚合数据，测试通过 |
| 依赖项 | P0-DA-01-BE-01 |
| 风险 | 无 |
| 预计修改文件 | `mood_health_server/src/controllers/managementController.ts`(修改)、`mood_health_server/src/services/managementService.ts`(修改)、`mood_health_server/src/repositories/managementRepository.ts`(修改) |
| 实施顺序 | 11 |

#### P0-DA-04-BE-01 模块使用统计聚合接口

| 字段 | 值 |
|------|-----|
| 子任务ID | P0-DA-04-BE-01 |
| 所属任务 | P0-DA-04 |
| 当前状态 | 未完成 |
| 当前代码证据 | 无跨模块统计 |
| 问题描述 | 无跨模块使用统计 |
| 修改范围 | 修改 `managementController.ts`、`managementService.ts`、`managementRepository.ts` |
| 前端任务 | 无（后端先行） |
| 后端任务 | 新建 `GET /api/admin/analytics/module-usage?startDate=&endDate=` 返回 `{ modules: [{ name, metric, count, description }] }`，覆盖：情绪记录、心理测评、树洞社区、活动、放松疗愈、AI 分析 |
| 数据库任务 | 无 |
| 权限任务 | `requirePermission('admin.access')` |
| 异常处理 | 空结果返回 0；时间参数校验 |
| 测试任务 | 各模块统计、口径一致性、空数据 |
| 验收步骤 | 每个指标有明确口径；数据可从原始业务表复核；不同模块口径不混淆 |
| 完成定义 | 接口返回聚合数据，测试通过 |
| 依赖项 | P0-DA-01-BE-01, P0-DA-02-BE-01, P0-DA-03-BE-01 |
| 风险 | 无 |
| 预计修改文件 | `mood_health_server/src/controllers/managementController.ts`(修改)、`mood_health_server/src/services/managementService.ts`(修改)、`mood_health_server/src/repositories/managementRepository.ts`(修改) |
| 实施顺序 | 12 |

#### P0-DA-01-FE-01 管理驾驶舱前端页面

| 字段 | 值 |
|------|-----|
| 子任务ID | P0-DA-01-FE-01 |
| 所属任务 | P0-DA-01, P0-DA-02, P0-DA-03, P0-DA-04 |
| 当前状态 | 未完成 |
| 当前代码证据 | `AdminDashboard.vue` 仅是导航卡片页 |
| 问题描述 | 无 KPI 仪表盘、无图表页 |
| 修改范围 | 重写 `AdminDashboard.vue`；新建图表组件；新建 `src/api/adminAnalytics.ts` |
| 前端任务 | ①重写 `AdminDashboard.vue`：KPI 卡片行（12 个指标）+ 时间范围筛选 + 加载/空/错误状态 ②新建 `EmotionTrendChart.vue`：折线图（ECharts）+ 日/周切换 ③新建 `MoodDistributionChart.vue`：饼图/柱状图 ④新建 `AssessmentDistributionChart.vue`：分布图 ⑤新建 `ModuleUsageChart.vue`：横向柱状图对比 ⑥新建 `src/api/adminAnalytics.ts` API 封装 ⑦图表自适应、Tooltip、图例 |
| 后端任务 | 无（使用已有接口） |
| 数据库任务 | 无 |
| 权限任务 | 路由守卫+菜单权限，普通用户不可见 |
| 异常处理 | 加载/空数据/失败/重试 |
| 测试任务 | KPI 卡片渲染、时间范围切换、图表渲染、空数据状态、普通用户被拒 |
| 验收步骤 | 管理员可查看 KPI 和图表；切换时间范围有效；空数据不报错；普通用户不可访问 |
| 完成定义 | 页面正常渲染，测试通过 |
| 依赖项 | P0-DA-01-BE-01 至 P0-DA-04-BE-01 |
| 风险 | ECharts 打包体积大（已在 vendor 中异步加载） |
| 预计修改文件 | `src/views/admin/AdminDashboard.vue`(重写)、`src/api/adminAnalytics.ts`(新建)、`src/components/admin/EmotionTrendChart.vue`(新建)、`src/components/admin/MoodDistributionChart.vue`(新建)、`src/components/admin/AssessmentDistributionChart.vue`(新建)、`src/components/admin/ModuleUsageChart.vue`(新建) |
| 实施顺序 | 13 |

---

## 5. 数据库变更计划

### 复用的现有表

| 表名 | 用途 |
|------|------|
| `moods` | 情绪记录，AI 上下文聚合 |
| `mood_emotions` | 情绪类型关联 |
| `assessment_sessions` | 测评结果，AI 上下文聚合 |
| `assessment_instruments` | 量表名称 |
| `users` | 用户统计 |
| `posts` | 社区内容统计 |
| `activities` | 活动统计 |
| `relax_records` | 放松疗愈统计 |
| `prompt_templates` | AI Prompt 模板 |

### 新增表

**`ai_analysis_history`** — AI 分析与建议历史记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT AUTO_INCREMENT PRIMARY KEY | 主键 |
| user_id | INT NOT NULL | 用户ID |
| mood_record_id | INT NULL | 关联情绪记录ID |
| assessment_session_id | INT NULL | 关联测评会话ID |
| analysis_type | VARCHAR(50) NOT NULL | 分析类型: mood_analysis / suggestion / counseling |
| input_context | JSON NULL | 分析输入上下文 |
| analysis_content | JSON NOT NULL | 分析结果(四段式) |
| suggestion_content | JSON NULL | 建议内容 |
| risk_level | VARCHAR(20) DEFAULT 'low' | 风险等级: low/medium/high |
| model_version | VARCHAR(50) NULL | AI 模型版本 |
| request_status | VARCHAR(20) NOT NULL | 请求状态: success/error/timeout |
| error_message | TEXT NULL | 错误信息 |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | 创建时间 |

### 新增索引

```sql
INDEX idx_user_id_created_at (user_id, created_at DESC)
INDEX idx_analysis_type (analysis_type)
INDEX idx_risk_level (risk_level)
```

### 迁移文件

- `mood_health_server/src/db/migrations/0260_create_ai_analysis_history.up.sql`
- `mood_health_server/src/db/migrations/0260_create_ai_analysis_history.down.sql`

### 回滚方式

```sql
DROP TABLE IF EXISTS ai_analysis_history;
```

### 兼容旧数据方案

- 新表，无旧数据需要迁移
- 首个 AI 分析请求发生后数据开始写入
- 旧 AI 分析结果（无持久化）不做回溯

---

## 6. API 变更计划

### 新增 API

| 方法 | 路径 | 角色 | 请求参数 | 校验 | 返回结构 | 错误码 | 权限 | 分页 | 前端调用 | 测试 |
|------|------|------|---------|------|---------|------|------|------|---------|------|
| POST | /api/ai/context/analyze | 普通用户 | `{message, mood}` | body 校验 | `{code: 0, data: {analysis, suggestions, riskLevel, dataScope}}` | 1001/1002/1503/1504/1505 | authenticate | 无 | `src/api/ai.ts` | `aiContextService.test.ts` |
| POST | /api/ai/history | 普通用户 | `{analysis_type, input_context, analysis_content, suggestion_content, risk_level, mood_record_id}` | body 校验 | `{code: 0, data: {id}}` | 1001/1002 | authenticate | 无 | `src/api/aiHistory.ts` | `aiHistoryController.test.ts` |
| GET | /api/ai/history | 普通用户 | `?page=1&pageSize=20` | query 校验 | `{code: 0, data: {list, total, page, pageSize}}` | 1002 | authenticate | 是 | `src/api/aiHistory.ts` | `aiHistoryController.test.ts` |
| GET | /api/ai/history/:id | 普通用户 | 路径参数 id | 无 | `{code: 0, data: {id, analysis_content, ...}}` | 1002/404 | authenticate + 所有权 | 无 | `src/api/aiHistory.ts` | `aiHistoryController.test.ts` |
| GET | /api/admin/kpi | 管理员 | `?startDate=&endDate=` | query 日期格式 | `{code: 0, data: {totalUsers, newUsers, ...}}` | 1001/1002/1403 | admin.access | 无 | `src/api/adminAnalytics.ts` | `managementController.test.ts` |
| GET | /api/admin/analytics/mood-trend | 管理员 | `?startDate=&endDate=&granularity=day\|week` | query 校验 | `{code: 0, data: [{date, count, avgIntensity}]}` | 1001/1002/1403 | admin.access | 无 | `src/api/adminAnalytics.ts` | `managementController.test.ts` |
| GET | /api/admin/analytics/mood-distribution | 管理员 | `?startDate=&endDate=` | query 日期格式 | `{code: 0, data: [{type, count}]}` | 1001/1002/1403 | admin.access | 无 | `src/api/adminAnalytics.ts` | `managementController.test.ts` |
| GET | /api/admin/analytics/assessment-distribution | 管理员 | `?startDate=&endDate=&instrumentId=` | query 校验 | `{code: 0, data: {instruments, scoreRanges, riskLevels}}` | 1001/1002/1403 | admin.access | 无 | `src/api/adminAnalytics.ts` | `managementController.test.ts` |
| GET | /api/admin/analytics/module-usage | 管理员 | `?startDate=&endDate=` | query 日期格式 | `{code: 0, data: {modules: [{name, metric, count, description}]}}` | 1001/1002/1403 | admin.access | 无 | `src/api/adminAnalytics.ts` | `managementController.test.ts` |

### 修改 API

| 方法 | 路径 | 变更内容 |
|------|------|---------|
| POST | /api/ai/counseling | 响应增加 `riskLevel` 字段，高风险时追加升级提示 |
| POST | /api/ai/mood/analyze | 响应改为四段式结构化 JSON |

---

## 7. 前端页面和交互计划

### 路由

| 路径 | 页面 | 权限 |
|------|------|------|
| `/ai-history` | AiHistory.vue | 登录用户 |
| `/admin/dashboard` | AdminDashboard.vue (重写) | 管理员 |

### 页面

| 页面 | 说明 |
|------|------|
| `AiHistory.vue` | 新建，AI 建议历史列表，含分页、空状态、加载失败重试 |
| `AdminDashboard.vue` | 重写，KPI 卡片 + 4 个图表区域 |

### 组件

| 组件 | 说明 |
|------|------|
| `AiDisclaimer.vue` | 新建，非诊断免责声明 |
| `AiSuggestCard.vue` | 改造，四段式结构 + 免责声明 |
| `Counseling.vue` | 改造，数据范围提示 + 高风险视觉区分 |
| `EmotionTrendChart.vue` | 新建，情绪趋势折线图 |
| `MoodDistributionChart.vue` | 新建，情绪类型分布图 |
| `AssessmentDistributionChart.vue` | 新建，测评分布图 |
| `ModuleUsageChart.vue` | 新建，模块使用对比图 |

### 状态管理

- 复用现有 `userStore` 管理登录态
- 管理端数据通过组件内 `ref` 管理，不新增 store

### API 调用

- 新建 `src/api/aiHistory.ts`
- 新建 `src/api/adminAnalytics.ts`

### 交互状态

每个页面/组件必须覆盖：加载中 → 数据渲染 → 空数据 → 请求失败 → 重试

### 权限菜单

- 管理端菜单项 `admin.access` 权限控制
- AI 历史菜单项 `authenticated` 可见

### 图表

- 使用 ECharts（项目已有 `vendor-echarts` chunk）
- 响应式 `resize`，Tooltip 中文

---

## 8. 测试计划

### 新增后端测试

| 测试文件 | 覆盖场景 |
|---------|---------|
| `aiContextService.test.ts` | 有历史数据、无历史数据、只有情绪、只有测评、查询超时 |
| `aiHistoryController.test.ts` | 保存、列表、详情、空列表、越权、分页边界 |
| `aiSafetyService.test.ts` | 10 种异常场景 |
| `managementController.test.ts` (补充) | KPI 聚合、情绪趋势、测评分布、模块统计、时间范围、空数据、普通用户被拒 |

### 新增前端测试

| 测试文件 | 覆盖场景 |
|---------|---------|
| `ai-history-page.test.ts` | 列表渲染、空列表、分页、加载失败、详情跳转 |
| `ai-four-section-card.test.ts` | 四段式渲染、免责声明、高风险样式 |
| `admin-dashboard.test.ts` | KPI 卡片、图表渲染、时间范围切换、空数据、普通用户被拒 |

### 现有测试必须保持通过

- 前端 125 测试（不得减少）
- 后端 175 测试（不得减少）

---

## 9. 实施顺序

按依赖关系排序（非任务编号）：

```
Phase 0: 数据库基础
  1. P0-DB-01        新建 ai_analysis_history 表

Phase 1: AI 上下文聚合与结构化输出
  2. P0-AI-01-BE-01  后端上下文聚合服务
  3. P0-AI-02-BE-01  结构化四段式建议生成
  4. P0-AI-01-FE-01  前端分析结果展示改造

Phase 2: AI 历史记录
  5. P0-AI-03-BE-01  后端 AI 历史接口
  6. P0-AI-03-FE-01  前端 AI 历史页面

Phase 3: AI 安全边界
  7. P0-AI-04-BE-01  输出安全校验与固定兜底
  8. P0-AI-04-FE-01  前端安全提示组件

Phase 4: 管理端数据分析
  9. P0-DA-01-BE-01  管理驾驶舱 KPI 聚合接口
  10. P0-DA-02-BE-01 情绪趋势与分布聚合接口
  11. P0-DA-03-BE-01 测评分布聚合接口
  12. P0-DA-04-BE-01 模块使用统计聚合接口
  13. P0-DA-01-FE-01 管理驾驶舱前端页面

Phase 5: 验证
  14. 全量测试 + 构建 + 端到端验收
```

---

## 10. 完成状态表

| 任务ID | 当前状态 | 开发状态 | 测试状态 | 验收状态 | 代码证据 | 未完成原因 |
|--------|---------|---------|---------|---------|---------|-----------|
| P0-DB-01 | 未完成 | 待开发 | 待测试 | 待验收 | 无 | 新表未建 |
| P0-AI-01-BE-01 | 未完成 | 待开发 | 待测试 | 待验收 | `moodRepository.ts` 有基础查询 | 无聚合服务 |
| P0-AI-02-BE-01 | 部分完成 | 待开发 | 待测试 | 待验收 | `moodAnalysisService.ts` 有 AI 分析 | 输出非结构化四段式 |
| P0-AI-01-FE-01 | 部分完成 | 待开发 | 待测试 | 待验收 | `Counseling.vue`、`AiSuggestCard.vue` 存在 | 非四段式，无数据范围 |
| P0-AI-03-BE-01 | 未完成 | 待开发 | 待测试 | 待验收 | 无 | 无 AI 历史接口 |
| P0-AI-03-FE-01 | 未完成 | 待开发 | 待测试 | 待验收 | `AiSuggestCard.vue` 有组件级 history-panel | 非独立页面，无 API |
| P0-AI-04-BE-01 | 部分完成 | 待开发 | 待测试 | 待验收 | `contentAuditService.ts` 有敏感词检测 | 无安全兜底，无输出校验 |
| P0-AI-04-FE-01 | 部分完成 | 待开发 | 待测试 | 待验收 | `Counseling.vue` 有紧急联系 | 无免责声明，无高风险视觉 |
| P0-DA-01-BE-01 | 未完成 | 待开发 | 待测试 | 待验收 | `managementController.ts` 有列表查询 | 无 KPI 聚合 |
| P0-DA-02-BE-01 | 未完成 | 待开发 | 待测试 | 待验收 | 无 | 无情绪趋势聚合 |
| P0-DA-03-BE-01 | 未完成 | 待开发 | 待测试 | 待验收 | 无 | 无测评分布聚合 |
| P0-DA-04-BE-01 | 未完成 | 待开发 | 待测试 | 待验收 | 无 | 无跨模块统计 |
| P0-DA-01-FE-01 | 未完成 | 待开发 | 待测试 | 待验收 | `AdminDashboard.vue` 是导航卡片 | 无 KPI 仪表盘图表 |