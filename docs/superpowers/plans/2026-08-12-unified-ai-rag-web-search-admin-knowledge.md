# AI 心理助手：统一问答、RAG、DeepSeek 联网搜索与管理员知识库实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让大学生在 `/counseling` 单一窗口提问后，系统使用真实 `deepseek-v4-flash` 自动回答，自动检索内置及管理员已发布资料，必要时使用同一 DeepSeek Key 搜索权威互联网来源，并完整保存问答与证据。

**Architecture:** 浏览器只调用 Node 会话接口；Node 负责登录、RBAC、文件接收、业务状态和 MySQL 事务；FastAPI 负责风险优先编排、内置/管理员 RAG、DeepSeek 原生联网能力、来源验证和最终生成。管理员资料必须先解析预览、后确认发布；检索器以数据库发布状态为最终可见性依据。任何 Provider、搜索、解析或持久化失败都返回明确错误，不生成伪成功答案或伪造来源。

**Tech Stack:** Vue 3 + TypeScript + Vitest，Node.js + Express + MySQL + Jest，FastAPI + Pydantic + httpx + ChromaDB + pytest，DeepSeek Anthropic-compatible Web Search 与 OpenAI-compatible Chat API。

## Global Constraints

- 严格实施已批准设计：`docs/superpowers/specs/2026-08-12-unified-ai-rag-web-search-admin-knowledge-design.md`。
- 先做真实 DeepSeek 联网能力探针；探针没有得到工具结果、权威 URL 和非空正文时，不得宣称系统已经具备联网搜索能力，也不得静默改用第二个付费搜索 Key。
- 浏览器不得提交模型、RAG 模式、联网开关、用户 ID 或任何密钥；普通用户只看到一个自然问答流程。
- 风险识别先于范围判断、RAG 和联网；高风险文本不发给普通搜索工具。
- 内置资料是本计划的强制交付物，必须覆盖十个批准主题并通过逐主题检索评估。
- 只有 `published` 的管理员资料可被检索；发布失败保持待确认，撤回先落数据库墓碑再清理向量。
- Web 来源仅接受规范化后的政府/卫生部门、WHO、高校官网和配置批准的医院官网；最终重定向地址也必须复验。
- 不展示模型私有思维链。`publicSteps` 只包含“整理回答、参考资料、联网核实”等公开状态。
- 不在日志、测试快照、探针输出或提交中写出 Key、完整心理对话、服务器绝对存储路径。
- 每个任务先写失败测试，再实现最小代码，再运行定向回归；一次小改动一次提交，只暂存本任务列明文件。
- 当前工作树已有用户改动。每个任务开始和提交前执行 `git status --short`；不得暂存 `src/views/admin/AdminAssessments.vue`、`src/utils/assessmentExport.ts`、相关测试或 `mood_health_ai_service/app/agent/duckduckgo_gateway.py`。修改已脏的 `src/views/counseling/Counseling.vue` 时必须使用交互式分块暂存，并核对 `git diff --cached`。
- `.git/packed-refs` 当前会让部分历史/maintenance 命令报 peeled-ref 格式错误；不修改 Git 内部文件。提交后用 `git rev-parse HEAD` 和 `git show --stat --oneline HEAD` 验证。

## File and Interface Map

```text
src/views/counseling/Counseling.vue
  -> src/api/counseling.ts
  -> POST /api/counseling/send
  -> mood_health_server/src/routes/counselingRoutes.ts
  -> mood_health_server/src/controllers/counselingController.ts
  -> mood_health_server/src/services/unifiedAssistantService.ts
  -> mood_health_server/src/services/fastApiClient.ts
  -> mood_health_ai_service/app/routers/assistant.py
  -> mood_health_ai_service/app/agent/orchestration.py
     -> built-in Chroma collection
     -> admin-upload Chroma collection + MySQL published-state filter
     -> DeepSeek native Web Search gateway
     -> DeepSeek final answer provider

src/views/admin/AdminKnowledge.vue
  -> src/api/adminKnowledge.ts
  -> /api/admin/knowledge/documents
  -> Node knowledge route/controller/service/repository
  -> MySQL knowledge_documents + knowledge_chunks
  -> signed FastAPI parse/index lifecycle endpoints
```

