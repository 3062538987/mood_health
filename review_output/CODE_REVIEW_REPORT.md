# 大学生情绪健康管理平台 — 全库代码审查主报告

> 审查日期：2026-08-08
> 审查方式：**4 路并行深度审查（后端 / 前端 / AI 服务 / 跨切面）+ 全库静态指标扫描交叉验证**
> 实跑验证：后端 `tsc --noEmit` / `jest` / 集成测试；前端 `vue-tsc` / `vitest` / `playwright`；AI 服务 `ruff` / `mypy` / `pytest` 全部真实运行
> 交付物：本报告 + `backend.md` / `frontend.md` / `ai-service.md` / `cross-cutting.md`（四份逐文件明细）

---

## 0. 阅读指引

- 想看**某一子系统逐文件证据**（file:line、完整缺陷表）→ 打开对应明细文件。
- 想看**总评、最高风险、修复路线**→ 读本报告即可。
- 本报告所有结论均基于真实文件读取与真实命令输出，关键 P0 结论已由主代理二次抽查确认。
- ⚠️ **一处需纠正**：AI 服务明细与跨切面明细中存在"仓库无 `.gitignore`、密钥极易被提交"的表述，**经 `git check-ignore` 实测，`.env` 已被根 `.gitignore` 正确忽略、未入库**。该条已降级为"P1 密钥管理（明文落盘 + 弱口令）"，详见第 6 节。

---

## 1. 执行摘要

这是一套**工程基础相当扎实、可学习演示上线**的三件套平台，类型系统与单测门禁均真实可用；但存在 **2 条安全红线（AI 接口未鉴权 + 后端提权缺口）** 与 **3 处前后端接口契约硬断裂（功能不可用）**，且**完全没有 CI/CD 门禁**，需要在发布前集中收敛。

| 子系统 | 总评(0-10) | 一句话 |
|---|---|---|
| 后端 `mood_health_server` | **6.6** | 分层清晰、参数化 SQL、单测 245 全绿；但授权边界、Redis 降级关闭暴破防护、AI 限流空转、93 处 `any`、死代码待清 |
| 前端 `mood-health-web` | **7.5** | strict 通过、205 单测 + 13 E2E 全绿；但错误契约不一致、两处裸 fetch 渲染损坏、巨型组件、配置变量名错配 |
| AI 服务 `mood_health_ai_service` | **6.0** | ruff/mypy 全绿、94 测试全绿；但 **analyze/chat 零鉴权（红线）**、大片 DB 死代码、同步阻塞事件循环、无速率限制 |
| 跨切面（契约/CI/配置/密钥/nginx） | — | 接口契约 4 处断裂、无 CI、nginx 暴露 AI 且端口错配、文档失真 |

**整体结论**：代码"能跑、测试能过、类型能过"，但**安全与契约层面有发布阻断级问题**。建议按第 10 节 P0→P1→P2 分阶段推进。

### 最致命的 5 件事（发布前必须处理）
1. 🔴 **AI 服务 `/api/analyze/mood` 与 `/api/ai/chat` 完全无鉴权**——任何人可触发付费 DeepSeek 调用，`chat` 甚至是无限转发代理（薅额度 + 内容风险）。
2. 🔴 **后端权限提升**：持有 `user.manage` 的普通 `admin` 可把任意用户（含自己）提权为 `super_admin`，无自改/提权校验。
3. 🟠 **前后端接口契约断裂**：课程管理（`/api/admin/courses` vs 后端 `/api/courses`）、情绪建议（`/api/moods/advice/*` 后端无实现）、删除分析（无 DELETE 路由）→ 这些功能**调用即 404**。
4. 🟠 **毫无 CI/CD**：`.github/workflows` 为空，任何未过类型检查/测试的代码都能直接合入部署。
5. 🟠 **nginx 公网暴露无鉴权的 `/ai/` 且 upstream 端口错配（8000 vs 实际 8001）**；生产 `nginx.linux.conf` 仅 80 明文、无 TLS。

---

## 2. 审查范围与方法

**范围**：仓库根（前端）、`mood_health_server/`（后端）、`mood_health_ai_service/`（AI 服务）、`agent_app/`（独立原型，未纳入主审查）、`.github`/`nginx*`/`README*`/`docs`（跨切面）。

**统一维度**：代码质量 / 架构与解耦 / 测试（单测 + 接口·集成测试 + E2E）/ 安全 / 缺陷与风险 / 优先级建议。

**实跑结果（真实命令）**

