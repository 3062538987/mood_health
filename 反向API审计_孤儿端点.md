# 反向 API 审计：后端已挂载但前端从未调用的端点

> 审计日期：2026-08-09（轮次⑤续）
> 方法：`mood_health_server/src/app.ts` 挂载表 + 各 `routes/*.ts` 实际路由 ↔ 前端 `src/**` 全部 `/api/*` 调用（含 `src/api/*.ts`、`stores/*`、`views/*`、`components/*` 内联、`__tests__`）逐一比对，差集即孤儿端点。
> 配套：轮次⑤已做正向审计（前端调了但后端没暴露），唯一真 bug = `/api/ai/feedback`→`/api/feedback`（已修）。本文件是反向 complement。

## 一、覆盖范围

- 后端挂载路由文件：auth / mood / questionnaire / audit / case / prompt / aiInterpretation / aiHistory / activity / post / music / course / relax / achievement / recommend / feedback / management / moodAnalysis / knowledgeAssistant / counseling（共 20 个 router）。
- 前端调用入口：约 100+ 条 `/api/*`（含测试）。
- 结论：除下方清单外，**所有前端调用的端点后端均已挂载、所有前端引用的字段路径可对应**；反向孤儿端点共 **23 个**，分四类。

## 二、孤儿端点清单（后端挂载，前端 0 调用）

### A 类：疑似死代码 / 未接线（建议删除或补前端入口）
| # | 方法+路径 | handler | 说明 |
|---|-----------|---------|------|
| 1 | `GET /api/moods/analysis` | getMoodAnalysisHandler | **已删除（2026-08-09 晚）**：历史遗留；现情绪分析走 `/api/mood-analyses`。迁移 `scripts/release-smoke.ps1` → `POST /api/mood-analyses`（period=7d），删除路由 + `getMoodAnalysisHandler` + 孤儿服务方法 `getMoodAnalysis`，同步 04-api-inventory.md、SQLITE 发版清单/模板。 |
| 2 | `GET /api/moods/tags` | getTagsHandler | **已删除（2026-08-09 晚·本轮）**：前端未拉取情绪标签→删路由 + handler + `moodService.listTags` + `moodRepository.listTags`；同步 `moodControllerContract.test.ts`。 |
| 3 | `POST /api/moods/tags` | createTagHandler | **已删除（2026-08-09 晚·本轮）**：前端无法创建标签→删路由 + handler + `moodService.createOrGetTag` + `moodRepository.createOrGetTag`；同步 `moodControllerContract.test.ts`。 |
| 4 | `PUT /api/moods/:id` | updateMoodHandler | **已删除（2026-08-09 晚·本轮）**：前端无编辑入口→删路由 + handler + `moodService.updateMood` + `moodRepository.updateMood`；同步 `moodControllerContract.test.ts`。 |
| 5 | `POST /api/counseling/sessions` | createSessionHandler | **已删除（2026-08-09 晚·本轮）**：前端从不显式建会话→删路由 + handler；`generateSessionId` 保留（`/send` 仍用）。 |
| 6 | `GET /api/audit/all` | getOperationLogsHandler | **与 `/api/audit/operation-logs` 完全相同 handler 的重复端点**（冗余）。 |
| 7 | `POST /api/users/manage` | userManageHandler | **已删除（2026-08-09 续·本轮清理）**：纯空壳 stub（仅记日志返回"已记录"），真实用户管理走 `/api/admin/users` 系列；删路由 + handler。 |
| 8 | `POST /api/roles/manage` | roleManageHandler | **已删除（2026-08-09 续·本轮清理）**：与 `PUT /api/admin/users`（user.manage）角色变更能力完全重复；删路由 + handler；`role.manage` 权限定义保留（RBAC 模型未动）→ **已于 2026-08-09 末 option A 清理移除**。 |
| 9 | `POST /api/system/config` | systemConfigHandler | **已删除（2026-08-09 续·本轮清理）**：纯空壳 stub（仅记 configKey 日志，无任何读写）；删路由 + handler；`system.config` 权限定义保留 → **已于 2026-08-09 末 option A 清理移除**。 |
| 10 | `GET /api/admin/assessments` | adminAssessmentsListHandler | **保留·有意预留（已实现，前端入口待补）**：调用 `assessmentService.listAllSessions` 查真实测评数据；代码已加注释标注为「有意预留」。 |
| 11 | `GET /api/admin/assessments/:id` | adminAssessmentDetailHandler | **保留·有意预留（已实现，前端入口待补）**：调用 `assessmentService.getSessionDetailAdmin`；代码已加注释标注为「有意预留」。 |
| 12 | `GET /api/posts/admin/audit-logs/:id` | getPostAuditLogsHandler | **已删除（2026-08-09 晚·本轮）**：前端 audit-logs 页走 `getAdminAuditLogs`（`@/api/admin`），与此 handler 无关→删路由 + handler；`auditService` 保留（`auditPostHandler` 仍用）。 |
| 13 | `GET /api/feedback/stats` | getFeedbackStats | **已删除（2026-08-09 晚）**：反馈统计管理前端无入口；删除路由 + `getFeedbackStats` handler + `feedbackService.getStats()` + `FeedbackStats` 类型。`POST /api/feedback`（用户提交反馈，前端在用）保留。 |
| 14 | `GET /api/feedback/list` | getFeedbackList | **已删除（2026-08-09 晚）**：反馈列表管理前端无入口；删除路由 + `getFeedbackList` handler + `feedbackService.getList()`。 |
| 15 | `POST /api/cases/auto-create` | autoCreateCase | **已删除（2026-08-09 晚·本轮）**：前端无入口→删路由 + handler + `validateAutoCreateCase` + `caseService.autoCreateCase` + 孤儿 `getAssessmentRepo`/导入；同步 `caseRoutesPermission.test.ts`。 |
| 16 | `GET /api/recommend/content` | getContentRecommendations | **已删除（2026-08-09 晚·本轮）**：整模块孤儿→删 `recommendRoutes.ts` + `recommendController.ts` + `utils/ai/recommendService.ts` + app.ts 挂载 `/api/recommend`。 |
| 17 | `DELETE /api/auth/me` | deleteMe | **保留·有意预留（已实现，前端入口待补）**：`authService.deleteMe`→`repository.deleteUser`，真实账号注销；前端生产代码无调用（仅 `auth.test.ts` 引用）；代码已加注释标注为「有意预留」。 |