Stable boundary objects:

```ts
export type AssistantSource = {
  sourceType: 'built_in' | 'admin_upload' | 'web'
  title: string
  reference: string
  url?: string
  documentId?: string
  documentVersion?: number
  accessedAt?: string
}

export type CounselingResponse = {
  sessionId: string
  answer: string
  sources: AssistantSource[]
  groundingUsed: boolean
  webSearchStatus: 'not_needed' | 'used' | 'failed'
  requestId: string
  provider: 'deepseek'
  model: 'deepseek-v4-flash'
  fallbackUsed: false
  publicSteps?: Array<{ phase: string; label: string }>
}
```

---

### Task 1: 固化 DeepSeek Flash 配置并完成真实联网能力探针

**Files:**
- Modify: `mood_health_ai_service/app/config.py`
- Modify: `mood_health_ai_service/.env.example`
- Create: `mood_health_ai_service/app/agent/deepseek_web_search.py`
- Create: `mood_health_ai_service/tests/unit/test_deepseek_web_search.py`
- Create: `mood_health_ai_service/scripts/probe_deepseek_web_search.py`

**Interfaces:** consumes existing `AI_API_KEY`; produces `DeepSeekWebSearchGateway.search(query, allowed_domains) -> WebSearchResult`. The probe prints status, model, result count, sanitized host names and error class only.

- [ ] Add a failing unit test with mocked `httpx.AsyncClient` for a response containing `server_tool_use`, `web_search_tool_result`, final text and a government URL; assert the gateway returns a non-empty result without logging request headers.
- [ ] Add failing tests for authentication failure, rate limit, timeout, `pause_turn` continuation, empty tool output and malformed URL. Map them to stable codes `web_auth_failed`, `web_rate_limited`, `web_timeout`, `web_unavailable`, and `web_invalid_result`.
- [ ] Implement the typed gateway against `${AI_ANTHROPIC_BASE_URL}/v1/messages`, sending `model=deepseek-v4-flash`, `web_search_20250305`, `max_uses=1`, and `allowed_domains`. Limit continuation to two rounds and never return raw provider payloads to callers.
- [ ] Change the default/example model to `deepseek-v4-flash`; add `AI_ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic` and a bounded timeout. Do not edit or print the real `.env` key.
- [ ] Implement the probe so missing key exits with code 2, capability failure exits with code 3, and a verified non-empty authoritative result exits with code 0.
- [ ] Run `cd mood_health_ai_service; pytest tests/unit/test_deepseek_web_search.py -q`; expected result after implementation: all tests pass.
- [ ] Run `cd mood_health_ai_service; python scripts/probe_deepseek_web_search.py --query "国家卫生健康委 12356 心理援助热线 最新信息" --allowed-domain gov.cn`; acceptance requires a real tool-result block, accessible authoritative URL and non-empty text. If it fails, record the sanitized code and stop the联网 claim before proceeding with Web-specific integration.
- [ ] Stage only the five task files, inspect `git diff --cached`, then commit `feat(ai): probe DeepSeek native web search`.

### Task 2: 建立权威域名、隐私清洗和增强自动联网策略

**Files:**
- Create: `mood_health_ai_service/app/agent/web_policy.py`
- Create: `mood_health_ai_service/tests/unit/test_web_policy.py`
- Modify: `mood_health_ai_service/app/agent/orchestration.py`
- Modify: `mood_health_ai_service/app/main.py`
- Modify: `mood_health_ai_service/tests/test_agent_orchestration.py`
- Create: `mood_health_ai_service/tests/test_main_web_gateway.py`

