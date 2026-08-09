# 大学生情绪健康管理平台 — 最全面修改方案（总览·主编排）

> 依据：`review_output/CODE_REVIEW_REPORT.md`（主报告）+ `backend.md` / `frontend.md` / `ai-service.md` / `cross-cutting.md`（四份逐文件明细）
> 配套深改方案（本文件的「补丁库」，含完整 before/after 代码）：`review_output/REMEDIATION/`
> - `expert_security.md`（安全与鉴权红线）
> - `expert_contract.md`（前后端契约与功能修复）
> - `expert_cicd.md`（CI/CD、nginx、配置与文档治理）
> - `expert_quality.md`（代码质量、解耦、死代码、测试提标）
>
> **交付形态：仅方案文档（不改动源码、不 `git commit`、不写 `dist/`）。** 所有落地补丁以「指令 + 指针」形式给出，均在配套四位专家文件中含可复制的 `before/after` 代码。
> 生成日期：2026-08-08

---

## 〇、本方案怎么用

1. **先读本文**获取全景路线图、优先级、跨文件影响与依赖关系。
2. **改代码时按编号取补丁**：每个发现都标注了 `→ 专家文件 §章节`，打开对应专家文件即可拿到完整 `before/after` 补丁与验证命令。
3. **执行顺序**：严格按「§二 优先级路线图」的 P0→P1→P2 推进；§七给出带依赖关系的推荐执行顺序。
4. **验证**：每个专家文件末尾都有「验证清单」，§八做了汇总对照。

---

## 一、已确认的三项关键决策（来自用户）

| # | 问题 | 决策 | 影响范围 |
|---|---|---|---|
| D-A | 前端已调用 `/api/moods/advice/*`，但后端无实现（M2） | **实现后端接口**（新建 repository + controller + 路由） | 后端 `mood_health_server/`；前端 `src/api/advice.ts` 无需改 URL |
| D-B | AI 服务中存在整块 DB / 迁移死代码（`app/db`、`app/repositories`、`migrations/`、`run_migrations`） | **直接删除死代码**（不给替代实现，附删除清单与核对命令） | AI 服务 `mood_health_ai_service/` |
| D-C | 本次交付形态 | **仅方案文档**（不落地、不提交）；后续可由执行专家按本方案实施 | 全部 |

> 其余争议点（如 advice 字段名 `coverImage`/`coverUrl`、`/ai/` 是否彻底关闭）已在对应专家文件中给出「非阻塞标注 + 推荐处理」，不影响主链路。

---

## 二、优先级路线图（P0→P1→P2，全量发现映射）

### 🔴 P0 — 发布前止血（安全 + 密钥事故响应）

| 发现 | 一句话 | 方案指针 |
|---|---|---|
| **R1** | AI `/api/analyze/mood`、`/api/ai/chat` 零鉴权，可滥用付费 DeepSeek | `expert_security.md §1.1.1` 加 `require_internal_auth` 依赖（复用 `verify_internal_auth` HMAC+Nonce） |
| **R2** | 后端 `admin` 可把任意人（含自己）提权为 `super_admin` | `expert_security.md §1.2` 提权硬约束 + 集成测试 |
| **S1**（密钥） | AI 服务 `.env` 含真实 DeepSeek 密钥明文落盘 | `expert_security.md §1.3` **人工**：吊销/轮换 → 迁入密钥管理 → 清历史 |
| **S3**（弱口令） | 根 `.env` 的 MySQL/Redis 口令弱且重复 | `expert_security.md §1.3` **人工**：`openssl rand` 各组件独立强口令 |
| **R8** | `AI_SERVICE_INTERNAL_TOKEN` 默认空串、两端 `.env` 未设 → 签名恒 401 | `expert_security.md §1.4` 两端设同一强随机 + 启动非空校验 |
| **T2** | `AI_ENABLED` 默认 false，生产形同未启用 | `expert_security.md §1.4` / `expert_cicd.md §3.5` 部署 `.env` 显式 `true` + 日志说明 |

> P0 中 S1/S3 为**人工动作**（吊销密钥、换口令、迁移密钥管理），AI 本体不自动执行；其余为代码改动。预计 1–2 天止血。

### 🟠 P1 — 本迭代必须（契约 + CI + 加固）

