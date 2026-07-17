# Plan P1 v1.0 — 基于 xlsx 的 P1 全链路开发计划

> 生成时间: 2026-07-17
> 基线提交: 50d0cb9
> 需求来源: 江宇芳开发任务1.0.xlsx「待完成视图」P1 任务
> 审计方法: 对 8 个 P1 任务逐一检查前端页面→API→后端路由→服务→数据访问→数据库表→权限→测试的完整链路

---

## 1. 项目现状

| 维度 | 详情 |
|------|------|
| 技术栈 | 前端 Vue 3 + Vite + TypeScript + Pinia + Element Plus + ECharts；后端 Express + TypeScript |
| 前端目录 | `src/` (views, components, api, stores, router, utils) |
| 后端目录 | `mood_health_server/src/` (controllers, services, repositories, routes, middleware, utils, db) |
| 数据库 | MySQL，迁移文件最大编号 0260 |
| 鉴权机制 | JWT + HttpOnly Cookie，`authenticate` 中间件，`requirePermission` 权限中间件 |
| AI 服务 | DeepSeek API，`aiClient.ts` + `aiCallService.ts` |
| 测试框架 | 前端 Vitest (125 测试)，后端 Jest (215 测试)，共 340 测试全部通过 |
| 构建状态 | 前端 vue-tsc + vite build 通过；后端 tsc 编译通过 |
| 当前主要风险 | ①推荐系统使用硬编码 fallback 未查真实数据库 ②内容审核无分级标记和优先队列 ③无建议反馈机制 |

---

## 2. P1 审计结论摘要

### 已完成并跳过 (0 项)

无。8 个 P1 均未达到"已完成"标准。

### 部分完成 (3 项)

| 任务ID | 已完成部分 | 缺失部分 |
|--------|-----------|---------|
| P1-EM-01 | 管理端 mood-trend 聚合接口（日/周粒度）、前端管理驾驶舱趋势图 | 用户端本周/上周、本月/上月同比环比对比；周期切换 UI；变化说明 |
| P1-REC-01 | `recommendService.ts` 有基础情绪推荐 + 硬编码 fallback | 基于用户历史数据（常见情绪、调节方式、测评结果）的个性化推荐；推荐理由可解释 |
| P1-SAFE-01 | `contentAuditService.ts` 有敏感词检测 + `aiSafetyService.ts` 有高风险检测 | 分级标记（低/中/高）、发布前拦截提示、风险状态展示 |

### 未完成 (5 项)

| 任务ID | 说明 |
|--------|------|
| P1-EM-02 | 整条链路缺失：异常波动检测规则→通知生成→前端提醒卡片→查看详情→关闭提示 |
| P1-REC-02 | 硬编码 fallback 推荐未关联真实数据库内容（音乐/活动/课程/放松） |
| P1-REC-03 | 整条链路缺失：反馈表→反馈接口→前端反馈按钮→管理员汇总统计 |
| P1-SAFE-02 | 整条链路缺失：高风险内容求助提示→管理员优先审核队列→高风险标识 |
| P1-SAFE-03 | 审核操作日志表不存在，post 审核流程未记录操作日志 |

### 阻塞任务 (0 项)

无。

---

## 3. 范围说明

### 本轮必须完成

- P1-EM-01: 用户端周/月趋势对比（同比/环比）
- P1-EM-02: 异常波动检测与摘要提醒
- P1-REC-01: 基于历史偏好的个性化推荐
- P1-REC-02: 活动与放松内容联动推荐
- P1-REC-03: 建议效果反馈
- P1-SAFE-01: 敏感与高风险内容分级识别
- P1-SAFE-02: 风险提示与人工复核
- P1-SAFE-03: 审核操作日志

### 本轮不包含

- P2 所有功能
- 前端 UI 美化/重构（非功能性问题）
- 性能优化（除非影响功能正确性）

### 因已有代码而跳过的内容

- 用户注册/登录/认证/权限体系
- 情绪记录/历史/趋势/摘要基础功能
- 心理测评量表/评分/反馈
- 树洞社区发布/检测/展示基础功能
- 活动模块、放松疗愈模块基础 CRUD
- 管理端 KPI 聚合/情绪趋势/分布等已在 P0 完成