**Interfaces:** consumes query, local evidence freshness and configured allowlist; produces `WebDecision(required, reason, sanitized_query)` and validated Web-source entries carrying an ISO UTC access time.

- [ ] Write failing table-driven tests proving natural commands such as“上网查”、freshness terms such as“最新/当前/通知/开放时间/是否仍有效”force search, ordinary emotional support does not, and risk text skips the search decision.
- [ ] Write failing URL tests that accept `nhc.gov.cn`, subdomains ending at `.gov.cn`, `who.int`, `.edu.cn` and configured exact hospital hosts; reject `gov.cn.example.com`, IP literals, localhost, private addresses, non-HTTP schemes and short links.
- [ ] Write failing redaction tests that remove phone numbers, student IDs, detailed addresses and names marked by common Chinese self-identification phrases while preserving the minimum search intent.
- [ ] Implement normalized host-boundary checks with `urllib.parse`, IDNA normalization and `ipaddress`; validate the final redirect URL as well as the provider URL.
- [ ] Integrate deterministic rules before the model decision. When local evidence is stale or insufficient for a current-information question, force search; otherwise let DeepSeek return only a boolean decision and public reason code.
- [ ] Replace runtime Tavily/DuckDuckGo selection for the unified assistant with `DeepSeekWebSearchGateway`; retain old modules only for compatibility until a later deprecation task. Set `web_available` from the DeepSeek key/configuration, not a Tavily key.
- [ ] Repair the existing orchestration test fixture so cases that provide a web gateway explicitly set `web_available=True`; retain all existing assertions.
- [ ] Run `cd mood_health_ai_service; pytest tests/unit/test_web_policy.py tests/test_agent_orchestration.py tests/test_main_web_gateway.py -q`; expected result: all selected tests pass and the previously observed eight web fixture failures are gone.
- [ ] Stage only the six task files and commit `feat(ai): enforce automatic authoritative web search`.

### Task 3: 收紧统一回答契约并禁止伪成功降级

**Files:**
- Modify: `mood_health_ai_service/app/models/contracts.py`
- Modify: `mood_health_ai_service/app/agent/orchestration.py`
- Modify: `mood_health_ai_service/tests/test_agent_orchestration.py`
- Modify: `mood_health_server/src/services/fastApiClient.ts`
- Modify: `mood_health_server/src/services/unifiedAssistantService.ts`
- Modify: `mood_health_server/src/services/counselingSessionService.ts`
- Modify: `mood_health_server/src/controllers/counselingController.ts`
- Modify: `mood_health_server/tests/unit/services/unifiedAssistantService.test.ts`
- Modify: `mood_health_server/tests/unit/controllers/counselingRequestContract.test.ts`

**Interfaces:** removes browser-controlled `allowWebSearch`; maps legacy persisted `sourceType='local'` to `built_in` on read; a provider/search failure produces an error response and no assistant message row.

- [ ] Add failing Python contract tests for `built_in|admin_upload|web`, `documentId`, `documentVersion`, `accessedAt`, `fallbackUsed=false`, and public status steps that cannot contain raw model reasoning.
- [ ] Add failing Node tests proving `allowWebSearch` is ignored/rejected at the public boundary, provider failure returns stable 502 data with `requestId`, and `saveMessagePair` is not called when no real answer exists.
- [ ] Update the FastAPI response model and orchestration result builder. Emit `webSearchStatus='not_needed'` when search was unnecessary, `used` only with validated web evidence, and `failed` when a required search cannot be verified.
- [ ] Remove the fixed fake-answer catch from `generateUnifiedAssistantResponse`; preserve the original typed error, log only request metadata, and let the controller return an actionable Chinese message without an `answer` field.
- [ ] Keep risk resources as an explicitly labeled safety pathway, not a provider-success imitation; ensure risk handling still precedes range and web logic.
- [ ] Normalize old saved `local` sources to `built_in` when reading history so existing sessions remain renderable without migrating old JSON snapshots.
- [ ] Run `cd mood_health_server; npm test -- --runInBand tests/unit/services/unifiedAssistantService.test.ts tests/unit/controllers/counselingRequestContract.test.ts`; expected result: pass.
- [ ] Run `cd mood_health_ai_service; pytest tests/test_agent_orchestration.py -q`; expected result: pass.
- [ ] Stage only listed files and commit `fix(ai): fail closed when assistant generation fails`.