| 发现 | 一句话 | 方案指针 |
|---|---|---|
| **M1** | 课程管理前端请求 `/api/admin/courses`，后端只挂 `/api/courses` → 404 | `expert_contract.md §1.1` 后端 `managementRoutes` 复用 `courseController` + 信封化 courseController |
| **M2** | 情绪建议 `advice/save`、`advice/history` 后端无实现（D-A 决定实现） | `expert_contract.md §1.2` 新建 `adviceRepository`/`adviceController` + 路由注册 |
| **M3** | 前端 DELETE `/api/mood-analyses/:id`，后端无 DELETE 路由 | `expert_contract.md §1.3` 后端补 `deleteAnalysis` + handler + 路由 |
| **M4** | 前端用 `sessionId`、后端用 `:id`（非断裂，命名不一致） | `expert_contract.md §1.4` 后端路由改 `:sessionId` |
| **R5/N1** | `/ai/` 公网暴露且无鉴权，叠加 R1 可滥用 | `expert_security.md §2.5` / `expert_cicd.md §2.5` 生产关闭公网 `/ai/` 或内网白名单+mTLS |
| **R6** | Redis 不可用时暴破防护被静默关闭（降级误用） | `expert_security.md §2.1` `executeSecure` fail-closed + 登录锁拒绝放行 |
| **R7** | AI 限流只配置不生效 | `expert_security.md §2.2` 后端 AI 入口 per-user/IP 令牌桶（Redis Lua + 内存兜底） |
| **AI#5** | analyze/chat 无速率限制 | `expert_security.md §1.1.2` AI 侧 `slowapi`=`30/minute` |
| **AI#7** | nonce 重放 Redis 不可用时降级放行 | `expert_security.md §2.3` fail-closed 拒绝 |
| **AI#9** | 异常原文回吐客户端 | `expert_security.md §2.4` 仅记日志、通用文案 |
| **AI#16** | chat 无系统提示/注入防护 | `expert_security.md §1.1.3` `CHAT_SYSTEM_PROMPT` + 丢弃调用方 system + 内容审核 |
| **R9/C1** | 无 CI 门禁 | `expert_cicd.md §一` 新建 `.github/workflows/ci.yml`（构建/类型/测试 + secret-scan + 依赖审计） |
| **R10/N5** | 生产 nginx 仅 80 明文无 TLS | `expert_cicd.md §2.3` 443+TLS + 80→443 + HSTS |
| **N2/T5** | AI 端口漂移（默认 8000 ≠ 实际 8001） | `expert_cicd.md §2.4` 三处统一 8001 |
| **N3** | 缺安全响应头（CSP/HSTS/X-Frame…） | `expert_cicd.md §2.1` 两 conf 所有 server 块补头 |
| **N4** | 缺速率限制 | `expert_cicd.md §2.2` `limit_req_zone` + `/api/` 与登录路由限流 |
| **T4** | MySQL 端口漂移（3316 vs AI 默认 3306） | `expert_cicd.md §3.1` 全仓显式 3316 |
| **T6** | `.env.example` 不同步 / AI 无 example | `expert_cicd.md §3.2/.3.3` 重写根 example + 新建 AI example |
| **R13** | 前端 store 读 `err.response?.data?.message`（ApiRequestError 无 `.response`）→ 吞错 | `expert_contract.md §2.1` 统一 `getErrorMessage/getErrorStatus/isApiRequestError` + 改 4 文件 |
| **R14** | 课程页裸 `fetch` 未解包信封、未带凭证 → 渲染损坏 | `expert_contract.md §2.2` 改用统一 `request` |
| **#13(relax)** | `relaxStore` 用 `'current-user-id'` 占位 → 离线分支不可达 | `expert_contract.md §2.3` 复用 `useUserStore` |
| **#5(feature)** | `.env` 变量名 `VITE_FEATURE_NON_CORE_MODULES_ENABLED` 错配 | `expert_contract.md §2.4` 统一为 `VITE_FEATURE_NON_CORE_MODULES` |
| **R11/D-B** | AI DB 死代码（D-B 决定删除） | `expert_quality.md §3.3` 删除清单 + 核对命令 |
| **R12** | AI 请求期同步重检索阻塞事件循环 | `expert_quality.md §5.1` `await asyncio.to_thread(...)` |
| **#6(AI 测试)** | analyze/chat 零测试 | `expert_quality.md §6.2` router 测试 + FakeProvider |

### 🟡 P2 — 技术债清理（一致性 + 纵深防御）

