# 心晴产品体验与真实能力整改 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按已审核的方案 A，以可回滚纵向切片完成管理后台、知识资料、风险个案、音乐、个人资料、真实通知、AI 助手、俄罗斯方块和一年演示数据整改。

**Architecture:** Vue 仅访问 Node/Express；Node 负责认证、权限、MySQL、文件元数据和后台任务；FastAPI 仅作为 Node 后方的 AI/RAG 服务。每个切片先写失败测试，再实现数据库/API/UI，最后用单测、构建和真实浏览器证据验收。

**Tech Stack:** Vue 3、TypeScript、Vitest、Node 22、Express 5、MySQL 8、Jest、Python 3.11、FastAPI、Chroma、Playwright。

## Global Constraints

- 保留当前分支 `codex/ai-chain-p0-fixes` 上用户已有的未提交修改；只暂存每项任务列出的文件。
- `src/views/counseling/Counseling.vue` 已有用户修改，Task 8 只能增量合并，不能覆盖推理轨迹改动。
- 每个行为变更遵循 RED → GREEN → REFACTOR；每个小功能独立提交。
- API 失败必须返回明确错误，不得用假数据或假成功提示兜底。
- 高风险内容和情绪数据遵循最小权限、脱敏日志和审计要求。
- 内置资料仅内置许可明确的正文；其余只保存标题、摘要和官方链接。
- 浏览器拒绝 Push 权限时只能降级为真实站内通知，不得显示“推送已开启”。
- 演示数据写入 `demo_support_admin` 的真实原始记录，分析结果必须由正式聚合与分析链生成。

---

### Task 1: 管理后台无闪切换并移除帖子审核

**Files:**
- Modify: `src/views/admin/AdminLayout.vue`
- Modify: `src/router/index.ts`
- Modify: `src/__tests__/views/adminLayoutNavigation.test.ts`
- Modify: `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: Vue Router 子路由与 `RouteMeta.subNav`。
- Produces: 持久后台壳层、无 `out-in` 空窗的内容切换、仅保留树洞审核入口。

- [ ] **Step 1: 写失败测试**

在 `adminLayoutNavigation.test.ts` 增加：

```ts
it('renders child routes without an out-in page transition', () => {
  const wrapper = mountAdminLayout()
  expect(wrapper.find('.admin-route-content').exists()).toBe(true)
  expect(wrapper.html()).not.toContain('fade-slide')
})

it('does not render the retired post moderation entry', () => {
  const wrapper = mountAdminLayout()
  expect(wrapper.text()).not.toContain('帖子审核')
  expect(wrapper.find('[href="/admin/posts"]').exists()).toBe(false)
})
```

- [ ] **Step 2: 运行 RED**

Run: `npx vitest run src/__tests__/views/adminLayoutNavigation.test.ts`

Expected: FAIL，现有模板仍包含 `fade-slide`/`out-in`，路由仍包含 `/admin/posts`。

- [ ] **Step 3: 最小实现**

把子路由改为：

```vue
<router-view v-slot="{ Component }">
  <component :is="Component" class="admin-route-content" />
</router-view>
```

删除对应页面级过渡 CSS，并从管理员 `subNav` 和 children 中删除 `/admin/posts`。树洞路由及底层帖子模型保持不变。

- [ ] **Step 4: GREEN 与构建**

Run: `npx vitest run src/__tests__/views/adminLayoutNavigation.test.ts`

Run: `npm run build`

Expected: PASS，构建退出码 0。

- [ ] **Step 5: 提交**

```powershell
git add -- src/views/admin/AdminLayout.vue src/router/index.ts src/__tests__/views/adminLayoutNavigation.test.ts tests/e2e/admin.spec.ts
git commit -m "fix(admin): 消除页面切换空白并移除帖子审核"
```

### Task 2: 知识资料元数据、内置目录与真实列表 API

**Files:**
- Create: `mood_health_server/src/db/migrations/0420_create_knowledge_resources.up.sql`
- Create: `mood_health_server/src/db/migrations/0420_create_knowledge_resources.down.sql`
- Create: `mood_health_server/src/repositories/knowledgeResourceRepository.ts`
- Create: `mood_health_server/src/services/knowledgeResourceService.ts`
- Create: `mood_health_server/src/controllers/knowledgeResourceController.ts`
- Create: `mood_health_server/src/routes/knowledgeResourceRoutes.ts`
- Modify: `mood_health_server/src/app.ts`
- Create: `mood_health_server/tests/unit/services/knowledgeResourceService.test.ts`
- Create: `mood_health_server/tests/unit/controllers/knowledgeResourceController.test.ts`
- Modify: `mood_health_server/tests/unit/db/migrationFiles.test.ts`

**Interfaces:**
- Produces: `GET /api/knowledge-resources/folders`、`GET /api/knowledge-resources`、`GET /api/knowledge-resources/:id`、`POST /api/knowledge-resources/:id/favorite`。
- DTO: `KnowledgeResourceDto { id, folderId, title, summary, resourceType, sourceUrl, licenseCode, isBuiltin, ingestionStatus, favorited }`。

- [ ] **Step 1: 写失败测试**

```ts
it('returns the immutable built-in folder with licensed resources', async () => {
  const folders = await service.listFolders({ userId: 7 })
  expect(folders).toContainEqual(expect.objectContaining({ slug: 'builtin', isBuiltin: true }))
})

