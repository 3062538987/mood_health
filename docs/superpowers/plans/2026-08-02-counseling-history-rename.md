# Counseling History and Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复心理咨询历史会话列表和消息加载，并提供可持久化、仅限本人操作的会话重命名功能。

**Architecture:** 保留 `counseling_sessions` 作为消息表，新增独立元数据表保存自定义标题。Node/Express 聚合会话、生成默认标题并提供 PATCH 重命名接口；Vue 请求层使用已经解包的数据，页面通过独立侧边栏组件完成加载、切换、错误恢复和内联重命名。

**Tech Stack:** Vue 3、TypeScript、Vitest、Vue Test Utils、Element Plus、Node.js、Express、MySQL、Jest、SQL migrations

## Global Constraints

- 标题去除首尾空格后必须为 1～30 个字符，允许重名。
- 默认标题取第一条用户消息；手动标题持久化后优先级更高且不会被后续消息覆盖。
- 重命名只能作用于当前登录用户自己的会话；不存在和越权统一返回 404。
- 加载失败必须显示错误和重试入口，不能静默显示为空列表。
- 本次不实现删除、批量管理、置顶、归档、AI 自动总结标题或无限滚动。
- 当前工作区包含无关改动；每次只暂存任务明确列出的文件，禁止 `git add -A`。

## File Map

- Create: `mood_health_server/src/db/migrations/0370_create_counseling_session_metadata.up.sql` — 创建会话标题元数据表。
- Create: `mood_health_server/src/db/migrations/0370_create_counseling_session_metadata.down.sql` — 回滚元数据表。
- Modify: `mood_health_server/tests/unit/db/migrationFiles.test.ts` — 锁定新增迁移文件。
- Create: `mood_health_server/tests/unit/services/counselingSessionService.test.ts` — 覆盖默认标题、标题优先级和所有权写入。
- Modify: `mood_health_server/src/services/counselingSessionService.ts` — 会话聚合、默认标题和重命名存储。
- Create: `mood_health_server/tests/unit/controllers/counselingSessionController.test.ts` — 覆盖重命名接口契约。
- Modify: `mood_health_server/src/controllers/counselingController.ts` — 标题校验和重命名 handler。
- Modify: `mood_health_server/src/routes/counselingRoutes.ts` — 注册 PATCH 路由。
- Modify: `src/__tests__/api/counseling.test.ts` — 覆盖历史与重命名请求契约。
- Modify: `src/api/counseling.ts` — 完善会话类型并新增重命名请求。
- Create: `src/components/counseling/CounselingHistorySidebar.vue` — GPT 式会话列表、状态和内联编辑。
- Create: `src/__tests__/components/counseling/CounselingHistorySidebar.test.ts` — 覆盖组件交互。
- Create: `src/__tests__/views/counseling-history.test.ts` — 覆盖页面解包、切换和失败提示。
- Modify: `src/views/counseling/Counseling.vue` — 接入侧边栏组件和正确的数据流。

---

### Task 1: Add Session Metadata Migration

**Files:**
- Create: `mood_health_server/src/db/migrations/0370_create_counseling_session_metadata.up.sql`
- Create: `mood_health_server/src/db/migrations/0370_create_counseling_session_metadata.down.sql`
- Modify: `mood_health_server/tests/unit/db/migrationFiles.test.ts`

**Interfaces:**
- Produces: MySQL table `counseling_session_metadata(user_id, session_id, title, created_at, updated_at)` with unique key `(user_id, session_id)`.

- [ ] **Step 1: Extend the migration manifest test**

Add the two filenames after the `0360` entries:

```ts
'0370_create_counseling_session_metadata.down.sql',
'0370_create_counseling_session_metadata.up.sql',
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/db/migrationFiles.test.ts`

Expected: FAIL because the two `0370` files do not exist.

- [ ] **Step 3: Add the up and down migrations**

```sql
CREATE TABLE counseling_session_metadata (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  session_id VARCHAR(36) NOT NULL,
  title VARCHAR(30) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_counseling_session_metadata_user_session (user_id, session_id),
  INDEX idx_counseling_session_metadata_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

```sql
DROP TABLE counseling_session_metadata;
```

- [ ] **Step 4: Run the migration test and backend typecheck**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/db/migrationFiles.test.ts`

Expected: PASS.