---

## 4. 任务拆解

### 4.1 情绪分析增强 (Phase 1)

#### P1-EM-01 用户端周/月趋势对比

| 字段 | 值 |
|------|-----|
| 子任务ID | P1-EM-01 |
| 所属模块 | 情绪分析能力增强 |
| 当前状态 | 部分完成 |
| 当前代码证据 | 管理端 `managementRepository.ts` 有 `getMoodTrend` 聚合；前端 `AdminDashboard.vue` 有趋势图；用户端 `moodRecordStore.ts` 有基础数据 |
| 问题描述 | 用户端无本周/上周、本月/上月对比视图 |
| 修改范围 | 后端新增对比聚合接口；前端新增周期对比组件 |
| 前端任务 | ①新建 `MoodComparison.vue` 组件：本周vs上周/本月vs上月切换 + 对比柱状图 + 变化说明文字 ②新建 `src/api/moodComparison.ts` API 封装 ③在 `MoodRecord.vue` 或 `MoodArchive.vue` 中集成 |
| 后端任务 | ①`moodRepository.ts` 新增 `getPeriodComparison(userId, period)` 方法：查询本周/上周、本月/上月情绪频次和平均强度 ②`moodService.ts` 新增强对比逻辑（同比/环比计算）③`moodController.ts` 新增 `GET /api/moods/comparison?period=week|month` ④路由注册 |
| 数据库任务 | 无（复用 moods 表） |
| 权限任务 | authenticate 中间件，只查询当前用户数据 |
| 异常处理 | 无上周/上月数据时显示"暂无对比数据"；空数据不报错 |
| 测试任务 | 周对比、月对比、无历史数据、边界值 |
| 验收步骤 | 切换本周/上周可看到频次和强度对比；变化值可与原始记录核对 |
| 完成定义 | 接口返回对比数据，前端渲染对比图，测试通过 |
| 依赖项 | 无 |
| 风险 | 无 |
| 预计修改文件 | `moodRepository.ts`(修改)、`moodService.ts`(修改)、`moodController.ts`(修改)、`moodRoutes.ts`(修改)、`src/api/moodComparison.ts`(新建)、`src/components/mood/MoodComparison.vue`(新建) |
| 实施顺序 | 1 |

#### P1-EM-02 异常波动与摘要提醒

| 字段 | 值 |
|------|-----|
| 子任务ID | P1-EM-02 |
| 所属模块 | 情绪分析能力增强 |
| 当前状态 | 未完成 |
| 当前代码证据 | 无异常检测、无提醒通知 |
| 问题描述 | 无连续低落或明显波动的检测和提醒 |
| 修改范围 | 后端新建检测服务；前端新建提醒卡片组件 |
| 前端任务 | ①新建 `MoodAlert.vue` 组件：提醒卡片（"最近3天情绪持续低落"）+ 查看详情 + 关闭提示 ②在 `MoodRecord.vue` 首页集成 |
| 后端任务 | ①新建 `moodAlertService.ts`：检测规则（连续3天强度<4 触发"持续低落"；连续3天强度波动>4 触发"明显波动"）②`moodController.ts` 新增 `GET /api/moods/alerts` ③去重：同一检测周期不重复提醒 ④`moodRoutes.ts` 注册 |
| 数据库任务 | 新建 `mood_alerts` 表（迁移 0270）：id, user_id, alert_type, alert_message, trigger_records(JSON), is_read, created_at。索引：idx_user_created |
| 权限任务 | authenticate 中间件 |
| 异常处理 | 无触发条件返回空数组；去重避免重复生成 |
| 测试任务 | 触发/不触发/去重/已读/关闭 |
| 验收步骤 | 连续3天低强度时显示提醒；普通波动不误报；提示不作医学诊断 |
| 完成定义 | 提醒正确触发，测试通过 |
| 依赖项 | 无 |
| 风险 | 规则阈值需调优，先用固定阈值 |
| 预计修改文件 | `mood_health_server/src/db/migrations/0270_create_mood_alerts.up.sql`(新建)、`mood_health_server/src/db/migrations/0270_create_mood_alerts.down.sql`(新建)、`mood_health_server/src/services/moodAlertService.ts`(新建)、`mood_health_server/src/controllers/moodController.ts`(修改)、`mood_health_server/src/routes/moodRoutes.ts`(修改)、`src/components/mood/MoodAlert.vue`(新建) |
| 实施顺序 | 2 |

