# RAG Knowledge Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken Streamlit 8501 popup with an authenticated in-app RAG knowledge assistant that retrieves cited mental-health knowledge through Node and FastAPI and persists user-isolated conversation history.

**Architecture:** Vue owns the in-app experience and calls only authenticated Node endpoints. Node derives the user identity from the session, signs an internal request to FastAPI, and persists a successful user/assistant pair transactionally. FastAPI owns retrieval and provider generation, returning an answer plus source metadata and never manufacturing an unmarked success response.

**Tech Stack:** Vue 3, Vue Router, TypeScript, Vitest, Express 5, MySQL 8, Jest, FastAPI, Pydantic 2, ChromaDB, sentence-transformers, OpenAI-compatible provider, pytest, Playwright.

## Global Constraints

- Product request flow is exactly `Vue → Node/Express → FastAPI → vector knowledge base/provider → MySQL → Vue`.
- Browser code must never open or call port 8501 and must never send a `user_id` for this feature.
- Route is `/ai/knowledge-assistant`; all three Node endpoints are mounted below `/api/knowledge-assistant` and use `authenticate`.
- User input is trimmed, must contain 1-1000 characters, and is never written to logs.
- Retrieval returns at most 3 source records copied from the existing `agent_app/rag/rag_service.py` knowledge entries.
- A successful answer has `fallbackUsed: false`; RAG/provider failures are explicit 502/503 responses and do not persist a fake assistant answer.
- All history queries constrain both `user_id` and `session_id`; foreign sessions respond as 404.
- Existing dirty-worktree changes are user-owned. Stage only the files named in each task.
- Use test-first red/green cycles and one focused commit per task.

---

## File Map

### Frontend

- Modify `src/App.vue`: replace popup behavior with internal router navigation.
- Modify `src/router/index.ts`: register the authenticated lazy route.
- Create `src/api/knowledgeAssistant.ts`: typed request functions and response contracts.
- Create `src/views/ai/KnowledgeAssistant.vue`: question, answer, citations, history, loading, retry, and responsive layout.
- Create `src/__tests__/views/knowledge-assistant-navigation.test.ts`: popup regression and route assertions.
- Create `src/__tests__/views/knowledge-assistant-page.test.ts`: page success/failure behavior.

### Node

- Modify `mood_health_server/src/app.ts`: mount the authenticated feature router.
- Modify `mood_health_server/src/services/fastApiClient.ts`: add signed `/api/rag/answer` call without proxy inheritance.
- Create `mood_health_server/src/routes/knowledgeAssistantRoutes.ts`: validation and route declarations.
- Create `mood_health_server/src/controllers/knowledgeAssistantController.ts`: HTTP orchestration and error mapping.
- Create `mood_health_server/src/services/knowledgeAssistantService.ts`: session validation, context building, FastAPI call, and persistence orchestration.
- Create `mood_health_server/src/repositories/knowledgeAssistantRepository.ts`: user-scoped reads and transactional pair writes.
- Create `mood_health_server/src/db/migrations/0380_create_knowledge_assistant_messages.up.sql` and `.down.sql`: storage and indexes.
- Create focused Jest tests under `mood_health_server/tests/unit/knowledgeAssistant/`.

### FastAPI

- Modify `mood_health_ai_service/requirements.txt` and `pyproject.toml`: RAG runtime dependencies.
- Modify `mood_health_ai_service/app/config.py`: embedding model, collection, persistence path, and top-k settings.
- Modify `mood_health_ai_service/app/models/contracts.py`: RAG request/response contracts.
- Modify `mood_health_ai_service/app/main.py`: include the RAG router and expose RAG readiness.
- Create `mood_health_ai_service/app/rag/knowledge_base.py`: exact migrated knowledge entries.
- Create `mood_health_ai_service/app/rag/retriever.py`: lazy persistent vector index.
- Create `mood_health_ai_service/app/rag/service.py`: prompt construction and answer generation.
- Create `mood_health_ai_service/app/routers/rag.py`: signed internal endpoint and status mapping.
- Create `mood_health_ai_service/tests/test_rag_contract.py` and `test_rag_service.py`.

---

### Task 0: Restore a trustworthy test baseline

**Files:**
- Modify: `src/__tests__/views/mood-layout.test.ts`
- Modify: `mood_health_server/tests/unit/db/seedCore.test.ts`
- Modify: `mood_health_server/src/utils/logger.ts`
- Create: `mood_health_server/tests/unit/utils/loggerLifecycle.test.ts`
- Modify: `mood_health_server/tests/unit/services/authService.test.ts`
- Modify: `mood_health_server/tests/unit/ai/fourSectionAnalysis.test.ts`
- Environment only: install `mood_health_ai_service/requirements-dev.txt` into `mood_health_ai_service/.venv`
- Modify: `mood_health_ai_service/pyproject.toml` and the existing `app/**/*.py` / `tests/**/*.py` files reported by Ruff or Mypy (baseline-only formatting and typing corrections)

