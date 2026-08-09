# 契约与功能修改方案（代码级补丁草稿）

> 范围：前端 `src/` + 后端 `mood_health_server/src/`。
> 约定：**仅阅读分析 + 本文件为方案**，不改动任何源码、不 `git commit`、不写 `dist/`。
> 所有 `before` 均为当前仓库真实代码（已逐文件核对），`after` 为建议落地补丁。
> 已确认决策：本次交付=方案文档；**建议接口（advice）= 实现后端端点**（M2）；AI 数据库死代码删除由另一专家负责（本文不涉及 AI 侧 DB）。

---

## 一、P1 契约断裂修复

### 1.1 课程管理 `/api/admin/courses`（M1）

**位置**：前端 `src/api/admin.ts:122-160`；后端 `courseRoutes.ts` 挂在 `/api/courses`（`app.ts:201`），`managementRoutes.ts` 无 `/admin/courses` → 4 个接口 404。

**决策**：在 `managementRoutes.ts` 新增 `/admin/courses` 子路由，复用现有 `courseController`（`src/controllers/courseController.ts`）。因为前端 `admin.ts` 已经请求 `/api/admin/courses`，**前端无需改动 URL**。

**补充前置修复（契约一致性，连带解决 §2.2）**：`courseController` 当前 `GET` 返回裸数组/对象（`res.json(courses)`），未走 `ApiResponse` 信封。而前端 `request()` 拦截器（`utils/request.ts:78-99`）强制要求 `{code,data,message}` 信封，否则抛 “响应缺少业务状态码”。所以必须先把 `courseController` 全部响应包进 `apiSuccess(...)`，再让前端用 `request` 调用。

#### 1.1.1 后端 `courseController.ts`：统一信封

before（节选，当前 `getCourses`/`getCourseById` 裸返回）:
```ts
// controllers/courseController.ts
export const getCourses = async (req, res, next) => {
  try {
    const { category } = req.query
    const courses = await courseRepo.findAll(category as string | undefined)
    res.json(courses)              // ❌ 裸数组，未走信封
  } catch (error) { next(error) }
}

export const getCourseById = async (req, res, next) => {
  try {
    const { id } = req.params
    const course = await courseRepo.findById(parseInt(id as string))
    if (!course) {
      res.status(404).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '课程不存在'))
      return
    }
    await courseRepo.incrementStudyCount(parseInt(id as string))
    res.json(course)               // ❌ 裸对象
  } catch (error) { next(error) }
}
```

after（包信封；`createCourse`/`updateCourse`/`deleteCourse` 同理用 `apiSuccess`/`apiFailure` 包裹）:
```ts
import { apiFailure, apiSuccess, API_ERROR_CODES } from '../utils/apiResponse' // 已 import

export const getCourses = async (req, res, next) => {
  try {
    const { category } = req.query
    const courses = await courseRepo.findAll(category as string | undefined)
    res.json(apiSuccess(courses))          // ✅ 走统一信封
  } catch (error) { next(error) }
}

export const getCourseById = async (req, res, next) => {
  try {
    const { id } = req.params
    const course = await courseRepo.findById(parseInt(id as string))
    if (!course) {
      res.status(404).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '课程不存在'))
      return
    }
    await courseRepo.incrementStudyCount(parseInt(id as string))
    res.json(apiSuccess(course))           // ✅ 走统一信封
  } catch (error) { next(error) }
}
// createCourse 末尾: res.status(201).json(apiSuccess(newCourse))
// updateCourse 末尾: res.json(apiSuccess(updated))
// deleteCourse 末尾: res.json(apiSuccess({ message: 'Course deleted successfully' }))
```

#### 1.1.2 后端 `managementRoutes.ts`：新增 `/admin/courses`（复用 courseController）

before（`managementRoutes.ts` 末尾，无 courses）:
```ts
// routes/managementRoutes.ts
import { authenticate, requireAdmin, requirePermission } from '../middleware/auth'

const router = Router()
// ... 现有 /admin/* 路由 ...
export default router
```