---

### 4.2 AI 个性化 (Phase 2)

#### P1-REC-01 基于历史偏好的推荐

| 字段 | 值 |
|------|-----|
| 子任务ID | P1-REC-01 |
| 所属模块 | AI 个性化 |
| 当前状态 | 部分完成 |
| 当前代码证据 | `recommendService.ts` 有 `getPersonalizedRecommendations()` 方法，但 `userPreferences` 和 `recentActivities` 参数未实际使用历史数据填充 |
| 问题描述 | 推荐未基于用户真实历史数据（常见情绪、有效调节方式、测评结果） |
| 修改范围 | 后端修改推荐服务传入真实历史数据；前端展示推荐理由 |
| 前端任务 | ①修改 `AiSuggestCard.vue`：推荐结果增加推荐理由标签和来源标签 ②修改 `Counseling.vue`：推荐卡片增加反馈入口（为 P1-REC-03 做准备） |
| 后端任务 | ①修改 `recommendService.ts` 的 `getPersonalizedRecommendations()`：查询用户近30天常见情绪类型、测评结果、已完成的调节活动 → 构建真实 `userPreferences` 和 `recentActivities` ②推荐理由改为可解释文本（如"基于您最近经常感到焦虑，推荐..."） |
| 数据库任务 | 无（复用现有表） |
| 权限任务 | authenticate 中间件 |
| 异常处理 | 无历史数据时使用通用推荐；AI 失败时使用本地 fallback |
| 测试任务 | 不同用户不同推荐、推荐理由可解释、无历史数据通用推荐 |
| 验收步骤 | 不同用户或不同历史得到不同推荐；推荐理由可解释 |
| 完成定义 | 推荐个性化生效，测试通过 |
| 依赖项 | 无 |
| 风险 | 推荐质量依赖数据量，新用户数据少返回通用推荐 |
| 预计修改文件 | `mood_health_server/src/utils/ai/recommendService.ts`(修改)、`src/components/mood/AiSuggestCard.vue`(修改) |
| 实施顺序 | 3 |

#### P1-REC-02 活动与放松内容联动推荐

| 字段 | 值 |
|------|-----|
| 子任务ID | P1-REC-02 |
| 所属模块 | AI 个性化 |
| 当前状态 | 未完成 |
| 当前代码证据 | `recommendService.ts` 有硬编码 fallback 推荐（音乐/活动/课程），但 id 和 URL 是假的 |
| 问题描述 | 推荐内容未关联真实数据库中的音乐、活动、课程、放松内容 |
| 修改范围 | 后端修改推荐服务查询真实内容；前端推荐卡片支持一键跳转 |
| 前端任务 | ①修改 `AiSuggestCard.vue`：推荐卡片增加"去体验"一键跳转按钮 ②跳转到对应模块（音乐/活动/课程/放松） |
| 后端任务 | ①修改 `recommendService.ts`：AI 推荐返回后，根据 `type` 查询真实 `musics`/`activities`/`courses`/`relax_records` 表，匹配真实 ID 和 URL ②新增 `GET /api/recommend/content?mood=&limit=` 接口 ③无匹配内容时返回通用建议 |
| 数据库任务 | 无（复用 musics/activities/courses/relax_records 表） |
| 权限任务 | authenticate 中间件 |
| 异常处理 | 无匹配内容时返回通用建议文本 |
| 测试任务 | 推荐内容可跳转、无匹配通用建议、不同情绪不同推荐 |
| 验收步骤 | 推荐内容可用且跳转正确；无匹配时有通用建议 |
| 完成定义 | 推荐内容关联真实数据，测试通过 |
| 依赖项 | P1-REC-01 |
| 风险 | 内容库数据量影响推荐多样性 |
| 预计修改文件 | `mood_health_server/src/utils/ai/recommendService.ts`(修改)、`mood_health_server/src/controllers/recommendController.ts`(新建)、`mood_health_server/src/routes/recommendRoutes.ts`(新建)、`src/components/mood/AiSuggestCard.vue`(修改) |
| 实施顺序 | 4 |

