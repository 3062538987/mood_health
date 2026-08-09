# AI Development SOP V3 预计修改执行 Plan（基于当前代码）

> 用途：交给能力较低的模型逐项执行。  
> 生成时间：2026-07-19。  
> 唯一现场依据：`D:\桌面\ccooddee` 当前物理目录中的代码、测试和运行结果。旧 PRD、旧报告、旧迁移只能帮助理解历史，发现冲突时必须以当前活动代码和活动 migration runner 为准。  
> 关联证据：`tasks/测试3.0.md`。  
> 本文件是预计修改计划，不代表这些修改已经完成。

## 1. 执行目标与固定边界

目标不是一次性“重构整个项目”，而是按最短可靠链路恢复：

1. 干净数据库可由活动迁移完整创建。
2. 注册/登录/刷新稳定。
3. 心情新增、查阅、更新、删除可用。
4. Node → FastAPI → AI Provider → 结果落库形成唯一、可测试的分析通路。
5. 默认测试命令自包含且可作为门禁。
6. 启动、健康、日志、安全和依赖达到可演示水平。

以下不是本轮默认授权：重做 UI、改产品范围、改论文口径、接入新的云服务、修改生产数据、替换技术栈、批量格式化全仓、使用 `npm audit fix --force`。

## 2. 给执行模型的强制协议

每个模型开始工作前必须完整阅读本 Plan 和 `tasks/测试3.0.md`，然后在回复第一段逐字明确：

- `Task ID`；
- 已满足的依赖 Task；
- 本 Task 允许修改的文件；
- 本 Task 禁止修改的文件；
- 基线命令与验收命令。

执行规则：

1. **一次只执行一个 Task。** 不顺手修相邻问题，不把两个 Task 合并。
2. 先运行该 Task 的基线/失败复现；不能复现时停止并提交证据，不猜修复。
3. 只修改任务卡“允许文件”。发现必须越界时停止，请上级拆新 Task。
4. 测试先行：先增加能暴露缺陷的最小测试，再改实现；不得删测试、跳过测试、降低断言或把 500 改成“预期”。
5. 数据库测试只能使用隔离 DB；不得连接或清空主库。迁移必须同时验证 fresh up、重复 up、必要时 down/up。
6. 不打印 Cookie、密码、AI Key、内部 token、加密密钥；日志/截图需脱敏。
7. 不用全仓自动修复。Ruff、依赖升级、格式化必须按任务允许范围执行。
8. 每个独立小改动完成并验证后提交一个小 commit；commit 只包含本 Task 文件。建议格式：`fix(V3-P0-01): ...` 或 `test(V3-P0-02): ...`。
9. 提交后立即停止，报告：commit hash、修改文件、测试命令、退出码、仍存在风险。不要自行领取下一 Task。
10. 若允许文件已有用户未提交修改，先展示 diff 并停止，不能覆盖、stash、reset 或 checkout 用户改动。

## 3. 已冻结的技术事实

为避免低级模型在冲突文档间自行做架构决定，本轮先固定以下事实：

- 当前业务数据库权威 migration runner 目录是 `mood_health_server/src/db/migrations`；`mood_health_server/migrations` 是遗留参考，不会自动生效。
- 当前心情主表是 `moods`，情绪关联是 `mood_emotions`，标签关联是 `mood_tags`；禁止重新引入 `mood_records`、`mood_record_tags`。
- AI 服务权威开发端口统一为 **8001**。
- 外部浏览器只访问 Node API；Node 是鉴权、授权、数据聚合与审计入口；FastAPI 是 AI 推理服务，不直接暴露给浏览器。
- 心情分析的 Node 侧版本/状态表采用 `mood_analysis_versions`。`analysis_jobs` 当前只有无消费者的 best-effort 写入，不作为新链路权威队列表。
- AI 输出必须遵守现有 Node↔Python contract；不得恢复 contract 明确禁止的 `mood_score`、`confidence` 等字段。
- 未经另行批准，不改变 HttpOnly Cookie 会话方案，也不把 token 放进 localStorage。

## 4. 依赖顺序