it('never lets a teacher overwrite a built-in resource', async () => {
  await expect(service.updateResource({ actorRole: 'counselor', id: 1, title: 'x' }))
    .rejects.toThrow('内置资料仅允许系统管理员修改')
})
```

- [ ] **Step 2: 运行 RED**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/services/knowledgeResourceService.test.ts`

Expected: FAIL，模块尚不存在。

- [ ] **Step 3: 新增迁移和最小仓储/服务/API**

迁移建立 `knowledge_folders`、`knowledge_resources`、`knowledge_resource_versions`、`knowledge_favorites` 和 `knowledge_ingestion_jobs`。`builtin` 文件夹使用唯一 `slug`；收藏使用 `(user_id, resource_id)` 唯一键；资源保存 `source_url/license_code/reviewed_at/content_hash/ingestion_status`。

服务必须只返回调用者可见资料，内置目录不可被普通老师删除，404 使用统一 `apiFailure`。

- [ ] **Step 4: GREEN、迁移静态检查与类型检查**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/services/knowledgeResourceService.test.ts tests/unit/controllers/knowledgeResourceController.test.ts tests/unit/db/migrationFiles.test.ts`

Run: `npm --prefix mood_health_server run typecheck`

- [ ] **Step 5: 提交**

```powershell
git add -- mood_health_server/src/db/migrations/0420_create_knowledge_resources.up.sql mood_health_server/src/db/migrations/0420_create_knowledge_resources.down.sql mood_health_server/src/repositories/knowledgeResourceRepository.ts mood_health_server/src/services/knowledgeResourceService.ts mood_health_server/src/controllers/knowledgeResourceController.ts mood_health_server/src/routes/knowledgeResourceRoutes.ts mood_health_server/src/app.ts mood_health_server/tests/unit/services/knowledgeResourceService.test.ts mood_health_server/tests/unit/controllers/knowledgeResourceController.test.ts mood_health_server/tests/unit/db/migrationFiles.test.ts
git commit -m "feat(knowledge): 建立内置资料与收藏数据链路"
```

### Task 3: 内置权威资料种子与学生资料页面

**Files:**
- Create: `mood_health_server/src/db/seeds/knowledgeResourceSeed.ts`
- Modify: `mood_health_server/src/db/seed.ts`
- Create: `mood_health_server/tests/unit/db/knowledgeResourceSeed.test.ts`
- Create: `src/api/knowledgeResources.ts`
- Rewrite: `src/views/improve/Knowledge.vue`
- Create: `src/__tests__/views/knowledgeResources.test.ts`

**Interfaces:**
- Consumes: Task 2 的资料 API。
- Produces: “内置资料”目录、真实加载/错误/空状态、资料详情链接与持久收藏。

- [ ] **Step 1: 写失败测试**

```ts
it('seeds only traceable official resources idempotently', async () => {
  await seedKnowledgeResources(db)
  await seedKnowledgeResources(db)
  expect(await db.countBySlug('who-doing-what-matters')).toBe(1)
  expect(await db.getBySlug('who-doing-what-matters')).toMatchObject({
    folderSlug: 'builtin', licenseCode: 'CC-BY-NC-SA-3.0-IGO'
  })
})
```

Vue 测试 mock API 返回 WHO、NIMH、教育部、国家卫健委条目，断言页面显示“内置资料”、来源和失败重试按钮。

- [ ] **Step 2: 运行 RED**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/db/knowledgeResourceSeed.test.ts`

