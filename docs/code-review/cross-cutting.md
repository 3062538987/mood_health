# 跨切面审查报告

> 审查对象：`D:\桌面\ccooddee`（大学生情绪健康管理平台，三件套单体仓库）
> 前端（仓库根 `src/api`）+ 后端（`mood_health_server/src/routes`）+ AI 服务（`mood_health_ai_service/app/routers`）
> 审查性质：**只读分析 + 仅写本报告**。未修改任何源码，未执行 git commit。
> 审查日期：2026-08-08

---

## 一、接口契约一致性（不匹配清单）

### 1.1 后端路由挂载前缀（来自 `mood_health_server/src/app.ts`）

| 前缀 | 路由模块 | 行号 |
|---|---|---|
| `/api/auth` | authRoutes | app.ts:183 |
| `/api/moods` | moodRoutes | app.ts:184 |
| `/api/questionnaires` | questionnaireRoutes | app.ts:185 |
| `/api/audit` | auditRoutes | app.ts:193 |
| `/api/cases` | caseRoutes | app.ts:194 |
| `/api/prompts` | promptRoutes | app.ts:195 |
| `/api/ai` | aiInterpretationRoutes + aiHistoryRoutes | app.ts:196-197 |
| `/api/activities` `/api/posts` `/api/music` `/api/courses` `/api/relax` `/api/achievements` | 各 Routes（均经 `requireNonCoreModules`） | app.ts:198-203 |
| `/api/recommend` | recommendRoutes | app.ts:204 |
| `/api`（兜底） | feedbackRoutes / managementRoutes / moodAnalysisRoutes | app.ts:205-207 |
| `/api/counseling` | counselingRoutes | app.ts:208 |

前端请求统一走 `src/utils/request.ts`（`axios`，`withCredentials: true`，非安全方法自动带 `x-csrf-token`）。鉴权为 **HttpOnly Cookie（`auth_token`）+ CSRF 双提交**，前端不发送 `Authorization` 头（与 `middleware/auth.ts:282` 优先读 cookie 一致）。

### 1.2 不匹配 / 可能断裂的接口（逐项 file:line）

| # | 前端调用（file:line） | 方法/路径 | 后端实际路由 | 结论 |
|---|---|---|---|---|
| M1 | `src/api/admin.ts:124,141,149,157` | GET/POST/PUT/DELETE `/api/admin/courses*` | `courseRoutes` 挂载于 `/api/courses`（app.ts:201），路径为 `/`、`/:id`、`/`、`/:id`、`/:id`；`managementRoutes` 无 `/admin/courses` | **断裂**：4 个课程管理接口全部 404，课程管理后台完全不可用 |
| M2 | `src/api/advice.ts:41,59`（被 `src/api/mood.ts:16` 引入、`src/views/mood/MoodRecordScript.ts:8` 使用，并有测试 `src/__tests__/api/advice.test.ts:26,82,94`） | POST `/api/moods/advice/save`、GET `/api/moods/advice/history` | `moodRoutes.ts` 无任何 `/advice/*`；全仓 grep `advice` 仅命中 DB 表 `advice_history`（`config/sqlite.ts:122`）与权限种子 `mood.advice.history.read`（`middleware/auth.ts:29`、种子 `coreSeed.ts:84`），**无控制器/路由** | **断裂**：接口未实现却已被前端与测试依赖，调用即 404 |
| M3 | `src/api/moodAnalysis.ts:162` | DELETE `/api/mood-analyses/:id` | `moodAnalysisRoutes.ts` 仅定义 POST `/mood-analyses`、GET `/latest`、GET `/mood-analyses`、GET `/:id`、POST `/:id`（`runAnalysis`），**无 DELETE** | **断裂**：删除分析功能 404 |
| M4 | `src/api/counseling.ts:172` `GET /api/counseling/sessions/${sessionId}`；`src/api/knowledgeAssistant.ts:48` `GET /api/knowledge-assistant/sessions/${sessionId}/messages` | GET | 后端 `counselingRoutes.ts:17` `/sessions/:id`；`knowledgeAssistantRoutes.ts:18` `/sessions/:id/messages` | **非断裂（命名不一致）**：Express 忽略参数名，`req.params.id` 可取；但前端用 `sessionId`、后端用 `id`，契约命名不统一，易在重构时踩坑 |
| M5 | `src/api/questionnaire.ts:76-82` 提交 `questionnaire_id`、`answers[].itemId` | POST `/api/questionnaires/assessments` | `questionnaireRoutes.ts:26-36` 校验 `questionnaire_id`、`answers.*.itemId` | **对齐**：字段命名一致（均 snake/camel 混用但两端相同） |