Run: `npm --prefix mood_health_server run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit only migration files**

```bash
git add mood_health_server/src/db/migrations/0370_create_counseling_session_metadata.up.sql mood_health_server/src/db/migrations/0370_create_counseling_session_metadata.down.sql mood_health_server/tests/unit/db/migrationFiles.test.ts
git commit -m "feat: add counseling session metadata migration"
```

### Task 2: Implement Session Titles in the Service Layer

**Files:**
- Create: `mood_health_server/tests/unit/services/counselingSessionService.test.ts`
- Modify: `mood_health_server/src/services/counselingSessionService.ts`

**Interfaces:**
- Produces: `CounselingSession.title: string`.
- Produces: `buildDefaultSessionTitle(content: string): string`.
- Produces: `renameSession(userId: number, sessionId: string, title: string): Promise<boolean>`.

- [ ] **Step 1: Write failing service tests with a mocked MySQL pool**

```ts
jest.mock('../../../src/config/mysql', () => ({ getMysqlPool: jest.fn() }))

it('uses the first user message when no saved title exists', async () => {
  query.mockResolvedValueOnce([[{
    session_id: 's1', custom_title: null,
    first_user_message: '  最近总是睡不好，白天也很累  ',
    created_at: new Date('2026-08-02T08:00:00Z'),
    last_message_at: new Date('2026-08-02T09:00:00Z'), message_count: 2,
  }], []])
  await expect(listSessions(7)).resolves.toEqual([
    expect.objectContaining({ sessionId: 's1', title: '最近总是睡不好，白天也很累' }),
  ])
})

it('prefers the saved title', async () => {
  query.mockResolvedValueOnce([[{
    session_id: 's1', custom_title: '睡眠调整计划', first_user_message: '原始内容',
    created_at: new Date(), last_message_at: new Date(), message_count: 2,
  }], []])
  await expect(listSessions(7)).resolves.toEqual([
    expect.objectContaining({ title: '睡眠调整计划' }),
  ])
})

it('returns false without writing when the session is not owned by the user', async () => {
  query.mockResolvedValueOnce([[], []])
  await expect(renameSession(7, 'other-session', '新标题')).resolves.toBe(false)
  expect(query).toHaveBeenCalledTimes(1)
})

it('upserts the title for an owned session', async () => {
  query.mockResolvedValueOnce([[{ exists: 1 }], []]).mockResolvedValueOnce([{}, []])
  await expect(renameSession(7, 's1', '睡眠调整计划')).resolves.toBe(true)
  expect(query.mock.calls[1][1]).toEqual([7, 's1', '睡眠调整计划'])
})
```

- [ ] **Step 2: Run the service test and verify it fails**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/services/counselingSessionService.test.ts`

Expected: FAIL because `title`, `buildDefaultSessionTitle`, and `renameSession` are missing.

- [ ] **Step 3: Implement the minimal service behavior**

Use this aggregation query so each row contains metrics, the first user message, and any saved title:

```sql
SELECT grouped.session_id,
       grouped.created_at,
       grouped.last_message_at,
       grouped.message_count,
       metadata.title AS custom_title,
       first_user.content AS first_user_message
FROM (
  SELECT user_id, session_id,
         MIN(created_at) AS created_at,
         MAX(created_at) AS last_message_at,
         COUNT(*) AS message_count
  FROM counseling_sessions
  WHERE user_id = ? AND role != 'system'
  GROUP BY user_id, session_id
) AS grouped
LEFT JOIN counseling_session_metadata AS metadata
  ON metadata.user_id = grouped.user_id
 AND metadata.session_id = grouped.session_id
LEFT JOIN counseling_sessions AS first_user
  ON first_user.id = (
    SELECT MIN(candidate.id)
    FROM counseling_sessions AS candidate
    WHERE candidate.user_id = grouped.user_id
      AND candidate.session_id = grouped.session_id
      AND candidate.role = 'user'
  )
ORDER BY grouped.last_message_at DESC
LIMIT 20
```

Implement the title helpers and write operation:

```ts
export function buildDefaultSessionTitle(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim()
  return normalized.slice(0, 30) || '新对话'
}

export async function renameSession(
  userId: number,
  sessionId: string,
  title: string
): Promise<boolean> {
  const pool = getMysqlPool()
  const [ownedRows] = await pool.query(
    `SELECT 1 AS \`exists\` FROM counseling_sessions
     WHERE user_id = ? AND session_id = ? LIMIT 1`,
    [userId, sessionId]
  )
  if ((ownedRows as any[]).length === 0) return false

  await pool.query(
    `INSERT INTO counseling_session_metadata (user_id, session_id, title)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE title = VALUES(title), updated_at = CURRENT_TIMESTAMP`,
    [userId, sessionId, title]
  )
  return true
}
```

Add `title` to `CounselingSession`, select `custom_title` and `first_user_message` in `listSessions`, then map `title: r.custom_title || buildDefaultSessionTitle(r.first_user_message || '')`.

- [ ] **Step 4: Run service tests and typecheck**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/services/counselingSessionService.test.ts`

Expected: PASS.

Run: `npm --prefix mood_health_server run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the service slice**

```bash
git add mood_health_server/src/services/counselingSessionService.ts mood_health_server/tests/unit/services/counselingSessionService.test.ts
git commit -m "feat: support counseling session titles"
```

### Task 3: Add the Authenticated Rename Endpoint

**Files:**
- Create: `mood_health_server/tests/unit/controllers/counselingSessionController.test.ts`
- Modify: `mood_health_server/src/controllers/counselingController.ts`
- Modify: `mood_health_server/src/routes/counselingRoutes.ts`

**Interfaces:**
- Consumes: `renameSession(userId, sessionId, title): Promise<boolean>` from Task 2.
- Produces: `PATCH /api/counseling/sessions/:id` with `{ title: string }`.
- Produces success data: `{ sessionId: string; title: string }`.

- [ ] **Step 1: Write failing controller contract tests**

Mock `renameSession` and call `renameSessionHandler` directly:

```ts
it('trims and saves a valid title', async () => {
  renameSessionMock.mockResolvedValue(true)
  req.params = { id: 's1' }
  req.body = { title: '  睡眠调整计划  ' }
  await renameSessionHandler(req as AuthRequest, res as Response)
  expect(renameSessionMock).toHaveBeenCalledWith(7, 's1', '睡眠调整计划')
  expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
    code: 0, data: { sessionId: 's1', title: '睡眠调整计划' },
  }))
})

it.each([undefined, '', '   ', 'a'.repeat(31)])('rejects invalid title %p', async title => {
  req.params = { id: 's1' }
  req.body = { title }
  await renameSessionHandler(req as AuthRequest, res as Response)
  expect(statusMock).toHaveBeenCalledWith(400)
})

it('returns 404 for a missing or foreign session', async () => {
  renameSessionMock.mockResolvedValue(false)
  req.params = { id: 's1' }
  req.body = { title: '新标题' }
  await renameSessionHandler(req as AuthRequest, res as Response)
  expect(statusMock).toHaveBeenCalledWith(404)
})
```

- [ ] **Step 2: Run the controller test and verify it fails**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/controllers/counselingSessionController.test.ts`

Expected: FAIL because `renameSessionHandler` is missing.

- [ ] **Step 3: Implement handler and route**

```ts
export const renameSessionHandler = async (req: AuthRequest, res: Response) => {
  const sessionId = req.params.id as string
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
  if (!sessionId || title.length < 1 || title.length > 30) {
    return res.status(400).json(apiFailure(400, '会话标题长度必须为1到30个字符'))
  }
  const renamed = await renameSession(req.user!.userId, sessionId, title)
  if (!renamed) return res.status(404).json(apiFailure(404, '会话不存在'))
  return res.json(apiSuccess({ sessionId, title }, '重命名成功'))
}
```

Register after the GET-by-id route:

```ts
router.patch('/sessions/:id', renameSessionHandler)
```

Wrap service errors in the existing controller logging/500 response pattern.

- [ ] **Step 4: Run focused backend tests and typecheck**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/controllers/counselingSessionController.test.ts tests/unit/services/counselingSessionService.test.ts`

Expected: PASS.

Run: `npm --prefix mood_health_server run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the endpoint slice**

```bash
git add mood_health_server/src/controllers/counselingController.ts mood_health_server/src/routes/counselingRoutes.ts mood_health_server/tests/unit/controllers/counselingSessionController.test.ts
git commit -m "feat: add counseling session rename endpoint"
```

### Task 4: Add Frontend History API Contracts

**Files:**
- Modify: `src/__tests__/api/counseling.test.ts`
- Modify: `src/api/counseling.ts`

**Interfaces:**
- Produces: `SessionItem.title: string`.
- Produces: `SessionMessage { role, content, createdAt? }`.
- Produces: `renameSession(sessionId: string, title: string): Promise<{ sessionId: string; title: string }>`.