| 发现 | 一句话 | 方案指针 |
|---|---|---|
| **#10(any)** | 后端 93 / 前端 44 处 `any` | `expert_quality.md §1.1` 泛型化 `errors.ts`/`redis.client.ts`/`analysisDispatcher` + 新增 `contracts/aiResponse.ts` |
| **#11(HttpStatus)** | 263 处魔法 HTTP 状态码 | `expert_quality.md §1.2` 抽 `utils/httpStatus.ts` + 批量替换 |
| **#8/#9** | `activityController` 越层直连 DB 写统计 SQL | `expert_quality.md §2.1` 统计下沉 `activityRepository.getStats` |
| **#13(perms)** | 权限模型双份定义（代码 + 库表） | `expert_quality.md §2.2` 以 DB 为权威，代码仅作 seed |
| **#19/#20** | 鉴权散落路由层、守卫不验签 | `expert_quality.md §2.3` `app.ts` 全局 `authenticate` + 守卫先 `ensureAuthenticated` |
| **#15/#6(swallow)** | 吞错 / decrypt 失败返回密文 | `expert_quality.md §2.4` 抛 `DatabaseError`；`decrypt` 失败抛错 |
| **#12(sqlite/flag)** | 后端 `config/sqlite.ts` + 空 feature-flag 死代码 | `expert_quality.md §3.1/.2` 删除 + grep 核对 |
| **#7/#10/#14/#22** | 前端死代码（`MoodRecordScript.ts` 等） | `expert_quality.md §3.4` 删除 + 死分支清理 |
| **#13(aiModel)** | 后端 `aiModel.ts` 1682 行 god-file | `expert_quality.md §4.1` 按域拆分 `models/ai/` |
| **#21/#24/#16** | 巨型 SFC/Store（>1000 行） | `expert_quality.md §4.2` 拆组件 + 常量下沉 `constants/` + 本地统计下沉 `utils/` |
| **#19(role)** | 前端角色常量双定义 | `expert_quality.md §4.3` 集中 `constants/roles.ts` |
| **#8(provider名)** | provider 标注 openai/deepseek 不一致 | `expert_quality.md §5.2` 统一 `PROVIDER_NAME` |
| **#10(provider单例)** | provider 每次 new，无 DI | `expert_quality.md §5.3` `lru_cache` 单例 + `Depends` 注入 |
| **#11/#17(RAG)** | RAG 未应用阈值、失败抛 500 | `expert_quality.md §5.4` 阈值过滤 + 降级兜底 |
| **#18/#20(env)** | `os.getenv` 绕过集中 Settings | `expert_quality.md §5.5` 统一 `get_settings()` |
| **#12(eval)** | `tests/eval/` 遮蔽内置 `eval` | `expert_quality.md §5.6` 重命名 `tests/evaluation/` |
| **#14(doctor)** | `doctor.py` 的 `.env` 路径算错 | `expert_quality.md §5.7` 以 AI 服务实际工作目录为准 |
| **#13(rag test)** | `test_rag_service.py` 依赖仓库外 `agent_app` | `expert_quality.md §5.8` 改用仓库内 `app.rag` |
| **#23/#24/#25** | 集成测试极薄、覆盖率门槛仅 45% | `expert_quality.md §6.1` 补集成测试 + 覆盖率门槛 ≥70% + repository 单测 |
| **D1/D2** | `README.txt` 目录树旧、失效引用 | `expert_cicd.md §4.1/.2` 重写目录树 + 修/补 `DEPLOYMENT.md` |
| **#6/#8/#17(fe arch)** | 前端 `activity.ts`/`activityApi.ts` 重复、缺 service 层 | `expert_contract.md §3` 合并 + 引入 `services/*` 薄层 |

---

## 三、P0 详细方案摘要（止血优先）

### 3.1 AI 接口 HMAC 鉴权（R1 + AI#5 + AI#16）
- **改动**：在 `analyze.py`/`chat.py` 路由装饰器加 `Depends(require_internal_auth)`（复用 `app/auth.py` 的 `verify_internal_auth`）。新增 `app/ratelimit.py`（`slowapi` 令牌桶，每 IP `30/minute`）。`openai_compatible.py` 注入不可覆盖的 `CHAT_SYSTEM_PROMPT`，丢弃调用方传入的 `system` 角色，命中高危关键词拦截。
- **风险**：Node 端 `analysisDispatcher`/`callChatCompletion` 已带 HMAC 头，无需改调用；AI 侧 `assistant/rag` 已鉴权，不影响。
- **完整补丁**：`expert_security.md §1.1.1 / §1.1.2 / §1.1.3`。