| 命令 | 结果 |
|---|---|
| 后端 `tsc --noEmit`（strict） | ✅ 0 错误 |
| 后端 `jest tests/unit` | ✅ 55 套 / **245 例**全绿 |
| 后端 `jest --config jest.integration.config.js` | ✅ 1 套 / **9 例**全绿（环境有可用 MySQL） |
| 前端 `vue-tsc --noEmit`（strict） | ✅ 0 错误 |
| 前端 `vitest run` | ✅ 49 文件 / **205 例**全绿 |
| 前端 `playwright test --list` | ✅ 13 用例 / 8 文件 |
| AI 服务 `ruff check app` | ✅ All checks passed |
| AI 服务 `mypy app`（strict） | ✅ 24 文件 0 错误 |
| AI 服务 `pytest`（HF_HUB_OFFLINE=1） | ✅ **94 passed** |

---

## 3. 子系统评分卡

| 维度 | 后端 | 前端 | AI 服务 |
|---|---|---|---|
| 代码质量 | 6.0 | 7.0 | 8.0 |
| 架构与解耦 | 7.0 | 7.0 | 6.0 |
| 测试 | 7.0 | 8.0 | 6.0 |
| 安全 | 6.5 | 8.0 | 4.0 |
| **总评** | **6.6** | **7.5** | **6.0** |

---

## 4. 全库静态指标扫描（主代理交叉验证）

| 指标 | 命中行数 | 说明 |
|---|---|---|
| `TODO/FIXME/HACK/XXX` | 1 | 技术债标注极少（不代表没有债，只是没打标） |
| `console.*`（源码内） | **112**（src 66 / 后端 46；tests 10；AI 0） | 应统一接入 logger（后端已有 winston，前端仍散用 console） |
| TS `any`（类型逃逸） | **~137**（后端 93 / 前端 44） | 关闭严格类型保护，AI 返回解析尤为集中 |
| `eval(` | 0 | 无危险动态执行 |
| 源码内 `sk-` 密钥 | 0 | **密钥未硬编码进源码**（仅在被 gitignore 的 `.env`） |
| Python `except Exception` | 16 | 部分过宽捕获，AI 路由把 `str(e)` 回吐客户端 |
| `@ts-ignore/@ts-nocheck` | 0 | 未用抑制注释掩盖问题 |

---

## 5. 最高优先级风险（合并去重 · Top 清单）

> 完整逐条（含 file:line）见四份明细。下表为跨子系统去重后的关键项。