### Task 4: 把十类内置资料变成版本化、可评估的真实 RAG 交付物

**Files:**
- Modify: `mood_health_ai_service/app/rag/knowledge_base.py`
- Modify: `mood_health_ai_service/app/rag/retriever.py`
- Create: `mood_health_ai_service/tests/fixtures/builtin_rag_evaluation.json`
- Create: `mood_health_ai_service/tests/unit/test_builtin_knowledge.py`
- Modify: `mood_health_ai_service/tests/test_rag_index.py`

**Interfaces:** each built-in record provides stable ID, title, content, reference, URL, reviewed date and content version; index manifest records knowledge version, embedding model and record count.

- [ ] Write a failing completeness test requiring all ten approved themes: grounding, task splitting, daily care, sleep, activity, professional support, crisis contacts, exam stress, interpersonal/dorm conflict and university transition.
- [ ] Add at least one representative query per theme to the evaluation fixture, with expected record IDs and a negative query set. Include the crisis query assertion that retrieval is skipped in favor of the risk route.
- [ ] Add `contentVersion` to every record, validate unique IDs, valid HTTP(S) URLs and ISO review dates at startup, and add the three missing university-specific themes with reviewed authoritative references.
- [ ] Make index rebuild atomic: construct a new versioned collection, verify record count, then switch the manifest; retain the last complete collection on failure.
- [ ] Run `cd mood_health_ai_service; pytest tests/unit/test_builtin_knowledge.py tests/test_rag_index.py -q`; expected result: all ten positive topics hit the expected record above the configured threshold and negative cases produce no displayed source.
- [ ] Stage only the five task files and commit `feat(rag): expand and evaluate built-in knowledge`.

### Task 5: 增加知识库权限和持久化表结构

**Files:**
- Create: `mood_health_server/src/db/migrations/0420_add_knowledge_manage_permission.up.sql`
- Create: `mood_health_server/src/db/migrations/0420_add_knowledge_manage_permission.down.sql`
- Create: `mood_health_server/src/db/migrations/0430_create_knowledge_documents.up.sql`
- Create: `mood_health_server/src/db/migrations/0430_create_knowledge_documents.down.sql`
- Modify: `mood_health_server/src/middleware/auth.ts`
- Modify: `mood_health_server/tests/unit/db/migrationFiles.test.ts`

**Interfaces:** adds `knowledge.manage` to both `admin` and `super_admin`; creates `knowledge_documents` and `knowledge_chunks` with status/version/audit/index fields and foreign keys.

- [ ] Add failing migration tests for paired files, increasing numeric order, required indexes, foreign keys, unique `(document_id, document_version, ordinal)`, and permission assignments for both administrative roles.
- [ ] Implement the permission migration with idempotent insert-from-select statements and a down migration that removes role mappings before the permission.
- [ ] Implement the document table with status values `parsing|pending_review|published|parse_failed|withdrawn`, random `storage_key`, SHA-256, version, uploader/publisher audit fields, sanitized parse error fields and `index_state`.
- [ ] Implement the chunk table with document/version/ordinal/content/content hash/embedding key/active. Down migration drops chunks before documents.
- [ ] Add `knowledge.manage` to the compile-time permission union without broadening unrelated roles.
- [ ] Run `cd mood_health_server; npm test -- --runInBand tests/unit/db/migrationFiles.test.ts`; expected result: pass.
- [ ] Run the migration up/down/up sequence against the dedicated test database and confirm both roles resolve `knowledge.manage` and tables preserve foreign-key integrity.
- [ ] Stage only the six task files and commit `feat(knowledge): add document schema and permission`.