#### P1-REC-03 建议效果反馈

| 字段 | 值 |
|------|-----|
| 子任务ID | P1-REC-03 |
| 所属模块 | AI 个性化 |
| 当前状态 | 未完成 |
| 当前代码证据 | 无反馈表、无反馈接口、无反馈 UI |
| 问题描述 | 用户无法标记 AI 建议是否有帮助 |
| 修改范围 | 新建反馈表；新建反馈接口；前端新增反馈按钮 |
| 前端任务 | ①修改 `AiSuggestCard.vue`：每个建议下方增加"有帮助"/"无帮助"按钮 + 提交状态 ②提交后显示"感谢反馈" |
| 后端任务 | ①新建迁移 0280 创建 `ai_feedback` 表：id, user_id, analysis_history_id, feedback_type(helpful/not_helpful), comment, created_at ②新建 `feedbackController.ts`：`POST /api/ai/feedback` ③新建 `feedbackService.ts` ④去重：同一用户对同一建议不可重复提交 ⑤管理端 `GET /api/admin/feedback/stats` 汇总统计 |
| 数据库任务 | 新建 `ai_feedback` 表（迁移 0280） |
| 权限任务 | POST 需 authenticate；GET stats 需 admin.access |
| 异常处理 | 重复提交返回提示；无效 ID 返回 404 |
| 测试任务 | 提交反馈、重复提交被拒、管理端统计、无效 ID |
| 验收步骤 | 反馈可保存且不重复提交；管理员可看到汇总统计 |
| 完成定义 | 反馈接口正常，测试通过 |
| 依赖项 | P0-DB-01（ai_analysis_history 表） |
| 风险 | 无 |
| 预计修改文件 | `mood_health_server/src/db/migrations/0280_create_ai_feedback.up.sql`(新建)、`mood_health_server/src/db/migrations/0280_create_ai_feedback.down.sql`(新建)、`mood_health_server/src/controllers/feedbackController.ts`(新建)、`mood_health_server/src/services/feedbackService.ts`(新建)、`mood_health_server/src/routes/feedbackRoutes.ts`(新建)、`src/components/mood/AiSuggestCard.vue`(修改) |
| 实施顺序 | 5 |

---

### 4.3 内容安全增强 (Phase 3)

#### P1-SAFE-01 敏感与高风险内容分级识别

| 字段 | 值 |
|------|-----|
| 子任务ID | P1-SAFE-01 |
| 所属模块 | 内容安全增强 |
| 当前状态 | 部分完成 |
| 当前代码证据 | `contentAuditService.ts` 有敏感词检测（返回 isSafe/severity）；`aiSafetyService.ts` 有高风险检测 |
| 问题描述 | 发布前未拦截并提示用户；风险等级未与发布流程集成 |
| 修改范围 | 后端集成审核到发布流程；前端增加发布前提示 |
| 前端任务 | ①修改 `Posts.vue`（树洞发布页）：提交前先调用审核接口，中风险内容弹出确认提示"内容可能包含敏感信息，确定发布？"，高风险内容阻断并提示修改 ②风险状态展示（低/中/高标签） |
| 后端任务 | ①修改 `postController.ts`：`createPost` 前调用 `contentAuditService.auditContent()` ②高风险（severity=high）拒绝发布返回 400 ③中风险（severity=medium）标记 `needs_review=true` ④低风险正常发布 |
| 数据库任务 | 无（复用 posts 表的 needs_review 字段） |
| 权限任务 | 无 |
| 异常处理 | 审核服务不可用时降级为仅基础敏感词过滤 |
| 测试任务 | 高风险内容被拒、中风险进入审核、普通内容正常发布、审核服务降级 |
| 验收步骤 | 测试样例能被正确分级；普通内容不过度拦截 |
| 完成定义 | 内容分级发布拦截生效，测试通过 |
| 依赖项 | 无 |
| 风险 | 敏感词列表需持续维护 |
| 预计修改文件 | `mood_health_server/src/controllers/postController.ts`(修改)、`src/views/posts/Posts.vue`(修改) |
| 实施顺序 | 6 |

