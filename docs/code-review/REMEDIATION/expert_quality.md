# 代码质量与解耦修改方案

> 范围：仅方案（补丁草稿 + 重构方向），不落地源码、不 git commit、不写 dist/。
> 聚焦集群：代码质量、类型安全、解耦、死代码、测试提标。
> 不在本方案：接口契约实现、安全鉴权策略落地、CI 流水线（由其他专家负责）。
> 已确认决策：AI 数据库死代码（`app/db`、`app/repositories`、`migrations/`、`run_migrations`）**直接删除**，仅给删除清单与影响确认步骤，不给替代实现。

---

## 一、P2 类型纯净（any / HttpStatus 常量）

### 1.1 #10 消除 `any`（优先级：errors.ts / redis.client.ts / 解析 AI 返回）

**位置**：`mood_health_server/src/utils/errors.ts:15,21`、`mood_health_server/src/utils/redis.client.ts:90-93`、`mood_health_server/src/services/analysisDispatcher.ts:45-118`、`mood_health_server/src/controllers/*`（解析 AI 返回）。

**问题**：`AppError.data` 用 `any`；`RedisClient.execute` 命令与参数全程 `any[]`；`analysisDispatcher` 的 `pool.query<any[]>` 与 `.map((r: any) => …)` 绕过类型检查；控制器里 `catch (error: any)` + `error.message` 也属隐式 any。

#### 1.1.1 errors.ts —— 泛型化 `data`

```ts
// before (errors.ts:15,21)
export class AppError extends Error {
  public data: any;
  constructor(message: string, statusCode: number, data: any = null, path: string = "") { … }
}

// after
export class AppError<TData = unknown> extends Error {
  public data: TData;
  constructor(message: string, statusCode: number, data: TData = null as TData, path: string = "") {
    super(message);
    this.data = data;
    …
  }
}
// 子类沿用泛型：BusinessError<TData = unknown> extends AppError<TData>
// DatabaseError 的 originalError 用具体类型：originalError: unknown
```

> 收益：调用方 `err.data` 不再自由转型；`originalError: any` 改为 `unknown` 后强制 `instanceof`/类型守卫。

#### 1.1.2 redis.client.ts —— 收窄 `execute` 签名

```ts
// before (redis.client.ts:90-93)
public async execute<T>(
  command: (...args: any[]) => Promise<T>,
  ...args: any[]
): Promise<T | null> { … }

// after
public async execute<T>(
  command: (...args: never[]) => Promise<T>,
  ...args: never[]
): Promise<T | null> {
  return command.apply(this.client, args as unknown as []) as Promise<T>;
}
// 调用方改为强类型，例如：
public async get(key: string): Promise<string | null> {
  return this.execute((k: string) => this.client.get(k), key);
}
```

> 说明：`never[]` 阻止随意传参；调用处显式标注参数类型（见 `set/get/del/keys/incr/expire`）。`scan` 内的 `this.client.scan(cursor,'MATCH',pattern,'COUNT',count)` 直接走原生客户端即可，无需经 `execute`。

#### 1.1.3 analysisDispatcher.ts —— 用 `RowDataPacket` 替代 `any`

```ts
// before (analysisDispatcher.ts:48,63,78,95,109,117)
const [rows] = await pool.query<any[]>(`SELECT …`, [userId, days]);
return rows.map((r: any) => ({ date: r.date, emotionName: r.emotionName, … }));

// after
interface MoodMetricRow extends RowDataPacket { date: string; emotionName: string; emotionCategory: string; intensity: number; count: number }
const [rows] = await pool.query<MoodMetricRow[]>(`SELECT …`, [userId, days]);
return rows.map((r) => ({ date: r.date, emotionName: r.emotionName, intensity: Number(r.intensity), count: Number(r.count) }));
// fetchMoodTrend / fetchTriggers 同样补 TrendRow / TriggerRow extends RowDataPacket
```

#### 1.1.4 定义 AI 返回 DTO（controllers 解析 AI 返回统一出口）

新增 `mood_health_server/src/contracts/aiResponse.ts`：

```ts
import type { MoodAnalysisResponse } from './moodAnalysis';
export interface AiDispatchResult {
  provider: string;
  model: string;
  data: MoodAnalysisResponse;
}
// 控制器内：const result = response.data as AiDispatchResult; 不再用 any 逐字段取值
```

**验证**：`cd mood_health_server && npx tsc --noEmit` 应 0 error；`grep -rn ": any" src/ | wc -l` 由 93 → 接近 0（残留仅第三方回调必要时配 `eslint-disable` 注释并登记）。

---

### 1.2 #11 263 处魔法 HTTP 状态码

**位置**：全后端 `res.status(500/400/404/401/403/201…)`（约 263 处）。

**问题**：状态码字面量散落，重构/语义调整易漏改，且无法静态检索“所有 403 出口”。

**方案**：抽 `src/utils/httpStatus.ts` 常量模块，全局替换。

```ts
// src/utils/httpStatus.ts
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];
```

替换示例（`activityController.ts`）：

```ts
// before
res.status(500).json(apiFailure(500, '服务器错误'))
// after
import { HttpStatus } from '../utils/httpStatus'
res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(apiFailure(HttpStatus.INTERNAL_SERVER_ERROR, '服务器错误'))
```

> 落地方式：用 `sed`/`jscodeshift` 批量替换 + `tsc` 校验；建议配合 ESLint 规则 `no-magic-numbers` 对 `res.status()` 入参限制（允许引用 `HttpStatus.*`）。