Run: `npx vitest run src/__tests__/views/knowledgeResources.test.ts`

- [ ] **Step 3: 最小实现**

种子仅写标题、中文摘要、官方 URL、许可代码和复核日期；允许再分发的正文另存版本，其余不镜像全文。Vue 页面删除静态 `knowledgeItems`，通过 API 获取数据并持久收藏。

- [ ] **Step 4: GREEN 与构建**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/db/knowledgeResourceSeed.test.ts`

Run: `npx vitest run src/__tests__/views/knowledgeResources.test.ts`

Run: `npm run build:all`

- [ ] **Step 5: 提交**

```powershell
git add -- mood_health_server/src/db/seeds/knowledgeResourceSeed.ts mood_health_server/src/db/seed.ts mood_health_server/tests/unit/db/knowledgeResourceSeed.test.ts src/api/knowledgeResources.ts src/views/improve/Knowledge.vue src/__tests__/views/knowledgeResources.test.ts
git commit -m "feat(knowledge): 展示可追溯的内置权威资料"
```

### Task 4: 老师上传资料与 RAG 索引状态

**Files:**
- Modify: `mood_health_server/package.json`
- Modify: `mood_health_server/package-lock.json`
- Create: `mood_health_server/src/middleware/knowledgeUpload.ts`
- Create: `mood_health_server/src/services/knowledgeFileService.ts`
- Modify: `mood_health_server/src/routes/knowledgeResourceRoutes.ts`
- Modify: `mood_health_server/src/controllers/knowledgeResourceController.ts`
- Create: `mood_health_server/tests/unit/services/knowledgeFileService.test.ts`
- Create: `src/views/admin/KnowledgeResources.vue`
- Create: `src/__tests__/views/adminKnowledgeResources.test.ts`
- Modify: `src/router/index.ts`

**Interfaces:**
- Produces: `POST /api/knowledge-resources/upload`（multipart，20 MB，PDF/DOCX/TXT/MD）、`POST /api/knowledge-resources/:id/retry-ingestion`。
- 存储接口: `saveValidatedFile(input): Promise<{ storageKey, sha256, mimeType, size }>`。

- [ ] **Step 1: 写失败测试**

```ts
it.each(['application/x-msdownload', 'text/html'])('rejects unsafe mime %s', async (mimeType) => {
  await expect(service.validate({ mimeType, header: Buffer.from('MZ'), size: 8 }))
    .rejects.toThrow('不支持的资料格式')
})

it('rejects files over 20 MiB', async () => {
  await expect(service.validate({ mimeType: 'application/pdf', header: pdf, size: 20 * 1024 * 1024 + 1 }))
    .rejects.toThrow('资料文件不能超过 20 MB')
})
```

- [ ] **Step 2: 运行 RED**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/services/knowledgeFileService.test.ts`

- [ ] **Step 3: 实现上传纵切**

使用项目内明确依赖处理 multipart；保存到配置化上传目录，服务端生成文件名，校验扩展名、MIME 与 magic bytes。上传后写 `pending` 任务；解析/索引失败写 `failed + error_code`，页面显示重试，不显示假成功。