### 3.2 后端提权硬约束（R2）
- **改动**：`managementController.ts:111-157` 增加：① 仅 `super_admin` 可分配 `super_admin`；② `admin` 目标角色限 `user/admin`；③ 禁止自改角色；④ `super_admin` 不可自降级（防锁死）。建议在 `managementService.updateUserRole` 内再加一层防御。
- **验证**：补集成测试 `roleEscalation.test.ts`（admin→他人 super_admin=403、→他人 admin=200、自提权=403）。
- **完整补丁**：`expert_security.md §1.2`。

### 3.3 密钥事故响应（S1 / S3，人工，AI 不自动执行）
- **S1**：登录 DeepSeek 控制台 **Revoke** 泄露 Key → 生成新 Key → 迁移到 Vault/密钥管理/加密 `.env` → 清历史（`git filter-repo`/`BFG`）→ `.gitignore` 确认含 `.env` + 加 `gitleaks` pre-commit。
- **S3**：`openssl rand -base64 24` 各组件独立强口令；MySQL `ALTER USER` + 独立 `mood_app` 账号；Redis `requirepass` + 内网 `bind` + 关公网 6379。
- **完整步骤**：`expert_security.md §1.3`。

### 3.4 内部门禁令牌 + AI 开关（R8 + T2）
- **改动**：两端 `.env` 设同一强随机 `AI_SERVICE_INTERNAL_TOKEN`；后端 `app.ts validateEnv()` 在 `AI_ENABLED=true` 时校验非空；AI `config.py` 用 `field_validator` 启动校验非空（否则拒绝启动）。部署 `.env` 显式 `AI_ENABLED=true`。
- **完整补丁**：`expert_security.md §1.4`。

---

## 四、P1 详细方案摘要（契约 + CI + 加固）

### 4.1 契约断裂修复（M1/M2/M3/M4）
- **M1**：后端 `managementRoutes.ts` 新增 `/admin/courses`（复用 `courseController`），并先给 `courseController` 所有响应包 `apiSuccess` 信封（前端 `request` 拦截器强制要求信封）。前端 URL 不变。⚠️ 非阻塞：`AdminCoursePayload.coverImage` vs 后端 `coverUrl` 需对齐。
- **M2**：新建 `repositories/adviceRepository.ts`、`controllers/adviceController.ts`；`moodRoutes.ts` 注册 `POST /advice/save`、`GET /advice/history`（需 `mood.advice.history.read`，已种子化）。前端 `advice.ts` 无需改。
- **M3**：后端补 `deleteAnalysis`（service）+ `deleteAnalysisHandler` + `router.delete('/mood-analyses/:id')`（仅本人或 super_admin）。前端无需改。
- **M4**：后端路由 `:id` → `:sessionId`（counseling/knowledgeAssistant），控制器取参同步改；前端已用 `sessionId` 无需改。
- **完整补丁**：`expert_contract.md §1.1–§1.4`。

### 4.2 前端错误契约与裸 fetch（R13/R14/#13/relax/#5）
- 新增 `getErrorMessage/getErrorStatus/isApiRequestError` 导出并改 `moodStore.ts`、`moodRecordStore.ts`、`mood.ts`、`moodAnalysis.ts` 的错误消费（读 `ApiRequestError.message/status` 而非 `err.response?.data?.message`）；删 `mood.ts` 重复 `shouldRetryLegacy`。
- `Courses.vue`/`CourseDetail.vue` 改用统一 `request`（自动 cookie/CSRF/解包信封）。
- `relaxStore.ts` 用 `useUserStore().user?.id` 替换 `'current-user-id'` 占位。
- `.env` 变量名统一 `VITE_FEATURE_NON_CORE_MODULES`。
- **完整补丁**：`expert_contract.md §2.1–§2.4`。

### 4.3 后端安全加固（R6/R7/AI#7/AI#9）
- `redis.client.ts` 新增 `executeSecure`（安全控制 Redis 不可用时抛错）；`authService.login` 锁 fail-closed（拒绝登录）。
- 后端 AI 入口加 per-user/IP 令牌桶（`utils/ai/rateLimiter.ts`，Redis Lua + 内存兜底，消费 `aiConfig.rateLimit`）。
- AI `auth.py verify_nonce` fail-closed；四处路由异常仅记日志、返回通用文案。
- **完整补丁**：`expert_security.md §2.1–§2.4`。