### Task 6: 实现安全文件解析、清洗和切分

**Files:**
- Modify: `mood_health_ai_service/requirements.txt`
- Create: `mood_health_ai_service/app/knowledge/__init__.py`
- Create: `mood_health_ai_service/app/knowledge/file_parser.py`
- Create: `mood_health_ai_service/app/knowledge/chunker.py`
- Create: `mood_health_ai_service/app/models/knowledge_contracts.py`
- Create: `mood_health_ai_service/app/routers/knowledge.py`
- Modify: `mood_health_ai_service/app/main.py`
- Create: `mood_health_ai_service/tests/unit/test_file_parser.py`
- Create: `mood_health_ai_service/tests/unit/test_knowledge_router.py`

**Interfaces:** signed internal `POST /api/knowledge/documents/parse` accepts document ID/version, filename, MIME and base64 bytes; returns sanitized metadata plus ordered chunks. Supported formats: PDF, DOCX, TXT, Markdown.

- [ ] Add failing parser tests using small fixture bytes for valid text PDF, DOCX, UTF-8/GB18030 text and Markdown. Add rejection tests for encrypted PDF, scanned/no-text PDF, DOCX zip bomb, macro/external-link entries, mismatched magic/MIME, NUL-heavy text, empty content and content over the configured character limit.
- [ ] Add `pypdf` and `python-docx` pinned compatible ranges. Do not add OCR or execute embedded document content.
- [ ] Implement signature checks: `%PDF-` for PDF; ZIP plus required DOCX members and bounded expanded size for DOCX; supported text decoding with binary/NUL rejection for TXT/Markdown.
- [ ] Implement heading/paragraph-first chunking with bounded length, overlap, stable ordinal and SHA-256 content hashes. Reject documents that yield no meaningful chunks.
- [ ] Protect the router with existing internal signature verification and stable error codes. Never return a server path, raw exception, secret or unbounded document text.
- [ ] Run `cd mood_health_ai_service; pytest tests/unit/test_file_parser.py tests/unit/test_knowledge_router.py -q`; expected result: pass.
- [ ] Stage only listed files and commit `feat(knowledge): parse and chunk admin documents safely`.

### Task 7: 实现 Node 文件接收、文档仓储与解析状态机

**Files:**
- Modify: `mood_health_server/package.json`
- Modify: `mood_health_server/package-lock.json`
- Create: `mood_health_server/src/config/knowledgeConfig.ts`
- Create: `mood_health_server/src/types/knowledge.ts`
- Create: `mood_health_server/src/repositories/knowledgeDocumentRepository.ts`
- Create: `mood_health_server/src/services/knowledgeDocumentService.ts`
- Modify: `mood_health_server/src/services/fastApiClient.ts`
- Create: `mood_health_server/tests/unit/services/knowledgeDocumentService.test.ts`

**Interfaces:** service consumes authenticated admin ID and Multer file metadata; creates `parsing`, calls signed FastAPI parser, stores chunks, and atomically enters `pending_review` or sanitized `parse_failed`.

- [ ] Add failing service tests for 20 MB limit, extension/MIME/magic mismatch, duplicate SHA-256, random storage key, parse success transaction, parse failure state, and removal of a newly stored file when the initial DB write fails.
- [ ] Add `multer` and `@types/multer`; configure a non-public `KNOWLEDGE_UPLOAD_DIR`, bounded file size and random UUID storage names. Original filenames are metadata only and must not form filesystem paths.
- [ ] Implement repository methods with parameterized SQL and transactions: create, replace chunks, mark parse failure, list/filter, get detail and lock row for lifecycle transition.
- [ ] Extend `fastApiClient` with signed parse/index methods. Encode internal document bytes as base64 JSON, enforce a dedicated body/time limit, and never log payload or authorization headers.
- [ ] Implement duplicate detection on SHA-256 among active/pending versions, deterministic status transitions and admin-safe error messages.
- [ ] Run `cd mood_health_server; npm test -- --runInBand tests/unit/services/knowledgeDocumentService.test.ts`; expected result: pass.
- [ ] Stage only listed files and commit `feat(knowledge): persist admin upload parsing workflow`.