| 阶段 | 必须先完成 | 可开始任务 |
|---|---|---|
| A：核心 DB/心情 | 无 | V3-P0-01 |
| A：CRUD 证明 | P0-01 | V3-P0-02、V3-P0-03 |
| B：认证/E2E | 无 | V3-P0-04、V3-P0-05 |
| C：AI 表与接口 | P0-01 | V3-P0-06、V3-P0-07 |
| C：AI 聚合与接线 | P0-06、P0-07 | V3-P0-08、V3-P0-09 |
| D：默认门禁 | P0-02、P0-04、P0-05、P0-09 | V3-P0-10 |
| E：运行环境 | P0-07、P0-09 | V3-P1-01、V3-P1-02 |
| F：质量/安全 | P0 全部 | 其余 P1，之后 P2 |

P0 任务必须串行按依赖验收。P1 中互不重叠文件的任务可以由上级安排并行，但单个低级模型仍只能做一个 Task。

## 5. P0 任务卡

### V3-P0-01：补齐 `moods.include_note` 活动迁移

- **目的**：消除合法心情新增/更新的确定性 500。
- **依赖**：无。
- **允许文件**：新增下一序号 `mood_health_server/src/db/migrations/*include_note*.up.sql`、对应 `.down.sql`；`mood_health_server/tests/unit/db/migrationFiles.test.ts`。
- **禁止文件**：`moodRepository.ts`、旧 `mood_health_server/migrations/*`、前端文件。
- **实现要求**：在活动迁移目录为 `moods` 增加 `include_note TINYINT(1) NOT NULL DEFAULT 0`；up/down 对称；兼容 fresh database，命名和序号遵循当前 0010–0310 约定。
- **验收**：隔离 DB fresh up 后 `DESCRIBE moods` 有该列；`npm --prefix mood_health_server run db:status` 全 applied；重复 migrate 无新增变化；后端 migration 单测通过。
- **提交**：`fix(V3-P0-01): add include_note active migration`。

### V3-P0-02：增加真实心情 CRUD 数据库集成测试

- **目的**：让当前单测无法发现的 schema/SQL 漂移进入自动门禁。
- **依赖**：V3-P0-01。
- **允许文件**：新增 `mood_health_server/tests/integration/moodCrud.integration.test.ts`；必要时新增一个仅供 integration 的 Jest 配置；`mood_health_server/package.json` 仅可修正 `test:integration` 脚本。
- **禁止文件**：业务实现、生产 `.env`、E2E spec。
- **实现要求**：测试真实 MySQL transaction，覆盖 create/list/update/delete；验证情绪、标签、includeNote；每例独立用户或事务回滚；只接受显式测试库环境变量。
- **验收**：`test:integration` 不再指向 `tests/unit`；空库迁移后四项 CRUD 全通过；故意移除列时测试能失败。
- **提交**：`test(V3-P0-02): add mysql mood CRUD integration coverage`。

### V3-P0-03：修正账号删除旧表名与事务

- **目的**：修复 E2E 清理 500 和真实账号注销失败风险。
- **依赖**：V3-P0-01。
- **允许文件**：`mood_health_server/src/repositories/userRepository.ts`、`mood_health_server/tests/unit/repositories/userRepository.test.ts`，以及一个专用删除 integration test（若 P0-02 的基础设施已存在）。
- **禁止文件**：路由/UI/其他 repository。
- **实现要求**：基于当前外键逐项核对删除顺序；使用 `moods`，禁止 `mood_records`；整个多表删除在同一 transaction，异常必须 rollback。
- **验收**：删除测试用户返回成功，相关数据消失且其他用户不受影响；中途模拟失败后所有数据保留；E2E fixture cleanup 不再 500。
- **提交**：`fix(V3-P0-03): make account deletion transactional on current schema`。

### V3-P0-04：修复公开页被 `/auth/me` 401 强制跳登录