- [ ] **Step 4: GREEN、类型检查与页面测试**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/services/knowledgeFileService.test.ts`

Run: `npx vitest run src/__tests__/views/adminKnowledgeResources.test.ts`

Run: `npm run typecheck:all`

- [ ] **Step 5: 提交**

```powershell
git add -- mood_health_server/package.json mood_health_server/package-lock.json mood_health_server/src/middleware/knowledgeUpload.ts mood_health_server/src/services/knowledgeFileService.ts mood_health_server/src/routes/knowledgeResourceRoutes.ts mood_health_server/src/controllers/knowledgeResourceController.ts mood_health_server/tests/unit/services/knowledgeFileService.test.ts src/views/admin/KnowledgeResources.vue src/__tests__/views/adminKnowledgeResources.test.ts src/router/index.ts
git commit -m "feat(knowledge): 支持老师安全上传和索引重试"
```

### Task 5: 今日状态分与风险个案 OR 信号引擎

**Files:**
- Create: `mood_health_server/src/db/migrations/0430_create_risk_signals.up.sql`
- Create: `mood_health_server/src/db/migrations/0430_create_risk_signals.down.sql`
- Modify: `mood_health_server/src/repositories/moodRepository.ts`
- Modify: `mood_health_server/src/services/moodService.ts`
- Create: `mood_health_server/src/repositories/riskSignalRepository.ts`
- Create: `mood_health_server/src/services/riskSignalService.ts`
- Modify: `mood_health_server/src/services/caseService.ts`
- Create: `mood_health_server/tests/unit/services/riskSignalService.test.ts`
- Modify: `mood_health_server/tests/unit/services/caseService.test.ts`
- Modify: `src/views/mood/MoodRecord.vue`
- Modify: `src/stores/moodRecordStore.ts`
- Modify: `src/views/admin/Cases.vue`
- Modify: `src/views/admin/CaseDetail.vue`

**Interfaces:**
- Produces: `wellbeing_score TINYINT 1..10`；`RiskSignalType = 'mood_low_7d' | 'treehole_high_risk' | 'ai_high_risk'`。
- 核心函数: `evaluateSignals(input: { userId, now }): Promise<RiskSignalDto[]>`。

- [ ] **Step 1: 写失败测试**

```ts
it('creates a mood signal only for seven consecutive low-score calendar days', async () => {
  repository.dailyScores = [4, 3, 4, 2, 4, 3, 4].map((score, i) => ({ date: day(i), score }))
  expect(await service.evaluateSignals({ userId: 9, now })).toContainEqual(
    expect.objectContaining({ type: 'mood_low_7d' })
  )
})

it.each(['treehole_high_risk', 'ai_high_risk'] as const)('creates a case when only %s exists', async (type) => {
  await repository.insertSignal({ userId: 9, type, sourceId: 'source-1' })
  expect(await service.syncOpenCase(9)).toMatchObject({ studentUserId: 9, status: 'open' })
})

it('deduplicates the same user type and trigger window', async () => {
  await service.evaluateSignals({ userId: 9, now })
  await service.evaluateSignals({ userId: 9, now })
  expect(repository.signals).toHaveLength(1)
})
```

- [ ] **Step 2: 运行 RED**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/services/riskSignalService.test.ts`

- [ ] **Step 3: 实现规则和证据链**

迁移给 mood 增加独立 `wellbeing_score`，建立 `risk_signals` 和 `case_risk_signals`。缺失日期中断连续周期；三个信号严格 OR；已有未结个案只追加证据。树洞审核和 counseling 消息持久化成功后触发相同服务。

- [ ] **Step 4: GREEN、类型检查与相关回归**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/services/riskSignalService.test.ts tests/unit/services/caseService.test.ts tests/unit/controllers/counselingSessionController.test.ts`

Run: `npm run typecheck:all`

- [ ] **Step 5: 提交**

```powershell
git add -- mood_health_server/src/db/migrations/0430_create_risk_signals.up.sql mood_health_server/src/db/migrations/0430_create_risk_signals.down.sql mood_health_server/src/repositories/moodRepository.ts mood_health_server/src/services/moodService.ts mood_health_server/src/repositories/riskSignalRepository.ts mood_health_server/src/services/riskSignalService.ts mood_health_server/src/services/caseService.ts mood_health_server/tests/unit/services/riskSignalService.test.ts mood_health_server/tests/unit/services/caseService.test.ts src/views/mood/MoodRecord.vue src/stores/moodRecordStore.ts src/views/admin/Cases.vue src/views/admin/CaseDetail.vue
git commit -m "feat(cases): 以三类真实风险信号自动建立个案"
```

### Task 6: 音乐新增真实纵切

**Files:**
- Modify: `mood_health_server/src/repositories/musicRepository.ts`
- Modify: `mood_health_server/src/controllers/musicController.ts`
- Modify: `mood_health_server/src/routes/musicRoutes.ts`
- Modify: `mood_health_server/tests/unit/controllers/musicController.test.ts`
- Modify: `src/api/admin.ts`
- Modify: `src/views/admin/Music.vue`
- Modify: `src/__tests__/views/adminMusic.test.ts`

**Interfaces:**
- Produces: `POST /api/music`，权限 `music.manage`，返回 `201 + MusicDto`。

- [ ] **Step 1: 写失败测试**

```ts
it('creates music and returns 201 for a manager', async () => {
  req.body = { title: '雨声', artist: '内置', url: '/audio/rain.mp3', duration: '03:00', category: 'nature' }
  await createMusic(req, res)
  expect(res.status).toHaveBeenCalledWith(201)
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
})
```

前端测试点击“添加音乐”，填写并提交，断言 `createAdminMusic` 被调用且新行出现。

- [ ] **Step 2: RED**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/controllers/musicController.test.ts`