> 已逐项对比其余 ~120 个前端请求（mood、auth、case、activity、post、achievement、relax、counseling、ai、aiHistory、moodInsight、moodComparison、adminAnalytics、knowledgeAssistant 等），路径、方法、鉴权（均走 `authenticate` 中间件）基本匹配，除上表 4 项外未再发现硬断裂。

---

## 二、安全与密钥泄露

| # | 位置 | 问题 | 严重度 |
|---|---|---|---|
| S1 | `mood_health_ai_service/.env:1` | **真实 DeepSeek 密钥泄露**：`AI_API_KEY=sk-0953…ac9c（已泄露，S1 轮换中）`。该文件被 `.gitignore` 忽略（未入库，`git ls-files` 确认 NOT TRACKED），但明文存在于工作区磁盘，等同泄露，应立即吊销轮换。 | P0 |
| S2 | `mood_health_ai_service/.env` | AI 服务 `.env` **未定义 `AI_SERVICE_INTERNAL_TOKEN`**；FastAPI 端 `config.py:43` 默认空串，`auth.py:93` 在 token 为空时直接拒绝 → 签名接口失效（见 M-AI1）。 | P0 |
| S3 | 根 `.env` | 明文凭据：`MYSQL_ROOT_PASSWORD=Jyf350721$$`、`MYSQL_APP_PASSWORD=Jyf350721$$`、`REDIS_PASSWORD=...`、`ENCRYPTION_KEY=...`。虽 gitignored，但工作区以弱口令明文保存；`Jyf350721$$` 强度低。 | P1 |
| S4 | 全仓源码 | 未检出硬编码 `sk-` 密钥、硬编码 JWT 密钥或数据库连接串（Node 端 `JWT_SECRET`/`MYSQL_*` 均从环境变量读取，`middleware/auth.ts:278` 无默认值，`app.ts:41-55` 缺失即启动失败）。源码侧密钥管理良好。 | 通过 |

> 注：`.env` 与 `mood_health_ai_service/.env` 均被 `.gitignore` 正确忽略，**未提交到 git 历史**，这是唯一值得肯定的点；但工作区明文密钥仍需迁移到密钥管理并轮换。

---

## 三、CORS / nginx 配置

### 3.1 后端 CORS（`mood_health_server/src/app.ts:66-94`）
使用**严格来源白名单**（`FRONTEND_URL` 或 localhost 列表）+ `credentials: true`，**未使用 `*` 通配**，正确。无 `*`+credentials 反模式。✅

### 3.2 nginx（`nginx.conf` / `nginx.linux.conf`）