### 4.4 CI/CD（R9/C1）
- 新建 `.github/workflows/ci.yml`（frontend/backend/ai 三子系统 build→typecheck→test；`secret-scan` 用 gitleaks+trufflehog；`dependency-audit` 用 `npm audit`/`pip-audit`；`gate` 汇总门禁）。
- 注意：后端需补提交 `package-lock.json`；`dependency-audit` 后端行临时 `|| true`，修复后移除。
- **完整配置**：`expert_cicd.md §一`（含完整 yaml）。

### 4.5 nginx / TLS / 端口 / 配置（N1/N2/N3/N4/N5/T4/T5/T6）
- `nginx.linux.conf` 重写为 443+TLS+80→443+HSTS；两 conf 所有 server 块补安全头（CSP 需 `style-src 'self' 'unsafe-inline'` 兼容 Element Plus/ECharts）；`/api/` 与登录路由 `limit_req`。
- AI upstream 三处统一 `8001`（`nginx.conf`/`vite.config.ts`/`aiConfig.ts`）。MySQL 端口全仓显式 `3316`。
- 重写根 `.env.example` + 新建 AI `.env.example`；建议新增 `scripts/config-doctor.*` 自检脚本。
- **完整配置**：`expert_cicd.md §2.1–§3.4`。

### 4.6 AI 质量（R11/R12/#6 测试，D-B 删除）
- 删除 `app/db/*`、`app/repositories/*`、`migrations/`、`tests/test_db.py`、`tests/test_analysis_task_repository.py`（D-B 决定删除；附 grep 核对命令）。
- `assistant/service.py`、`rag/service.py` 检索包 `await asyncio.to_thread(...)`。
- 补 `test_analyze_router.py`/`test_chat_router.py`/`test_assistant_router.py`（FakeProvider）。
- **完整补丁**：`expert_quality.md §3.3 / §5.1 / §6.2`。

---

## 五、P2 详细方案摘要（技术债）

> 全部为「方向 + 删除/重构清单 + 验证命令」，完整补丁见 `expert_quality.md`/`expert_contract.md §3`/`expert_cicd.md §4`。要点：
- 类型纯净：`errors.ts` 泛型、`redis.client.ts` 收窄、`analysisDispatcher` 用 `RowDataPacket`、新增 `contracts/aiResponse.ts`;`HttpStatus` 常量替代 263 处魔法数字。
- 解耦：`activityController` 统计下沉 repository；权限模型收敛为 DB 单一权威；`app.ts` 全局 `authenticate`；`decrypt` 失败抛错、`achievementRepository` 抛 `DatabaseError`。
- 死代码：后端 `config/sqlite.ts` + 空 feature-flag；前端 `MoodRecordScript.ts` + store 死分支；前端角色常量集中 `constants/roles.ts`。
- 巨型拆分：`GroupActivity.vue`/`MoodArchive.vue`/`MoodRecord.vue`/`moodRecordStore.ts` 拆组件；常量下沉 `constants/`；本地统计下沉 `utils/relaxStats.ts` 纯函数。
- AI provider 单例 DI + 统一 `PROVIDER_NAME` + RAG 阈值/降级；`os.getenv` 收敛 `get_settings()`；`tests/eval`→`evaluation`；`doctor.py` 修正 `.env` 路径；`test_rag_service` 去除 `agent_app` 依赖。
- 测试提标：覆盖率门槛函数/行 ≥70%；核心 repository/service 补单测；建立契约测试。
- 文档：`README.txt` 目录树重写 + 修/补 `DEPLOYMENT.md`。

---

## 六、跨文件影响矩阵（落地前必读）