- **目的**：游客可正常访问注册页，受保护页仍正确跳登录。
- **依赖**：无。
- **允许文件**：`src/utils/request.ts`、`src/router/guards.ts`、`src/__tests__/utils/request.test.ts`、`src/__tests__/router/guards.test.ts`、`tests/e2e/auth.spec.ts`。
- **禁止文件**：后端 auth/CSRF、Cookie 存储方案、其他页面。
- **实现要求**：全局 401 处理必须知道当前/目标路由是否 public；`/register`、`/login` 的 auth bootstrap 401 不触发二次导航；受保护路由仍带正确 redirect；避免重定向循环。
- **验收**：无登录访问 `/register` 保持在注册页；注册成功按产品现有规则跳转；无登录访问 `/mood/record` 跳登录；相关 Vitest 与 auth E2E 通过；控制台无非预期 error。
- **特别提醒**：`src/utils/request.ts` 当前已有用户未提交修改。执行模型必须先停下确认或由上级先处理所有权，禁止覆盖。
- **提交**：`fix(V3-P0-04): preserve public routes on auth bootstrap 401`。

### V3-P0-05：定位并修复官方 Playwright 会话夹具不一致

- **目的**：消除“官方 runner 401、独立浏览器 200”的矛盾，让 E2E 能可靠判定产品。
- **依赖**：V3-P0-04。
- **允许文件**：`tests/e2e/fixtures/isolatedTest.ts`、`tests/e2e/fixtures/testAccount.ts`、`tests/e2e/global-setup.ts`、`playwright.config.ts`、`tests/e2e/auth.spec.ts`。
- **禁止文件**：产品 auth 实现、将 token 写 localStorage、放宽后端认证。
- **实现要求**：先输出登录响应、浏览器 cookie 元数据、context storage state、服务 baseURL/端口的脱敏证据；确认失败发生在哪一步后再改夹具。不得为了通过测试绕过 UI 登录或伪造 Cookie，除非用例本身明确是预认证 fixture。
- **验收**：auth spec 3/3 稳定通过，连续运行 3 次无 flaky；登录后硬导航和 reload 的 `/auth/me` 均 200；无测试账号残留。
- **提交**：`test(V3-P0-05): stabilize Playwright cookie session fixture`。

### V3-P0-06：把 `mood_analysis_versions` 纳入活动迁移

- **目的**：让当前 Node 分析 API 在干净库中有真实状态表。
- **依赖**：V3-P0-01。
- **允许文件**：新增下一序号 `src/db/migrations/*mood_analysis_versions*.up.sql/.down.sql`（位于 `mood_health_server` 下）；`migrationFiles.test.ts`；可参考但不得直接执行旧 `mood_health_server/migrations/007_create_mood_analysis_versions.sql`。
- **禁止文件**：Controller、FastAPI、旧迁移目录。
- **实现要求**：逐字段对照 `moodAnalysisDataService.ts` 当前 SELECT/INSERT/UPDATE；外键指向当前 `users/moods`；为 user+period+version/status/created_at 常用查询建必要索引；down 对称。
- **验收**：fresh up 创建表；service 的所有 SQL 字段存在；重复 migrate 稳定；migration 单测通过。
- **提交**：`fix(V3-P0-06): add active mood analysis version migration`。

### V3-P0-07：实现 FastAPI `/api/analyze/mood` 最小闭环

- **目的**：使 Node 已声明的 AI endpoint 不再 404。
- **依赖**：可与 P0-06 独立开始，但 P0-09 前必须完成。
- **允许文件**：`mood_health_ai_service/app/main.py`；必要时在 `app/` 新增一个小型 router/service 文件；`tests/test_analyze_mood.py`；现有 contract 测试。
- **禁止文件**：Node 代码、数据库生产配置、真实 key 文件。
- **实现要求**：复用现有 HMAC/internal-token 验证、Pydantic contract、provider abstraction；校验 timestamp/nonce/body hash；无 token、过期、重放、非法 payload 返回明确 4xx；provider 异常映射稳定 5xx；日志不含日记原文和 token。
- **验收**：mock provider 下成功返回 contract 合法结果；401/403、422、provider timeout/error 全有测试；`pytest -q`、Ruff（仅本 Task 文件）、Mypy（仅本 Task 文件）通过。
- **提交**：`feat(V3-P0-07): add authenticated mood analysis endpoint`。