| # | 位置 | 问题 | 严重度 |
|---|---|---|---|
| N1 | `nginx.conf:78-88` | **暴露 `/ai/` 到公网**，且 AI 服务 `analyze/mood`、`ai/chat` 接口**无签名鉴权**（见 M-AI2），攻击者可绕过 Node 直接调用 AI 接口、滥用 DeepSeek 密钥。 | P1 |
| N2 | `nginx.conf:30` `upstream ai_backend { server 127.0.0.1:8000; }` | 上游端口 **8000**，但 AI 服务真实端口为 **8001**（`.env` `MOOD_AI_SERVICE_PORT=8001`、Node 调用 `127.0.0.1:8001`）。`/ai/` 实际指向错误端口（见 M-AI3）。 | P2 |
| N3 | `nginx.conf`、`nginx.linux.conf` 全局 | **缺失安全响应头**：无 `Strict-Transport-Security`(HSTS)、无 `Content-Security-Policy`(静态页)、无 `X-Frame-Options`/`X-Content-Type-Options`/`Referrer-Policy`。后端 `helmet` 仅作用于 `/api`，静态前端资源零防护。 | P2 |
| N4 | 两文件全局 | **无速率限制**（仅 Node 端对 `/api/auth/login` 有限流，app.ts:182）；缺全局/按 IP 限流，易被爆破/刷接口。 | P2 |
| N5 | `nginx.linux.conf:32-74` | **生产配置仅监听 80、无 TLS、server_name 为公网 IP `47.94.91.72`，且无 80→443 重定向**；HTTPS server 块仅存在于 `nginx.conf`（且未强制跳转）。公网明文传输。 | P1 |
| N6 | `nginx.conf:104-163` HTTPS 块 | 虽启用 TLS，但 `server_tokens off` 已设（✅），仍缺 HSTS 与上文安全头；且 80 端口未重定向到 443。 | P2 |

---

## 四、CI/CD

| # | 结论 | 严重度 |
|---|---|---|
| C1 | **无 CI/CD 管道**：`.github/workflows/` 目录存在但**为空**（无任何 workflow 文件）。三套系统均无 typecheck / lint / test / 安全扫描（如 secret scan、依赖审计）/ 构建校验。任意未通过类型检查或测试的代码均可直接合入并部署。 | P1 |
| C2 | 无证据表明存在 `Jenkinsfile`、`.gitlab-ci.yml`、`Dockerfile` 内 CI 步骤（仓库根未见此类文件）。部署依赖人工 `start-project.ps1` / `nginx` 手动配置。 | P1（同 C1 范畴） |

---

## 五、文档准确性

| # | 位置 | 问题 | 严重度 |
|---|---|---|---|
| D1 | `README.txt:48-113`「最终标准目录树」 | 仍描述 Python 模块（`api_response/`、`assessment/`、`common/`、`db/`、`treehole/`、`user_auth/`、`main.py`）位于 `mood_health_server/` 下，但**真实 AI 服务在 `mood_health_ai_service/`**（`README.txt:12-19` 的「架构更正」已自相矛盾）。文档自相冲突。 | P2 |
| D2 | `README.txt` 引用 | 引用 **`DEPLOYMENT.md`、`health/`、`start-project.sh`、`requirements.txt`** 均**在仓库根不存在**（已 `ls` 验证 MISSING）；根实际只有 `start-project.ps1`、`ecosystem.config.cjs`。 | P2 |
| D3 | `docs/API.md:347,374` | 文档化 **`POST /moods/advice/save`、`GET /moods/advice/history`**——即 M2 中**未实现**的接口。文档与代码双重失真（文档称存在、代码无实现）。 | P2 |
| D4 | `README.txt:115-121` 端口表 | 称「前端开发服务：3001」——与 `vite.config.ts:72` `port:3001` 一致 ✅；称「Python AI API：8001」与 `.env` 一致 ✅。此两处已更正准确。 | 通过 |

---

## 六、配置与令牌管理