| 文件 | 改动性质 | 关联发现 | 注意 |
|---|---|---|---|
| `mood_health_ai_service/app/routers/analyze.py` | 加鉴权依赖 + 限流 + 通用错误 | R1, AI#5, AI#9 | 调用方已带 HMAC，无需改 |
| `mood_health_ai_service/app/routers/chat.py` | 加鉴权 + 长度护栏 + 系统提示 + 通用错误 | R1, AI#5, AI#16, AI#9 | 同上 |
| `mood_health_ai_service/app/providers/openai_compatible.py` | 注入 `CHAT_SYSTEM_PROMPT` + 内容审核 + 统一 `PROVIDER_NAME` | AI#16, #8 | 仅 chat 路径 |
| `mood_health_ai_service/app/auth.py` | `verify_nonce` fail-closed | AI#7 | 依赖 Redis 高可用 |
| `mood_health_ai_service/app/config.py` | 令牌非空校验 | R8 | 启动即失败 |
| `mood_health_ai_service/app/db`、`app/repositories`、`migrations/`、`tests/test_db.py`、`tests/test_analysis_task_repository.py` | **删除** | R11, D-B | 删除前 grep 确认无 router 引用 |
| `mood_health_ai_service/app/*.service.py`、`app/rag/retriever.py` | `asyncio.to_thread` + RAG 阈值/降级 | R12, #11/#17 | 测试同步改 |
| `mood_health_server/src/controllers/managementController.ts` | 提权硬约束 | R2 | 补集成测试 |
| `mood_health_server/src/services/authService.ts`、`utils/redis.client.ts` | 登录锁 fail-closed + `executeSecure` | R6 | 普通缓存仍用 `execute` |
| `mood_health_server/src/utils/ai/rateLimiter.ts`（新） | per-user/IP 令牌桶 | R7 | 消费 `aiConfig.rateLimit` |
| `mood_health_server/src/app.ts` | `validateEnv` 令牌校验 + 全局 `authenticate` + 删空 feature-flag | R8, #19/#20, #12 | 路由层鉴权收敛 |
| `mood_health_server/src/config/aiConfig.ts` | 默认端口 8001；`AI_ENABLED` 说明 | T2/N2, #19 | 默认 false（安全兜底） |
| `mood_health_server/src/controllers/courseController.ts` | 统一信封 | M1 | 前端 `request` 依赖 |
| `mood_health_server/src/routes/managementRoutes.ts` | 新增 `/admin/courses` | M1 | 复用 courseController |
| `mood_health_server/src/repositories/adviceRepository.ts`、`controllers/adviceController.ts`（新） | 实现 advice | M2, D-A | — |
| `mood_health_server/src/routes/moodRoutes.ts` | 注册 advice + DELETE mood-analyses | M2, M3 | — |
| `mood_health_server/src/routes/moodAnalysisRoutes.ts` + service/controller | DELETE 路由 | M3 | — |
| `mood_health_server/src/routes/counselingRoutes.ts`、`knowledgeAssistantRoutes.ts` + controller | `:sessionId` | M4 | 前端无需改 |
| `mood_health_server/src/utils/errors.ts`、`redis.client.ts`、`services/analysisDispatcher.ts` | 去 `any` | #10 | — |
| `mood_health_server/src/utils/httpStatus.ts`（新） | 状态码常量 | #11 | 批量替换 |
| `mood_health_server/src/controllers/activityController.ts` + `repositories/activityRepository.ts` | 统计下沉 | #8/#9 | — |
| `mood_health_server/src/middleware/auth.ts` | 权限模型收敛 + 守卫验签 | #13, #19/#20 | DB 为权威 |
| `mood_health_server/src/repositories/achievementRepository.ts`、`utils/encryption.ts` | 抛错不吞 | #15/#6 | — |
| `mood_health_server/src/config/sqlite.ts`（删）+ `middleware/featureFlag.ts`（删） | 死代码 | #12 | grep 核对 |
| `src/stores/moodStore.ts`、`moodRecordStore.ts`、`api/mood.ts`、`api/moodAnalysis.ts` | 统一错误消费 | R13, #13 | 新增 3 导出函数 |
| `src/views/improve/Courses.vue`、`CourseDetail.vue` | 改用 `request` | R14, #3/#4 | — |
| `src/stores/relaxStore.ts` | 真实 `userId` | #13(relax) | 复用 userStore |
| `src/views/mood/MoodRecordScript.ts`（删）、`constants/`、`utils/relaxStats.ts` | 死代码 + 常量下沉 | #7/#10/#14/#22, #16, #19 | — |
| `.github/workflows/ci.yml`（新） | CI 门禁 | R9, C1 | 需补后端 lock |
| `nginx.conf`、`nginx.linux.conf` | 安全头 + 限流 + TLS + 端口 8001 + `/ai/` 收敛 | N1–N5, T5 | 需证书 |
| `.env.example`（根重写）、`mood_health_ai_service/.env.example`（新） | 同步配置 | T4, T6 | 铁律：真实 `.env` 不入库 |
| `README.txt`、`DEPLOYMENT.md`（修/补） | 目录树 + 失效引用 | D1, D2 | — |

---