| # | 级 | 子系统 | 位置 | 问题 |
|---|---|---|---|---|
| R1 | 🔴P0 | AI | `routers/analyze.py:18`、`chat.py:16` | 两个端点**完全无内部鉴权**，可被任意调用/滥用 DeepSeek |
| R2 | 🔴P0 | 后端 | `controllers/managementController.ts:111-157` | 权限提升：`admin` 可把任何人提权为 `super_admin`，无自改/提权校验 |
| R3 | 🟠P1 | 跨/后端 | `src/api/admin.ts:124,141,149,157` ↔ `app.ts:201` | 课程管理路径契约断裂（`/api/admin/courses` vs `/api/courses`）→ 404 |
| R4 | 🟠P1 | 跨/前端 | `src/api/advice.ts:41,59` ↔ 后端无实现 | 情绪建议保存/历史接口被前端与测试依赖但**后端未实现** → 404 |
| R5 | 🟠P1 | 跨/AI/nginx | `nginx.conf:78-88` + AI 路由 | `/ai/` 公网暴露且无鉴权，叠加 R1 可滥用密钥 |
| R6 | 🟠P1 | 后端 | `services/authService.ts:86-99,151-159`、`redis.client.ts` | Redis 不可用时登录暴破防护被**静默关闭**（安全降级误用为缓存降级） |
| R7 | 🟠P1 | 后端 | `config/aiConfig.ts:60-64`（定义，未消费） | **AI 限流只配置不生效**，AI 接口可被无限调用（成本/DoS） |
| R8 | 🟠P1 | 后端/AI | `aiClient.ts:222`、`config.py:43` | `AI_SERVICE_INTERNAL_TOKEN` 默认空串；两端 `.env` 均未设置 → 签名接口恒 401 |
| R9 | 🟠P1 | 跨/CI | `.github/workflows/`（空） | 无任何 CI 门禁（typecheck/lint/test/secret-scan） |
| R10 | 🟠P1 | 跨/nginx | `nginx.linux.conf:32-74` | 生产仅 80 明文、无 TLS、无 80→443 跳转 |
| R11 | 🟠P1 | AI | `app/db/*`、`repositories/*`、`run_migrations()` | **整块 DB/迁移死代码**，从未被任何路由调用 |
| R12 | 🟠P1 | AI | `assistant/service.py:37`、`rag/service.py:15` | 请求期同步 CPU 重检索阻塞事件循环（未 `asyncio.to_thread`） |
| R13 | 🟠P1 | 前端 | `stores/moodStore.ts`、`moodRecordStore.ts` | 拦截器抛 `ApiRequestError`（无 `.response`），但 store 仍读 `err.response?.data?.message` → 真实后端错误被吞、AI 限流/冷却分支失效 |
| R14 | 🟠P1 | 前端 | `Courses.vue:73`、`CourseDetail.vue:76` | 裸 `fetch` 未解包 ApiResponse 信封、未带凭证 → 课程列表/详情渲染损坏 |
| R15 | 🟡P2 | 后端 | `controllers/activityController.ts:3-4,395,426` | 控制器越层直连 DB 写统计 SQL，破坏分层、难测试 |
| R16 | 🟡P2 | 后端 | `config/sqlite.ts`（~266 行）、`app.ts:57` 空 feature-flag | 死代码 |
| R17 | 🟡P2 | 后端 | `middleware/auth.ts:92-218` | 权限模型双份定义（代码映射 + 库表），易漂移 |
| R18 | 🟡P2 | 后端 | 全仓 93 处 `any`、263 处魔法 HTTP 状态码 | 类型/常量未收敛 |
| R19 | 🟡P2 | 前端 | `MoodRecordScript.ts`(539 行无引用)、`.env` 变量名错配 `VITE_FEATURE_NON_CORE_MODULES_ENABLED` vs `VITE_FEATURE_NON_CORE_MODULES` | 死代码 + 功能开关恒开 |
| R20 | 🟡P2 | 前端 | `GroupActivity.vue`(1496)、`MoodArchive.vue`(1344)、`MoodRecord.vue`(1301) | 巨型 SFC，可维护性风险 |
| R21 | 🟡P2 | 跨/文档 | `README.txt` 目录树、`docs/API.md` | 文档描述旧结构/未实现接口，与实际代码双重失真 |
| R22 | 🟡P2 | 跨/配置 | `nginx.conf:30`(8000) vs 实际 8001；`MYSQL_PORT` 3316 vs AI 默认 3306 | 端口漂移 |
| R23 | 🟡P2 | 跨/nginx | 两 conf 全局 | 缺 HSTS/CSP/X-Frame-Options 等安全头、缺速率限制 |

---

## 6. 安全红线清单（含一处纠正）

**🔴 必须立即处理**
- **R1 AI 接口零鉴权**：为 `analyze`/`chat` 套用 `verify_internal_auth`（与 `assistant`/`rag` 一致），或对 `/ai/` 在 nginx 层做内网白名单/不暴露。
- **R2 后端提权**：`managementController` 角色修改加硬约束——仅 `super_admin` 可分配 `super_admin`；`admin` 的目标角色限 `user/admin`；禁止把自身提权；补集成测试模拟 `admin→super_admin` 应 403。
- **密钥事故响应**：`mood_health_ai_service/.env` 含**真实 DeepSeek 密钥明文落盘**（具体值不在此复述，请就地查看并立即吊销轮换），迁移到密钥管理服务；根 `.env` 含**弱口令**（长度不足、含弱模式）明文，需替换为强随机口令。

**🟠 尽快处理**
- **R6 Redis 降级误用**：登录失败锁定属"安全控制"，Redis 不可用时必须 **fail-closed**（拒绝登录或强制验证码），不应与缓存降级混用静默放行。
- **R7 AI 限流落地**：在 AI 入口用 Redis/内存计数器实现 per-user/IP 限流，否则配置形同文档。
- **R8 内部门禁令牌**：在两端 `.env` 设置同一强随机 `AI_SERVICE_INTERNAL_TOKEN`，并加入启动校验（空则拒绝启动 AI 能力）。
- **R9 CI/secret-scan**：引入 `gitleaks`/`trufflehog` 防止 `.env` 误提交，并作为合并门禁。
- **R10 / R5 TLS 与暴露面**：生产启用 443+TLS、80→443 跳转；关闭公网 `/ai/`。

