# AI 全链路 P0 修复执行 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 先消除阻断 AI 全链路验证的 P0 问题，让前端构建、数据库迁移、Node→FastAPI 配置和关键 AI 页面调用具备继续端到端验收的基础。

**Architecture:** 固定目标架构为 Vue → Node/Express → FastAPI → DeepSeek/LangChain/向量库 → 业务数据库。本计划不做 UI 美化，不引入新的独立前端，不用 Mock 冒充真实 AI。每个任务完成后只暂存本任务文件并提交一次。

**Tech Stack:** Vue 3、Vite、TypeScript、Axios、Node.js/Express、MySQL migration、FastAPI、Playwright、Vitest、Jest。

## Global Constraints

- 不覆盖、不清理用户已有未提交变更。
- 只修改本计划列出的文件；如发现必须扩大范围，先停止并记录原因。
- 每个代码任务后运行对应最小验证命令。
- 端到端验证失败时保留原始失败边界，不把健康检查或 HTTP 200 当作通过。
- Key、Cookie、Token、完整心理日记和完整咨询对话不得写入日志或报告。

---

## 文件变更地图

- 修改 `src/api/counseling.ts`：把 `request.get/post` 改成当前项目真实支持的函数式 request 调用。
- 修改 `src/api/moodAnalysis.ts`：修复 `getMoodInsight` 的请求调用方式，避免情绪洞察页前端直接崩。
- 修改 `src/api/questionnaire.ts`：修复量表 AI 解读请求调用方式。
- 修改 `mood_health_server/src/db/migrations/0350_create_user_ai_profiles.up.sql`：把重复版本 `0350` 重命名为新版本。
- 修改 `mood_health_server/src/db/migrations/0350_create_user_ai_profiles.down.sql`：同步重命名。
- 修改 `scripts/start-all.ps1`：Node 启动时写入 `AI_SERVICE_BASE_URL`，不再只写 Node 不读取的 `FASTAPI_BASE_URL`。
- 修改 `ecosystem.config.cjs`：PM2 Node 服务写入 `AI_SERVICE_BASE_URL`。
- 修改 `mood_health_server/.env.example`、`mood_health_server/.env.production.no-ai.example`：默认 FastAPI 端口统一为 8001。
- 后续可修改 `src/App.vue`、`src/router/index.ts`、新增知识助手内部页面和前后端 API；本轮只有在前面基础验证通过后再进入。

## Task 1: 修复前端 AI API 封装编译阻断

**Files:**
- Modify: `src/api/counseling.ts`
- Modify: `src/api/moodAnalysis.ts`
- Modify: `src/api/questionnaire.ts`

**Interfaces:**
- Consumes: `request<T>({ url, method, data, params })` from `src/utils/request.ts`
- Produces: 能通过 `npm run typecheck:all` 的 API 封装

- [x] **Step 1: 修改 `src/api/counseling.ts`**

把：

```ts
request.get('/api/counseling/sessions')
request.get(`/api/counseling/sessions/${sessionId}`)
request.post('/api/counseling/send', data)
```

改为：

```ts
request<CounselingSession[]>({ url: '/api/counseling/sessions', method: 'GET' })
request<SessionMessagesResponse>({ url: `/api/counseling/sessions/${sessionId}`, method: 'GET' })
request<SessionCounselingResponse>({ url: '/api/counseling/send', method: 'POST', data })
```

- [x] **Step 2: 修改 `src/api/moodAnalysis.ts`**

把：

```ts
return request.post('/api/ai/insight', data)
```

改为：

```ts
return request({ url: '/api/ai/insight', method: 'POST', data })
```

- [x] **Step 3: 修改 `src/api/questionnaire.ts`**

把：

```ts
return request.post('/api/ai/interpret', data)
```

改为：

```ts
return request({ url: '/api/ai/interpret', method: 'POST', data })
```

- [x] **Step 4: 验证**

Run: `npm run typecheck:all`

Expected: 不再出现 `request.get` 或 `request.post` 不存在的错误。如出现新的类型错误，记录真实错误并只修本任务范围内的调用类型。

- [x] **Step 5: 提交**

Run:

```bash
git add src/api/counseling.ts src/api/moodAnalysis.ts src/api/questionnaire.ts
git commit -m "fix: align ai api wrappers with request helper"
```

## Task 2: 修复数据库迁移版本冲突