after（追加，鉴权用 `course.manage`，与 courseRoutes 一致；`auditOperation` 复用 courseRoutes 的风格）:
```ts
import { authenticate, requireAdmin, requirePermission } from '../middleware/auth'
import { auditOperation } from '../utils/operationLogger'
import {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
} from '../controllers/courseController'   // 复用既有控制器

const router = Router()
// ... 现有 /admin/* 路由 ...

// 课程管理（复用 course 控制器；权限与 /api/courses 的写操作一致）
router.get('/admin/courses', authenticate, requirePermission('course.manage'), getCourses)
router.post(
  '/admin/courses',
  authenticate,
  requirePermission('course.manage'),
  auditOperation({ permissionCode: 'course.manage', operationType: 'COURSE_CREATE' }),
  createCourse,
)
router.put(
  '/admin/courses/:id',
  authenticate,
  requirePermission('course.manage'),
  auditOperation({
    permissionCode: 'course.manage',
    operationType: 'COURSE_UPDATE',
    getTargetId: (req) => (typeof req.params.id === 'string' ? req.params.id : null),
  }),
  updateCourse,
)
router.delete(
  '/admin/courses/:id',
  authenticate,
  requirePermission('course.manage'),
  auditOperation({
    permissionCode: 'course.manage',
    operationType: 'COURSE_DELETE',
    getTargetId: (req) => (typeof req.params.id === 'string' ? req.params.id : null),
  }),
  deleteCourse,
)

export default router
```

**前端是否需改**：`src/api/admin.ts` 的 `getAdminCourses/createAdminCourse/updateAdminCourse/deleteAdminCourse` 已经请求 `/api/admin/courses*` → **URL 不变，无需改**。
**附加数据形状注意（非阻塞）**：`admin.ts:130 AdminCoursePayload` 用 `coverImage`/`videoUrl`，而 `courseController.createCourse` 读取 `coverUrl`/`type`。建议在合并后对齐字段（前端补 `coverUrl`，后端兼容 `coverImage`→`coverUrl` 映射），否则管理端新建课程封面会丢失。本次仅标注，不阻断 M1。

**验证方式**：
- 后端：`curl -X POST /api/admin/courses -b cookie`（带 `course.manage` 角色）→ 201，返回 `{code:0,data:{...}}`。
- 后端：无权限用户 → 403。
- 前端：`getAdminCourses()` 能拿到数组（信封被 `request` 解包）。

---

### 1.2 情绪建议接口实现（M2，已确认实现）

**位置**：前端 `src/api/advice.ts:41,59` 调 `POST /api/moods/advice/save`、`GET /api/moods/advice/history`；后端全仓无实现（仅死代码表 `advice_history` 与权限种子 `mood.advice.history.read`）。`docs/API.md:347,374` 已文档化这两个接口，实现后保持一致（D3 自动消解，见 §1.5）。

**契约（与前端对齐）**：
- `POST /api/moods/advice/save` body：`{ moodRecordId?: number, analysis: string, suggestions: string[] }`；响应：`apiSuccess({ id })`
- `GET /api/moods/advice/history?page=&pageSize=` 响应：`apiSuccess({ list: AdviceHistoryItem[], total: number })`
- `AdviceHistoryItem = { id, userId, moodRecordId?, analysis, suggestions: string[], createdAt }`

**表结构**（`advice_history.sql`）：`id, user_id, mood_record_id, analysis(NVARCHAR1000), suggestions(NVARCHAR MAX), created_at`。

#### 1.2.1 新增 `repositories/adviceRepository.ts`

```ts
import { getMysqlPool } from '../config/mysql'
import { RowDataPacket, ResultSetHeader } from 'mysql2'

export interface AdviceHistoryRow {
  id: number
  userId: number
  moodRecordId: number | null
  analysis: string
  suggestions: string
  createdAt: string
}

export interface AdviceHistoryItem {
  id: number
  userId: number
  moodRecordId?: number
  analysis: string
  suggestions: string[]
  createdAt: string
}

export const createAdviceRepository = (db = getMysqlPool()) => {
  const save = async (input: {
    userId: number
    moodRecordId?: number
    analysis: string
    suggestions: string[]
  }): Promise<number> => {
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO advice_history (user_id, mood_record_id, analysis, suggestions, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [
        input.userId,
        input.moodRecordId ?? null,
        input.analysis,
        JSON.stringify(input.suggestions),
      ],
    )
    return result.insertId
  }

  const listByUser = async (
    userId: number,
    page: number,
    pageSize: number,
  ): Promise<{ list: AdviceHistoryItem[]; total: number }> => {
    const offset = (page - 1) * pageSize
    const [countRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM advice_history WHERE user_id = ?`,
      [userId],
    )
    const total = Number(countRows[0]?.total ?? 0)
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT * FROM advice_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [userId, pageSize, offset],
    )
    const list: AdviceHistoryItem[] = rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      moodRecordId: r.mood_record_id ?? undefined,
      analysis: r.analysis,
      suggestions: typeof r.suggestions === 'string' ? JSON.parse(r.suggestions) : [],
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }))
    return { list, total }
  }

  return { save, listByUser }
}