### B 类：整模块未接线（前端零调用）
| # | 路径 | 说明 |
|---|------|------|
| 18 | `/api/prompts/*` 全部 5 个：`GET /`、`GET /:id`、`POST /`、`PUT /:id`、`DELETE /:id` | **已删除（2026-08-09 晚）**：prompt 管理模块（`promptRoutes.ts` + `promptController.ts` + app.ts 挂载）前端完全未接线，已整体移除。注意：`prompt_templates` 表 / `promptService` / `promptRepository` / `seedPromptTemplates` **保留**——`utils/ai/aiCallService.ts` 运行时通过 `promptService.getActiveByCategory()` 加载模板供 AI 服务使用，非死代码。 |

### C 类：公开写路由被 admin 路由冗余覆盖（建议删冗余公开写路由）
| # | 方法+路径 | 说明 |
|---|-----------|------|
| 19 | `POST /api/courses` | 课程创建走 `/api/admin/courses`（managementRoutes）。公开 `/api/courses` 写路由无人调用。 |
| 20 | `PUT /api/courses/:id` | 同上冗余。 |
| 21 | `DELETE /api/courses/:id` | 同上冗余。 |
| 22 | `POST /api/music` | 音乐新增未接线（admin 仅 `GET /api/music` + `PUT /api/music/:id`，可改不可增删）。**已删除（2026-08-09 晚 C 类清理移除路由；2026-08-09 Task #36 清理 controller 死导出 `createMusic` + repository `create`）**。 |
| 23 | `DELETE /api/music/:id` | 音乐删除未接线。**已删除（同上：C 类清理移除路由；Task #36 清理 `deleteMusic` + repository `remove`）**。 |

> 注：`/api/courses` 与 `/api/music` 的 **GET / 与 GET /:id 前端正常调用**（课程浏览、音乐浏览），仅写操作冗余。

## 三、判定口径（避免误报）

- 多行 route 定义（`.post(\n '/x', ...)`）已被逐文件读取补全，非 grep 漏判。
- 动态路径（如 `/api/moods/${id}`）按方法区分：`mood.ts:99` 仅 `delete`；`counseling.ts:182` 为 `patch`（rename）；`admin.ts:87` 的 `PUT /admin/users` 已接线（更新角色）。
- `/api/ai/*` 子路由 `router.use(authenticate)` 不影响本审计（本审计只看「是否被调用」，不看鉴权）。

## 四、行动建议（按优先级）

1. **高（清理死代码/重复）**：~~删 `GET /api/audit/all`（与 operation-logs 重复）~~ ✓已删；~~复核 `GET /api/moods/analysis` 是否过期~~ ✓已迁移并删（Task #32）；~~删 C 类冗余公开写路由（`/api/courses`、`/api/music` 的 POST/PUT/DELETE）~~ ✓已删（23:xx C 类清理）+ Task #36 清理 music 死导出。**本条全部完成。**
2. **中（未接线功能）**：~~决定 `/api/prompts/*` 是「待开发」还是「删除」；补或删 `/api/feedback/stats|list`~~（已处理：prompts 整体删除；feedback/stats|list 删除）；~~`POST /api/cases/auto-create`、`GET /api/recommend/content`~~（本轮已删除）；`POST /api/users/manage`、`POST /api/roles/manage`、`POST /api/system/config` **已删除（2026-08-09 续·本轮清理，纯空壳/重复）**；其余保留待补前端入口：`/api/admin/assessments*`（真正实现）、`DELETE /api/auth/me`（真正实现账号注销）。
3. **低（确认性）**：~~`/api/moods/tags`、`PUT /api/moods/:id`、`POST /api/counseling/sessions`~~ 本轮已确认删除（前端零调用，非刻意保留）。

## 五、与正向审计的对照

- 正向（前端→后端缺口）：仅 1 个真 bug → `/api/ai/feedback` 错路径，已修为 `/api/feedback`，真后端 + 单测双验证通过。
- 反向（后端→前端孤儿）：23 个端点未消费，绝大多数是 admin/内部/待开发功能，**非 bug**，但 A 类（重复/过期）值得清理。
- 综合结论：前后端主干链路（情绪记录、问卷、AI 三大能力、咨询、知识助手、活动、帖子、放松、成就）**对齐良好**；需清理的是管理后台的冗余/重复端点与未接线子模块。