Run: `npx vitest run src/__tests__/views/adminMusic.test.ts`

- [ ] **Step 3: 实现仓储、接口和表单**

校验必填字段、`http(s)` 或站内音频 URL、`mm:ss/hh:mm:ss` 时长；失败不修改列表。创建成功后插入真实返回行并提供试听。

- [ ] **Step 4: GREEN 与构建**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/controllers/musicController.test.ts`

Run: `npx vitest run src/__tests__/views/adminMusic.test.ts`

Run: `npm run build:all`

- [ ] **Step 5: 提交**

```powershell
git add -- mood_health_server/src/repositories/musicRepository.ts mood_health_server/src/controllers/musicController.ts mood_health_server/src/routes/musicRoutes.ts mood_health_server/tests/unit/controllers/musicController.test.ts src/api/admin.ts src/views/admin/Music.vue src/__tests__/views/adminMusic.test.ts
git commit -m "feat(music): 增加可验证的管理员新增音乐功能"
```

### Task 7: 个人资料、头像与收藏统计

**Files:**
- Create: `mood_health_server/src/db/migrations/0440_create_user_profile_assets.up.sql`
- Create: `mood_health_server/src/db/migrations/0440_create_user_profile_assets.down.sql`
- Modify: `mood_health_server/src/routes/authRoutes.ts`
- Modify: `mood_health_server/src/controllers/authController.ts`
- Modify: `mood_health_server/src/services/userProfileService.ts`
- Modify: `mood_health_server/src/repositories/userRepository.ts`
- Create: `mood_health_server/tests/unit/services/userProfileUpdate.test.ts`
- Modify: `src/api/auth.ts`
- Modify: `src/stores/userStore.ts`
- Rewrite: `src/views/user/Profile.vue`
- Create: `src/__tests__/views/profileEdit.test.ts`

**Interfaces:**
- Produces: `PATCH /api/auth/me { username }`、`POST /api/auth/me/avatar`、`GET /api/auth/me/stats`。

- [ ] **Step 1: 写失败测试**

```ts
it('rejects a username already owned by another user', async () => {
  repository.ownerIdForUsername = 2
  await expect(service.updateProfile({ userId: 1, username: 'taken' }))
    .rejects.toThrow('用户名已被使用')
})

it('returns persisted knowledge favorite counts', async () => {
  expect(await service.getProfileStats(1)).toEqual(expect.objectContaining({ favoriteKnowledgeCount: 3 }))
})
```

- [ ] **Step 2: RED**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/services/userProfileUpdate.test.ts`

- [ ] **Step 3: 实现资料与头像闭环**

用户名 trim、长度和唯一性校验；头像仅 JPG/PNG/WebP，生成随机安全文件名，保存 URL 后更新当前 store。Profile 页面只显示真实统计，刷新和重登后仍一致。

- [ ] **Step 4: GREEN、前端测试与构建**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/services/userProfileUpdate.test.ts`

Run: `npx vitest run src/__tests__/views/profileEdit.test.ts src/__tests__/stores/userStore.test.ts`

Run: `npm run build:all`

- [ ] **Step 5: 提交**

```powershell
git add -- mood_health_server/src/db/migrations/0440_create_user_profile_assets.up.sql mood_health_server/src/db/migrations/0440_create_user_profile_assets.down.sql mood_health_server/src/routes/authRoutes.ts mood_health_server/src/controllers/authController.ts mood_health_server/src/services/userProfileService.ts mood_health_server/src/repositories/userRepository.ts mood_health_server/tests/unit/services/userProfileUpdate.test.ts src/api/auth.ts src/stores/userStore.ts src/views/user/Profile.vue src/__tests__/views/profileEdit.test.ts
git commit -m "feat(profile): 持久化用户名头像与收藏统计"
```

### Task 8: 服务端设置、真实提醒与周报

**Files:**
- Create: `mood_health_server/src/db/migrations/0450_create_notifications.up.sql`
- Create: `mood_health_server/src/db/migrations/0450_create_notifications.down.sql`
- Create: `mood_health_server/src/repositories/notificationRepository.ts`
- Create: `mood_health_server/src/services/notificationService.ts`
- Create: `mood_health_server/src/services/weeklyReportService.ts`
- Create: `mood_health_server/src/controllers/notificationController.ts`
- Create: `mood_health_server/src/routes/notificationRoutes.ts`
- Modify: `mood_health_server/src/app.ts`
- Create: `mood_health_server/tests/unit/services/notificationService.test.ts`
- Create: `mood_health_server/tests/unit/services/weeklyReportService.test.ts`
- Create: `src/api/notifications.ts`
- Rewrite: `src/views/user/Setting.vue`
- Create: `src/components/notifications/NotificationCenter.vue`
- Create: `src/__tests__/views/notificationSettings.test.ts`

**Interfaces:**
- Produces: `GET/PUT /api/notifications/preferences`、`GET /api/notifications`、`POST /api/notifications/:id/read`、`POST /api/notifications/test-reminder`。
- 核心函数: `dispatchDueReminders(now)` 与 `generateWeeklyReport(userId, weekStart)`。

- [ ] **Step 1: 写失败测试**

```ts
it('creates one due reminder in the user timezone and records delivery', async () => {
  const delivered = await service.dispatchDueReminders(new Date('2026-08-13T12:00:00Z'))
  expect(delivered).toHaveLength(1)
  expect(repository.notifications[0].status).toBe('sent')
})