#### P1-SAFE-02 风险提示与人工复核

| 字段 | 值 |
|------|-----|
| 子任务ID | P1-SAFE-02 |
| 所属模块 | 内容安全增强 |
| 当前状态 | 未完成 |
| 当前代码证据 | `managementController.ts` 有 `getPendingPosts` 但无优先级排序 |
| 问题描述 | 高风险内容无求助提示；管理员审核列表无优先级排序 |
| 修改范围 | 前端高风险内容显示求助资源；后端审核列表按风险等级排序 |
| 前端任务 | ①修改 `Posts.vue`：高风险内容被拦截时显示求助提示（心理咨询热线、紧急联系方式）和求助资源入口 ②修改 `AdminDashboard.vue` 或管理端审核页：高风险内容增加红色"高风险"标识 + 优先排序 |
| 后端任务 | ①修改 `postController.ts`：高风险拒绝时返回 `helpResources` 字段 ②修改 `managementController.ts`：`getPendingPosts` 按 risk_level 降序排列（高风险优先）③`posts` 表新增 `risk_level` 字段（迁移 0290） |
| 数据库任务 | 迁移 0290：posts 表新增 risk_level 字段（low/medium/high，默认 low） |
| 权限任务 | 管理端审核需要 admin.access |
| 异常处理 | 无高风险内容时正常排序 |
| 测试任务 | 高风险求助提示、审核列表优先级排序、风险标识 |
| 验收步骤 | 高风险内容不会直接公开；管理员可优先处理 |
| 完成定义 | 风险提示和优先队列生效，测试通过 |
| 依赖项 | P1-SAFE-01 |
| 风险 | 无 |
| 预计修改文件 | `mood_health_server/src/db/migrations/0290_add_posts_risk_level.up.sql`(新建)、`mood_health_server/src/db/migrations/0290_add_posts_risk_level.down.sql`(新建)、`mood_health_server/src/controllers/postController.ts`(修改)、`mood_health_server/src/controllers/managementController.ts`(修改)、`src/views/posts/Posts.vue`(修改) |
| 实施顺序 | 7 |

#### P1-SAFE-03 审核操作日志

| 字段 | 值 |
|------|-----|
| 子任务ID | P1-SAFE-03 |
| 所属模块 | 内容安全增强 |
| 当前状态 | 未完成 |
| 当前代码证据 | `auditService.ts` 有通用 `record()` 方法，`auditRepository.ts` 可写 audit_logs 表；但 post 审核流程未调用 |
| 问题描述 | 审核操作未记录操作人、操作、原因和时间 |
| 修改范围 | 后端在审核操作中调用 audit 记录；前端新增审核历史查看 |
| 前端任务 | ①修改管理端审核页面：每次审核操作后展示审核历史（操作人、操作、原因、时间）②新建 `AuditLogs.vue` 审核历史组件或在现有审核页集成 |
| 后端任务 | ①修改 `postController.ts`：`approvePost`/`rejectPost` 等审核操作后调用 `auditService.record()` ②日志内容：`{ action: 'post.approve'|'post.reject', targetId, operatorId, reason, timestamp }` ③新增 `GET /api/admin/posts/:id/audit-logs` 查询审核日志 |
| 数据库任务 | 无（复用 audit_logs 表） |
| 权限任务 | 查看审核日志需要 admin.access |
| 异常处理 | 日志写入失败不影响审核操作（静默记录错误） |
| 测试任务 | 审核后日志生成、日志查询、不可混淆 |
| 验收步骤 | 每次审核均生成不可混淆的日志记录 |
| 完成定义 | 审核日志记录和查询正常，测试通过 |
| 依赖项 | P1-SAFE-01 |
| 风险 | 无 |
| 预计修改文件 | `mood_health_server/src/controllers/postController.ts`(修改)、`mood_health_server/src/routes/postRoutes.ts`(修改) |
| 实施顺序 | 8 |