| # | 位置 | 问题 | 严重度 |
|---|---|---|---|
| T1 | `mood_health_ai_service/.env` 与根 `.env` 均缺 `AI_SERVICE_INTERNAL_TOKEN` | 两端默认空串 → 签名接口恒失败（见 M-AI1）。`AI_SERVICE_INTERNAL_TOKEN` **变量名**在 Node(`fastApiClient.ts:102`/`analysisDispatcher.ts:172`/`aiClient.ts:222`) 与 FastAPI(`config.py:43`) 一致，但**值**在两处 `.env` 均未设置。 | P0 |
| T2 | `mood_health_server/src/config/aiConfig.ts:52` | `enabled: getEnvBoolean('AI_ENABLED', false)` **默认 false**。根 `.env` 与 AI 服务 `.env` 均未设 `AI_ENABLED` → **所有 AI 功能默认关闭**（`callChatCompletion` 首行即抛「AI 服务未启用」）。即便修好令牌，AI 仍不可用。 | P1 |
| T3 | `vite.config.ts:34,55`、根 `.env` | 前端正确使用 `import.meta.env.VITE_API_BASE_URL`（`apiBase.ts:34`）与 `VITE_FEATURE_NON_CORE_MODULES_ENABLED`（VITE_ 前缀规范 ✅）。根 `.env` `VITE_API_BASE_URL=` 为空，开发期由 vite `/api` 代理（→3000）接管，生产由 nginx 同域代理，可用。 | 通过（提示） |
| T4 | 端口冲突/漂移 | MySQL：根 `.env` `MYSQL_PORT=3316`，但 `mysql.ts:41` 默认 `3306`、`.env.example` 默认 `3306`；AI 服务 `.env` **未设 MYSQL_PORT** 故取默认 `3306` → AI 服务连 MySQL 会指向错误端口（仅 warning 降级，P2）。Node 3000 / AI 8001 / Redis 6379 / MySQL 3316 其余不冲突。 | P2 |
| T5 | `mood_health_ai_service/.env:4` `MOOD_AI_SERVICE_PORT=8001` vs `nginx.conf:30`(8000)/`vite.config.ts:82`(8000)/`aiConfig.ts:54`(默认 8000) | AI 服务端口在「实际运行值」与「nginx/vite/默认配置」间存在 **8001 vs 8000** 不一致（见 M-AI3）。 | P2 |
| T6 | 根 `.env.example` | 模板含 `AI_SERVICE_INTERNAL_TOKEN=change-me-to-a-random-secret`，但**实际根 `.env` 未包含该变量**，且 AI 服务无独立 `.env.example`。示例与真实部署配置不同步。 | P2 |

---

## 七、缺陷与风险清单（表格）

> 严重度：P0=安全/功能致命；P1=高（功能断裂/安全暴露/无防护）；P2=中（一致性/文档/加固）。