it('builds a weekly report from repository aggregates only', async () => {
  repository.aggregate = { recordCount: 8, averageWellbeing: 5.4, lowDays: 2 }
  const report = await service.generateWeeklyReport(3, '2026-08-10')
  expect(report.snapshot.recordCount).toBe(8)
})
```

- [ ] **Step 2: RED**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/services/notificationService.test.ts tests/unit/services/weeklyReportService.test.ts`

- [ ] **Step 3: 实现站内通知和可验证投递**

偏好写数据库；提醒产生真实通知行；周报保存输入统计快照和正文。前端先实现站内弹窗和“发送测试提醒”。Push Subscription 只在浏览器授权成功时保存；拒绝时显示站内降级状态。

- [ ] **Step 4: GREEN 与构建**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/services/notificationService.test.ts tests/unit/services/weeklyReportService.test.ts`

Run: `npx vitest run src/__tests__/views/notificationSettings.test.ts`

Run: `npm run build:all`

- [ ] **Step 5: 提交**

```powershell
git add -- mood_health_server/src/db/migrations/0450_create_notifications.up.sql mood_health_server/src/db/migrations/0450_create_notifications.down.sql mood_health_server/src/repositories/notificationRepository.ts mood_health_server/src/services/notificationService.ts mood_health_server/src/services/weeklyReportService.ts mood_health_server/src/controllers/notificationController.ts mood_health_server/src/routes/notificationRoutes.ts mood_health_server/src/app.ts mood_health_server/tests/unit/services/notificationService.test.ts mood_health_server/tests/unit/services/weeklyReportService.test.ts src/api/notifications.ts src/views/user/Setting.vue src/components/notifications/NotificationCenter.vue src/__tests__/views/notificationSettings.test.ts
git commit -m "feat(notifications): 落地真实提醒和数据周报"
```

### Task 9: AI 助手三栏布局与可观察性能

**Files:**
- Modify: `src/views/counseling/Counseling.vue`
- Modify: `src/__tests__/views/counseling-history.test.ts`
- Create: `src/__tests__/views/counseling-layout.test.ts`
- Modify: `mood_health_server/src/services/unifiedAssistantService.ts`
- Modify: `mood_health_server/src/controllers/counselingController.ts`
- Modify: `mood_health_server/tests/unit/services/unifiedAssistantService.test.ts`
- Modify: `tests/e2e/counseling.spec.ts`

**Interfaces:**
- Produces: 桌面左历史/中对话/右信息三栏；输入框固定在中栏；响应返回 `timings { totalMs, safetyMs, retrievalMs, providerMs }`。

- [ ] **Step 1: 写失败测试**

```ts
it('renders history, conversation and service information as sibling columns', () => {
  const wrapper = mountCounseling()
  expect(wrapper.find('.history-column').exists()).toBe(true)
  expect(wrapper.find('.conversation-column > .input-panel').exists()).toBe(true)
  expect(wrapper.find('.service-column .emergency-number').exists()).toBe(true)
})
```

服务测试固定时钟，断言响应 timings 只含数字且不含敏感正文。

- [ ] **Step 2: RED**

Run: `npx vitest run src/__tests__/views/counseling-layout.test.ts`

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/services/unifiedAssistantService.test.ts`