- [ ] **Step 1: Add failing request-contract tests**

```ts
it('loads the unwrapped history list', async () => {
  requestMock.mockResolvedValueOnce([{ sessionId: 's1', title: '睡眠调整计划' }])
  await expect(getSessions()).resolves.toEqual([{ sessionId: 's1', title: '睡眠调整计划' }])
  expect(requestMock).toHaveBeenCalledWith({ url: '/api/counseling/sessions', method: 'get' })
})

it('renames a session', async () => {
  requestMock.mockResolvedValueOnce({ sessionId: 's1', title: '新标题' })
  await renameSession('s1', '新标题')
  expect(requestMock).toHaveBeenCalledWith({
    url: '/api/counseling/sessions/s1', method: 'patch', data: { title: '新标题' },
  })
})
```

- [ ] **Step 2: Run the API test and verify it fails**

Run: `npm run test:run -- src/__tests__/api/counseling.test.ts`

Expected: FAIL because `renameSession` and `SessionItem.title` are missing.

- [ ] **Step 3: Implement types and API wrapper**

```ts
export interface SessionItem {
  sessionId: string
  title: string
  createdAt: string
  lastMessageAt: string
  messageCount: number
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: string
}

export function renameSession(sessionId: string, title: string) {
  return request<{ sessionId: string; title: string }>({
    url: `/api/counseling/sessions/${sessionId}`,
    method: 'patch',
    data: { title },
  })
}
```

Change `loadSessionMessages` to return `request<SessionMessage[]>`.

- [ ] **Step 4: Run the API test and frontend typecheck**

Run: `npm run test:run -- src/__tests__/api/counseling.test.ts`

Expected: PASS.

Run: `npx vue-tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit the API slice**

```bash
git add src/api/counseling.ts src/__tests__/api/counseling.test.ts
git commit -m "feat: add counseling history API contracts"
```

### Task 5: Build the GPT-Style History Sidebar Component

**Files:**
- Create: `src/components/counseling/CounselingHistorySidebar.vue`
- Create: `src/__tests__/components/counseling/CounselingHistorySidebar.test.ts`

**Interfaces:**
- Consumes props: `sessions: SessionItem[]`, `currentSessionId: string`, `loading: boolean`, `error: string`.
- Emits: `select(sessionId: string)`, `create`, `retry`, `rename({ sessionId, title })`, `close`.

- [ ] **Step 1: Write failing component tests**

```ts
it('renders titles and marks the current session', () => {
  const wrapper = mountSidebar({ sessions, currentSessionId: 's1' })
  expect(wrapper.get('[data-session-id="s1"]').classes()).toContain('active')
  expect(wrapper.text()).toContain('睡眠调整计划')
})

it('emits a trimmed rename on Enter', async () => {
  const wrapper = mountSidebar({ sessions })
  await wrapper.get('[aria-label="会话操作"]').trigger('click')
  await wrapper.get('[data-action="rename"]').trigger('click')
  await wrapper.get('input').setValue('  新标题  ')
  await wrapper.get('input').trigger('keydown.enter')
  expect(wrapper.emitted('rename')?.[0]).toEqual([{ sessionId: 's1', title: '新标题' }])
})

it('shows validation and does not emit an invalid title', async () => {
  const wrapper = mountSidebar({ sessions })
  await wrapper.get('[aria-label="会话操作"]').trigger('click')
  await wrapper.get('[data-action="rename"]').trigger('click')
  await wrapper.get('input').setValue('   ')
  await wrapper.get('input').trigger('keydown.enter')
  expect(wrapper.text()).toContain('标题长度为1到30个字符')
  expect(wrapper.emitted('rename')).toBeUndefined()
})

it('shows retry only for load failures', async () => {
  const wrapper = mountSidebar({ sessions: [], error: '历史会话加载失败' })
  await wrapper.get('[data-action="retry"]').trigger('click')
  expect(wrapper.emitted('retry')).toHaveLength(1)
})