**验证**：`grep -rn "res.status([0-9]" src/ | wc -l` → 0；`npx tsc --noEmit` 通过。

---

## 二、P2 分层与解耦（activityController、权限模型、全局鉴权、吞错）

### 2.1 #8/#9 分层越界：controller 直连 DB 写统计 SQL

**位置**：`mood_health_server/src/controllers/activityController.ts:3-4,395,426`、`mood_health_server/src/services/analysisDispatcher.ts:13`（`getMysqlPool` 在 service 内直接取池，属同层尚可，但统计查询应下沉）。

**问题**：`getActivityStatsHandler` 直接 `getMysqlPool()` 拼 4 条统计 SQL（:395-453），controller 承担了 repository 职责；违反“controller 只做编排、数据访问在 repository”的分层。

**方案**：统计查询下沉到 `activityRepository`（或新建 `activityStatsService`）。

```ts
// after: repositories/activityRepository.ts 新增
export interface ActivityStats {
  totalActivities: number; totalParticipants: number; averageParticipants: number;
  totalFeedback: number; averageRating: number;
  ratingDistribution: Record<1|2|3|4|5, number>;
}
export const createActivityRepository = (db = getMysqlPool()) => {
  // …既有方法
  const getStats = async (filter: { startDate?: string; endDate?: string }): Promise<ActivityStats> => {
    const dateFilter: string[] = []; const params: unknown[] = [];
    if (filter.startDate) { dateFilter.push('AND a.start_time >= ?'); params.push(filter.startDate); }
    if (filter.endDate)   { dateFilter.push('AND a.start_time <= ?'); params.push(filter.endDate); }
    const where = `WHERE 1=1 ${dateFilter.join(' ')}`;
    const [total, joined, fb, dist] = await Promise.all([
      db.query<RowDataPacket[]>(`SELECT COUNT(*) AS t FROM activities a ${where}`, params),
      db.query<RowDataPacket[]>(`SELECT COUNT(*) AS t FROM activity_participants ap JOIN activities a ON ap.activity_id=a.id ${where}`, params),
      db.query<RowDataPacket[]>(`SELECT COUNT(*) AS t, COALESCE(AVG(af.rating),0) AS avg FROM activity_feedback af JOIN activities a ON af.activity_id=a.id ${where}`, params),
      db.query<RowDataPacket[]>(`SELECT SUM(rating=1) r1,SUM(rating=2) r2,SUM(rating=3) r3,SUM(rating=4) r4,SUM(rating=5) r5 FROM activity_feedback af JOIN activities a ON af.activity_id=a.id ${where}`, params),
    ]);
    // …映射到 ActivityStats（同原逻辑）
  };
  return { …, getStats };
};
```

```ts
// after: controllers/activityController.ts 顶部移除 `import { getMysqlPool } from '../config/mysql'`
export const getActivityStatsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query as Record<string, string>;
    // 日期格式校验保持不变
    const stats = await activityRepo.getStats({ startDate, endDate }); // 委托 repository
    res.json(apiSuccess(stats, '获取活动统计成功'));
  } catch (error) {
    logger.error('获取活动统计失败:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(apiFailure(HttpStatus.INTERNAL_SERVER_ERROR, '服务器错误'));
  }
};
```

**验证**：`npm test` 中 `appFactory.test.ts` + 新增 `activityStats` 单测（走 mock DB DI）；`grep -n "getMysqlPool" src/controllers/` → 0 命中（仅 config/repository 层允许）。

---

### 2.2 #13 权限模型双份（代码映射 + 库表），易漂移

**位置**：`mood_health_server/src/middleware/auth.ts:92-218`（内存 `rolePermissions`）、库表 `role_permissions`（由 `coreSeed` 写入）、`auth.register.role_assign` 永不授予。

**问题**：角色→权限同时存在于「代码常量 `rolePermissions`」与「DB `role_permissions`」。两端任一改动都会漂移；且 `auth.register.role_assign` 出现在所有角色的 `forbidden` 中却从未被 `granted`，属死权限码。

**方案**：以 DB 为权威；代码 `rolePermissions` 仅作**种子数据**（启动时写入 `role_permissions`，不用于运行时判定）；`requirePermission` 永远走 `accessRepository.hasPermission`。

```ts
// after: middleware/auth.ts
// 1) 删除运行时判定的 rolePermissions 映射；保留 seed 常量供 coreSeed 写入
export const ROLE_PERMISSION_SEED: Record<UserRole, PermissionCode[]> = {
  student: [/* 仅 granted 列表 */ 'auth.profile.read', 'mood.record.create', …],
  // …其余角色同理，删除所有 forbidden 段
};
// 2) requirePermission 仅依赖 DB
export const requirePermission = (permission: PermissionCode) => async (req, res, next) => {
  if (!req.user) return sendAuthError(req, res, HttpStatus.UNAUTHORIZED, '未登录');
  const granted = await getAccessRepository().hasPermission(getNormalizedRequestRole(req), permission);
  if (!granted) { await auditAccessDenied(…); return sendAuthError(req, res, HttpStatus.FORBIDDEN, '权限不足'); }
  next();
};
// 3) 清理死权限码 'auth.register.role_assign'（从 PermissionCode 联合类型与 seed 中移除）
```

**补充**：新增一致性校验测试 `tests/unit/architecture/rolePermissionConsistency.test.ts`：断言 `ROLE_PERMISSION_SEED` 展开后的权限集合 ⊆ `PermissionCode` 联合类型；并在集成测试中比对「代码 seed」与「DB `role_permissions` 实际行」一致。