### Task 8: 建立管理员资料动态索引、发布与撤回墓碑

**Files:**
- Create: `mood_health_ai_service/app/rag/admin_index.py`
- Create: `mood_health_ai_service/app/knowledge/published_repository.py`
- Modify: `mood_health_ai_service/app/rag/retriever.py`
- Modify: `mood_health_ai_service/app/routers/knowledge.py`
- Modify: `mood_health_server/src/repositories/knowledgeDocumentRepository.ts`
- Modify: `mood_health_server/src/services/knowledgeDocumentService.ts`
- Create: `mood_health_ai_service/tests/unit/test_admin_index.py`
- Modify: `mood_health_ai_service/tests/test_rag_index.py`
- Modify: `mood_health_server/tests/unit/services/knowledgeDocumentService.test.ts`

**Interfaces:** publish indexes pending chunks invisibly, then Node marks the version `published`; retrieval queries both collections and discards every admin hit not currently published in MySQL. Withdraw marks DB inactive first, then removes vectors.

- [ ] Add failing tests proving pending/failed/withdrawn chunks never appear, publish failure leaves `pending_review`, a prior vector surviving deletion is filtered by the database tombstone, and a second version does not expose two active versions.
- [ ] Implement a separate admin Chroma collection with IDs `admin:{documentId}:{version}:{ordinal}` and metadata containing source type, document/version, title and content hash.
- [ ] Implement a read-only published-state repository in FastAPI using its existing MySQL pool. On database uncertainty, fail closed for admin hits while allowing valid built-in retrieval.
- [ ] Merge built-in and admin candidates by score, remove duplicates, apply `RAG_MIN_SIMILARITY`, and return at most three sources. Admin hits emit `sourceType='admin_upload'` and document identifiers.
- [ ] Implement publish ordering: lock pending version, call FastAPI index, then atomically set published/active and withdraw the prior published version. Implement withdraw ordering: commit DB tombstone first, then request vector cleanup; record cleanup-pending state without restoring visibility.
- [ ] Run `cd mood_health_ai_service; pytest tests/unit/test_admin_index.py tests/test_rag_index.py -q`; expected result: pass.
- [ ] Run `cd mood_health_server; npm test -- --runInBand tests/unit/services/knowledgeDocumentService.test.ts`; expected result: pass.
- [ ] Stage only listed files and commit `feat(rag): publish and tombstone admin knowledge`.

### Task 9: 暴露受 RBAC 保护的管理员知识库 API

**Files:**
- Create: `mood_health_server/src/controllers/adminKnowledgeController.ts`
- Create: `mood_health_server/src/routes/adminKnowledgeRoutes.ts`
- Modify: `mood_health_server/src/app.ts`
- Modify: `mood_health_server/src/utils/roleAuthorization.ts`
- Create: `mood_health_server/tests/unit/routes/adminKnowledgeRoutes.test.ts`

**Interfaces:** provides upload/list/detail/publish/withdraw/reparse routes at `/api/admin/knowledge/documents`; every route requires authentication and `knowledge.manage`.

- [ ] Add failing route tests for unauthenticated 401, ordinary user/counselor 403, admin and super-admin success, cross-user ID spoofing ignored, unsupported files rejected, and no storage key/path in responses.
- [ ] Implement Multer middleware so file-size/type errors map to stable 400/413 responses and temporary files are removed on rejection.
- [ ] Implement controller schemas for filters, IDs and lifecycle operations. Take actor ID only from authenticated request context.
- [ ] Mount the router in `app.ts`; enforce `authenticate` then `requirePermission('knowledge.manage')` before business handlers.
- [ ] Run `cd mood_health_server; npm test -- --runInBand tests/unit/routes/adminKnowledgeRoutes.test.ts`; expected result: pass.
- [ ] Stage only the five task files and commit `feat(admin): expose protected knowledge APIs`.