export type AdviceRepository = ReturnType<typeof createAdviceRepository>
```

#### 1.2.2 新增 `controllers/adviceController.ts`

```ts
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { apiSuccess, apiFailure, API_ERROR_CODES } from '../utils/apiResponse'
import { createAdviceRepository } from '../repositories/adviceRepository'

const adviceRepo = createAdviceRepository()

export const saveAdviceHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json(apiFailure(1002, '未登录'))
    const { moodRecordId, analysis, suggestions } = req.body as {
      moodRecordId?: number
      analysis?: unknown
      suggestions?: unknown
    }
    if (typeof analysis !== 'string' || !analysis.trim()) {
      return res.status(400).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, 'analysis 不能为空'))
    }
    if (!Array.isArray(suggestions) || suggestions.some((s) => typeof s !== 'string')) {
      return res.status(400).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, 'suggestions 必须为字符串数组'))
    }
    const id = await adviceRepo.save({
      userId: req.user.userId,
      moodRecordId: typeof moodRecordId === 'number' ? moodRecordId : undefined,
      analysis,
      suggestions: suggestions as string[],
    })
    return res.status(201).json(apiSuccess({ id }, '保存成功'))
  } catch (error) {
    return res.status(500).json(apiFailure(1500, '保存建议失败'))
  }
}

export const getAdviceHistoryHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json(apiFailure(1002, '未登录'))
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
    const { list, total } = await adviceRepo.listByUser(req.user.userId, page, pageSize)
    return res.json(apiSuccess({ list, total }, '获取成功'))
  } catch (error) {
    return res.status(500).json(apiFailure(1500, '获取建议历史失败'))
  }
}
```

#### 1.2.3 路由注册 `routes/moodRoutes.ts`（挂载在 `/api/moods`，已全局 `authenticate`）

before:
```ts
// moodRoutes.ts
router.get('/analysis', getMoodAnalysisHandler)
router.get('/insight', getMoodInsightHandler)
// ...
export default router
```

after（追加；history 接口需 `mood.advice.history.read`，该权限已种子化且授予 student/user，见 `middleware/auth.ts:29,100,192`）:
```ts
import {
  getMoodAnalysisHandler,
  getMoodInsightHandler,
  // ... 既有 ...
} from '../controllers/moodController'
import { saveAdviceHandler, getAdviceHistoryHandler } from '../controllers/adviceController'
import { requirePermission } from '../middleware/auth'