**验证**：`npm run test:unit` 含一致性测试；`grep -n "auth.register.role_assign" src/ | wc -l` → 0。

---

### 2.3 #19/#20 鉴权脆弱：路由级逐路由 `authenticate` + 守卫不验签

**位置**：`mood_health_server/src/app.ts:182-208`（各 router 在 `routes/*.ts` 内自行 `authenticate`）、`mood_health_server/src/middleware/auth.ts:323,352,386`（`requireAdmin/requireRole/requirePermission` 仅 `if(!req.user)` 判空，不验 JWT 签名）。

**问题**：鉴权散落在 router 层、不统一；`requireXxx` 守卫把「无 user」当 401，但并未主动验证令牌签名（若将来某路由漏挂 `authenticate`，守卫只是因 `req.user` 为 `undefined` 返回 401，逻辑脆弱且不可见）。

**方案**：`app.ts` 对 `/api` 挂**全局 `authenticate`**（登录/注册等公开端点除外）；路由级仅保留 `requirePermission/Role/Admin`；守卫内部先 `authenticate` 再判定（防御式）。

```ts
// after: app.ts（关键片段）
import { authenticate, requirePermission, requireRole, requireAdmin } from './middleware/auth';

// 公开端点（登录/注册/刷新）先挂载，且跳过全局 authenticate
app.use('/api/auth', authRoutes);              // 内部 login/register 不鉴权
// 其余 /api 统一鉴权
app.use('/api', authenticate);                 // 全局前置
app.use('/api/audit', auditRoutes);
app.use('/api/cases', requirePermission('…'), caseRoutes);
app.use('/api/activities', requirePermission('activity.manage'), activityRoutes); // 视端点细化
// …其余路由
```

```ts
// after: middleware/auth.ts —— 守卫先确保已鉴权
const ensureAuthenticated = (req: AuthRequest, res: Response): boolean => {
  if (!req.user) { sendAuthError(req, res, HttpStatus.UNAUTHORIZED, '未登录'); return false; }
  return true;
};
export const requireAdmin = (req, res, next) => {
  if (!ensureAuthenticated(req, res)) return;
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') { /* 403 */ return; }
  next();
};
// requireRole / requirePermission 同样先 ensureAuthenticated
```

**验证**：`npm run test:integration` 新增「未带 token 访问受保护端点→401」「带合法 token→200」「越权角色→403」；`grep -rn "authenticate" src/routes/ | wc -l` 应降为 0（统一收到 app 层）。

---

### 2.4 #15/#6 吞错（吞异常/密文当明文）

**位置**：`mood_health_server/src/repositories/achievementRepository.ts:118`（`catch{return 0}`）、`mood_health_server/src/utils/encryption.ts:78`（`decrypt` 失败 `return encryptedData`）。

**问题**：`getMetricValue` 吞掉 DB 异常返回 0，会让“查询失败”被误认为“进度为 0”，成就进度静默失真；`decrypt` 在解密失败时把**密文原样返回**，调用方拿到的其实是加密串却以为已解密，构成数据正确性与安全隐患。

#### 2.4.1 achievementRepository

```ts
// before (achievementRepository.ts:112-120)
try { const [rows] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS total …`, [userId]); return Number(rows[0]?.total || 0); }
catch { return 0; }