---

## 5. 数据库变更计划

### 复用的现有表

| 表名 | 用途 |
|------|------|
| `moods` | 情绪记录，周期对比 |
| `mood_emotions` | 情绪类型关联 |
| `assessment_sessions` | 测评结果，推荐上下文 |
| `musics` | 音乐内容，联动推荐 |
| `activities` | 活动内容，联动推荐 |
| `courses` | 课程内容，联动推荐 |
| `relax_records` | 放松内容，联动推荐 |
| `posts` | 树洞帖子，审核 |
| `audit_logs` | 审核操作日志 |
| `ai_analysis_history` | AI 分析记录，反馈关联 |

### 新增表

**`mood_alerts`** — 情绪异常提醒记录（迁移 0270）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT AUTO_INCREMENT PRIMARY KEY | 主键 |
| user_id | INT NOT NULL | 用户ID |
| alert_type | VARCHAR(50) NOT NULL | 提醒类型: continuous_low / high_fluctuation |
| alert_message | VARCHAR(500) NOT NULL | 提醒文案 |
| trigger_records | JSON NULL | 触发记录ID列表 |
| is_read | TINYINT(1) DEFAULT 0 | 是否已读 |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | 创建时间 |

索引：`idx_user_created (user_id, created_at DESC)`

**`ai_feedback`** — AI 建议效果反馈（迁移 0280）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT AUTO_INCREMENT PRIMARY KEY | 主键 |
| user_id | INT NOT NULL | 用户ID |
| analysis_history_id | INT NOT NULL | 关联 AI 分析记录ID |
| feedback_type | ENUM('helpful', 'not_helpful') NOT NULL | 反馈类型 |
| comment | VARCHAR(500) NULL | 补充说明 |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | 创建时间 |

索引：`UNIQUE idx_user_analysis (user_id, analysis_history_id)` — 防止重复提交

### 修改现有表

**`posts` 表新增字段**（迁移 0290）

```sql
ALTER TABLE posts ADD COLUMN risk_level VARCHAR(20) DEFAULT 'low' AFTER needs_review;
```

### 迁移文件

- `mood_health_server/src/db/migrations/0270_create_mood_alerts.up.sql` / `.down.sql`
- `mood_health_server/src/db/migrations/0280_create_ai_feedback.up.sql` / `.down.sql`
- `mood_health_server/src/db/migrations/0290_add_posts_risk_level.up.sql` / `.down.sql`

---

## 6. API 变更计划

### 新增 API

| 方法 | 路径 | 角色 | 返回结构 | 权限 | 前端调用 |
|------|------|------|---------|------|---------|
| GET | /api/moods/comparison?period=week\|month | 普通用户 | `{ thisPeriod: {count, avgIntensity}, lastPeriod: {count, avgIntensity}, change: {countRate, intensityDiff} }` | authenticate | `src/api/moodComparison.ts` |
| GET | /api/moods/alerts | 普通用户 | `{ alerts: [{id, type, message, triggerRecords, isRead, createdAt}] }` | authenticate | `src/api/mood.ts` |
| GET | /api/recommend/content?mood=&limit= | 普通用户 | `{ items: [{type, id, title, description, url, relevance}] }` | authenticate | `src/api/recommend.ts` |
| POST | /api/ai/feedback | 普通用户 | `{ id }` | authenticate | `src/api/ai.ts` |
| GET | /api/admin/feedback/stats | 管理员 | `{ total, helpful, notHelpful, rate }` | admin.access | `src/api/adminAnalytics.ts` |
| GET | /api/admin/posts/:id/audit-logs | 管理员 | `{ logs: [{action, operator, reason, createdAt}] }` | admin.access | `src/api/admin.ts` |

### 修改 API