### V3-P0-08：更新 Node 分析聚合 SQL 到当前 schema

- **目的**：让 dispatcher 能从 `moods/mood_emotions/mood_tags` 生成正确请求。
- **依赖**：V3-P0-06。
- **允许文件**：`mood_health_server/src/services/analysisDispatcher.ts`、`mood_health_server/tests/unit/services/analysisDispatcher.test.ts`，可增加一个专用 integration test。
- **禁止文件**：FastAPI、Controller、迁移、其他 AI service。
- **实现要求**：删除所有 `mood_records/mood_record_tags` 引用；按多情绪关系聚合，明确 primary emotion；严格遵守 includeNote，未授权时不得读取/发送 note 明文；日期范围和用户 ID 参数化。
- **验收**：7d/30d、无数据、多情绪、多标签、includeNote true/false 均有测试；SQL 只使用当前表；契约测试通过。
- **提交**：`fix(V3-P0-08): query current mood schema for AI dispatch`。

### V3-P0-09：接通分析状态机并移除无消费者 `analysis_jobs` 写入

- **目的**：形成 Node 创建版本 → FastAPI 分析 → completed/failed 落库的单一路径。
- **依赖**：V3-P0-06、P0-07、P0-08。
- **允许文件**：`moodAnalysisDataService.ts`、`moodAnalysisController.ts`、`moodRepository.ts`、对应 unit/integration tests；若需调用只允许复用 `analysisDispatcher.ts` 或 `fastApiClient.ts`，不得新增第三个客户端。
- **禁止文件**：前端、旧迁移、其他业务域。
- **实现要求**：创建版本后状态从 pending 到 processing，再到 completed/failed；失败保留安全错误摘要；同一请求防重复；删除 `createMood` 中无人消费且静默失败的 `analysis_jobs` 写入，不新建该遗留表；不得吞异常。
- **验收**：mock FastAPI 成功/超时/5xx/非法响应均有状态断言；真实隔离 Node+mock FastAPI 集成通过；心情创建不依赖分析可用性；`POST /api/mood-analyses` 不再因缺表 500。
- **提交**：`fix(V3-P0-09): connect analysis version state machine to FastAPI`。

### V3-P0-10：恢复自包含默认 E2E 门禁

- **目的**：`npm run test:e2e` 不依赖人工先迁移、手填账号或遗留服务。
- **依赖**：V3-P0-02、P0-03、P0-04、P0-05、P0-09。
- **允许文件**：`playwright.config.ts`、`tests/e2e/global-setup.ts`、E2E fixture、`package.json`、现有 5 个 E2E spec；不得改产品代码。
- **实现要求**：global setup 创建/迁移隔离 DB、加载最小种子、准备每 worker 独立账号；performance spec 使用 fixture 账号或由默认命令安全注入；服务必须由配置启动和回收；禁止复用 3000/3001 用户服务。
- **验收**：全新隔离环境运行默认命令，现有 9/9 通过；连续两次通过；结束后 3100/3101 无残留，测试账号被清理；失败时保留 trace/screenshot 且无 secret。
- **提交**：`test(V3-P0-10): make default E2E suite self-contained`。

## 6. P1 任务卡

### V3-P1-01：统一 AI 端口、PM2 名称和健康路径

- **依赖**：P0-07、P0-09。
- **允许文件**：`vite.config.ts`/实际代理配置、`mood_health_server/src/config/aiConfig.ts`、`scripts/start-all.ps1`、`scripts/dev-reset.ps1`、`ecosystem.config.cjs`、`package.json`、相应 config/startup tests。
- **固定值**：AI 8001；Node PM2 名统一为项目认可的 `mood-health-server`；AI 名统一为 `mood-health-ai`；Node 健康路径 `/health`；FastAPI `/api/health` 与 `/api/health/ready`。
- **验收**：全仓活动配置不再残留 AI 8000；start/status/stop/restart 使用同名；PM2 启动后两服务 online，两个健康检查通过。
- **提交**：`fix(V3-P1-01): align ports process names and health checks`。

### V3-P1-02：修复严格 doctor 与 AI 配置诊断