**Interfaces:**
- Consumes: current `MoodLayout` contract, current `REFERENCE_ROLES` / `REFERENCE_PERMISSIONS` catalog, and the project Python virtual environment.
- Produces: frontend and Node test expectations aligned with current product behavior plus a runnable FastAPI pytest/Ruff/Mypy toolchain.

**Recorded baseline evidence (2026-08-02):**

- `npm run test:run`: 198/199 passed; `mood-layout.test.ts` incorrectly expected an explicitly supplied `/mood/analysis` item to be removed even though `MoodLayout` now passes typed route metadata through unchanged.
- `npm --prefix mood_health_server run test:stable`: 230/232 passed; `seedCore.test.ts` still asserted the older 3-role/21-permission R0 catalog, while the active seed contains the later `admin` role and expanded permissions. Its parameterization assertion also incorrectly rejected the intentional static `DELETE FROM role_permissions` statement.
- `mood_health_ai_service/.venv/Scripts/python.exe -m pytest -q`: collection could not start because pytest was not installed; `requirements-dev.txt` is the authoritative development dependency manifest.
- `npm --prefix mood_health_server run test:stable`: all 232 assertions passed after the seed correction, but Jest remained alive because importing the application logger in tests also created two `DailyRotateFile` transports. Test runs must not own production file-rotation resources.
- The isolated `authService.test.ts` suite also remained alive: it imported the eager Redis singleton even though every service dependency under test was otherwise injected. The unit test must mock Redis so it cannot open a real retrying socket.
- The isolated `fourSectionAnalysis.test.ts` suite remained alive for the same class of boundary leak: importing a pure parser through `moodAnalysisService` loaded `cache -> redis.client`. Mock the unused cache module in this parser-only test.
- After installing the declared tools, FastAPI pytest passed `78 passed, 1 deprecation warning`; Ruff reported 116 existing findings (75 safe-auto-fixable) and strict Mypy reported 27 existing errors across 9 files. Intentional camelCase Pydantic wire fields and legacy contract-test names require narrow per-file Ruff exceptions; all remaining findings require behavior-preserving cleanup.

- [ ] **Step 1: Correct the already-red MoodLayout contract test**

Rename the test to `renders every typed sub-navigation item supplied by the route` and assert the complete literal output:

```ts
expect(wrapper.text()).toBe('记录分析档案')
```

This catches dropping, reordering, or renaming a supplied navigation item without testing obsolete filtering behavior.

- [ ] **Step 2: Run the focused frontend test and full frontend suite**

```powershell
npm run test:run -- src/__tests__/views/mood-layout.test.ts
npm run test:run
```

Expected: focused test PASS; full suite reports 199/199 passing.

- [ ] **Step 3: Commit the frontend baseline correction**

```powershell
git add -- src/__tests__/views/mood-layout.test.ts
git commit -m "test: align mood navigation contract"
```

- [ ] **Step 4: Correct the already-red seed catalog assertions**

Replace obsolete totals with current independent invariants:

```ts
expect(result.roles).toBe(4)
expect(REFERENCE_ROLES.map(role => role.code)).toEqual([
  'student', 'counselor', 'super_admin', 'admin',
])
expect(new Set(REFERENCE_PERMISSIONS.map(permission => permission.code)).size)
  .toBe(REFERENCE_PERMISSIONS.length)
expect(REFERENCE_PERMISSIONS.map(permission => permission.code)).toEqual(
  expect.arrayContaining([
    'auth.profile.read',
    'mood.record.create',
    'assessment.submit',
    'user.manage',
    'prompt.manage',
    'post.audit',
    'activity.manage',
  ])
)
```

For SQL safety, isolate the static reset and require parameters for every remaining query:

```ts
const resetQueries = db.queries.filter(query => query.sql.trim() === 'DELETE FROM role_permissions')
const dataQueries = db.queries.filter(query => query.sql.trim() !== 'DELETE FROM role_permissions')
expect(resetQueries).toHaveLength(1)
expect(dataQueries.every(query => query.params.length > 0)).toBe(true)
```

- [ ] **Step 5: Run the focused Node test and full stable suite**

```powershell
npm --prefix mood_health_server test -- --runTestsByPath tests/unit/db/seedCore.test.ts
npm --prefix mood_health_server run test:stable
```

Expected: focused test PASS; full suite reports 232/232 passing.

- [ ] **Step 6: Commit the Node baseline correction**

```powershell
git add -- mood_health_server/tests/unit/db/seedCore.test.ts
git commit -m "test: align reference seed contract"
```

- [ ] **Step 7: Add a red logger lifecycle test**

Add `loggerLifecycle.test.ts` that resets modules, sets `NODE_ENV=test`, imports the logger, and asserts the logger owns no `DailyRotateFile` transports. Run it first and confirm it fails against the current unconditional transport construction.

- [ ] **Step 8: Disable rotating-file transports only in tests**