| 编号 | 严重度 | 位置（子系统:file:line） | 问题 | 建议 |
|---|---|---|---|---|
| 1 | P0 | secret:`mood_health_ai_service/.env:1` | 真实 DeepSeek 密钥 `sk-0953…ac9c（已泄露，S1 轮换中）` 明文落盘 | 立即吊销并轮换；迁移至密钥管理（Vault/云 Secret）；禁止在 `.env` 存真实密钥 |
| 2 | P0 | config:`mood_health_ai_service/.env` 缺 `AI_SERVICE_INTERNAL_TOKEN`；`app/config.py:43`；`mood_health_server/src/services/fastApiClient.ts:102` | 内部门禁令牌空串 → 知识助手/RAG 签名接口恒 401 | 在两套 `.env` 设置同一强随机 `AI_SERVICE_INTERNAL_TOKEN`；CI 校验非空 |
| 3 | P1 | contract:`src/api/admin.ts:124,141,149,157` ↔ `courseRoutes`(app.ts:201) | 课程管理走 `/api/admin/courses`，后端仅 `/api/courses` → 404 | 统一路径：后端新增 `/api/admin/courses` 或前端改调 `/api/courses`（推荐前者，与权限 `course.manage` 一致） |
| 4 | P1 | contract:`src/api/advice.ts:41,59`（被 `mood.ts:16`、`MoodRecordScript.ts:8` 依赖）↔ 无后端实现 | 情绪建议保存/历史接口未实现即被调用 → 404 | 实现 `moodRoutes` 的 `/advice/save`、`/advice/history`（库表 `advice_history` 已存在），或前端下架该功能 |
| 5 | P1 | ai:`mood_health_ai_service/app/routers/analyze.py:18`、`chat.py:16` | `/api/analyze/mood`、`/api/ai/chat` 无 `verify_internal_auth`，仅校验自身 `AI_API_KEY` | 与 `assistant.py`/`rag.py` 一致，强制 `verify_internal_auth`；或确保 nginx 不暴露该端点 |
| 6 | P1 | nginx:`nginx.conf:78-88` | `/ai/` 公网可达且无鉴权，配合 #5 可被滥用 AI 密钥 | 生产移除 `/ai/` location，或加 mTLS/内网白名单并指向 8001 |
| 7 | P1 | cicd:`.github/workflows/`（空） | 无任何 CI 门禁（typecheck/lint/test/secret-scan） | 建立覆盖三子系统的 GitHub Actions：安装→lint→typecheck→test→构建→secret 扫描 |
| 8 | P1 | config:`mood_health_server/src/config/aiConfig.ts:52`；根 `.env` 无 `AI_ENABLED` | `AI_ENABLED` 默认 false → 全部 AI 功能默认关闭 | 部署 `.env` 显式 `AI_ENABLED=true`；文档明确该依赖 |
| 9 | P1 | nginx:`nginx.linux.conf:32-74` | 公网生产仅 80 明文、无 TLS、无重定向 | 启用 443+TLS，80→443 强制跳转；配置 HSTS |
| 10 | P2 | contract:`src/api/moodAnalysis.ts:162` ↔ `moodAnalysisRoutes.ts`（无 DELETE） | 删除分析接口 404 | 补 `router.delete('/mood-analyses/:id', ...)` 及控制器 |
| 11 | P2 | nginx:N3（两 conf 全局） | 缺 HSTS/CSP/X-Frame-Options/X-Content-Type-Options 等安全头 | 在 server 块统一 `add_header` 安全头（或 `helmet` 前置代理） |
| 12 | P2 | nginx:N4（两 conf 全局） | 缺速率限制 | 增加 `limit_req_zone` 对 `/api/` 限流（登录/注册更严） |
| 13 | P2 | config:`vite.config.ts:82`、`nginx.conf:30`、`aiConfig.ts:54` vs 实际 8001 | AI 端口 8000/8001 不一致 | 统一为 8001；nginx `/ai/` upstream 指向 8001 |
| 14 | P2 | config:根 `.env` `MYSQL_PORT=3316` vs AI 服务 `.env` 未设(默认 3306) | AI 服务 MySQL 端口漂移 | AI 服务 `.env` 显式 `MYSQL_PORT=3316` 等，或共用同一 `.env` 来源 |
| 15 | P2 | doc:`README.txt:48-113` 目录树 | 描述旧结构（Python 在 `mood_health_server/`），与「架构更正」及实际 `mood_health_ai_service/` 矛盾 | 重写目录树，删除不存在的 Python 子目录描述 |
| 16 | P2 | doc:`README.txt` 引用的 `DEPLOYMENT.md`/`health/`/`start-project.sh`/`requirements.txt` 缺失 | 文档指向不存在文件 | 补充文件或修正引用 |
| 17 | P2 | doc:`docs/API.md:347,374` | 文档化未实现接口（advice） | 实现接口或标注「未实现」 |
| 18 | P2 | config:根 `.env.example` 含 `AI_SERVICE_INTERNAL_TOKEN`，实际 `.env` 无 | 示例与真实配置不同步 | 生成真实 `.env` 时从 example 全量复制并填充 |
| 19 | P2 | secret:根 `.env` `MYSQL_ROOT_PASSWORD=Jyf350721$$` 等弱口令明文 | 弱口令 + 明文 | 使用强随机口令并迁入密钥管理 |
| 20 | P3 | contract:`src/api/counseling.ts:172`、`knowledgeAssistant.ts:48` vs 后端 `:id` | 路径参数命名前后端不一致（sessionId vs id） | 统一命名（如均用 `:sessionId`），避免重构歧义 |