| 方法 | 路径 | 变更内容 |
|------|------|---------|
| POST | /api/posts | 发布前调用 contentAuditService，高风险拒绝，中风险标记审核 |
| PUT | /api/admin/posts/:id/approve | 审核后记录 audit_log |
| PUT | /api/admin/posts/:id/reject | 审核后记录 audit_log（含原因） |
| GET | /api/admin/posts/pending | 按 risk_level DESC 排序 |

---

## 7. 前端页面和交互计划

### 新增组件

| 组件 | 说明 |
|------|------|
| `MoodComparison.vue` | 新建，周/月趋势对比（柱状图 + 变化说明） |
| `MoodAlert.vue` | 新建，异常波动提醒卡片 |

### 修改组件

| 组件 | 修改内容 |
|------|---------|
| `AiSuggestCard.vue` | 推荐理由标签 + 来源标签 + 反馈按钮 + 内容跳转按钮 |
| `Posts.vue` | 发布前审核拦截 + 求助提示 + 风险等级展示 |
| `AdminDashboard.vue` | 审核列表高风险标识 + 优先排序 |

### 新增 API 文件

| 文件 | 说明 |
|------|------|
| `src/api/moodComparison.ts` | 周期对比 API |
| `src/api/recommend.ts` | 内容推荐 API |

### 交互状态

每个页面/组件必须覆盖：加载中 → 数据渲染 → 空数据 → 请求失败 → 重试

---

## 8. 测试计划

### 新增后端测试

| 测试文件 | 覆盖场景 |
|---------|---------|
| `moodComparison.test.ts` | 周对比、月对比、无上周数据、边界值 |
| `moodAlertService.test.ts` | 触发提醒、不触发、去重、已读 |
| `recommendService.test.ts` (补充) | 个性化推荐、真实内容匹配、无匹配通用建议 |
| `feedbackController.test.ts` | 提交反馈、重复提交、管理端统计、无效ID |
| `postController.test.ts` (补充) | 高风险拒绝、中风险审核、审核日志记录 |

### 新增前端测试

| 测试文件 | 覆盖场景 |
|---------|---------|
| `mood-comparison.test.ts` | 周期切换、图表渲染、空数据、变化说明 |
| `mood-alert.test.ts` | 提醒渲染、关闭、查看详情 |
| `ai-feedback.test.ts` | 反馈按钮、提交状态、重复提交提示 |

### 现有测试必须保持通过

- 前端 125 测试（不得减少）
- 后端 215 测试（不得减少）

---

## 9. 实施顺序

```
Phase 1: 情绪分析增强
  1. P1-EM-01  用户端周/月趋势对比
  2. P1-EM-02  异常波动与摘要提醒

Phase 2: AI 个性化
  3. P1-REC-01  基于历史偏好的推荐
  4. P1-REC-02  活动与放松内容联动推荐
  5. P1-REC-03  建议效果反馈

Phase 3: 内容安全增强
  6. P1-SAFE-01 敏感与高风险内容分级识别
  7. P1-SAFE-02 风险提示与人工复核
  8. P1-SAFE-03 审核操作日志

Phase 4: 验证
  9. 全量测试 + 构建 + 端到端验收
```

---

## 10. 完成状态表

| 任务ID | 当前状态 | 开发状态 | 测试状态 | 验收状态 |
|--------|---------|---------|---------|---------|
| P1-EM-01 | 部分完成 | 待开发 | 待测试 | 待验收 |
| P1-EM-02 | 未完成 | 待开发 | 待测试 | 待验收 |
| P1-REC-01 | 部分完成 | 待开发 | 待测试 | 待验收 |
| P1-REC-02 | 未完成 | 待开发 | 待测试 | 待验收 |
| P1-REC-03 | 未完成 | 待开发 | 待测试 | 待验收 |
| P1-SAFE-01 | 部分完成 | 待开发 | 待测试 | 待验收 |
| P1-SAFE-02 | 未完成 | 待开发 | 待测试 | 待验收 |
| P1-SAFE-03 | 未完成 | 待开发 | 待测试 | 待验收 |