Build the logger transport list from `NODE_ENV`: production and development retain both rotating files, while tests use no file transports. Keep the existing console behavior unchanged. Mock `redis.client` in `authService.test.ts` with an unavailable no-I/O client because that suite injects all other dependencies, and mock the unused cache module in `fourSectionAnalysis.test.ts`. Run the focused tests, then run `npm --prefix mood_health_server run test:stable` without `--forceExit` and require the command to exit normally.

- [ ] **Step 9: Commit the Node test-lifecycle correction**

```powershell
git add -- mood_health_server/src/utils/logger.ts mood_health_server/tests/unit/utils/loggerLifecycle.test.ts mood_health_server/tests/unit/services/authService.test.ts mood_health_server/tests/unit/ai/fourSectionAnalysis.test.ts
git commit -m "test: close logger resources in Node tests"
```

- [ ] **Step 10: Install the declared FastAPI development toolchain**

```powershell
Push-Location mood_health_ai_service
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m ruff check app tests
.\.venv\Scripts\python.exe -m mypy app
Pop-Location
```

Expected: pytest, Ruff, and Mypy are importable. Record any real code failures as baseline defects before continuing; the ignored `.venv` produces no repository commit.

- [ ] **Step 11: Apply and commit safe Ruff baseline fixes**

Run `python -m ruff check app tests --fix`, review the diff, and commit only deterministic import, annotation-syntax, whitespace, and unused-import fixes. Add narrow `N815`/`N802` per-file ignores only where camelCase is the published JSON contract or the existing test name documents that contract.

- [ ] **Step 12: Repair remaining Ruff and strict Mypy findings without changing contracts**

Add concrete return and generic types, preserve camelCase wire fields, wrap long lines, and chain translated exceptions with `from e`. Remove only provably unused locals. Re-run pytest after each logical slice and create small commits for Ruff configuration, provider/contracts typing, and application/database typing.

- [ ] **Step 13: Re-run the complete FastAPI baseline gate**

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m ruff check app tests
.\.venv\Scripts\python.exe -m mypy app
```

Expected: 78 tests pass; Ruff and Mypy exit 0. Preserve and report the Starlette `httpx` deprecation warning separately because it originates in installed dependencies.

---

### Task 1: Replace the 8501 popup with an authenticated internal route

**Files:**
- Modify: `src/App.vue:216-220`
- Modify: `src/router/index.ts:358-365`
- Create: `src/__tests__/views/knowledge-assistant-navigation.test.ts`

**Interfaces:**
- Consumes: existing Vue Router instance imported by `src/App.vue` and `createRoutes()` from `src/router/index.ts`.
- Produces: `openAgentAssistant(): Promise<void> | void` navigating to `/ai/knowledge-assistant`, and a lazy route resolving `@/views/ai/KnowledgeAssistant.vue`.

- [ ] **Step 1: Write the failing navigation regression test**

```ts
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import App from '@/App.vue'
import { createRoutes } from '@/router'
import { useUserStore } from '@/stores/userStore'