// ... 既有路由 ...
router.post('/advice/save', saveAdviceHandler)
router.get('/advice/history', requirePermission('mood.advice.history.read'), getAdviceHistoryHandler)
```

**前端是否需改**：`src/api/advice.ts` 的 `saveAdvice`/`getAdviceHistory` 已请求正确 URL 与形状 → **无需改**（其 `resolveAdviceError` 用 `axios.isAxiosError` 误判见 §2.1，但 URL/契约本身正确）。

**验证方式**：
- `POST /api/moods/advice/save` 带登录 cookie → 201 `{code:0,data:{id}}`。
- `GET /api/moods/advice/history?page=1&pageSize=20` → `{code:0,data:{list:[...],total}}`。
- 无 `mood.advice.history.read` 角色 → 403。

---

### 1.3 删除分析 DELETE（M3）

**位置**：前端 `src/api/moodAnalysis.ts:161-166` `DELETE /api/mood-analyses/:id`；后端 `moodAnalysisRoutes.ts` 无 `DELETE`。

**决策**：补 `router.delete('/mood-analyses/:id')` + 控制器 `deleteAnalysisHandler` + 服务 `deleteAnalysis`（仅本人或 `super_admin`）。

#### 1.3.1 后端 `moodAnalysisDataService.ts`：新增 `deleteAnalysis`

after（在 `return { ... }` 内追加）:
```ts
const deleteAnalysis = async (
  id: number,
  userId: number,
  isSuperAdmin: boolean,
): Promise<boolean> => {
  const sql = isSuperAdmin
    ? `DELETE FROM mood_analysis_versions WHERE id = ?`
    : `DELETE FROM mood_analysis_versions WHERE id = ? AND user_id = ?`
  const params = isSuperAdmin ? [id] : [id, userId]
  const [result] = await pool.query<ResultSetHeader>(sql, params)
  return result.affectedRows > 0
}
// 并在顶部 import { ResultSetHeader }
// return 对象中加入 deleteAnalysis
```

#### 1.3.2 后端 `moodAnalysisController.ts`：新增 handler

```ts
export const deleteAnalysisHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = guardUserId(req, res)
    if (userId === null) return
    const id = parseInt(String(req.params.id))
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, '无效的分析 ID'))
    }
    const isSuperAdmin = req.user?.role === 'super_admin'
    const deleted = await moodAnalysisDataService.deleteAnalysis(id, userId, isSuperAdmin)
    if (!deleted) {
      return res.status(404).json(apiFailure(404, '分析记录不存在或无权限'))
    }
    return res.json(apiSuccess(null, '删除成功'))
  } catch (error) {
    logger.error('[deleteAnalysisHandler] Error:', error)
    return res.status(500).json(apiFailure(500, '删除分析失败'))
  }
}
```

#### 1.3.3 后端 `moodAnalysisRoutes.ts`：注册 DELETE

before:
```ts
router.get('/mood-analyses/:id', getAnalysisById)
router.post('/mood-analyses/:id', runAnalysis)
export default router
```
after:
```ts
router.get('/mood-analyses/:id', getAnalysisById)
router.post('/mood-analyses/:id', runAnalysis)
router.delete('/mood-analyses/:id', deleteAnalysisHandler)
// 顶部 import 增加 deleteAnalysisHandler
```

**前端是否需改**：`deleteAnalysis`（`moodAnalysis.ts:161`）已调 `DELETE /api/mood-analyses/:id` → **URL 不变，无需改**。

**验证方式**：
- 普通用户删他人 id → 404；删自己 → 200。
- `super_admin` 删任意 id → 200。

---

### 1.4 路径参数命名统一（M4）

**位置**：前端 `counseling.ts:172`、`knowledgeAssistant.ts:48` 用 `sessionId`；后端 `counselingRoutes.ts:17,19` 与 `knowledgeAssistantRoutes.ts:18,21` 用 `:id`。控制器内部其实已 `const sessionId = req.params.id`（`counselingController.ts:194,217`、`knowledgeAssistantController.ts:65`）。

**决策**：统一为后端 `:sessionId`，前端已用 `sessionId` → **前端不需改**。仅改后端路由 + 控制器取参。

before（后端路由）:
```ts
// counselingRoutes.ts
router.get('/sessions/:id', getSessionMessagesHandler)
router.patch('/sessions/:id', renameSessionHandler)
// knowledgeAssistantRoutes.ts
router.get('/sessions/:id/messages', param('id').isUUID(), validateRequest, getMessages)
```
after（后端路由）:
```ts
// counselingRoutes.ts
router.get('/sessions/:sessionId', getSessionMessagesHandler)
router.patch('/sessions/:sessionId', renameSessionHandler)
// knowledgeAssistantRoutes.ts
router.get('/sessions/:sessionId/messages', param('sessionId').isUUID(), validateRequest, getMessages)
```

after（控制器取参）:
```ts
// counselingController.ts
const sessionId = req.params.sessionId as string   // 原 req.params.id
// knowledgeAssistantController.ts
const sessionId = String(req.params.sessionId)      // 原 req.params.id
```

**验证方式**：`GET /api/counseling/sessions/:sessionId` 与 `GET /api/knowledge-assistant/sessions/:sessionId/messages` 在后端可正确取到参数；前端调用不变。

---

### 1.5 D3 文档/实现不一致（自动消解）

`docs/API.md:347,374` 已文档化 `advice/save`、`advice/history`。M2 实现后契约即与文档一致，**D3 自动消解**，此处不再单独处理。建议实现后用脚本核对：文档路径与实现路由逐一比对（见 §四）。

---

## 二、P1 前端错误契约与裸 fetch

> 根因：`src/utils/request.ts` 抛出 `ApiRequestError`（`types/api.ts:11-19`），**只有 `status/code/message/data`，没有 `.response` 属性**。但多处仍按 `AxiosError` 读 `err.response?.data?.message` → 永远 `undefined`，真实后端错误被吞、限流冷却分支失效、重试失效。

### 2.1 统一错误消费（#1/#2/#13/#23）

#### 2.1.1 新增统一错误工具（挂在 `src/utils/request.ts` 末尾导出）

```ts
import { ApiRequestError } from '@/types/api' // 已 import ApiRequestErrorOptions/ApiResponse