- **依赖**：P1-01。
- **允许文件**：`scripts/doctor.mjs`、`mood_health_ai_service/scripts/doctor.py`、`.env.example` 类模板、对应测试；若不支持 Linux，则 doctor 不应把可选 shell 脚本当 strict failure。
- **要求**：明确 required/optional；识别正确 env 文件加载位置；输出 UTF-8；只显示“已配置/未配置”，不回显值。
- **验收**：完整合法测试 env 下两个 doctor 退出 0；缺 token/key 时明确退出非 0；Windows 中文输出可读。
- **提交**：`fix(V3-P1-02): make runtime doctors authoritative and secret-safe`。

### V3-P1-03：修复 CORS 错误语义与 Request ID 复用

- **依赖**：P0 完成后。
- **允许文件**：`mood_health_server/src/app.ts`、`middleware/errorHandler.ts`、`middleware/requestId.ts`、对应 unit tests。
- **要求**：非法 origin 返回稳定 4xx，不在生产响应泄露内部文本；error handler 使用 `res.locals.requestId`，header/body/log 同一 ID；合法 preflight 不回归。
- **验收**：合法/非法/no-origin 三类集成测试通过；单次错误的 header、body、日志 ID 一致。
- **提交**：`fix(V3-P1-03): normalize CORS errors and request correlation`。

### V3-P1-04：修复未知 API 被认证中间件吞掉

- **依赖**：P0 完成后。
- **允许文件**：`mood_health_server/src/app.ts`、`routes/moodAnalysisRoutes.ts`、`tests/unit/appFactory.test.ts` 或专用路由测试。
- **要求**：将分析 router 挂到具体前缀，或确保 unmatched route 调用 next；已知受保护 endpoint 仍先认证。
- **验收**：未知 `/api/not-a-real-route` 返回 404；未登录已知分析接口返回 401；已登录已知接口按业务返回。
- **提交**：`fix(V3-P1-04): preserve 404 semantics for unknown APIs`。

### V3-P1-05：消除 Jest open handle

- **依赖**：P0 完成后。
- **允许文件**：先用 `--detectOpenHandles` 定位后，只允许修改具体泄漏测试及其直接生命周期实现；不得全局 `forceExit`。
- **要求**：关闭 server、pool、Redis mock、timer、worker；测试中的 fake timer 要恢复。
- **验收**：后端全部 218+ 测试正常退出，无 Jest open handle 警告，墙钟接近真实测试时长。
- **提交**：`test(V3-P1-05): close backend test resources cleanly`。

### V3-P1-06A～06D：Python Ruff/Mypy 分批清零

不得一次全仓自动修复。拆成四个独立 Task，每个模型只做一个：

| ID | 允许范围 | 验收 |
|---|---|---|
| V3-P1-06A | `mood_health_ai_service/app/config.py`、`auth.py`、`main.py` | 范围内 Ruff/Mypy 0，相关 pytest 通过。 |
| V3-P1-06B | `app/db/**`、`app/repositories/**` | 范围内 Ruff/Mypy 0，DB/repository tests 通过。 |
| V3-P1-06C | `app/providers/**`、contracts | 范围内 Ruff/Mypy 0，provider/contract tests 通过；协议字段不擅改。 |
| V3-P1-06D | `eval/**`、`scripts/**`、`tests/**` | 全仓 Ruff 0、Mypy 0、Pytest 全通过。 |

每个 Task 一个独立 commit：`style(V3-P1-06X): clear Python quality gate for <scope>`。

### V3-P1-07A～07C：生产依赖分组升级

禁止 `--force`，每组一个 Task/commit：

| ID | 范围 | 必测 |
|---|---|---|
| V3-P1-07A | 根项目 ECharts/wordcloud 链 | 前端 build、typecheck、图表页面单测、audit production。 |
| V3-P1-07B | 后端 Axios/form-data/follow-redirects | 后端 build、client tests、AI mock integration、audit production。 |
| V3-P1-07C | 后端 Multer/Lodash/rate-limit/path-to-regexp/qs/Morgan | 上传、限流、路由、日志测试与完整后端测试。 |