### Task 10: 交付管理员上传、预览、发布与撤回页面

**Files:**
- Create: `src/api/adminKnowledge.ts`
- Create: `src/views/admin/AdminKnowledge.vue`
- Create: `src/__tests__/api/adminKnowledge.test.ts`
- Create: `src/__tests__/views/adminKnowledge.test.ts`
- Modify: `src/router/index.ts`
- Modify: `src/router/guards.ts`
- Modify: `src/views/admin/AdminLayout.vue`
- Modify: `src/__tests__/router/guards.test.ts`

**Interfaces:** frontend consumes only sanitized Node DTOs; route `/admin/knowledge` requires `knowledge.manage`; publish action always follows an explicit preview confirmation.

- [ ] Add failing API tests for multipart upload, list/detail, publish, withdraw, reparse and normalized error messages.
- [ ] Add failing view tests for accepted formats/20 MB hint, parsing/pending/published/failed/withdrawn states, real chunk preview, duplicate warning, publish confirmation, disabled invalid transitions and retryable errors.
- [ ] Add failing guard tests proving `admin` and `super_admin` can enter while user/counselor cannot; keep frontend role mapping aligned with database permission migration.
- [ ] Implement the API module and an accessible responsive page with file input, filters, state badges, preview drawer and confirmed lifecycle buttons. Never render `storage_key` or internal errors.
- [ ] Add the admin navigation item without changing the dirty `AdminAssessments.vue` file.
- [ ] Run `npm test -- --run src/__tests__/api/adminKnowledge.test.ts src/__tests__/views/adminKnowledge.test.ts src/__tests__/router/guards.test.ts`; expected result: pass.
- [ ] Stage only listed files and commit `feat(admin): add knowledge management workspace`.

### Task 11: 简化普通用户问答界面并显示可核验证据

**Files:**
- Modify: `src/api/counseling.ts`
- Create: `src/components/counseling/AssistantEvidence.vue`
- Create: `src/__tests__/components/counseling/AssistantEvidence.test.ts`
- Modify: `src/views/counseling/Counseling.vue`
- Modify: `src/__tests__/views/counseling-send-failure.test.ts`
- Modify: `src/__tests__/views/counseling-history.test.ts`
- Create: `src/__tests__/views/counseling-evidence.test.ts`

**Interfaces:** user sends only message/session ID; UI renders natural public status, grouped source cards and explicit retryable errors. Raw reasoning, provider internals and technical mode controls are absent.

- [ ] Before editing, save and inspect `git diff -- src/views/counseling/Counseling.vue`; identify the existing user-owned reasoning timeline hunks and do not overwrite them.
- [ ] Add failing API/view tests proving no `allowWebSearch` field is sent, built-in/admin/web source labels render correctly, web cards require title+URL+access time, and missing grounding produces no source section.
- [ ] Add failing tests proving required-search failure says“最新信息暂时无法核实”without a fabricated answer, provider failure remains retryable, and restored history normalizes legacy local sources.
- [ ] Implement `AssistantEvidence.vue` and update counseling types. Keep one input flow and use only natural labels such as“正在整理回答”“已参考知识资料”“已联网核实”。
- [ ] Replace any raw reasoning rendering with approved public statuses. Keep crisis resources visible independently from a failed provider call.
- [ ] Run `npm test -- --run src/__tests__/components/counseling/AssistantEvidence.test.ts src/__tests__/views/counseling-send-failure.test.ts src/__tests__/views/counseling-history.test.ts src/__tests__/views/counseling-evidence.test.ts`; expected result: pass.
- [ ] Use interactive hunk staging for `Counseling.vue`, stage the other listed files normally, inspect every cached hunk, and commit `feat(ai): present verified answer evidence naturally` without including pre-existing user changes.