## 七、推荐执行顺序（带依赖）

```
阶段 0（人工·可与编码并行）：
  - S1 吊销/轮换 DeepSeek Key；S3 换强口令；密钥迁入密钥管理
  - 申请/放置 TLS 证书（P1 nginx 用）

阶段 1（P0 止血，约 1–2 天）：
  ① R8/T2  两端 .env 设 AI_SERVICE_INTERNAL_TOKEN + 启动非空校验 + AI_ENABLED 显式 true
  ② R1     AI analyze/chat 加 require_internal_auth（依赖①令牌生效）
  ③ R2     后端 managementController 提权硬约束 + roleEscalation 集成测试
  ④ AI#5   AI 侧 slowapi 限流（依赖②）

阶段 2（P1 契约 + 加固，约 3–5 天）：
  ⑤ M1     courseController 信封化 → managementRoutes 加 /admin/courses（依赖信封化）
  ⑥ M2     advice repository/controller/路由（D-A）
  ⑦ M3     mood-analyses DELETE
  ⑧ M4     :sessionId 统一
  ⑨ R13/R14/#13/relax/#5  前端错误契约 + 裸 fetch + relax userId + feature flag（可与⑤⑧并行）
  ⑩ R6/R7/AI#7/AI#9  后端 Redis fail-closed + AI 限流 + nonce fail-closed + 异常不回吐
  ⑪ R9    .github/workflows/ci.yml（依赖锁文件齐备）

阶段 3（P1 部署配置，约 1–2 天）：
  ⑫ N1–N5/T4/T5/T6  nginx 重写 + 端口/MySQL 统一 + .env.example 同步 + config-doctor
  ⑬ R11/D-B  AI DB 死代码删除（grep 核对 → 删 → pytest 绿）
  ⑭ R12/#6   AI asyncio.to_thread + analyze/chat 测试

阶段 4（P2 技术债，持续）：
  ⑮ #10/#11  去 any + HttpStatus 常量
  ⑯ #8/#9/#13/#15/#6/#19/#20  解耦 + 权限收敛 + 全局鉴权 + 吞错修复
  ⑰ #12/#7/#14/#22/aiModel/#21/#16/#19(fe)  死代码 + 巨型拆分 + 常量下沉
  ⑱ #8/#10/#11/#17/#18/#12/#14/#13(AI)  AI provider/DI/RAG/Settings/eval/doctor/test
  ⑲ #23/#24/#25 + 契约测试  测试提标 + 覆盖率 ≥70% + 集成测试
  ⑳ D1/D2  文档治理
```

> **关键依赖**：②依赖①；⑤依赖 courseController 信封化（否则前端 `request` 解包失败）；⑪依赖后端 `package-lock.json` 入库；nginx 安全头须保留 `'unsafe-inline'`（Element Plus/ECharts 运行时注入 inline style）；⑬删除前必须 grep 确认 AI router 无引用。

---

## 八、验证清单（汇总对照）