export const isApiRequestError = (error: unknown): error is ApiRequestError =>
  error instanceof ApiRequestError

/** 从任意错误中取出可读消息（统一消费约定） */
export const getErrorMessage = (error: unknown, fallback = '请求失败'): string => {
  if (isApiRequestError(error)) return error.message
  if (error instanceof Error) return error.message
  return fallback
}

/** 取出 HTTP 状态码（无则为 0），用于限流/重试判断 */
export const getErrorStatus = (error: unknown): number => {
  if (isApiRequestError(error)) return error.status ?? 0
  return 0
}
```

#### 2.1.2 `src/stores/moodStore.ts:20-24,37-41,54-58`

before:
```ts
} catch (err: unknown) {
  const errorResponse = err as { response?: { data?: { message?: string } } }
  error.value = errorResponse.response?.data?.message || '提交失败'
  throw err
}
```
after（三处同改，`提交失败/获取列表失败/获取周报失败` 各保留原文案作为 fallback）:
```ts
} catch (err: unknown) {
  error.value = getErrorMessage(err, '提交失败')
  throw err
}
```

#### 2.1.3 `src/stores/moodRecordStore.ts`

**(a) `shouldRetryError`（~606-629）—— 读 `status` 而非 `response.status`**

before:
```ts
const shouldRetryError = (error: unknown) => {
  const requestError = error as { response?: { status?: number }; code?: string; message?: string }
  const status = requestError.response?.status || 0
  if (status === 429 || status >= 500) return true
  const message = (requestError.message || '').toLowerCase()
  if (requestError.code === 'ECONNABORTED' || requestError.code === 'ETIMEDOUT' ||
      message.includes('timeout') || message.includes('network')) return true
  return false
}
```
after:
```ts
const shouldRetryError = (error: unknown) => {
  const status = getErrorStatus(error)
  if (status === 429 || status >= 500) return true
  const message = (error instanceof Error ? error.message : '').toLowerCase()
  const code = isApiRequestError(error) ? error.code : undefined
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' ||
      message.includes('timeout') || message.includes('network')) return true
  return false
}
```

**(b) `handleAiError`（~680-714）—— 限流冷却/服务端分支用 `status`**

before:
```ts
const requestError = error as {
  response?: { status?: number; data?: { detail?: string; message?: string } }
  code?: string; message?: string
}
if (requestError.response?.status === 429) { ... }
if ((requestError.response?.status || 0) >= 500) { ... }
if (requestError.code === 'ECONNABORTED') { ... }
const message = requestError.response?.data?.detail || requestError.response?.data?.message || requestError.message || '获取建议失败'
```
after:
```ts
const status = getErrorStatus(error)
if (status === 429) {
  const message = '请求太频繁，请稍后再试'
  markAiFailure(message); return message
}
if (status >= 500) {
  const message = '建议服务暂时繁忙，请稍后重试'
  markAiFailure(message); return message
}
const code = isApiRequestError(error) ? error.code : undefined
if (code === 'ECONNABORTED') {
  const message = '请求超时，请稍后重试'
  markAiFailure(message); return message
}
const message = (error instanceof Error ? error.message : '') || '获取建议失败'
markAiFailure(message); return message
```

> 注：`moodRecordStore.ts` 顶部需 `import { getErrorMessage, getErrorStatus, isApiRequestError } from '@/utils/request'`（与 `moodStore` 一致）。

#### 2.1.4 `src/api/mood.ts`：删除重复的 legacy + `shouldRetry`（#23）

before（`mood.ts:48-76`）:
```ts
export const analyzeMoodWithRetryLegacy = async (data, retries = 2, delay = 1000) => {
  try { return await analyzeMoodLegacy(data) }
  catch (error: any) {
    if (retries > 0 && shouldRetry(error)) { await new Promise(r => setTimeout(r, delay)); return analyzeMoodWithRetryLegacy(data, retries - 1, delay * 2) }
    throw error
  }
}
const shouldRetry = (error: any): boolean => { /* 与 moodAnalysis.ts 重复 */ }
```
after（删掉 `analyzeMoodWithRetryLegacy` 与本地 `shouldRetry`；直接复用 `moodAnalysis.ts` 中已导出的 `analyzeMoodWithRetry`/`shouldRetry`）:
```ts
// 删除 analyzeMoodWithRetryLegacy；保留 analyzeMoodLegacy 转调 analyzeMood（如仍有引用）
// 重试逻辑统一走 src/api/moodAnalysis.ts 的 analyzeMoodWithRetry（其 shouldRetry 同样需改成读 ApiRequestError.status，见下）
```
**连带修复 `src/api/moodAnalysis.ts` 的 `shouldRetry`（:108-120）**：
before `if (error.response) { const status = error.response.status ... }`
after:
```ts
const shouldRetry = (error: unknown): boolean => {
  const status = getErrorStatus(error)
  if (status >= 500 || status === 429) return true
  const code = isApiRequestError(error) ? error.code : (error as { code?: string }).code
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return true
  const message = error instanceof Error ? error.message : ''
  if (message.includes('Network Error')) return true
  return false
}
// moodAnalysis.ts 顶部需 import { getErrorStatus, isApiRequestError } from '@/utils/request'
```

**受影响文件清单**：`moodStore.ts`、`moodRecordStore.ts`、`mood.ts`、`moodAnalysis.ts`（共 4 个文件 + 新增 3 个导出函数）。

---

### 2.2 修复裸 fetch（#3/#4/#15）

**位置**：`Courses.vue:73-77`、`CourseDetail.vue:76-78` 用原生 `fetch` + `buildApiUrl`，未带 `credentials`、绕过拦截器、未解包信封 → 渲染损坏（`courses.value=data` 直接赋值，列表 `v-for` 遍历异常）。

**前置依赖**：§1.1.1 已把 `courseController` 响应包进 `apiSuccess`，所以 `request()` 可正确解包为内层数组/对象。

#### 2.2.1 `Courses.vue`

before:
```ts
const fetchCourses = async () => {
  loading.value = true
  try {
    const category = activeCategory.value === '全部' ? '' : activeCategory.value
    const response = await fetch(buildApiUrl(`/api/courses?category=${encodeURIComponent(category)}`))
    const data = await response.json()
    courses.value = data
  } catch (error) {
    console.error('Error fetching courses:', error)
  } finally {
    loading.value = false
  }
}
```
after（改用 `request`，自动带 cookie 与 CSRF、解包信封；`data` 已是内层数组）:
```ts
import request from '@/utils/request'   // 顶部新增 import，移除对 buildApiUrl 的依赖