若升级需要 breaking API，停止并新建 migration Task，不得用 overrides 强压版本后直接交付。

### V3-P1-08：扩充真正 API 集成覆盖

- **依赖**：P0、P1-03、P1-04。
- **允许文件**：仅 `mood_health_server/tests/integration/**` 和测试配置/脚本。
- **按独立子任务拆分**：Auth+Cookie+CSRF；Mood CRUD；Assessment；AI analysis；Admin/RBAC；Upload/download。每个子任务一个 commit，不修改业务实现；测出缺陷后停止并把缺陷退回对应业务 Task。
- **验收**：每个 endpoint 至少 success、validation、unauthorized/forbidden、not-found、dependency-failure 五类中适用项；使用真实路由和隔离 DB。

### V3-P1-09：日志可诊断且不泄密

- **依赖**：P1-03。
- **允许文件**：`mood_health_server/src/utils/logger.ts`、operation logger、错误处理中间件及对应测试；历史生成物是否删除需上级确认。
- **要求**：500 必须记录 request ID、错误类和安全摘要；不得记录密码、Cookie、token、加密 key、完整日记；解决日志文件为空/冲突元数据问题。
- **验收**：注入一次可控 500，响应 ID 能在日志唯一检索；secret scanner/测试确认敏感字段未出现。
- **提交**：`fix(V3-P1-09): make server errors traceable without secrets`。

## 7. P2 优化任务（P0/P1 全绿后执行）

### V3-P2-01：构建循环依赖与大 chunk

先生成 bundle analyzer 证据，再分别处理 `mood.ts ↔ moodAnalysis.ts` 导出环、Vue/Element Plus chunk 环、ECharts 懒加载。每个问题单独 Task/commit；验收为 build 无对应警告、页面行为和性能基线不回退。

### V3-P2-02：前端控制台与测试噪声

只处理未注册 Element Plus stubs、Sass legacy warning、预期错误分支的原始 stack 输出。不得隐藏真实 console error。验收：单测全绿且输出仅保留可行动警告。

### V3-P2-03：大文件分解

按单文件建立独立任务，优先顺序：`src/api/aiModel.ts`、`GroupActivity.vue`、`MoodArchive.vue`、`MoodRecord.vue`、`moodRepository.ts`。每次只抽一个职责，保持公开接口不变，先做 characterization tests；禁止一次跨前后端重构。

### V3-P2-04：性能、兼容与长稳

独立任务分别覆盖 Chromium 重复基线、Firefox、移动 viewport、弱网、API 并发、30–60 分钟长稳。高负载前需上级确认目标环境与速率；未执行的场景继续标风险，不能写“性能通过”。

## 8. 每个任务的统一验收回执模板

执行模型完成后必须按以下格式回复并停止：

```text
Task ID:
结论: 完成 / 阻塞
Commit: <hash；未完成则无>
修改文件:
- <path>
基线复现:
- <command> -> <exit code + 核心失败>
验收证据:
- <command> -> <exit code + passed/failed 数>
未执行测试及原因:
- <明确风险，不得写通过>
剩余问题:
- <不属于本 Task 的问题，只记录，不修改>
```

## 9. 总门禁与停止点

完成 P0 后，上级模型必须做一次只读综合复核，不能让最后一个实现模型自评“P0 全部通过”。复核命令至少包括：

```powershell
npm run doctor:strict
npm run build:all
npm run lint:check
npm run typecheck:all
npm run test:run
npm --prefix mood_health_server run test
npm --prefix mood_health_server run test:integration
python -m ruff check mood_health_ai_service
python -m mypy mood_health_ai_service/app mood_health_ai_service/eval
python -m pytest -q mood_health_ai_service
npm run test:e2e
```

同时必须检查：活动迁移 fresh up、Node `/health`、FastAPI `/api/health/ready`、PM2 status、浏览器 console/network、依赖 audit、日志 request ID。只有全部必要门禁通过，才能开始 P2；任一 P0 回归应退回拥有该文件的 Task，不允许由复核模型顺手修复。

本 Plan 的当前停止点是：**尚未实施任何修复；下一执行任务应从 `V3-P0-01` 开始。**