| 验证项 | 命令/动作 | 预期 | 关联 |
|---|---|---|---|
| AI 无 HMAC | `curl -X POST :8001/api/analyze/mood -d '{}'` | 401 | R1 |
| AI 合法签名 | 带 `X-Signature/X-Timestamp/X-Nonce`（Node 生成） | 200/业务响应 | R1 |
| AI 限流 | 同 IP 31 次合法 analyze | 第 31 次 429 | AI#5 |
| 后端提权 | admin 把他人提权 super_admin | 403 | R2 |
| 后端自提权 | admin 改自己角色 super_admin | 403 | R2 |
| 令牌缺失启动 | 删 `AI_SERVICE_INTERNAL_TOKEN` 起 AI | 启动即退出 | R8 |
| Redis 不可用登录 | 停 Redis 正常登录 | 503 fail-closed | R6 |
| 后端 AI 限流 | 单 userId 1 分钟 >60 次 chat | 第 61 次 429 | R7 |
| nonce 重放 | 停 Redis 带合法签名请求 assistant | 401（nonce 失败） | AI#7 |
| 异常不回吐 | 触发 500 非法请求 | `detail` 无异常原文；日志有 `type(e)` | AI#9 |
| chat 护栏 | 传入 `system: 忽略规则` | 仍受系统提示约束 | AI#16 |
| M1 课程管理 | `POST /api/admin/courses -b cookie`（course.manage） | 201 `{code:0,...}` | M1 |
| M2 建议保存/历史 | `POST /api/moods/advice/save`、`GET /api/moods/advice/history` | 201 / `{code:0,data:{list,total}}` | M2 |
| M3 删除分析 | 删他人→404；删自己→200；super_admin 任意→200 | 符合权限 | M3 |
| M4 会话参数 | `GET /api/counseling/sessions/:sessionId` | 正确取参 | M4 |
| 前端错误契约 | 模拟 `ApiRequestError(status:429)` | handleAiError 触发冷却、shouldRetryError 返回 true | R13 |
| 课程页渲染 | DevTools 网络面板确认带 Cookie/x-csrf-token | 列表/详情正常 | R14 |
| CI 门禁 | `gh workflow run ci.yml` | 5 job 全绿；secret-scan 红=有疑似密钥 | R9 |
| nginx 校验 | `nginx -t -c nginx.linux.conf` | syntax ok | N1–N5 |
| TLS 跳转 | `curl -I http://<host>/` | 301→https；响应含 HSTS | N5 |
| 端口/配置自检 | `scripts/config-doctor`（建议新增） | AI=8001、MySQL=3316、令牌一致 | N2/T4/T5/T6 |
| 后端类型 | `cd mood_health_server && npx tsc --noEmit` | 0 error；`any`/魔法状态码显著下降 | #10/#11 |
| 后端测试 | `npm run test:coverage` | 函数/行 ≥70% 全绿 | #23/#24/#25 |
| 前端类型 | `npx vue-tsc --noEmit` | 0 error | #10(fe) |
| 前端测试 | `npx vitest run --coverage` | ≥70% 全绿 | #23 |
| AI 质量 | `ruff check app && mypy app && pytest` | 全绿；无 agent_app/db 悬挂引用 | R11/R12/#6 |
| AI 死代码删除 | `grep -rn "app.db|app.repositories|run_migrations" app/ tests/` | 空（除已删测试） | R11/D-B |

---

## 九、交付物清单

| 文件 | 角色 |
|---|---|
| `review_output/CODE_REVIEW_REPORT.md` | 主审查报告（总评/评分/Top 风险/路线图） |
| `review_output/backend.md` / `frontend.md` / `ai-service.md` / `cross-cutting.md` | 四份逐文件缺陷明细 |
| `review_output/REMEDIATION/expert_security.md` | 安全与鉴权补丁库（R1/R2/R6/R7/R8/T2/AI#5/#7/#9/#16/S1/S3/N1/N5/N6） |
| `review_output/REMEDIATION/expert_contract.md` | 契约与功能补丁库（M1–M4/#1–#5/#13/#15/#17/#23 + D3） |
| `review_output/REMEDIATION/expert_cicd.md` | CI/nginx/配置/文档补丁库（C1/N1–N5/T2/T4/T5/T6/D1/D2） |
| `review_output/REMEDIATION/expert_quality.md` | 质量/解耦/死代码/测试补丁库（#6–#25 大部分 + R11/R12） |
| **`review_output/REMEDIATION_PLAN.md`（本文件）** | **总编排：决策 + 优先级路线图 + 影响矩阵 + 执行顺序 + 验证汇总** |

---

## 十、重要提醒（落地前必读）

1. **S1/S3 是人工动作**：吊销密钥、换口令、迁移密钥管理必须由人执行，本方案不自动执行；真实 `.env`、证书、私钥**绝不入库**（`.gitignore` 已含 `.env`，CI 用 Encrypted Secrets 注入）。
2. **删死代码先 grep 核对**：尤其 AI DB 层（R11/D-B）与后端 sqlite（#12），删除前/后确认无 router 引用、架构测试与 `pytest`/`tsc` 仍绿。
3. **CSP 兼容**：nginx 安全头的 `style-src` 必须含 `'unsafe-inline'`，否则 Element Plus/ECharts 组件样式丢失。
4. **AI 端口铁律**：AI 服务固定 8001，所有上游/代理/默认回退统一指 8001；MySQL 端口全仓显式 3316。
5. **默认安全兜底**：`AI_ENABLED` 默认 false 是刻意的——生产必须显式 `true`；`AI_SERVICE_INTERNAL_TOKEN` 空串即拒绝启动 AI 能力。
6. **测试前先补锁文件**：后端 `package-lock.json` 需入库，否则 CI `npm ci` 失败。
7. **本方案未改动任何源码、未提交、未写 `dist/`**，全部为可执行的指令与补丁指针。