> **✅ 已纠正项（重要）**：AI 服务与跨切面明细中"仓库无 `.gitignore`、密钥极易被提交"的 P0 表述**不成立**。经 `git check-ignore -v .env` 与 `mood_health_ai_service/.env` 实测，两者均被根 `.gitignore` 正确忽略、未纳入 git 历史。因此该问题从"会入库泄露(P0)"降级为"明文落盘 + 弱口令(P1 密钥管理)"——密钥不被提交，但工作区明文仍应轮换并迁入密钥管理。源码侧密钥管理其余项良好（无硬编码 `sk-`、无硬编码 JWT/连接串）。

---

## 7. 接口契约断裂清单（前后端 / 服务间）

| 编号 | 前端调用 | 后端实际 | 结论 |
|---|---|---|---|
| M1 | `admin.ts:124,141,149,157` → `/api/admin/courses` | `courseRoutes` 挂 `/api/courses` | **404：课程管理后台不可用** |
| M2 | `advice.ts:41,59` → `/api/moods/advice/save`、`/moods/advice/history` | 全仓无此路由（仅死代码 `advice_history` 表 + 权限种子） | **404：被前端与测试依赖却未实现** |
| M3 | `moodAnalysis.ts:162` → `DELETE /api/mood-analyses/:id` | `moodAnalysisRoutes` 无 DELETE | **404：删除分析不可用** |
| M4 | `counseling.ts:172`、`knowledgeAssistant.ts:48` 用 `sessionId` | 后端用 `:id` | 非断裂（Express 忽略参数名），但**命名不一致**易踩坑 |
| M5 | `questionnaire.ts` 提交字段 | `questionnaireRoutes` | ✅ 对齐 |

**建议**：优先实现/对齐 M1、M2、M3；并建立**契约测试**（前端 `src/api` ↔ 后端 `routes` 自动化对账，CI 运行）防回归。

---

## 8. 测试评估总览（单测 / 接口·集成 / E2E）