describe('knowledge assistant navigation', () => {
  it('navigates in the current app without opening another window', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/ai/knowledge-assistant', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    await router.isReady()
    const pinia = createPinia()
    const openSpy = vi.spyOn(window, 'open')
    const wrapper = mount(App, { global: { plugins: [pinia, router] } })
    const userStore = useUserStore(pinia)
    userStore.user = { id: 7, username: 'student', role: 'student', email: 's@example.com' }
    await wrapper.vm.$nextTick()

    await wrapper.get('.nav-agent-link').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/ai/knowledge-assistant')
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('registers a protected knowledge assistant route', () => {
    const route = createRoutes().find(item => item.path === '/ai/knowledge-assistant')
    expect(route).toBeDefined()
    expect(route?.meta?.public).not.toBe(true)
  })
})
```

- [ ] **Step 2: Run the test and confirm the current popup behavior fails it**

Run: `npm run test:run -- src/__tests__/views/knowledge-assistant-navigation.test.ts`

Expected: FAIL because `App.vue` still contains `window.open(...8501...)` and the route is absent.

- [ ] **Step 3: Add the minimal route placeholder and internal navigation**

Add the route before the catch-all route:

```ts
{
  path: '/ai/knowledge-assistant',
  name: 'KnowledgeAssistant',
  component: () => import('@/views/ai/KnowledgeAssistant.vue'),
}
```

Replace the popup function:

```ts
const openAgentAssistant = () => {
  router.push('/ai/knowledge-assistant')
}
```

Create `src/views/ai/KnowledgeAssistant.vue` with only a semantic placeholder needed for the route to compile:

```vue
<template><main aria-labelledby="knowledge-title"><h1 id="knowledge-title">AI 知识助手</h1></main></template>
```

- [ ] **Step 4: Run the focused test and frontend typecheck**

Run: `npm run test:run -- src/__tests__/views/knowledge-assistant-navigation.test.ts`

Expected: 2 tests PASS.

Run: `npx vue-tsc --noEmit`

Expected: exit 0.

- [ ] **Step 5: Commit only the navigation slice**

```powershell
git add -- src/App.vue src/router/index.ts src/views/ai/KnowledgeAssistant.vue src/__tests__/views/knowledge-assistant-navigation.test.ts
git commit -m "fix: open knowledge assistant inside the app"
```

---

### Task 2: Add the FastAPI RAG contracts and deterministic retrieval boundary

**Files:**
- Modify: `mood_health_ai_service/requirements.txt`
- Modify: `mood_health_ai_service/pyproject.toml`
- Modify: `mood_health_ai_service/app/config.py`
- Modify: `mood_health_ai_service/app/models/contracts.py`
- Create: `mood_health_ai_service/app/rag/__init__.py`
- Create: `mood_health_ai_service/app/rag/knowledge_base.py`
- Create: `mood_health_ai_service/app/rag/retriever.py`
- Create: `mood_health_ai_service/tests/test_rag_service.py`

**Interfaces:**
- Consumes: the exact `KNOWLEDGE_BASE` records currently defined in `agent_app/rag/rag_service.py`.
- Produces: `retrieve_knowledge(query: str, limit: int) -> list[RetrievedKnowledge]`, `RagAnswerRequest`, `RagAnswerResponse`, and source metadata with `title` and `reference`.

- [ ] **Step 1: Write failing retrieval and contract tests**

```py
from pydantic import ValidationError
import pytest

from app.models.contracts import RagAnswerRequest
from app.rag.retriever import RetrievedKnowledge, retrieve_knowledge


def test_rag_request_rejects_empty_and_oversized_queries():
    with pytest.raises(ValidationError):
        RagAnswerRequest(query="", requestId="r1")
    with pytest.raises(ValidationError):
        RagAnswerRequest(query="x" * 1001, requestId="r1")


def test_retrieval_returns_real_sources_and_honors_limit(monkeypatch):
    monkeypatch.setattr(
        "app.rag.retriever._similarity_search",
        lambda query, limit: [
            RetrievedKnowledge(content="睡眠卫生", title="睡眠改善", reference="国家卫健委")
        ],
    )
    results = retrieve_knowledge("怎样改善睡眠", 1)
    assert len(results) == 1
    assert results[0].reference == "国家卫健委"
```

- [ ] **Step 2: Run the focused pytest file and confirm imports fail**

Run from `mood_health_ai_service`: `python -m pytest tests/test_rag_service.py -q`

Expected: FAIL because RAG contracts and modules do not exist.

- [ ] **Step 3: Add exact RAG contracts**

Append to `app/models/contracts.py`:

```py
class RagHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class RagAnswerRequest(BaseModel):
    model_config = {"extra": "forbid"}
    query: str = Field(..., min_length=1, max_length=1000)
    requestId: str = Field(..., min_length=1, max_length=128)
    history: List[RagHistoryMessage] = Field(default_factory=list, max_length=10)


class RagSource(BaseModel):
    title: str
    reference: str


class RagAnswerResponse(BaseModel):
    answer: str
    sources: List[RagSource] = Field(default_factory=list, max_length=3)
    requestId: str
    provider: str
    model: str
    usage: Optional[dict] = None
    fallbackUsed: Literal[False] = False
```

- [ ] **Step 4: Migrate knowledge entries without changing their content or references**

Create `app/rag/knowledge_base.py` by extracting the full `KNOWLEDGE_BASE: list[dict]` constant from `agent_app/rag/rag_service.py`. Normalize each record at module load to this internal type; do not add sources not present in the original list:

```py
from dataclasses import dataclass


@dataclass(frozen=True)
class KnowledgeRecord:
    content: str
    title: str
    reference: str


KNOWLEDGE_RECORDS = tuple(
    KnowledgeRecord(
        content=item["content"],
        title=item["content"].split("：", 1)[0][:30],
        reference=item["source"],
    )
    for item in KNOWLEDGE_BASE
)
```

- [ ] **Step 5: Add lazy Chroma retrieval with injectable search seam**

Add dependencies to both dependency manifests:

```text
chromadb>=0.5.0
sentence-transformers>=3.3.0
```

Implement `RetrievedKnowledge` and `_similarity_search` in `app/rag/retriever.py`. Use `chromadb.PersistentClient(path=settings.RAG_PERSIST_DIRECTORY)`, collection name `settings.RAG_COLLECTION_NAME`, `SentenceTransformer(settings.RAG_EMBEDDING_MODEL)`, normalized embeddings, and stable record IDs derived from SHA-256 of `content + reference`. `retrieve_knowledge` must trim the query and clamp `limit` to `1..settings.RAG_TOP_K`.

Add these typed settings:

```py
    RAG_EMBEDDING_MODEL: str = "BAAI/bge-small-zh-v1.5"
    RAG_COLLECTION_NAME: str = "mental_health_knowledge_bge_zh_v1"
RAG_PERSIST_DIRECTORY: str = "./data/chroma"
RAG_TOP_K: int = 3
```

- [ ] **Step 6: Run focused tests and static checks**

Runtime evidence recorded on 2026-08-02: the originally planned English-oriented `all-MiniLM-L6-v2` initialized successfully, but the Chinese query `怎样改善睡眠` ranked the anxiety-disorder diagnostic entry first instead of a sleep entry. Use `BAAI/bge-small-zh-v1.5` and a versioned collection name so an existing English-vector collection cannot be reused accidentally. The non-mocked acceptance query must return a source containing `睡眠` or the National Health Commission sleep-health reference.

Run from `mood_health_ai_service`:

```powershell
python -m pytest tests/test_rag_service.py -q
python -m ruff check app/rag app/models/contracts.py app/config.py tests/test_rag_service.py
python -m mypy app/rag app/models/contracts.py app/config.py
```

Expected: retrieval/contract tests PASS; Ruff and Mypy exit 0.

- [ ] **Step 7: Commit the retrieval boundary**

```powershell
git add -- mood_health_ai_service/requirements.txt mood_health_ai_service/pyproject.toml mood_health_ai_service/app/config.py mood_health_ai_service/app/models/contracts.py mood_health_ai_service/app/rag mood_health_ai_service/tests/test_rag_service.py
git commit -m "feat: add FastAPI knowledge retrieval boundary"
```

---

### Task 3: Generate cited answers through the signed FastAPI endpoint

**Files:**
- Modify: `mood_health_ai_service/app/main.py`
- Create: `mood_health_ai_service/app/rag/service.py`
- Create: `mood_health_ai_service/app/routers/rag.py`
- Create: `mood_health_ai_service/tests/test_rag_contract.py`

**Interfaces:**
- Consumes: `retrieve_knowledge(query, limit)`, `OpenAICompatibleProvider.chat`, and existing `verify_internal_auth`.
- Produces: signed `POST /api/rag/answer` returning `RagAnswerResponse` or explicit 401/502/503.

- [ ] **Step 1: Write failing endpoint tests for auth, citations, and failure mapping**

```py
from fastapi.testclient import TestClient


def test_rag_endpoint_requires_internal_auth(client: TestClient):
    response = client.post("/api/rag/answer", json={"query": "睡眠", "requestId": "r1"})
    assert response.status_code == 401


def test_rag_endpoint_returns_answer_and_retrieved_sources(client, signed_headers, monkeypatch):
    async def fake_answer(request):
        return {
            "answer": "保持规律作息。",
            "sources": [{"title": "睡眠卫生", "reference": "国家卫健委"}],
            "requestId": request.requestId,
            "provider": "deepseek",
            "model": "deepseek-chat",
            "usage": None,
            "fallbackUsed": False,
        }

    monkeypatch.setattr(
        "app.routers.rag.answer_question",
        fake_answer,
    )
    body = {"query": "怎样改善睡眠", "requestId": "r1", "history": []}
    response = client.post("/api/rag/answer", json=body, headers=signed_headers(body))
    assert response.status_code == 200
    assert response.json()["sources"][0]["reference"] == "国家卫健委"
```

- [ ] **Step 2: Run the endpoint test and confirm the route is absent**

Run: `python -m pytest tests/test_rag_contract.py -q`

Expected: FAIL with 404 for `/api/rag/answer`.

- [ ] **Step 3: Implement grounded prompt construction and provider call**

`answer_question(request: RagAnswerRequest) -> RagAnswerResponse` must:

```py
records = retrieve_knowledge(request.query, settings.RAG_TOP_K)
if not records:
    raise RagNotReadyError("知识库未返回可用内容")

context = "\n\n".join(
    f"资料 {index + 1}\n内容：{item.content}\n来源：{item.reference}"
    for index, item in enumerate(records)
)
messages = [
    {
        "role": "system",
        "content": (
            "你是心理健康知识助手。只能根据给定资料回答；资料不足时明确说不知道。"
            "不得诊断、开药或编造来源。回答使用简体中文，并提醒紧急风险应联系当地急救或专业人员。"
        ),
    },
    *[{"role": item.role, "content": item.content} for item in request.history[-10:]],
    {"role": "user", "content": f"资料：\n{context}\n\n问题：{request.query}"},
]
content, model, usage = await provider.chat(messages=messages, temperature=0.2, max_tokens=900)
```

Return only sources taken from `records`, de-duplicated by `reference` and capped at 3.

- [ ] **Step 4: Implement raw-body HMAC verification and route status mapping**

The route reads the exact request bytes, calls `verify_internal_auth(body.decode(), X-Signature, X-Timestamp, X-Nonce)`, parses `RagAnswerRequest`, and maps:

```py
except RagNotReadyError as error:
    raise HTTPException(status_code=503, detail=str(error)) from error
except Exception as error:
    logger.error("RAG answer failed requestId=%s type=%s", request.requestId, type(error).__name__)
    raise HTTPException(status_code=502, detail="知识助手暂时不可用") from error
```

Include the router in `app/main.py`.

- [ ] **Step 5: Run FastAPI focused and full tests**

```powershell
python -m pytest tests/test_rag_contract.py tests/test_rag_service.py -q
python -m pytest -q
python -m ruff check app tests
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit the RAG answer endpoint**

```powershell
git add -- mood_health_ai_service/app/main.py mood_health_ai_service/app/rag/service.py mood_health_ai_service/app/routers/rag.py mood_health_ai_service/tests/test_rag_contract.py
git commit -m "feat: add signed cited RAG answer endpoint"
```

---

### Task 4: Add authenticated Node proxy and user-isolated persistence

**Files:**
- Modify: `mood_health_server/src/app.ts`
- Modify: `mood_health_server/src/services/fastApiClient.ts`
- Create: `mood_health_server/src/db/migrations/0380_create_knowledge_assistant_messages.up.sql`
- Create: `mood_health_server/src/db/migrations/0380_create_knowledge_assistant_messages.down.sql`
- Create: `mood_health_server/src/repositories/knowledgeAssistantRepository.ts`
- Create: `mood_health_server/src/services/knowledgeAssistantService.ts`
- Create: `mood_health_server/src/controllers/knowledgeAssistantController.ts`
- Create: `mood_health_server/src/routes/knowledgeAssistantRoutes.ts`
- Create: `mood_health_server/tests/unit/knowledgeAssistant/knowledgeAssistantController.test.ts`
- Create: `mood_health_server/tests/unit/knowledgeAssistant/knowledgeAssistantRepository.test.ts`
- Modify: `mood_health_server/tests/unit/db/migrationFiles.test.ts`

**Interfaces:**
- Consumes: signed FastAPI request helper and `req.user.userId`.
- Produces: `POST /api/knowledge-assistant/messages`, `GET /sessions`, `GET /sessions/:id/messages`, plus repository functions `saveMessagePair`, `listSessions`, `loadMessages`, and `sessionBelongsToUser`.

- [x] **Step 1: Write failing controller tests**

```ts
it('derives the user id from authentication and ignores body identity', async () => {
  req.user = { userId: 7, username: 'student', role: 'student' } as any
  req.body = { message: '怎样改善睡眠？', sessionId: 's1', user_id: 99 }
  answerKnowledgeQuestionMock.mockResolvedValue(answer)

  await postMessage(req as AuthRequest, res as Response)

  expect(answerKnowledgeQuestionMock).toHaveBeenCalledWith(7, '怎样改善睡眠？', 's1')
})

it('does not persist a fake answer when FastAPI fails', async () => {
  callRagAnswerMock.mockRejectedValue(Object.assign(new Error('not ready'), { response: { status: 503 } }))
  await expect(answerKnowledgeQuestion(7, '睡眠', 's1')).rejects.toThrow('not ready')
  expect(saveMessagePairMock).not.toHaveBeenCalled()
})
```

- [x] **Step 2: Run focused tests and confirm missing modules fail**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/knowledgeAssistant/knowledgeAssistantController.test.ts tests/unit/knowledgeAssistant/knowledgeAssistantRepository.test.ts`

Expected: FAIL because the controller, service, and repository do not exist.

- [x] **Step 3: Add migration and migration-file assertions**

Up migration:

```sql
CREATE TABLE knowledge_assistant_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  session_id VARCHAR(36) NOT NULL,
  role ENUM('user', 'assistant') NOT NULL,
  content TEXT NOT NULL,
  sources_json JSON NULL,
  request_id VARCHAR(128) NOT NULL,
  provider VARCHAR(64) NULL,
  model VARCHAR(128) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_knowledge_user_session_created (user_id, session_id, created_at),
  INDEX idx_knowledge_request_id (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Down migration:

```sql
DROP TABLE IF EXISTS knowledge_assistant_messages;
```

- [x] **Step 4: Implement transactional and user-scoped repository methods**

Use `getMysqlPool().getConnection()`, `beginTransaction`, two parameterized inserts, `commit`, and `rollback`. `listSessions(userId)` groups only `WHERE user_id = ?`; `loadMessages(userId, sessionId)` uses both fields. Serialize sources with `JSON.stringify(answer.sources)` only for the assistant row.

Expose these exact types:

```ts
export interface KnowledgeSource { title: string; reference: string }
export interface RagAnswer {
  answer: string
  sources: KnowledgeSource[]
  requestId: string
  provider: string
  model: string
  fallbackUsed: false
}
export interface KnowledgeMessage { role: 'user' | 'assistant'; content: string; sources: KnowledgeSource[]; createdAt: string }
export interface KnowledgeSession { sessionId: string; title: string; lastMessageAt: string; messageCount: number }
export async function saveMessagePair(userId: number, sessionId: string, question: string, answer: RagAnswer): Promise<void>
export async function listSessions(userId: number): Promise<KnowledgeSession[]>
export async function loadMessages(userId: number, sessionId: string): Promise<KnowledgeMessage[]>
```

- [x] **Step 5: Add signed FastAPI call and service orchestration**

Add `callRagAnswer(requestBody)` to `fastApiClient.ts`, using `generateAuthHeaders(JSON.stringify(requestBody), token)`, `POST /api/rag/answer`, `proxy: false`, and no retry for 400/401/422/503. The service must trim input, generate `randomUUID()` when `sessionId` is absent, load the last 10 stored messages, generate a `requestId`, call FastAPI, then save the pair only after success.

- [x] **Step 6: Add authenticated routes and error mapping**

```ts
router.use(authenticate)
router.post('/messages', validateMessage, validateRequest, postMessage)
router.get('/sessions', getSessions)
router.get('/sessions/:id/messages', getMessages)
```

Map FastAPI 503 to Node 503, other upstream failures to 502, validation to 400, and foreign/missing sessions to 404. Every error body uses existing `apiFailure` and includes the request ID in `data` when available.

- [x] **Step 7: Run focused tests, Node typecheck, and migration checks**

```powershell
npm --prefix mood_health_server test -- --runTestsByPath tests/unit/knowledgeAssistant/knowledgeAssistantController.test.ts tests/unit/knowledgeAssistant/knowledgeAssistantRepository.test.ts tests/unit/db/migrationFiles.test.ts
npm --prefix mood_health_server run typecheck
```

Expected: all tests PASS and TypeScript exits 0.

- [x] **Step 8: Commit the authenticated Node slice**

```powershell
git add -- mood_health_server/src/app.ts mood_health_server/src/services/fastApiClient.ts mood_health_server/src/db/migrations/0380_create_knowledge_assistant_messages.up.sql mood_health_server/src/db/migrations/0380_create_knowledge_assistant_messages.down.sql mood_health_server/src/repositories/knowledgeAssistantRepository.ts mood_health_server/src/services/knowledgeAssistantService.ts mood_health_server/src/controllers/knowledgeAssistantController.ts mood_health_server/src/routes/knowledgeAssistantRoutes.ts mood_health_server/tests/unit/knowledgeAssistant mood_health_server/tests/unit/db/migrationFiles.test.ts
git commit -m "feat: add authenticated knowledge assistant API"
```

---

### Task 5: Build the in-app knowledge assistant experience

**Files:**
- Create: `src/api/knowledgeAssistant.ts`
- Replace: `src/views/ai/KnowledgeAssistant.vue`
- Create: `src/__tests__/views/knowledge-assistant-page.test.ts`

**Interfaces:**
- Consumes: Node endpoints from Task 4.
- Produces: responsive knowledge assistant page with session history, citations, pending/error states, and retry.

- [x] **Step 1: Write failing page behavior tests**

```ts
it('renders the answer and server-provided sources after sending', async () => {
  sendKnowledgeMessageMock.mockResolvedValue({
    sessionId: 's1',
    answer: '保持规律作息。',
    sources: [{ title: '睡眠卫生', reference: '国家卫健委' }],
    requestId: 'r1', provider: 'deepseek', model: 'deepseek-chat', fallbackUsed: false,
  })
  const wrapper = mountPage()
  await wrapper.get('textarea').setValue('怎样改善睡眠？')
  await wrapper.get('[data-test="send"]').trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('保持规律作息')
  expect(wrapper.text()).toContain('国家卫健委')
})

it('keeps the failed question and offers retry', async () => {
  sendKnowledgeMessageMock.mockRejectedValue(new Error('知识助手暂时不可用'))
  const wrapper = mountPage()
  await wrapper.get('textarea').setValue('怎样改善睡眠？')
  await wrapper.get('[data-test="send"]').trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('怎样改善睡眠？')
  expect(wrapper.get('[data-test="retry"]').exists()).toBe(true)
})
```

- [x] **Step 2: Run the page test and confirm the placeholder cannot satisfy it**

Run: `npm run test:run -- src/__tests__/views/knowledge-assistant-page.test.ts`

Expected: FAIL because API functions and interactive UI are absent.

- [x] **Step 3: Add the typed frontend API**

```ts
export interface KnowledgeSource { title: string; reference: string }
export interface KnowledgeAnswer {
  sessionId: string
  answer: string
  sources: KnowledgeSource[]
  requestId: string
  provider: string
  model: string
  fallbackUsed: false
}

export const sendKnowledgeMessage = (message: string, sessionId?: string) =>
  request<KnowledgeAnswer>({ url: '/api/knowledge-assistant/messages', method: 'post', data: { message, sessionId }, timeout: 60_000 })
```

Add matching `getKnowledgeSessions()` and `getKnowledgeMessages(sessionId)` functions using the two GET routes.

- [x] **Step 4: Implement the page states**

The page must have:

- `<main aria-labelledby="knowledge-title">` and a visible scope disclaimer.
- Four sample-question buttons that populate the textarea without auto-sending.
- User and assistant message bubbles using text interpolation, never `v-html`.
- Source chips/links rendered only from `message.sources`.
- 1000-character textarea, disabled send while pending, and `data-test="send"`.
- Failed user message retained with `data-test="retry"`; retry reuses the same content.
- History loading, session switching, new-session action, mobile-friendly single-column layout, and existing CSS theme variables.
- A visible request ID in the error detail when the API provides one.

- [x] **Step 5: Run page tests, navigation tests, typecheck, and accessibility-focused assertions**

```powershell
npm run test:run -- src/__tests__/views/knowledge-assistant-navigation.test.ts src/__tests__/views/knowledge-assistant-page.test.ts
npx vue-tsc --noEmit
npm run lint:check
```

Expected: focused tests PASS; typecheck and lint exit 0.

- [x] **Step 6: Commit the frontend experience**

```powershell
git add -- src/api/knowledgeAssistant.ts src/views/ai/KnowledgeAssistant.vue src/__tests__/views/knowledge-assistant-page.test.ts
git commit -m "feat: add cited knowledge assistant experience"
```

---

### Task 6: Integrate startup readiness and run end-to-end acceptance

**Files:**
- Modify: `mood_health_ai_service/app/main.py`
- Modify: `scripts/doctor.mjs`
- Modify: `start-project.ps1`
- Modify: `scripts/one-click-start.test.mjs`
- Create: `tests/e2e/knowledge-assistant.spec.ts`
- Modify: `docs/COMMANDS.md`

**Interfaces:**
- Consumes: complete Vue → Node → FastAPI RAG → MySQL path.
- Produces: startup/readiness diagnostics and executable acceptance coverage proving no dependency on 8501.

- [ ] **Step 1: Write failing startup and browser acceptance tests**

Extend the launcher test to assert `start-project.ps1` waits for RAG readiness and contains no Streamlit launch requirement. Add Playwright coverage:

```ts
test('opens and uses the knowledge assistant inside the authenticated app', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'AI 知识助手' }).click()
  await expect(page).toHaveURL(/\/ai\/knowledge-assistant$/)
  const popupCount = page.context().pages().length
  expect(popupCount).toBe(1)
  await page.getByRole('textbox').fill('怎样改善睡眠？')
  await page.getByRole('button', { name: '发送' }).click()
  await expect(page.locator('[data-test="assistant-answer"]')).not.toBeEmpty()
  await expect(page.locator('[data-test="source"]')).toHaveCount(1)
})
```

- [ ] **Step 2: Run launcher test and E2E test to verify the missing diagnostics/behavior fail**

```powershell
node scripts/one-click-start.test.mjs
npx playwright test tests/e2e/knowledge-assistant.spec.ts --project=chromium
```

Expected: launcher assertion or E2E path fails before integration changes.

- [ ] **Step 3: Add RAG readiness and doctor checks**

`/api/health/ready` adds `checks.rag` and stays 503 until the vector index is initialized. `start-project.ps1` waits for readiness with a bounded timeout and prints a clear instruction when the embedding model/index cannot initialize. `doctor.mjs` checks configured FastAPI base URL and reports the RAG readiness result without printing secrets. It must not check or require port 8501.

- [ ] **Step 4: Update commands documentation**

Document that `npm run start-all:with-ai` launches the knowledge assistant through the existing FastAPI service, that the product URL is `/ai/knowledge-assistant`, and that no separate Streamlit command is required.

- [ ] **Step 5: Run fresh full verification**

```powershell
node scripts/one-click-start.test.mjs
npm run test:run
npm --prefix mood_health_server run test:stable
Push-Location mood_health_ai_service; python -m pytest -q; python -m ruff check app tests; Pop-Location
npm run typecheck:all
npm run build:all
npx playwright test tests/e2e/knowledge-assistant.spec.ts --project=chromium
```

Expected: every command exits 0. Record exact test counts and any warnings; do not describe unrun commands as passed.

- [ ] **Step 6: Verify runtime and data evidence manually**

With the one-click launcher running:

```powershell
curl.exe --noproxy '*' -sS http://127.0.0.1:3001/
curl.exe --noproxy '*' -sS http://127.0.0.1:3000/health
curl.exe --noproxy '*' -sS http://127.0.0.1:8001/api/health/ready
netstat -ano | Select-String ':3000|:3001|:8001|:8501'
```

Verify browser request ordering, a non-empty cited answer, the two persisted rows for the authenticated user, refresh restoration, a second user's 404 for the first session, and explicit UI failure with no new assistant row after stopping FastAPI.

- [ ] **Step 7: Commit integration and acceptance coverage**

```powershell
git add -- mood_health_ai_service/app/main.py scripts/doctor.mjs start-project.ps1 scripts/one-click-start.test.mjs tests/e2e/knowledge-assistant.spec.ts docs/COMMANDS.md
git commit -m "test: verify RAG knowledge assistant end to end"
```

---

## Plan Self-Review

- Spec coverage: baseline restoration plus internal route, Node-only browser boundary, FastAPI retrieval/provider, citations, persistence, user isolation, failure handling, startup readiness, unit/contract/E2E tests, and small commits are assigned to Tasks 0-6.
- Scope check: all tasks form one vertical feature; Streamlit retirement, admin ingestion, web search, and unrelated AI refactors remain excluded.
- Type consistency: `KnowledgeSource` uses `title/reference` in FastAPI, Node, and Vue; success response consistently uses `answer`, `sessionId`, `requestId`, `provider`, `model`, and `fallbackUsed: false`.
- Completeness scan: every implementation step names concrete files, signatures, status codes, and verification commands; no deferred or unspecified work remains.