### Task 12: 真实端到端验收、回归与毕业设计证据

**Files:**
- Create: `tests/e2e/admin-knowledge.spec.ts`
- Modify: `tests/e2e/counseling.spec.ts`
- Modify: `tests/e2e/scripts/provision-database.ps1`
- Create: `docs/verification/2026-08-12-ai-rag-web-search-acceptance.md`

**Interfaces:** acceptance runs through Chromium and real services, not direct function mocks; evidence document records command, timestamp, request ID, sanitized provider/model, source hosts, database assertions and failures.

- [ ] Add E2E setup that creates an isolated admin and student through supported APIs, provisions migrations 0420/0430, and cleans only records created by the test IDs.
- [ ] Add browser flow: admin uploads a unique Markdown fixture, waits for parsing, previews a known sentence, publishes it, then the student asks a matching question and sees the same admin source after page refresh.
- [ ] Add browser flow for a built-in exam-stress question and assert the expected built-in source; add an unrelated question and assert no false source card.
- [ ] Add a real freshness query that forces DeepSeek web search and assert `webSearchStatus='used'`, a visible authoritative title, accessible URL, `accessedAt`, request ID and saved history snapshot. No mocked provider response counts as this gate.
- [ ] Add failure flows for invalid file, non-admin access, publish indexing failure, required-search failure, provider failure and withdrawn-document non-retrieval.
- [ ] Run FastAPI full tests: `cd mood_health_ai_service; pytest -q`; record exact pass/fail counts.
- [ ] Run Node full tests and build: `cd mood_health_server; npm test -- --runInBand; npm run build`; record them separately.
- [ ] Run frontend tests, type check and build: `npm test -- --run; npm run type-check; npm run build`; record them separately.
- [ ] Start MySQL, Node, FastAPI and Vite using the project launcher; verify listeners and then run `npx playwright test tests/e2e/admin-knowledge.spec.ts tests/e2e/counseling.spec.ts --project=chromium`.
- [ ] Query MySQL with a read-only verification to prove the question, real answer, source snapshot, request ID, provider, model and search status persisted together. Do not copy full private conversation text into the evidence document.
- [ ] Write the acceptance document with separate sections for build, unit tests, service startup, browser rendering, real DeepSeek generation, real RAG, real Web Search, MySQL persistence and known limitations. A health check or HTTP 200 alone is not completion evidence.
- [ ] Scan tracked changes for secrets and unfinished markers using `rg -n "AI_API_KEY=|sk-[A-Za-z0-9_-]{12,}|TAVILY_API_KEY=|T[O]DO|T[B]D"` over the task files; expected result: no secret and no unresolved marker.
- [ ] Stage only E2E/provision/evidence files and commit `test(ai): verify real RAG and web search flows`.

## Completion Gate

All conditions below must be true before marking the goal complete:

- [ ] `deepseek-v4-flash` returns a real non-empty answer through Vue → Node → FastAPI → DeepSeek.
- [ ] A representative query hits a versioned built-in source from each of the ten approved themes.
- [ ] An administrator can upload, preview, publish, reparse and withdraw PDF/DOCX/TXT/Markdown under `knowledge.manage`.
- [ ] Published admin content is retrievable; pending, failed and withdrawn content is not, including during index-cleanup failure.
- [ ] A freshness query triggers the same-Key DeepSeek native Web Search and exposes only verified authoritative sources with access time.
- [ ] Risk input bypasses ordinary search, scope-out input is politely redirected, and search/provider failures never produce a fabricated answer.
- [ ] Conversation history restores the real answer and immutable source snapshot after refresh.
- [ ] Targeted and full tests, builds, service startup, Chromium E2E and read-only MySQL verification are recorded independently.
- [ ] Every implementation commit contains only its named task files or intentionally selected hunks from an already dirty file.