- [ ] **Step 3: 增量合并布局和性能埋点**

保留当前未提交的推理轨迹代码；历史组件桌面常驻、移动端抽屉；信息卡移到右侧；输入框在中栏底部。记录各阶段耗时与 requestId，不记录对话原文。会话列表刷新不阻塞答案显示。

- [ ] **Step 4: GREEN、构建与 E2E**

Run: `npx vitest run src/__tests__/views/counseling-layout.test.ts src/__tests__/views/counseling-history.test.ts src/__tests__/views/counseling-send-failure.test.ts`

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/services/unifiedAssistantService.test.ts`

Run: `npm run build:all`

- [ ] **Step 5: 提交**

只暂存本任务对 `Counseling.vue` 的新增 hunks；若与用户未提交 hunks 无法可靠拆分，则先提交其余文件并保留该文件未暂存，绝不误提交用户改动。

```powershell
git add -- src/__tests__/views/counseling-layout.test.ts src/__tests__/views/counseling-history.test.ts mood_health_server/src/services/unifiedAssistantService.ts mood_health_server/src/controllers/counselingController.ts mood_health_server/tests/unit/services/unifiedAssistantService.test.ts tests/e2e/counseling.spec.ts
git commit -m "perf(ai): 增加分阶段耗时并避免非阻塞刷新等待"
```

### Task 10: 俄罗斯方块持续按压控制

**Files:**
- Create: `src/components/relax/tetrisInputController.ts`
- Modify: `src/components/relax/TetrisGame.vue`
- Create: `src/__tests__/components/relax/tetrisInputController.test.ts`

**Interfaces:**
- Produces: `createTetrisInputController({ dasMs: 150, arrMs: 45, move })`，公开 `press(direction, now)`、`release(direction)`、`tick(now)`、`releaseAll()`。

- [ ] **Step 1: 写失败测试**

```ts
it('moves once immediately then repeats after DAS at ARR intervals', () => {
  const moves: string[] = []
  const controller = createTetrisInputController({ dasMs: 150, arrMs: 45, move: d => moves.push(d) })
  controller.press('left', 0)
  controller.tick(149)
  controller.tick(150)
  controller.tick(195)
  expect(moves).toEqual(['left', 'left', 'left'])
})

it('stops immediately on pointer cancel', () => {
  controller.press('right', 0)
  controller.releaseAll()
  controller.tick(500)
  expect(moves).toEqual(['right'])
})
```

- [ ] **Step 2: RED**

Run: `npx vitest run src/__tests__/components/relax/tetrisInputController.test.ts`

- [ ] **Step 3: 实现纯控制器并接入 Pointer Events**

左右按钮使用 `pointerdown/up/leave/cancel`；键盘复用同一控制器；页面失焦调用 `releaseAll`；碰撞判断仍由现有 `movePiece` 完成。

- [ ] **Step 4: GREEN 与构建**

Run: `npx vitest run src/__tests__/components/relax/tetrisInputController.test.ts`

Run: `npm run build`

- [ ] **Step 5: 提交**

```powershell
git add -- src/components/relax/tetrisInputController.ts src/components/relax/TetrisGame.vue src/__tests__/components/relax/tetrisInputController.test.ts
git commit -m "fix(tetris): 支持方向键和触屏持续按压"
```

### Task 11: `demo_support_admin` 一年真实明细种子

**Files:**
- Create: `mood_health_server/src/db/seeds/seedSupportAdminYearData.ts`
- Modify: `mood_health_server/src/db/seed.ts`
- Modify: `mood_health_server/src/db/seeds/profileSeed.ts`
- Create: `mood_health_server/tests/unit/db/seedSupportAdminYearData.test.ts`
- Modify: `mood_health_server/tests/unit/db/seedProfiles.test.ts`

**Interfaces:**
- Produces: `seedSupportAdminYearData(db, { now, seedVersion }): Promise<{ userId, daysCovered, moodCount }>`。

- [ ] **Step 1: 写失败测试**

```ts
it('creates one deterministic year for demo_support_admin and remains idempotent', async () => {
  const first = await seedSupportAdminYearData(db, { now: new Date('2026-08-13T00:00:00Z'), seedVersion: 'v1' })
  const second = await seedSupportAdminYearData(db, { now: new Date('2026-08-13T00:00:00Z'), seedVersion: 'v1' })
  expect(first.daysCovered).toBe(365)
  expect(second.moodCount).toBe(first.moodCount)
  expect(db.usernamesWritten).toEqual(['demo_support_admin'])
})
```

- [ ] **Step 2: RED**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/db/seedSupportAdminYearData.test.ts`