const fetchCourses = async () => {
  loading.value = true
  try {
    const category = activeCategory.value === '全部' ? '' : activeCategory.value
    const data = await request<any[]>({
      url: `/api/courses?category=${encodeURIComponent(category)}`,
      method: 'get',
    })
    courses.value = data            // ✅ data 为数组，v-for 正常
  } catch (error) {
    console.error('Error fetching courses:', error)
    courses.value = []
  } finally {
    loading.value = false
  }
}
```

#### 2.2.2 `CourseDetail.vue`

before:
```ts
const fetchCourseDetail = async () => {
  loading.value = true
  try {
    const courseId = route.params.id
    const response = await fetch(buildApiUrl(`/api/courses/${courseId}`))
    const data = await response.json()
    course.value = data
  } catch (error) {
    console.error('Error fetching course detail:', error)
  } finally {
    loading.value = false
  }
}
```
after:
```ts
import request from '@/utils/request'

const fetchCourseDetail = async () => {
  loading.value = true
  try {
    const courseId = route.params.id
    const data = await request<any>({ url: `/api/courses/${courseId}`, method: 'get' })
    course.value = data            // ✅ data 为课程对象
  } catch (error) {
    console.error('Error fetching course detail:', error)
  } finally {
    loading.value = false
  }
}
```

**验证方式**：课程页列表渲染、详情页 `sanitizedContent` 正常；DevTools 网络面板确认请求带 `Cookie`/ `x-csrf-token`。

---

### 2.3 relax 用户身份（#13）

**位置**：`relaxStore.ts:126,164` 用 `'current-user-id'` 占位 `userId`，`if (userId)` 永真 → 离线分支不可达。

before（`fetchRecords` / `fetchStatistics` 内）:
```ts
const userId = 'current-user-id' // 临时值，实际应从用户状态获取
if (userId) {
  const response = await relaxAPI.getRecordsSafe(params)
  // ... 在线分支
} else {
  // 未登录分支（永远走不到）
}
```
after（复用文件内已有的 `useUserStore`，与 `relaxStore.ts:59,274,317` 同模式）:
```ts
const userStore = useUserStore()
const userId = userStore.user?.id
if (userId) {
  const response = await relaxAPI.getRecordsSafe(params)
  // ... 在线分支
} else {
  // 未登录：从 localStorage 取暂存记录（现在可达）
  const storedRecords = storageUtil.getItem<RelaxRecord[]>('pendingRelaxRecords') || []
  records.value = storedRecords
  return { records: storedRecords, total: storedRecords.length }
}
```
同理替换 `fetchStatistics` 内 `const userId = 'current-user-id'`（:164）处。

**验证方式**：未登录状态下调用 `fetchRecords` → 命中离线分支、返回 `pendingRelaxRecords`；已登录 → 走在线。

---

### 2.4 feature flag 变量名（#5）

**位置**：根 `.env:5` 用 `VITE_FEATURE_NON_CORE_MODULES_ENABLED=true`，但 `src/config/featureFlags.ts:24` 读 `import.meta.env.VITE_FEATURE_NON_CORE_MODULES`（`.env.example` 也无该变量，仅 `.env` 错写）→ 开关恒为 `true`（fallback 默认 true），且无法关闭。

**决策**：统一为 `VITE_FEATURE_NON_CORE_MODULES`。

before（`.env:5`）:
```ini
VITE_FEATURE_NON_CORE_MODULES_ENABLED=true
```
after（`.env:5`）:
```ini
VITE_FEATURE_NON_CORE_MODULES=true
```

before（`featureFlags.ts:23-25`，读取已正确，仅补启动校验）:
```ts
export const getFeatureFlags = (_environment: FeatureFlagEnvironment): FrontendFeatureFlags => ({
  nonCoreModules: toBool(import.meta.env.VITE_FEATURE_NON_CORE_MODULES, true),
})
```
after（补显式校验：缺失时告警并明确默认）:
```ts
export const getFeatureFlags = (environment: FeatureFlagEnvironment): FrontendFeatureFlags => {
  const raw = environment.VITE_FEATURE_NON_CORE_MODULES
  if (raw === undefined) {
    console.warn(
      '[featureFlags] 未设置 VITE_FEATURE_NON_CORE_MODULES，非核心模块将默认启用。',
    )
  }
  return { nonCoreModules: toBool(raw, true) }
}
```

after（`.env.example` 同步补齐，避免后人再踩）:
```ini
# 非核心模块开关 (音乐/放松/活动/社区/课程/成就)，默认启用
VITE_FEATURE_NON_CORE_MODULES=true
```

**验证方式**：设 `VITE_FEATURE_NON_CORE_MODULES=false` 重启前端 → 课程/音乐/放松等路由按 feature flag 关闭（控制台无告警）；设 `true` 或留空 → 启用。

---

## 三、P2 前端架构清理方向（#6/#8/#17，详细留质量专家）

仅给文件级改造清单与方向，不在此落地具体补丁。

- **#6 / #8 合并 `activity.ts` 与 `activityApi.ts`**：
  - 现状：`src/api/activity.ts` 已是 `@/api/activityApi` 的 `@deprecated` 兼容层（转调其导出）。保留两层属冗余。
  - 方向：全局检索 `import ... from '@/api/activity'`，迁移到 `@/api/activityApi`；删除 `activity.ts`。注意 `getActivities` 等命名已在 `activityApi.ts` 定义，迁移时保持签名一致。
- **#8 `SafeResult` 单源**：现状已单源（`src/types/api.ts:21-23`），其余模块均 `import type { SafeResult } from '@/types/api'`（已 grep 确认：`achievements.ts`/`advice.ts`/`relax.ts`）。**无需改动**，仅确认无散落副本。
- **#17 `relax` 类型收敛 + `service` 层**：
  - `src/stores/relaxStore.ts` 内联 `RelaxRecord`/`OfflineRecord` 等类型 → 收敛到 `src/types/relax.ts`。
  - store 与 `api/relax.ts` 之间可引入 `services/relaxService.ts` 薄层，统一封装 `getRecordsSafe` / `getStatisticsSafe` 与离线降级逻辑，store 只负责状态，避免 store 里塞满请求与分支。
- **通用原则**：API 层只做请求/信封解包；store 只持有状态与简单派生；跨“请求+本地降级+错误归一”的复杂流程下沉到 `services/*`。

---

## 四、验证清单

### 4.1 单元测试（vitest，前端）
```bash
cd d:/桌面/ccooddee
npx vitest run src/stores/__tests__/moodStore.spec.ts src/stores/__tests__/moodRecordStore.spec.ts
# 预期：错误消费改用 getErrorMessage；shouldRetryError/handleAiError 对 ApiRequestError.status 正确分支
```
- 新增用例：模拟 `ApiRequestError({kind:'http',status:429,...})` → `handleAiError` 触发冷却、`shouldRetryError` 返回 `true`。
- 新增用例：`relaxStore.fetchRecords` 在 `userStore.user=null` 时命中离线分支。

### 4.2 后端接口自测（前端联调前）
```bash
cd d:/桌面/ccooddee/mood_health_server
npm run build && npm start   # 或 npm run dev
# 用真实 JWT cookie 调:
curl -b cookie.txt -X GET  http://localhost:3000/api/admin/courses          # M1
curl -b cookie.txt -X POST http://localhost:3000/api/moods/advice/save \
     -H 'Content-Type: application/json' \
     -d '{"analysis":"...","suggestions":["a","b"]}'                         # M2
curl -b cookie.txt -X GET  'http://localhost:3000/api/moods/advice/history?page=1&pageSize=20'  # M2
curl -b cookie.txt -X DELETE http://localhost:3000/api/mood-analyses/1       # M3
curl -b cookie.txt -X GET  http://localhost:3000/api/counseling/sessions/<uuid>  # M4
# 预期：均返回 {code:0,data:...}；无权限返回 {code:1003/...} 且 message 中文可读
```

### 4.3 端到端（Playwright）
```bash
npx playwright test tests/improve/courses.spec.ts tests/relax.spec.ts tests/advice.spec.ts
# 预期：课程列表/详情渲染正常（无 v-for 对象异常）；未登录 relax 走离线；advice 保存/历史可展示
```

### 4.4 文档/实现一致性核对（D3 自动消解验证）
```bash
grep -n "advice/save\|advice/history" docs/API.md mood_health_server/src/routes/moodRoutes.ts
# 预期：docs/API.md:347,374 的两条路径在 moodRoutes.ts 中均已注册，路径与契约一致
```

### 4.5 变量收敛检查
```bash
grep -rn "VITE_FEATURE_NON_CORE_MODULES_ENABLED" . --include=.env --include=*.ts
# 预期：仅 .env 改后无残留；featureFlags.ts 只读 VITE_FEATURE_NON_CORE_MODULES
```

---

### 附：落地顺序建议（供执行专家参考，不在本文范围）
1. §1.1.1 信封化 courseController（连带 §2.2 前置）。
2. §1.1.2 / §1.2 / §1.3 / §1.4 后端路由与控制器。
3. §2.1 错误工具统一 + 4 个前端文件改造。
4. §2.2 / §2.3 / §2.4 前端收尾。
5. 跑 §四 验证，再交质量专家做 §三 架构清理。