it('cancels rename on Escape without emitting', async () => {
  const wrapper = mountSidebar({ sessions })
  await wrapper.get('[aria-label="会话操作"]').trigger('click')
  await wrapper.get('[data-action="rename"]').trigger('click')
  await wrapper.get('input').setValue('不会保存')
  await wrapper.get('input').trigger('keydown.esc')
  expect(wrapper.find('input').exists()).toBe(false)
  expect(wrapper.emitted('rename')).toBeUndefined()
})
```

- [ ] **Step 2: Run the component test and verify it fails**

Run: `npm run test:run -- src/__tests__/components/counseling/CounselingHistorySidebar.test.ts`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the isolated component**

Use semantic buttons and an inline input. Keep only one open menu/edit session at a time. Derive state with:

```ts
const menuSessionId = ref('')
const editingSessionId = ref('')
const renameDraft = ref('')
const renameError = ref('')
const renameEditorRef = ref<HTMLElement | null>(null)

onClickOutside(renameEditorRef, () => {
  if (editingSessionId.value) cancelRename()
})

const submitRename = () => {
  const title = renameDraft.value.trim()
  if (title.length < 1 || title.length > 30) {
    renameError.value = '标题长度为1到30个字符'
    return
  }
  emit('rename', { sessionId: editingSessionId.value, title })
  cancelRename()
}
```

The template must include loading, error/retry, empty state, active marker, `…` menu, rename input, confirm and cancel buttons. Stop propagation on menu/editor clicks so they never switch sessions. Use `aria-label` on close, menu, confirm, and cancel controls. Style the drawer at `300px` desktop and `min(86vw, 340px)` on narrow screens; use semantic theme variables already present in `Counseling.vue`.

Import `onClickOutside` from `@vueuse/core`, bind `renameEditorRef` to the inline editor, call `cancelRename` from `keydown.esc`, and cover Escape in the test above. The `onClickOutside` binding provides the approved blank-area cancellation behavior.

- [ ] **Step 4: Run component tests and frontend typecheck**

Run: `npm run test:run -- src/__tests__/components/counseling/CounselingHistorySidebar.test.ts`

Expected: PASS.

Run: `npx vue-tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit the component slice**

```bash
git add src/components/counseling/CounselingHistorySidebar.vue src/__tests__/components/counseling/CounselingHistorySidebar.test.ts
git commit -m "feat: add counseling history sidebar"
```

### Task 6: Integrate History Loading, Switching, and Rename Recovery

**Files:**
- Create: `src/__tests__/views/counseling-history.test.ts`
- Modify: `src/views/counseling/Counseling.vue`
- Modify: `src/__tests__/views/counseling-send-failure.test.ts`

**Interfaces:**
- Consumes: `getSessions(): Promise<SessionItem[]>`, `loadSessionMessages(): Promise<SessionMessage[]>`, `renameSession()` and `CounselingHistorySidebar`.

- [ ] **Step 1: Write failing page integration tests**

```ts
it('renders the already-unwrapped history response', async () => {
  getSessionsMock.mockResolvedValueOnce([session])
  const wrapper = mountCounseling()
  await flushPromises()
  await wrapper.get('.sidebar-toggle').trigger('click')
  expect(wrapper.text()).toContain(session.title)
})

it('loads the already-unwrapped message array when a session is selected', async () => {
  getSessionsMock.mockResolvedValueOnce([session])
  loadSessionMessagesMock.mockResolvedValueOnce([
    { role: 'user', content: '最近睡不好', createdAt: '2026-08-02T08:00:00Z' },
    { role: 'assistant', content: '我在听。', createdAt: '2026-08-02T08:00:01Z' },
  ])
  const wrapper = mountCounseling()
  await flushPromises()
  await wrapper.get('.sidebar-toggle').trigger('click')
  await wrapper.get('[data-session-id="s1"]').trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('最近睡不好')
  expect(wrapper.text()).toContain('我在听。')
})

it('keeps the old title and reports a rename failure', async () => {
  getSessionsMock.mockResolvedValueOnce([session])
  renameSessionMock.mockRejectedValueOnce(new Error('网络异常'))
  const wrapper = mountCounseling()
  await flushPromises()
  await wrapper.get('.sidebar-toggle').trigger('click')
  await wrapper.get('[aria-label="会话操作"]').trigger('click')
  await wrapper.get('[data-action="rename"]').trigger('click')
  await wrapper.get('input').setValue('新标题')
  await wrapper.get('input').trigger('keydown.enter')
  await flushPromises()
  expect(wrapper.text()).toContain(session.title)
  expect(wrapper.text()).not.toContain('新标题')
  expect(messageErrorMock).toHaveBeenCalledWith('网络异常')
})

it('shows load failure and retries', async () => {
  getSessionsMock.mockRejectedValueOnce(new Error('网络异常')).mockResolvedValueOnce([session])
  const wrapper = mountCounseling()
  await flushPromises()
  await wrapper.get('.sidebar-toggle').trigger('click')
  expect(wrapper.text()).toContain('历史会话加载失败，请重试')
  await wrapper.get('[data-action="retry"]').trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain(session.title)
})
```