---

## 八、优先级改进建议（P0/P1/P2 跨系统治理路线）

### 阶段 P0（立即，安全+可用止血）
1. **密钥事故响应**：吊销 `mood_health_ai_service/.env` 中的 DeepSeek 密钥并轮换；将全部 `.env` 明文凭据迁移到密钥管理服务（如 Vault / 云 Secret Manager），仓库内仅保留 `.env.example`。
2. **补门禁令牌**：在「根 `.env`」与「AI 服务 `.env`」中设置**同一随机值** `AI_SERVICE_INTERNAL_TOKEN`，并加入启动校验（空则拒绝启动）；CI 增加「密钥非空 + 格式校验」。
3. **关公网 AI 入口**：生产 `nginx.conf` 移除 `/ai/` location（或加内网白名单 + mTLS），阻断 #5/#6 的滥用路径。

### 阶段 P1（一周内，契约+CI 加固）
4. **契约修复**：实现/对齐 M1（课程 `/api/admin/courses`）、M2（advice 接口）、M3（mood-analyses DELETE）；建立**契约测试**（前端 `src/api` 请求 ↔ 后端 `routes` 路由的自动化对账，CI 中运行），防止回归。
5. **启用 CI/CD**：新增 `.github/workflows/ci.yml` 覆盖三子系统——前端 `npm ci && npm run lint && vue-tsc --noEmit && vitest`；Node `npm ci && npm run build && npm test`；AI 服务 `pip install && pytest`；并加入 `gitleaks`/`trufflehog` 密钥扫描与 `npm audit`/`pip-audit` 依赖审计。
6. **AI 开关与 TLS**：部署 `.env` 显式 `AI_ENABLED=true`；`nginx.linux.conf` 启用 443+TLS 并 80→443 跳转 + HSTS。
7. **AI 接口鉴权对齐**：`analyze/mood`、`ai/chat` 增加 `verify_internal_auth`，与 `assistant`/`rag` 一致。

### 阶段 P2（迭代优化，一致性+纵深防御）
8. **统一配置治理**：引入单一配置源/模板，消除 8000/8001、3306/3316 端口漂移；`.env.example` 与真实 `.env` 保持同步并脚本校验。
9. **nginx 安全头与限流**：全局补充 CSP/HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy；对 `/api/` 增加 `limit_req` 限流（登录/注册更严格）。
10. **文档治理**：重写 `README.txt` 目录树与 `docs/API.md`，删除不存在文件引用，标注未实现接口；为「架构更正」建立单一事实源。
11. **契约与命名规范**：统一路径参数命名（sessionId 等）；考虑 OpenAPI 作为前后端/服务间唯一契约来源（FastAPI 已天然支持，Node 侧可生成 client 校验）。
12. **强口令与最小权限**：替换弱口令，数据库账号按服务最小授权；AI 服务 MySQL 凭据显式配置避免默认漂移。

---

### 附录：关键证据速查
- 前端请求基数：`src/utils/request.ts:140-147`（`withCredentials`、CSRF）、`src/utils/apiBase.ts:33-55`（VITE_API_BASE_URL）
- 后端鉴权：`middleware/auth.ts:277-306`（cookie 优先）、`middleware/csrf.ts:5-6,26`（双提交一致）
- AI 门禁：`app/auth.py:71-105`（空 token 拒绝）、`app/config.py:43`
- Node→AI 调用：`services/fastApiClient.ts:10,102,160,170,187`、`utils/ai/aiClient.ts:220-232`
- 真实 AI 路由：`app/routers/{analyze,chat,assistant,rag}.py`
- 端口：`vite.config.ts:72,82`、`nginx.conf:25,30`、`mood_health_ai_service/.env:4`