- [ ] **Step 3: 实现确定性原始记录**

创建或复用 `demo_support_admin`，写 365 天、每天 1–2 条情绪与状态分、标签和可解释触发因素；使用批次键幂等；至少包含一段连续 7 日状态分小于 5。不得写分析结论表。

- [ ] **Step 4: GREEN 与类型检查**

Run: `npm --prefix mood_health_server test -- --runTestsByPath tests/unit/db/seedSupportAdminYearData.test.ts tests/unit/db/seedProfiles.test.ts`

Run: `npm --prefix mood_health_server run typecheck`

- [ ] **Step 5: 提交**

```powershell
git add -- mood_health_server/src/db/seeds/seedSupportAdminYearData.ts mood_health_server/src/db/seed.ts mood_health_server/src/db/seeds/profileSeed.ts mood_health_server/tests/unit/db/seedSupportAdminYearData.test.ts mood_health_server/tests/unit/db/seedProfiles.test.ts
git commit -m "feat(demo): 生成管理员账号一年真实情绪明细"
```

### Task 12: 全链路迁移、真实数据分析与浏览器验收

**Files:**
- Modify: `tests/e2e/admin.spec.ts`
- Modify: `tests/e2e/counseling.spec.ts`
- Modify: `tests/e2e/mood-analysis-navigation.spec.ts`
- Create: `tests/e2e/knowledge-resources.spec.ts`
- Create: `tests/e2e/profile-notifications.spec.ts`
- Modify: `docs/superpowers/plans/2026-08-13-product-experience-real-capabilities.md`

**Interfaces:**
- Consumes: Tasks 1–11。
- Produces: 页面、Network、服务日志、MySQL 与失败场景的统一验收证据。

- [ ] **Step 1: 执行迁移和演示种子**

Run: `npm --prefix mood_health_server run db:migrate`

Run: `npm --prefix mood_health_server run db:seed:demo`

Expected: 新迁移全部 applied；重复种子不增加重复批次。

- [ ] **Step 2: 验证真实分析来源**

通过受认证 API读取 `demo_support_admin` 的年度洞察并生成正式分析；使用只读 SQL 抽样核对日聚合、记录数、平均状态分与图表响应一致。不得直接插入分析文本。

- [ ] **Step 3: 执行全量静态和自动化验证**

Run: `npm run typecheck:all`

Run: `npm run lint:check`

Run: `npm run test:all`

Run: `npm run build:all`

Run: `npm run test:e2e -- tests/e2e/admin.spec.ts tests/e2e/knowledge-resources.spec.ts tests/e2e/profile-notifications.spec.ts tests/e2e/counseling.spec.ts tests/e2e/mood-analysis-navigation.spec.ts`

- [ ] **Step 4: 浏览器人工证据**

验证后台连续切换无白屏、资料打开/上传/失败重试、三类风险单独建案、音乐新增试听、头像用户名重登保留、测试提醒实际弹出、AI 三栏输入、俄罗斯方块长按、年度洞察与分析。控制台无错误；Network 错误均有明确业务提示。

- [ ] **Step 5: 更新勾选状态并提交 E2E**

```powershell
git add -- tests/e2e/admin.spec.ts tests/e2e/counseling.spec.ts tests/e2e/mood-analysis-navigation.spec.ts tests/e2e/knowledge-resources.spec.ts tests/e2e/profile-notifications.spec.ts docs/superpowers/plans/2026-08-13-product-experience-real-capabilities.md
git commit -m "test(e2e): 覆盖整改功能的真实用户路径"
```

## Self-Review

- 设计方案的后台、知识资料、帖子审核、个案 OR 规则、音乐、个人资料、通知、AI 布局与速度、俄罗斯方块、一年演示数据均映射到独立任务。
- 接口命名在前后任务一致：知识统一 `/api/knowledge-resources`，通知统一 `/api/notifications`，个人资料统一 `/api/auth/me`。
- 计划不迁移旧情绪强度为状态分，不生成假分析，不强行声称浏览器 Push 已授权。
- 所有行为任务包含失败测试、指定命令、最小实现、通过验证和原子提交。