- [ ] **Step 2: Run page tests and verify they fail**

Run: `npm run test:run -- src/__tests__/views/counseling-history.test.ts src/__tests__/views/counseling-send-failure.test.ts`

Expected: FAIL because the page still reads `data.data` and has no rename/error state.

- [ ] **Step 3: Integrate the component and correct request handling**

Replace the inline sidebar template/styles with `CounselingHistorySidebar`. Add:

```ts
const sessionsLoading = ref(false)
const sessionsError = ref('')

const loadSessions = async () => {
  sessionsLoading.value = true
  sessionsError.value = ''
  try {
    sessions.value = await getSessions()
  } catch {
    sessionsError.value = '历史会话加载失败，请重试'
  } finally {
    sessionsLoading.value = false
  }
}

const handleRenameSession = async (payload: { sessionId: string; title: string }) => {
  try {
    const renamed = await renameSession(payload.sessionId, payload.title)
    sessions.value = sessions.value.map(session =>
      session.sessionId === payload.sessionId ? { ...session, title: renamed.title } : session
    )
    ElMessage.success('会话已重命名')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '重命名失败，请重试')
  }
}
```

In `switchSession`, do not set `currentSessionId` until `await loadSessionMessages(sessionId)` succeeds; map the returned array directly. On failure keep the current messages/session and call `ElMessage.error('会话加载失败，请重试')`.

Update `counseling-send-failure.test.ts` API mocks to include `renameSession`, and add `success` to the Element Plus message mock so existing tests remain isolated.

- [ ] **Step 4: Run focused frontend tests and typecheck**

Run: `npm run test:run -- src/__tests__/views/counseling-history.test.ts src/__tests__/views/counseling-send-failure.test.ts src/__tests__/components/counseling/CounselingHistorySidebar.test.ts src/__tests__/api/counseling.test.ts`

Expected: PASS.

Run: `npx vue-tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit the page integration**

```bash
git add src/views/counseling/Counseling.vue src/__tests__/views/counseling-history.test.ts src/__tests__/views/counseling-send-failure.test.ts
git commit -m "fix: restore counseling history and rename flow"
```

### Task 7: Verify the Full Feature

**Files:**
- Modify only if a verification-discovered defect is directly within the files listed above; create a separate fix commit for each defect.

**Interfaces:**
- Verifies the complete Vue → Node/Express → MySQL history and rename path without invoking the AI provider.

- [ ] **Step 1: Run all focused tests**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/db/migrationFiles.test.ts tests/unit/services/counselingSessionService.test.ts tests/unit/controllers/counselingSessionController.test.ts`

Expected: PASS.

Run: `npm run test:run -- src/__tests__/api/counseling.test.ts src/__tests__/components/counseling/CounselingHistorySidebar.test.ts src/__tests__/views/counseling-history.test.ts src/__tests__/views/counseling-send-failure.test.ts src/__tests__/styles/counseling-theme.test.ts`

Expected: PASS.

- [ ] **Step 2: Run static verification and builds**

Run: `npm run typecheck:all`

Expected: PASS.

Run: `npm run build:all`

Expected: PASS, allowing only pre-existing non-fatal bundling warnings.

- [ ] **Step 3: Apply the migration in the active local environment**

Run: `npm --prefix mood_health_server run db:migrate`

Expected: output reports migration `0370` applied, or status shows it already applied.

- [ ] **Step 4: Perform authenticated browser acceptance**

Verify with a student account:

1. Open counseling and confirm existing sessions appear by title.
2. Switch sessions and confirm their stored messages render.
3. Rename a session, refresh, and confirm the new title persists.
4. Enter an empty and 31-character title and confirm neither saves.
5. Simulate a failed list request and confirm error plus retry, not an empty-state lie.
6. Check the drawer and rename controls at a mobile viewport.

- [ ] **Step 5: Confirm repository scope**

Run: `git status --short`

Expected: only the user's pre-existing unrelated changes remain; all feature files are committed in the task-specific commits above.