// after
try { const [rows] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS total …`, [userId]); return Number(rows[0]?.total || 0); }
catch (error) {
  logger.error('统计成就指标失败: type=%s, userId=%d, error=%s', type, userId, error);
  throw new DatabaseError('查询成就指标失败', error);
}
// 调用方 checkAndUnlock 用 try/catch 决定整体失败，而非掩盖为 0
```

#### 2.4.2 encryption.decrypt

```ts
// before (encryption.ts:76-79)
catch (error) { logger.error('Decryption error:', error); return encryptedData; }

// after：失败抛错（或返回 null 由调用方显式处理）
export function decrypt(encryptedData: string, keyHex?: string): string {
  if (!encryptedData) return encryptedData;
  if (!encryptedData.startsWith('{')) return encryptedData; // 明文直通，保持兼容
  try { /* …原解密逻辑… */ return decrypted; }
  catch (error) {
    logger.error('Decryption error:', error);
    throw new Error('数据解密失败'); // 不再把密文当明文返回
  }
}
// 调用方（如解密用户字段）需处理异常；若确需“解密失败即视为无值”，改为返回 null 并在调用处判空
```

**验证**：`npm run test:unit` 新增 `achievementRepository` 注入 mock DB 抛错断言→抛出 `DatabaseError`；`encryption.test.ts` 断言“损坏密文调用 decrypt 抛错”。

---

## 三、P2 死代码清理

### 3.1 #12 `config/sqlite.ts`（node:sqlite 遗留，无启用路径）

**位置**：`mood_health_server/src/config/sqlite.ts`（~266 行，`DatabaseSync`/`node:sqlite`）。

**问题**：后端统一走 MySQL（`getMysqlPool`），`sqlite.ts` 无任何启用路径；已有架构测试 `tests/unit/architecture/noSqliteActivePath.test.ts` 反向确认“无活动路径”。

**删除清单**：
- `mood_health_server/src/config/sqlite.ts`

**反向确认（删除前/后均须通过）**：
```bash
cd mood_health_server
# 确认无任何 import
grep -rn "config/sqlite\|from '../config/sqlite'\|sqliteDb" src/ | wc -l   # 期望 0
# 反向确认测试仍通过
npx jest tests/unit/architecture/noSqliteActivePath.test.ts --runInBand
```
**验证**：上述 grep 为 0 且架构测试绿。

---

### 3.2 #12 `app.ts` 的 `NON_CORE_ROUTES` + `featureFlag.requireNonCoreModules` 空操作

**位置**：`mood_health_server/src/app.ts:57`（`NON_CORE_ROUTES = [] as const`）、`:187-191` 空循环、`:198-203` 每路由挂 `requireNonCoreModules`、`mood_health_server/src/middleware/featureFlag.ts`。

**问题**：`NON_CORE_ROUTES` 恒为空 → 循环与 `requireNonCoreModules` 皆为无效中间件（所有核心模块本就挂载）。属空操作死代码。

**方案**：删除常量与中间件引用；`featureFlag.ts` 若无其他用途一并删除。

```ts
// after: app.ts
// 删除 const NON_CORE_ROUTES = [] as const; 与第 187-191 行循环
app.use('/api/activities', activityRoutes);   // 原 requireNonCoreModules 移除
app.use('/api/posts', postRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/relax', relaxRoutes);
app.use('/api/achievements', achievementRoutes);
// 删除 import { requireNonCoreModules } from './middleware/featureFlag'
```

**确认命令**：
```bash
grep -rn "requireNonCoreModules\|NON_CORE_ROUTES" src/ | wc -l   # 期望 0
npx jest tests/unit/appFactory.test.ts --runInBand
```

---

### 3.3 AI 数据库死代码删除（已确认）

**删除文件清单**：

```
mood_health_ai_service/app/db/__init__.py
mood_health_ai_service/app/db/migrations.py
mood_health_ai_service/app/repositories/__init__.py
mood_health_ai_service/app/repositories/analysis_task_repository.py
mood_health_ai_service/migrations/001_create_analysis_tasks.sql
mood_health_ai_service/tests/test_db.py                 # 仅测 app.db.migrations
mood_health_ai_service/tests/test_analysis_task_repository.py  # 仅测 app.repositories.*
# 说明：未找到任何 run_migrations 脚本/入口，无需删除（确认命令见下）
```

**确认“无任何 router import”的核对命令**：
```bash
cd mood_health_ai_service
# 在 app/ 与 tests/ 中检索这些符号，期望只命中自身定义或被删测试
grep -rn "app\.db\|app\.repositories\|from app\.db\|from app\.repositories\|run_migrations\|migrations" app/ tests/ \
  | grep -v "tests/test_db.py\|tests/test_analysis_task_repository.py"
# 期望输出为空（已实测：app/db、app/repositories 仅自引用）
# 确无 run_migrations 入口
ls run_migrations* 2>/dev/null || echo "no run_migrations entrypoint"
```

**影响确认步骤**：
1. 执行上述 grep，确认 `app/routers/*`、`app/main.py`、`app/services/*` 均不 import 这些模块（实测无引用）。
2. `python -c "import app.main"` 成功（确认删除后模块仍可装配）。
3. `pytest tests/ -q` 绿（删掉两个孤立测试后其余测试不受影响）。

**验证**：`ruff check app/`、`mypy app/`、`pytest` 全绿；`grep -rn "analysis_task_repository\|app.db" app/ tests/ | wc -l` → 0。

---

### 3.4 #7/#10/#14/#22 前端死代码

**删除/清理清单**：

| 文件:行 | 类型 | 处理 |
|---|---|---|
| `src/views/mood/MoodRecordScript.ts`（539 行） | 整文件无引用 | **删除**（已 `grep -rn "MoodRecordScript" src/` 确认 0 引用） |
| `src/stores/moodRecordStore.ts:817` | DEV `console.log` 噪声 | 删除 `if (import.meta.env.DEV) console.log(...)` 整段 |
| `src/stores/moodRecordStore.ts:822-827` | 死分支（`recordId=0`、`analysisJob=null` 后 `if(analysisJob)` 永假） | 删除 `const recordId=0`、`const analysisJob=null` 及 `if(analysisJob){…}` 整块，仅保留提交成功提示 |
| `src/stores/userStore.ts:21 token` | 半死状态（仅 set/clear，无消费方） | 若确无读取方，删除 `token` ref 与 `setToken/clearToken` 或改为仅 `clearToken` 透出；以全仓 `grep "userStore.token\|\.token"` 结果为准 |

**确认命令**：
```bash
cd "$(git rev-parse --show-toplevel)"
grep -rn "MoodRecordScript" src/ | wc -l          # 期望 0 → 可删
grep -rn "userStore.token\|\.token\b" src/ | wc -l # 评估 token 是否真死
```

**验证**：`vue-tsc --noEmit` 通过；`vitest run` 全绿。

---

## 四、P2 巨型组件/Store 拆分与常量下沉

### 4.1 #13 后端 god-file `models/aiModel.ts`（1682 行）

**位置**：`mood_health_server/src/models/aiModel.ts`（1682 行，约 50+ 接口：类型 + 疑似遗留/未用模型接口混居）。

**问题**：单一文件聚合全部 AI 类型、配置、性能、训练等接口，且含大量未被 import 的遗留接口（`AIModelConfig`/`AIModelPerformance`/`EmotionPredictionModel`/`EmotionModelTraining`/`EmotionAnalysisModel` 等仅定义无引用），检索与维护成本高。

**目标结构（拆分方向）**：
```
src/models/ai/
  index.ts                 # 统一再导出
  analysis.ts              # 情绪分析请求/响应 DTO
  counseling.ts            # 心理咨询对话
  contentAudit.ts          # 内容审核
  assistant.ts             # 心理助手
  config.ts                # AIModelConfig（若仍在用）
  legacy/                  # 明确标注“遗留、未使用”的接口，集中放置或直接删除
    prediction.ts          # EmotionPredictionModel（若无引用→删除）
    training.ts            # EmotionModelTraining（若无引用→删除）
```
**步骤**：
1. `grep -rln "AIModelConfig\|EmotionPredictionModel\|EmotionModelTraining" src/ tests/` 列出真实引用；无引用者直接删（不进 legacy）。
2. 有引用者按域迁移到 `src/models/ai/*.ts`，原 `aiModel.ts` 改为 `export * from './ai'`。
3. 删除后保留一个“orphan interface”单测（架构测试）断言无孤立接口。

**验证**：`npx tsc --noEmit`；`tests/unit/architecture/noOrphanAiInterface.test.ts`（新增）断言各接口至少被一处 import。

---

### 4.2 #21/#24/#16 前端巨型组件与 Store 拆分 + 常量下沉

**巨型清单与拆分方向**：

| 文件（行数） | 拆分方向 |
|---|---|
| `src/views/improve/GroupActivity.vue`（1496） | 拆：`GroupActivityList.vue` / `GroupActivityCard.vue` / `GroupActivityForm.vue` / `ActivityReminderModal.vue`；列表/表单/弹窗各自成组件 |
| `src/views/mood/MoodArchive.vue`（1344） | 拆：`MoodArchiveTimeline.vue` / `MoodArchiveFilter.vue` / `MoodArchiveStats.vue`；时间线、筛选、统计分离 |
| `src/views/mood/MoodRecord.vue`（1301） | 拆：`MoodRecordForm.vue` / `EmotionPicker.vue` / `MoodTagSelector.vue` / `MoodRecordSubmitBar.vue` |
| `src/stores/moodRecordStore.ts`（919） | 拆：`useMoodRecordStore`（提交/状态）+ `useMoodDraftStore`（草稿/离线队列）；统计与映射逻辑下沉 utils |

**静态数据下沉 `src/constants/`**：
- 情绪选项、`MOOD_OPTIONS`、`RECOMMEND_RULES`、推荐规则等从组件/store 内联常量迁移到 `src/constants/mood.ts`、`src/constants/recommend.ts`。

**`relaxStore` 本地统计下沉纯函数（#16）**：
```ts
// after: src/utils/relaxStats.ts（纯函数，可单测）
import type { RelaxRecord, RelaxStatistics } from '@/api/relax';
export function calculateLocalStatistics(
  records: RelaxRecord[],
  params?: { startDate?: string; endDate?: string },
): RelaxStatistics { /* …原 relaxStore.ts:197 逻辑原样搬入，去除 this 依赖 */ }

// relaxStore.ts:174,179,186 改为
const localStats = calculateLocalStatistics(records.value, params);
statistics.value = localStats;
```

**验证**：`vue-tsc --noEmit`；`vitest` 新增 `utils/relaxStats.test.ts` 覆盖空数据/边界日期；各拆分组件挂载测试通过。

---

### 4.3 #19 角色常量集中（去双定义）

**位置**：`src/router/guards.ts:10-12`（`UserRole` + `rolePermissions` 前端副本）、`src/stores/userStore.ts:30`（`isAdmin` 判定内联 `'admin'|'super_admin'`）。

**问题**：角色与权限映射在 `guards.ts` 与后端 `auth.ts` 双份定义，易漂移；且前端副本维度不全。

**方案**：提到 `src/constants/roles.ts`（或 `src/types/user.ts`）：
```ts
// src/constants/roles.ts
export type UserRole = 'user' | 'admin' | 'super_admin' | 'student' | 'counselor';
export const ADMIN_ROLES: readonly UserRole[] = ['admin', 'super_admin'];
export const ROLE_PERMISSIONS: Record<UserRole, readonly string[]> = { /* 仅前端路由守卫所需的最小集 */ };
```
`guards.ts` 与 `userStore.ts` 统一 `import { ADMIN_ROLES } from '@/constants/roles'`；`userStore.isAdmin = computed(() => ADMIN_ROLES.includes(user.value?.role as UserRole))`。

**验证**：`grep -rn "super_admin'\|'admin'" src/router/guards.ts src/stores/userStore.ts | wc -l` 降为 0（字符串字面量集中到常量）。

---

## 五、P2 AI 服务质量（asyncio.to_thread、provider 单例/溯源、eval 重命名、doctor 路径、测试外依赖）

### 5.1 #4 异步阻塞：同步 CPU 重检索在 async handler 内直接调用

**位置**：`app/assistant/service.py:37`、`app/rag/service.py:15`（`retrieve_knowledge` 同步做 embedding + chroma 查询，直接在 `async` 函数体内调用，阻塞事件循环）。

**方案**：`await asyncio.to_thread(...)` 把同步重检索移到线程池。

```py
# before (assistant/service.py:36-39)
records = _relevant_records(
    retrieve_knowledge(request.query, settings.RAG_TOP_K),
    settings.RAG_MIN_SIMILARITY,
)
# after
records = _relevant_records(
    await asyncio.to_thread(retrieve_knowledge, request.query, settings.RAG_TOP_K),
    settings.RAG_MIN_SIMILARITY,
)
```
```py
# before (rag/service.py:15)
records = retrieve_knowledge(request.query, settings.RAG_TOP_K)
# after
records = await asyncio.to_thread(retrieve_knowledge, request.query, settings.RAG_TOP_K)
```
> 注：`app/main.py:86` 已在 lifespan 用 `asyncio.to_thread(initialize_retriever)` 预热，handler 内同样处理即一致。

**验证**：`pytest tests/test_assistant_service.py tests/test_rag_service.py -q` 绿；压测/事件循环不阻塞（可用 `pytest` + `anyio` 的 `to_thread` 断言）。

---

### 5.2 #8 provider 溯源不一致（openai vs deepseek）

**位置**：`app/providers/openai_compatible.py:128`（`result.provider = "openai"`）、`app/assistant/service.py:77` / `app/rag/service.py:61`（`provider="deepseek"`）。

**问题**：同一底层 provider，analyze 流程标 “openai”，assistant/rag 标 “deepseek”，监控/审计溯源混乱。

**方案**：统一用 `settings.AI_MODEL` 派生的常量 `PROVIDER_NAME`。

```py
# after: app/providers/openai_compatible.py 新增模块级常量
from app.config import get_settings
PROVIDER_NAME = get_settings().AI_MODEL   # 例如 "deepseek-chat"；或映射为人类可读 "deepseek"
# analyze() 中 result.provider = PROVIDER_NAME
```
`assistant/service.py` 与 `rag/service.py` 改为 `from app.providers.openai_compatible import PROVIDER_NAME` 并 `provider=PROVIDER_NAME`。若需展示为 “deepseek”，在 `config.py` 增加 `PROVIDER_DISPLAY = "deepseek"` 并由 `AI_BASE_URL` 推导，三处共用。

**验证**：`pytest tests/test_providers.py tests/test_assistant_contract.py tests/test_rag_contract.py` 断言三处 `provider` 一致。

---

### 5.3 #10 provider 单例 + 落实 DI

**位置**：`app/assistant/service.py:63`、`app/rag/service.py:38`（每次请求 `OpenAICompatibleProvider(settings)` 新建，重复建连）。

**问题**：`OpenAICompatibleProvider.__init__` 本身惰性建 client（`client` 属性），反复 `new` 虽未立刻建连，但违背单例语义且无法注入 mock；`AnalysisProvider` 协议（已在 `app/providers/__init__.py` 定义）未落地 DI。

**方案**：模块级/`Depends` 单例复用 + FastAPI `Depends` 注入。
```py
# after: app/providers/__init__.py 增加工厂
from functools import lru_cache
@lru_cache
def get_analysis_provider() -> AnalysisProvider:
    from app.providers.openai_compatible import OpenAICompatibleProvider
    return OpenAICompatibleProvider(get_settings())
```
```py
# after: routers 中
from app.providers import get_analysis_provider, AnalysisProvider
@router.post("/chat")
async def chat(req: …, provider: AnalysisProvider = Depends(get_analysis_provider)):
    ...
# assistant/service.py / rag/service.py 改为接收 provider 参数（默认 Depends）
```
> 测试时 `app.dependency_overrides[get_analysis_provider] = lambda: FakeProvider()` 即可注入 mock。

**验证**：`pytest tests/test_providers.py` 断言 `get_analysis_provider() is get_analysis_provider()`（单例）；AI 测试用 `dependency_overrides` 注入 fake。

---

### 5.4 #11 / #17 RAG 阈值与降级策略

**位置**：`app/rag/service.py:15-17`（未应用 `RAG_MIN_SIMILARITY`）、`app/rag/service.py:16` 直接 `raise RagNotReadyError`（无降级），而 `app/assistant/service.py:34-45` 用 `_relevant_records(..., threshold)` 且失败降级为无上下文。

**方案**：
- RAG 也应用阈值：复用 `RetrievedKnowledge.similarity` 与 `settings.RAG_MIN_SIMILARITY`，或在 `retrieve_knowledge` 内按阈值过滤（需同时修正 `app/rag/retriever.py:94` 的 `retrieve_knowledge`——目前返回 top-k 但不过滤相似度）。
- 降级策略与 assistant 对齐：检索失败/无结果时**不抛 500**，改为返回“无可用资料”的兜底答案（或显式 `fallbackUsed=True`），由调用方决定。

```py
# retriever.py: retrieve_knowledge 增加阈值过滤（可选，配合 settings）
def retrieve_knowledge(query: str, limit: int, min_similarity: float | None = None) -> list[RetrievedKnowledge]:
    results = _similarity_search(query.strip(), limit)
    if min_similarity is not None:
        results = [r for r in results if r.similarity >= min_similarity]
    return results
# rag/service.py
records = await asyncio.to_thread(retrieve_knowledge, request.query, settings.RAG_TOP_K, settings.RAG_MIN_SIMILARITY)
if not records:
    # 与 assistant 一致的降级：返回兜底提示，而非 raise
    return RagAnswerResponse(answer="当前知识库暂无可参考内容，请稍后重试或联系专业人员。",
                              sources=[], requestId=request.requestId, provider=PROVIDER_NAME,
                              model=settings.AI_MODEL, usage=None, fallbackUsed=True)
```

**验证**：`tests/test_rag_service.py` 断言“低相似度检索结果被过滤”“空结果走降级而非 500”。

---

### 5.5 #18/#20 `os.getenv` 散落绕过集中 Settings

**位置**：`app/main.py:110`（`os.environ.get("NODE_ENV", "development")`）；`scripts/doctor.py` 大量 `os.environ.get`（配置面板应读 `Settings`）。

**问题**：绕过 `app/config.py` 的集中 `Settings`，散布读取使配置来源不单一、易遗漏。

**方案**：统一用 `get_settings()`。`main.py` 改为：
```py
from app.config import get_settings
settings = get_settings()
docs_url = "/api/docs" if settings.NODE_ENV == "development" else None
```
`doctor.py` 的环境变量检查若需与运行时一致，可 `from app.config import Settings; s = Settings()` 读取，或保留 `os.environ` 但集中到一处常量列表（已在 `required_env` 中）并注释“与 Settings 字段对应”。

**验证**：`grep -rn "os.environ\|os.getenv" app/` → 仅 `main.py` 入口与 `config.py` 必要处；`mypy app/` 通过。

---

### 5.6 #12 `eval/` 包名遮蔽内置 `eval`

**位置**：`mood_health_ai_service/tests/eval/`（含 `test_loader.py`、`test_scoring.py`；无 `__init__.py`，但作为包被 pytest 收集，导入路径 `tests.eval.*` 有遮蔽内置 `eval` 风险）。

**方案**：重命名为 `tests/evaluation/`，更新 `pytest` 收集与任何 import。
```bash
cd mood_health_ai_service && git mv tests/eval tests/evaluation
# 若有 `from tests.eval... import` 同步改写；本仓库测试相互 import 实测为 0，仅需重命名目录
```

**验证**：`pytest tests/evaluation -q` 绿；`python -c "import eval" 2>&1` 不误导入本仓库（内置 eval 可用）。

---

### 5.7 #14 `doctor.py` 的 `.env` 路径算错

**位置**：`mood_health_ai_service/scripts/doctor.py:21`（`root = Path(__file__).parent.parent.parent`）、`:124`（`env_file = root / ".env"`）。

**问题**：`root` 解析为仓库根（因 `scripts/doctor.py` 上三层），但 FastAPI 服务由 `app/config.py` 的 `env_file=".env"` 从**自身工作目录**加载（实际为 `mood_health_ai_service/.env`）。doctor 校验的是仓库根 `.env`，与服务真正消费的文件可能不一致，导致“环境就绪”误报。

**方案**：校验服务实际加载的 `.env`（以 `ai_dir` 为准），并兼容仓库根 `.env` 提示。
```py
# after (doctor.py)
root = Path(__file__).parent.parent.parent
ai_dir = root / "mood_health_ai_service"
# 8. .env 文件 —— 以 AI 服务实际工作目录为准
print("\n--- .env 文件 ---")
env_file = ai_dir / ".env"          # 服务真实读取位置
repo_env = root / ".env"
if env_file.exists():
    check(f".env 文件存在 ({env_file})", True)
elif repo_env.exists():
    check(f"AI 服务目录缺 .env，但仓库根存在 ({repo_env})；服务将读不到", False)
    errors += 1
else:
    check(".env 文件不存在", False); errors += 1
```

**验证**：在 `mood_health_ai_service/` 缺 `.env`、仓库根有时，`python scripts/doctor.py` 应 FAIL 并提示；补齐后 PASS。

---

### 5.8 #13 `test_rag_service.py` 依赖仓库外 `agent_app`

**位置**：`mood_health_ai_service/tests/test_rag_service.py`（import `agent_app`，该包位于仓库外 `agent_app/`，导致测试不可移植、CI 难复现）。

**方案**：改为依赖仓库内 `app.rag.retriever` / `app.rag.knowledge_base`，用本地 `KNOWLEDGE_RECORDS` 构造测试语料，必要时用 `monkeypatch` 替换 embedding/collection。
```py
# after
from app.rag.retriever import retrieve_knowledge, RetrievedKnowledge
from app.rag.knowledge_base import KNOWLEDGE_RECORDS
def test_retrieve_returns_known_source():
    recs = retrieve_knowledge(KNOWLEDGE_RECORDS[0].content[:10], limit=1)
    assert recs and recs[0].reference == KNOWLEDGE_RECORDS[0].reference
```
**验证**：`grep -rn "agent_app" tests/ | wc -l` → 0；`pytest tests/test_rag_service.py` 在干净环境可跑。

---

## 六、P2 测试提标（集成测试、覆盖率门槛、repository 单测、AI analyze/chat 测试）

### 6.1 后端 #23/#24/#25 集成测试与覆盖率门槛

**现状**：集成测试仅 `tests/integration/moodCrud.integration.test.ts` 1 套；`jest.config.js` 覆盖率门槛仅 `functions 45 / lines 45`（#24）；核心 repository（post/activity/achievement/course/music/relax/management）无单测（#25）。

**方案 A：补充集成测试（走现有 mock DB DI 模式）**
- `tests/integration/auth.integration.test.ts`：注册→登录拿 token→携带 token 访问受保护端点；越权角色→403；无 token→401。
- `tests/integration/postAudit.integration.test.ts`：普通用户发帖→管理员 `post.audit` 审核通过/拒绝流转。
- `tests/integration/aiAnalyze.integration.test.ts`：mock `axios` 调 FastAPI，断言 `analysisDispatcher.dispatchAnalysis` 的落库与响应校验（禁止字段拦截）。

**方案 B：覆盖率门槛提到 函数/行 ≥70%**
```js
// mood_health_server/jest.config.js —— coverageThreshold.global
functions: 70,
lines: 70,
branches: 60,
statements: 70,
```

**方案 C：repository 单测（复用既有 mock DB 注入 `createXRepository(mockDb)`）**
新增清单：
- `tests/unit/repositories/postRepository.test.ts`
- `tests/unit/repositories/activityRepository.test.ts`（含 `getStats`）
- `tests/unit/repositories/achievementRepository.test.ts`（含“DB 抛错→抛 DatabaseError”，对应 2.4.1）
- `tests/unit/repositories/courseRepository.test.ts`
- `tests/unit/repositories/musicRepository.test.ts`
- `tests/unit/repositories/relaxRepository.test.ts`
- `tests/unit/repositories/managementRepository.test.ts`

mock 模式示例：
```ts
const mockDb = { query: jest.fn().mockResolvedValue([[{ total: 5 }] as any]) };
const repo = createAchievementRepository(mockDb as any);
expect(await repo.getMetricValue(1, 'mood_records')).toBe(5);
```

**验证**：`cd mood_health_server && npm run test:coverage` → 函数/行 ≥70% 且全绿；`npm run test:integration` 绿。

---

### 6.2 AI 测试 #6 analyze/chat 零测试

**现状**：`/api/analyze/mood` 与 `/api/chat` 无测试（仅 contract/provider 测试）。

**方案**：router 集成测试 + mock provider（复用 5.3 的 `dependency_overrides`）。
新增清单：
- `tests/test_analyze_router.py`：POST `/api/analyze/mood` → 用 `FakeProvider.analyze` 返回合法 `MoodAnalysisResponse` → 断言 200 + 字段；注入非法 JSON → 断言 422/500 且含禁止字段拦截。
- `tests/test_chat_router.py`：POST `/api/chat` → `FakeProvider.chat` 返回文本 → 断言 200 + `answer`；空返回 → 断言 500（`RuntimeError`）。
- `tests/test_assistant_router.py`：覆盖 `riskDetected` 分支（跳过检索）与正常检索降级。

FakeProvider 示例：
```py
class FakeProvider:
    async def analyze(self, request): return MoodAnalysisResponse(…)      # 满足 contracts
    async def chat(self, messages, **kw): return ("hi", settings.AI_MODEL, None)
app.dependency_overrides[get_analysis_provider] = lambda: FakeProvider()
```

**验证**：`cd mood_health_ai_service && pytest tests/test_analyze_router.py tests/test_chat_router.py tests/test_assistant_router.py -q` 绿；`ruff`/`mypy` 通过。

---

## 七、验证清单（预期命令与结果）

### 后端（TypeScript）
| 命令 | 预期 |
|---|---|
| `cd mood_health_server && npx tsc --noEmit` | 0 error；`grep -rn ": any" src/\|wc -l` 由 93 显著下降 |
| `grep -rn "res.status([0-9]" src/ \| wc -l` | 0（全部 `HttpStatus.*`） |
| `grep -rn "getMysqlPool" src/controllers/ \| wc -l` | 0（统计已下沉） |
| `npm run test:unit` | 含权限一致性、achievement 抛错、repository 单测，全绿 |
| `npm run test:integration` | 含 auth/postAudit/aiAnalyze 新集成，全绿 |
| `npm run test:coverage` | 函数/行 ≥70%，门槛不触发失败 |

### 前端（TypeScript / Vue）
| 命令 | 预期 |
|---|---|
| `cd 仓库根 && npx vue-tsc --noEmit` | 0 error；`grep -rn ": any\|Array<" src/\|wc -l` 中 `any` 由 44 下降 |
| `grep -rn "MoodRecordScript" src/ \| wc -l` | 0（已删） |
| `npx vitest run` | 含 `relaxStats.test.ts`、组件拆分挂载测试，全绿 |
| `npx vitest run --coverage` | 新增 functions/lines ≥70% 门槛（见下） |

> 前端覆盖率门槛补充（`vitest.config.ts` → `coverage` 增加）：
> ```ts
> coverage: { … , thresholds: { functions: 70, lines: 70, branches: 60, statements: 70 } }
> ```

### AI 服务（Python）
| 命令 | 预期 |
|---|---|
| `cd mood_health_ai_service && ruff check app/ tests/` | 0 error |
| `mypy app/` | 0 error |
| `pytest tests/ -q` | 绿；删除 `test_db.py`/`test_analysis_task_repository.py` 与 `app/db`、`app/repositories` 后无悬挂引用 |
| `grep -rn "agent_app" tests/ \| wc -l` | 0 |
| `python -c "import app.main"` | 成功（删除 DB 层后仍能装配） |
| `python scripts/doctor.py` | 按真实 `.env` 位置正确判定环境 |

### 交叉确认（删除影响）
```bash
# 后端 sqlite 死代码
grep -rn "config/sqlite" mood_health_server/src/ | wc -l   # 0
npx jest tests/unit/architecture/noSqliteActivePath.test.ts --runInBand   # 绿
# AI DB 层删除
grep -rn "app.db\|app.repositories\|run_migrations" mood_health_ai_service/app mood_health_ai_service/tests | grep -v "tests/test_db.py\|tests/test_analysis_task_repository.py"   # 空
```

> 所有 before/after 仅为补丁草稿，按本方案落地前需在对应仓库跑通上述验证命令；不在此方案范围内执行任何源码修改或提交。