| 子系统 | 单测 | 集成/接口 | E2E | 缺口 |
|---|---|---|---|---|
| 后端 | 245 例全绿（55 套） | 仅 `moodCrud` 1 套 9 例 | — | 集成覆盖极薄（鉴权/权限/帖文/AI/案例无集成）；核心 repository（`post/activity/achievement/course/music/relax/management`）无独立单测；覆盖率门槛仅 45% |
| 前端 | 205 例全绿（49 文件） | — | 13 用例 / 8 文件 | 组件级单测薄（relax/*、admin/*、user/*、improve/* 缺）；视图/组件覆盖率不均 |
| AI 服务 | 94 例全绿 | — | — | **`analyze`/`chat` 零测试**；大量测试覆盖的是**从未被调用的 DB 死代码**；`test_rag_service.py` 依赖仓库外 `agent_app` 黄金源（CI 缺该私有仓即失败） |

**接口测试重点缺口**：后端集成测试几乎只覆盖 `mood` 单域；AI 服务最关键的两个路由（analyze/chat）没有任何测试；跨系统无契约测试。建议把"契约测试 + 核心链路集成测试"作为 P1 测试建设重点。

---

## 9. 架构与解耦总评

- **后端**：`controller → service → repository → mysql2` 总体清晰，事务使用规范（已验证回滚）。问题集中在：① `activityController` 越层直连 DB；② 权限模型代码映射与库表双份易漂移；③ 配置 `process.env` 散读、缺统一 config 聚合；④ 鉴权依赖"每路由自己加"，脆弱。
- **前端**：`api / stores / types / constants / config` 分层清晰，无 EventBus 滥用。问题：① store 直接调 api 缺 service 层；② `activity.ts`/`activityApi.ts` 重复、`SafeResult` 双定义；③ 巨型 SFC/store；④ 错误消费契约不一致。
- **AI 服务**：`assistant`/`rag` 走 `router → service → provider` 清晰；但 `analyze`/`chat` 在路由内直接调 provider（缺 service 层）；`AnalysisProvider` 协议定义了却从未 DI 使用；DB 层整体死代码；RAG 检索在请求期同步阻塞事件循环。
- **总体**：三个服务各自内部分层基本健康，但**跨服务契约缺乏单一事实源（建议 OpenAPI + 契约测试）**，配置/端口/令牌在三处 `.env` 各自为政。

---

## 10. 优先级路线图（分阶段行动清单）

### 🔴 P0 — 发布前止血（安全 + 可用）
1. 为 AI `analyze`/`chat` 增加 `verify_internal_auth`（复用现有 HMAC），或 nginx 不暴露 `/ai/`。
2. 后端 `managementController` 加提权硬约束（仅 super_admin 可分配 super_admin、禁止自改、admin 目标角色限 user/admin），补集成测试。
3. 密钥响应：吊销并轮换 AI 服务 DeepSeek 密钥；根/AI `.env` 弱口令替换为强随机；密钥迁入密钥管理，仓库仅留 `.env.example`。
4. 两端 `.env` 设置同一 `AI_SERVICE_INTERNAL_TOKEN`（强随机），启动校验非空。

### 🟠 P1 — 本迭代必须（契约 + CI + 加固）
5. 修复契约断裂 M1（`/api/admin/courses`）、M2（实现 advice 接口或下架）、M3（mood-analyses DELETE）。
6. 建立 CI/CD：`.github/workflows/ci.yml` 覆盖三子系统（lint → typecheck → test → build → **secret-scan + 依赖审计**）。
7. 后端登录暴破在 Redis 不可用时 fail-closed；AI 入口落地 per-user/IP 限流。
8. 部署 `.env` 显式 `AI_ENABLED=true`；`nginx.linux.conf` 启用 443+TLS + 80→443 + HSTS。
9. AI：lifespan 调用 `run_migrations()` 或删除整块 DB 死代码；RAG 检索包 `asyncio.to_thread`；补 `analyze`/`chat` 单测。
10. 前端修复错误消费契约（store 改读 `ApiRequestError.message/status`）；`Courses/CourseDetail` 改用统一 `request` 并解包信封；`relax` 用真实 `userStore.user.id` 替代占位。

### 🟡 P2 — 技术债清理（一致性 + 纵深防御）
11. 类型纯净：消除 ~137 处 `any`（优先 AI 返回 DTO、`errors.ts`、`redis.client.ts`）；后端抽 `HttpStatus` 常量。
12. 死代码清理：后端 `config/sqlite.ts`、空 feature-flag；前端 `MoodRecordScript.ts`、store 死分支。
13. 解耦：后端 `activityController` 下沉 repository；统一权限模型为单一权威源；前端合并重复 api 模块、引入 service 层。
14. 测试提标：覆盖率门槛提到函数/行 ≥70%；核心 repository/service 补单测；建立前后端契约测试。
15. nginx：补 CSP/HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy；`/api/` 加 `limit_req`；统一端口 8001、MySQL 端口 3316 到 AI 服务。
16. 文档治理：重写 `README.txt` 目录树、`docs/API.md`，删除不存在文件引用，标注未实现接口。
17. 巨型组件拆分（>1000 行 SFC/store）；静态数据下沉 `constants/`；本地统计计算下沉 `utils/` 纯函数。

---

## 11. 已验证 / 已纠正

- ✅ 后端 `adminUsersUpdateRoleHandler` 确无提权/自改校验（读 `managementController.ts:111-157` 确认）。
- ✅ AI 服务仅 `assistant.py`/`rag.py` 使用 `verify_internal_auth`，`analyze.py`/`chat.py` 无鉴权（grep `routers/` 确认）。
- ✅ 课程路径契约断裂：`app.ts:201` 挂 `/api/courses`，前端请求 `/api/admin/courses`（确认）。
- ✅ advice 端点缺失：后端 `src` 无 `advice` 路由实现（仅死代码表 + 权限种子，确认）。
- ✅ **纠正**：`.env` 已被根 `.gitignore` 正确忽略、未入库（`git check-ignore` 确认），原"无 gitignore 会提交泄露"结论不成立，已降级为密钥管理类 P1。

---

## 12. 交付物清单

| 文件 | 内容 |
|---|---|
| `review_output/CODE_REVIEW_REPORT.md`（本文件） | 主报告：总评 + 评分卡 + 指标 + Top 风险 + 路线图 |
| `review_output/backend.md` | 后端逐文件审查（28 条缺陷表 + 实跑结果） |
| `review_output/frontend.md` | 前端逐文件审查（24 条缺陷表 + 实跑结果） |
| `review_output/ai-service.md` | AI 服务逐文件审查（20 条缺陷表 + ruff/mypy/pytest 实跑） |
| `review_output/cross-cutting.md` | 跨切面：契约 5 项 + 安全 + CI + nginx + 文档 + 配置（20 条缺陷表） |

> 所有结论基于真实读取与实跑，未修改任何源码。下一步建议从 P0 四项（AI 鉴权、后端提权、密钥轮换、内部门禁令牌）切入，1–2 天内可止血。