**Files:**
- Move: `mood_health_server/src/db/migrations/0350_create_user_ai_profiles.up.sql` → `mood_health_server/src/db/migrations/0360_create_user_ai_profiles.up.sql`
- Move: `mood_health_server/src/db/migrations/0350_create_user_ai_profiles.down.sql` → `mood_health_server/src/db/migrations/0360_create_user_ai_profiles.down.sql`

**Interfaces:**
- Consumes: migration runner 的四位数字版本识别规则
- Produces: 不再触发 `Duplicate migration version: 0350`

- [x] **Step 1: 检查迁移文件名**

Run: `Get-ChildItem mood_health_server/src/db/migrations -Filter '*.sql' | Sort-Object Name`

Expected: 当前存在两个 `0350_*`。

- [x] **Step 2: 重命名 user_ai_profiles migration**

把 user profile migration 从 `0350` 改为 `0360`，不改 SQL 业务内容。

- [x] **Step 3: 验证 Node migration 测试**

Run: `npm --prefix mood_health_server run test:stable -- --runTestsByPath tests/unit/db/migrationFiles.test.ts`

Expected: 不再出现 `Duplicate migration version: 0350`。如果测试继续要求 migration 序列或禁止 `IF NOT EXISTS`，保留具体失败并按测试规范修正。

- [x] **Step 4: 提交**

Run:

```bash
git add mood_health_server/src/db/migrations/0350_create_user_ai_profiles.up.sql mood_health_server/src/db/migrations/0350_create_user_ai_profiles.down.sql mood_health_server/src/db/migrations/0360_create_user_ai_profiles.up.sql mood_health_server/src/db/migrations/0360_create_user_ai_profiles.down.sql
git commit -m "fix: resolve duplicate ai migration version"
```

## Task 3: 统一 Node 到 FastAPI 的环境变量和端口

**Files:**
- Modify: `scripts/start-all.ps1`
- Modify: `ecosystem.config.cjs`
- Modify: `mood_health_server/.env.example`
- Modify: `mood_health_server/.env.production.no-ai.example`

**Interfaces:**
- Consumes: Node AI clients read `AI_SERVICE_BASE_URL`
- Produces: start scripts and examples all point to FastAPI 8001 through `AI_SERVICE_BASE_URL`

- [x] **Step 1: 修改 PowerShell 启动脚本**

在 Node 后端启动命令中同时设置：

```powershell
$env:AI_SERVICE_BASE_URL='http://127.0.0.1:${AiPort}'
$env:FASTAPI_BASE_URL='http://127.0.0.1:${AiPort}'
```

- [x] **Step 2: 修改 PM2 配置**

在 Node 应用 env 中加入：

```js
AI_SERVICE_BASE_URL: 'http://127.0.0.1:8001'
```

- [x] **Step 3: 修改 env examples**

把 examples 中 `AI_SERVICE_BASE_URL=http://127.0.0.1:8000` 改为：

```env
AI_SERVICE_BASE_URL=http://127.0.0.1:8001
```

- [x] **Step 4: 验证配置搜索**

Run: `rg -n "AI_SERVICE_BASE_URL=http://127.0.0.1:8000|FASTAPI_BASE_URL" scripts ecosystem.config.cjs mood_health_server/.env.example mood_health_server/.env.production.no-ai.example`

Expected: examples 中不再有 8000；`FASTAPI_BASE_URL` 只作为兼容变量保留，不作为 Node 唯一变量。

- [x] **Step 5: 提交**

Run:

```bash
git add scripts/start-all.ps1 ecosystem.config.cjs mood_health_server/.env.example mood_health_server/.env.production.no-ai.example
git commit -m "fix: align node ai service base url"
```

## Task 4: 重新运行基础验证并决定下一段修复

**Files:**
- No source changes unless validation exposes same-task regressions.

**Interfaces:**
- Consumes: Tasks 1-3 commits
- Produces: 当前可继续修 AI 生成链路或需要先修测试规范的判断

- [x] **Step 1: 运行基础验证**

Run:

```bash
npm run typecheck:all
npm run build:all
npm --prefix mood_health_server run test:stable -- --runTestsByPath tests/unit/db/migrationFiles.test.ts
```

- [x] **Step 2: 根据结果分类**

如果 typecheck/build 仍失败，继续优先修构建阻断；如果 migration 测试仍失败，继续修迁移规范；如果都通过，再进入 AI 情绪分析生成链路。

- [x] **Step 3: 更新本计划执行状态**

把已完成任务勾选，并记录剩余阻断点。
