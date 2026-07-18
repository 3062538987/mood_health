# 集成测试报告 - ccooddee 项目

**生成日期**：2026-07-18  
**分析范围**：`d:\桌面\ccooddee\` 全部代码文件  
**分析方法**：静态代码分析（未执行实际测试）  
**项目类型**：全栈 Web 应用（Vue 3 + TypeScript 前端 / Express.js + TypeScript 后端 / MySQL + Redis）

---

## 一、项目集成架构

```
┌─────────────────────────────────────────────────────────────┐
│  前端 (Vue 3 + Element Plus + Pinia)                        │
│  ├─ src/utils/request.ts  ── Axios 拦截器 ──────────────────┤
│  ├─ src/stores/userStore.ts  ── 状态管理                    │
│  ├─ src/router/guards.ts  ── 路由守卫 + 权限校验            │
│  └─ src/views/*  ── 页面组件                                │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (JSON) + Cookie (JWT)
┌──────────────────────────▼──────────────────────────────────┐
│  后端 Express 应用 (app.ts)                                  │
│  ├─ 中间件链: helmet → cors → requestLogger → rateLimiter   │
│  │             → cookieParser → jsonParser → routes          │
│  ├─ 路由层 (routes/)                                         │
│  │   ├─ /api/auth  → authRoutes  (register/login/logout)    │
│  │   ├─ /api/moods → moodRoutes  (CRUD + 分析 + 洞察)       │
│  │   ├─ /api/ai    → aiInterpretationRoutes                 │
│  │   ├─ /api/admin → managementRoutes                       │
│  │   ├─ /api/activities → activityRoutes                    │
│  │   └─ ... 其他路由                                        │
│  ├─ 中间件: authenticate → requireRole → validateRequest    │
│  ├─ 控制器层 (controllers/)                                  │
│  ├─ 服务层 (services/)                                       │
│  └─ 数据访问层 (repositories/)                               │
└──────┬──────────────────┬───────────────────────────────────┘
       │                  │
┌──────▼──────┐   ┌───────▼────────┐
│  MySQL      │   │  Redis (ioredis)│
│  (mysql2)   │   │  - 情绪缓存     │
│  - 连接池   │   │  - 活动缓存     │
│  - 事务     │   │  - AI结果缓存   │
│  - 加密字段 │   │  - 降级处理     │
└─────────────┘   └────────────────┘
       │
┌──────▼──────────────────────┐
│  外部 AI 服务 (DeepSeek)     │
│  - chat/completions         │
│  - 指数退避重试              │
│  - 超时控制                  │
└─────────────────────────────┘
```

### 关键交互路径

| 路径 | 调用链 |
|------|--------|
| 用户注册 | `POST /api/auth/register` → authRoutes → validateRequest → authController.register → authService.register → userRepository.createStudentUser → MySQL |
| 情绪记录 | `POST /api/moods/record` → authenticate → moodRoutes → validateRequest → moodController.recordMood → moodService.recordMood → moodRepository.createMood → MySQL (事务) → Redis (缓存清除) |
| 心理辅导 | `POST /api/ai/counseling` → authenticate → aiInterpretationRoutes → counselingController → aiSafetyService → callChatCompletion → DeepSeek API |
| 活动报名 | `POST /api/activities/join/:id` → authenticate → activityRoutes → activityController.joinActivity → activityRepository.join → MySQL (事务) → Redis (缓存清除) |
| 管理KPI | `GET /api/admin/kpi` → authenticate → requireAdmin → managementRoutes → managementController → managementService → managementRepository.safeCount → MySQL |

---

## 二、模块间集成测试

### 2.1 认证流程：Controller → Service → Repository → Database

#### IT-MOD-001：用户注册全链路

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 authController.register → authService.register → userRepository.createStudentUser 的数据正确传递 |
| **前置条件** | 数据库连接正常，用户名 `newuser` 不存在 |
| **测试步骤** | 1. 调用 `authService.register({ username: "newuser", password: "P@ss123" })` |
| **预期结果** | 1. `userRepository.createStudentUser` 被调用 2. 密码被 bcrypt 哈希 3. 用户记录插入 users 表 4. 默认邮箱以 `newuser_` 开头 |

#### IT-MOD-002：用户注册—用户名重复

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证重复用户名注册时各层异常传播 |
| **前置条件** | 用户名 `existuser` 已存在 |
| **测试步骤** | 1. 调用 `authService.register({ username: "existuser", password: "123" })` |
| **预期结果** | 1. `userRepository.createStudentUser` 抛出 `DuplicateUserError` 2. `authService.register` 捕获后抛出 `BusinessError("用户名已存在")` 3. 控制器返回 `400` |

#### IT-MOD-003：用户登录—JWT 签发与验证

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 login → JWT签发 → authenticate 中间件验证的完整链路 |
| **前置条件** | 用户 `testuser` 已注册，密码 `P@ss123` |
| **测试步骤** | 1. 调用 `authService.login({ username: "testuser", password: "P@ss123" })` 2. 获取返回的 token 3. 在请求中设置 `Cookie: token=<token>` 4. 调用 `authenticate` 中间件 |
| **预期结果** | 1. login 返回 `{ token, user }` 2. token 可被 `jwt.verify` 解析 3. `authenticate` 设置 `req.user = { userId, username, role }` 4. `updateLastLoginAt` 被调用 |

#### IT-MOD-004：认证中间件—非法角色 Token 降级

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 JWT 中 role 为非法值时 `getRoleFromToken` 的降级处理 |
| **前置条件** | 手动构造 JWT，role="hacker" |
| **测试步骤** | 1. 签发 role="hacker" 的 JWT 2. 通过 `authenticate` 中间件 |
| **预期结果** | `req.user.role` 被降级为 `"user"`，`isValidUserRole("hacker")` 返回 false |

#### IT-MOD-005：权限中间件—requirePermission 数据库查询

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 requirePermission 中间件查询 role_permissions 表的正确性 |
| **前置条件** | 数据库有 `activity.manage` 权限配置 |
| **测试步骤** | 1. admin 用户请求 `activity.manage` 接口 2. student 用户请求 `activity.manage` 接口 |
| **预期结果** | 1. admin 查询到权限，`next()` 被调用 2. student 查询不到权限，返回 `403` |

---

### 2.2 情绪记录流程：Controller → Service → Repository → 加密 → 缓存

#### IT-MOD-006：情绪记录创建—加密字段传递

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 note 和 trigger 字段在 service→repository 层被加密，查询时被解密 |
| **前置条件** | ENCRYPTION_KEY 已配置，情绪类型存在 |
| **测试步骤** | 1. 调用 `moodService.recordMood({ note: "今天很开心", trigger: "考试通过" })` 2. 调用 `moodService.listMoods(userId)` 查询刚创建的记录 |
| **预期结果** | 1. 存入数据库的 `note_ciphertext` 是加密后的字符串 2. 查询返回的 `note` 字段为解密后的 `"今天很开心"` |

#### IT-MOD-007：情绪记录创建—事务完整性

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 moodRepository.createMood 事务在插入情绪关联失败时回滚 |
| **前置条件** | 用户存在，情绪类型存在 |
| **测试步骤** | 1. 传入一个不存在的 `emotionTypeId` 2. 调用 `moodRepository.createMood` |
| **预期结果** | 1. moods 表无新增记录（事务回滚） 2. mood_emotions 表无新增记录 3. 异常被抛出 |

#### IT-MOD-008：情绪分析—Repository → Service → AI 调用

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 getMoodAnalysis 从数据库查询到 AI 调用的完整链路 |
| **前置条件** | 用户有 7 天情绪数据，AI 服务可用 |
| **测试步骤** | 1. 调用 `moodService.getMoodAnalysis(userId, 'week')` 2. 查看返回的 `analysis` 字段 |
| **预期结果** | 1. `moodRepository.getMoodAnalysis` 查询到数据 2. `buildAnalysisRecommendations` 生成建议 3. AI 返回的分析文本非空 |

#### IT-MOD-009：情绪洞察—缓存命中/未命中

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 getMoodInsight 的 Redis 缓存机制 |
| **前置条件** | Redis 已连接，用户有数据 |
| **测试步骤** | 1. 第一次调用 `getMoodInsight(userId, 'week')` 2. 检查 Redis 中是否有 key `mood:insight:<userId>:week` 3. 第二次调用同一接口 |
| **预期结果** | 1. 第一次调用后缓存被写入 2. 第二次调用命中缓存，不查询数据库 |

---

### 2.3 活动报名—事务+并发控制

#### IT-MOD-010：活动报名成功—事务提交

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 activityRepository.join 的事务提交和计数器更新 |
| **前置条件** | 活动 id=1，max_participants=10，current_participants=5 |
| **测试步骤** | 1. 调用 `activityRepository.join(1, userId)` |
| **预期结果** | 1. activity_participants 表插入 1 条记录 2. activities.current_participants 更新为 6 3. 事务提交，连接释放 |

#### IT-MOD-011：活动名额已满—事务回滚

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证名额已满时 join 的事务回滚 |
| **前置条件** | 活动 current_participants = max_participants |
| **测试步骤** | 1. 调用 `activityRepository.join(1, userId)` |
| **预期结果** | 1. UPDATE 语句 affectedRows=0 2. 抛出 `Error('ACTIVITY_FULL')` 3. 事务回滚 4. activity_participants 表无新增 |

#### IT-MOD-012：重复报名—唯一约束

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证同一用户重复报名时 Duplicate entry 的正确处理 |
| **前置条件** | 用户已报名活动 id=1 |
| **测试步骤** | 1. 再次调用 `activityRepository.join(1, userId)` |
| **预期结果** | 1. INSERT 抛出 Duplicate entry 错误 2. catch 捕获后抛出 `Error('ALREADY_JOINED')` 3. 事务回滚 |

---

### 2.4 AI 服务集成

#### IT-MOD-013：AI 调用—安全检测 → 调用 → 响应校验

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 counselingController 的完整 AI 调用链路 |
| **前置条件** | AI 服务可用，用户已认证 |
| **测试步骤** | 1. POST `/api/ai/counseling` 发送 `{ message: "我最近压力很大" }` 2. 跟踪调用链 |
| **预期结果** | 1. `aiSafetyService.detectHighRisk` 被调用 2. 检测通过后 `callChatCompletion` 被调用 3. 返回的 content 被 `aiSafetyService.validateOutput` 校验 4. 输出被 `sanitizeOutput` 脱敏 |

#### IT-MOD-014：AI 调用—高风险内容阻断

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证高风险内容被 aiSafetyService 阻断 |
| **前置条件** | AI 服务可用 |
| **测试步骤** | 1. POST `/api/ai/counseling` 发送 `{ message: "我想自杀" }` |
| **预期结果** | 1. `detectHighRisk` 返回 true 2. `buildSafeResponse(1506, true)` 返回安全兜底响应 3. AI 从未被调用 |

#### IT-MOD-015：AI 调用—DeepSeek API 超时+重试

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 callChatCompletion 的超时和重试机制 |
| **前置条件** | Mock DeepSeek API 延迟 35 秒（超出 timeout=30s） |
| **测试步骤** | 1. 调用 `callChatCompletion(messages)` |
| **预期结果** | 1. 第一次请求超时 → 抛出错误 2. 状态码非 401/400 → 进入重试 3. 最多重试 3 次（指数退避） 4. 全部失败后抛出 `AiServiceError` |

#### IT-MOD-016：AI 调用—API Key 无效

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 API Key 无效时不重试，直接抛出 |
| **前置条件** | 使用无效的 API Key |
| **测试步骤** | 1. 调用 `callChatCompletion(messages)` |
| **预期结果** | 1. DeepSeek 返回 401 2. 内部识别为不可重试错误 3. 直接抛出 `AiServiceError("AI API Key 无效")` |

---

### 2.5 缓存与数据库一致性

#### IT-MOD-017：情绪记录后的缓存清除

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 recordMood 后 clearMoodCache 被调用 |
| **前置条件** | Redis 有该用户的情绪缓存 |
| **测试步骤** | 1. 先设置缓存 `mood:trend:1:week` 2. 调用 `recordMood` 3. 检查 Redis |
| **预期结果** | 1. `clearMoodCache(userId)` 被调用 2. 匹配模式的缓存 key 被删除 3. 下次查询从数据库重新加载 |

#### IT-MOD-018：活动变化后的缓存清除

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证活动创建/更新/删除/报名后 clearActivityCache 被调用 |
| **前置条件** | Redis 有活动列表缓存 |
| **测试步骤** | 1. 创建/更新活动 → 检查缓存 2. 报名活动 → 检查缓存 |
| **预期结果** | 每次操作后 activityCacheKeys 被清空，下次查询重新加载 |

---

## 三、数据库集成测试

### 3.1 连接池管理

#### IT-DB-001：连接池初始化

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 MySQL 连接池在服务启动时正确初始化 |
| **前置条件** | MySQL 服务运行中 |
| **测试步骤** | 1. 启动服务器 2. 调用 `checkMysqlHealth()` |
| **预期结果** | 1. `connectMysql()` 成功创建连接池 2. `checkMysqlHealth()` 返回 true 3. 连接池有 `connectionLimit` 个连接 |

#### IT-DB-002：连接池耗尽

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证连接池耗尽时请求排队等待 |
| **前置条件** | 连接池大小 10 |
| **测试步骤** | 1. 同时发起 20 个数据库查询请求 |
| **预期结果** | 1. 前 10 个立即获取连接 2. 后 10 个排队等待 3. 所有请求最终完成（默认 queueLimit=0 无上限） |

#### IT-DB-003：MySQL 不可用时的优雅降级

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 MySQL 服务不可用时 safeCount 返回 0 而非崩溃 |
| **前置条件** | MySQL 连接断开 |
| **测试步骤** | 1. 调用 `safeCount("SELECT COUNT(*) FROM users")` 2. 调用 `GET /api/admin/kpi` |
| **预期结果** | 1. `safeCount` 返回 0 2. KPI 接口返回 200，各字段为 0 |

---

### 3.2 事务边界

#### IT-DB-004：创建情绪记录—事务提交

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 createMood 事务中所有表写入成功后提交 |
| **前置条件** | 数据库正常 |
| **测试步骤** | 1. 调用 `createMood({ userId: 1, emotions: [...], tagIds: [1, 2] })` 2. 查询 moods、mood_emotions、mood_tags 表 |
| **预期结果** | 1. moods 表 1 条新记录 2. mood_emotions 表 N 条记录 3. mood_tags 表 M 条记录 4. 三表数据一致 |

#### IT-DB-005：创建情绪记录—事务回滚

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 mood_emotions 插入失败时 moods 和 mood_tags 回滚 |
| **前置条件** | 传入不存在的 emotionTypeId |
| **测试步骤** | 1. 调用 `createMood({ emotionTypeId: 99999 })` |
| **预期结果** | 1. moods 表无新增 2. mood_emotions 表无新增 3. mood_tags 表无新增 4. 连接被释放回池 |

#### IT-DB-006：活动报名—事务隔离

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证并发报名时事务的正确隔离 |
| **前置条件** | 活动 max_participants=1，0 人已报名 |
| **测试步骤** | 1. 同时发起 2 个报名请求（不同用户） |
| **预期结果** | 1. 仅 1 个请求成功 2. 另一个请求因 `current_participants >= max_participants` 失败 3. 失败请求的事务回滚 |

#### IT-DB-007：用户删除—级联删除

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 deleteUser 删除用户及其关联数据 |
| **前置条件** | 用户有 mood_records、mood_emotions、mood_tags 数据 |
| **测试步骤** | 1. 调用 `deleteUser(userId)` 2. 查询相关表 |
| **预期结果** | 1. users 表删除 1 条 2. mood_records 删除所有关联记录 3. mood_emotions 删除所有关联记录 4. mood_tags 删除所有关联记录 |

---

### 3.3 数据迁移

#### IT-DB-008：迁移脚本与模型定义一致性

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 mood_health 核心表迁移脚本字段与代码中 RowDataPacket 类型一致 |
| **前置条件** | 执行 0080_create_moods.up.sql 迁移 |
| **测试步骤** | 1. 对比迁移脚本中的列定义与 moodRepository.ts 中的 MoodRow 类型 |
| **预期结果** | 1. 迁移脚本的列名与 MoodRow 的字段名一一对应 2. 迁移脚本的列类型与 TypeScript 类型兼容 |

#### IT-DB-009：迁移 up/down 可逆性

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 activity_reminders 迁移的 up 和 down 可逆 |
| **前置条件** | 数据库已初始化 |
| **测试步骤** | 1. 执行 0300_create_activity_reminders.up.sql 2. 验证表存在 3. 执行 0300_create_activity_reminders.down.sql 4. 验证表已删除 |
| **预期结果** | 1. up 创建表成功 2. down 删除表成功 3. 无残留数据 |

---

### 3.4 数据加密

#### IT-DB-010：加密字段存储与读取

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 moods 表中 note_ciphertext 和 trigger_ciphertext 的加解密流程 |
| **前置条件** | ENCRYPTION_KEY 已配置 |
| **测试步骤** | 1. 记录情绪 `{ note: "私密笔记", trigger: "工作压力" }` 2. 直接查询数据库 `SELECT note_ciphertext FROM moods` 3. 通过 API 查询 `/api/moods/list` |
| **预期结果** | 1. 数据库中 note_ciphertext 为加密字符串（非明文） 2. API 返回的 note 为解密后的 "私密笔记" 3. 数据库中不包含明文 |

---

## 四、API 集成测试

### 4.1 中间件管道

#### IT-API-001：完整请求管道

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 POST /api/auth/register 的完整中间件管道 |
| **前置条件** | 服务已启动 |
| **测试步骤** | 1. 发送 POST `/api/auth/register` 2. 跟踪中间件执行顺序 |
| **预期结果** | 1. helmet → cors → requestLogger → rateLimiter → cookieParser → jsonParser 2. → authRoutes → validateRequest → register controller 3. 响应经过 json() 序列化 |

#### IT-API-002：CORS 配置

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 CORS 配置允许前端跨域访问 |
| **前置条件** | 前端运行在 `http://localhost:5173` |
| **测试步骤** | 1. 从前端发送请求到后端 2. 检查响应头 |
| **预期结果** | 1. `Access-Control-Allow-Origin` 包含 `http://localhost:5173` 2. `Access-Control-Allow-Credentials: true` |

#### IT-API-003：限流中间件

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 rateLimiter 在短时间内大量请求时触发限流 |
| **前置条件** | 限流配置 windowMs=15分钟, max=100 |
| **测试步骤** | 1. 在 1 秒内发送 101 个请求 |
| **预期结果** | 1. 前 100 个正常处理 2. 第 101 个返回 `429 Too Many Requests` |

#### IT-API-004：认证中间件串联

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 authenticate + requireAdmin 链式调用 |
| **前置条件** | 有 student 用户 token 和 admin 用户 token |
| **测试步骤** | 1. student token 请求 `/api/admin/kpi` 2. admin token 请求 `/api/admin/kpi` |
| **预期结果** | 1. student: authenticate 通过 → requireAdmin 返回 403 2. admin: authenticate 通过 → requireAdmin next() → controller 返回数据 |

---

### 4.2 错误处理与响应格式

#### IT-API-005：验证错误响应格式

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 validateRequest 返回的错误响应格式 |
| **前置条件** | 无 |
| **测试步骤** | 1. POST `/api/moods/record` 发送 `{ emotions: "not_array" }` |
| **预期结果** | 1. 状态码 400 2. `{ code: 1001, message: "请求参数验证失败", data: { errors: [...] } }` 3. errors 数组中 field 不包含 password 等敏感字段 |

#### IT-API-006：全局错误处理

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 errorHandler 捕获未处理异常 |
| **前置条件** | 无 |
| **测试步骤** | 1. 触发一个未处理的 throw 2. 检查响应 |
| **预期结果** | 1. 状态码 500 2. `{ code: 1500, message: "..." }` 3. 生产环境 message 脱敏为 "服务器内部错误" 4. 日志中保留了完整错误信息 |

#### IT-API-007：404 处理

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证未匹配路由的 404 处理 |
| **前置条件** | 无 |
| **测试步骤** | 1. GET `/api/nonexistent` |
| **预期结果** | 1. 状态码 404 2. `{ code: 404, message: "接口不存在" }` |

---

### 4.3 外部 API 调用

#### IT-API-008：DeepSeek API 请求构造

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 callChatCompletion 发送给 DeepSeek 的请求格式 |
| **前置条件** | Mock DeepSeek API 端点 |
| **测试步骤** | 1. 调用 `callChatCompletion([{ role: "system", content: "test" }, { role: "user", content: "hello" }])` 2. 检查发出的 HTTP 请求 |
| **预期结果** | 1. URL 为 `https://api.deepseek.com/v1/chat/completions` 2. `Authorization: Bearer sk-xxx` 3. body 包含 `{ model, messages, temperature, max_tokens }` 4. `Content-Type: application/json` |

#### IT-API-009：DeepSeek API 响应解析

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 DeepSeek 返回的响应被正确解析 |
| **前置条件** | Mock DeepSeek 返回 `{ choices: [{ message: { content: "您好！" } }] }` |
| **测试步骤** | 1. 调用 `callChatCompletion(messages)` |
| **预期结果** | 1. 返回 `"您好！"`（trim 后） |

#### IT-API-010：DeepSeek API 返回异常内容

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 DeepSeek 返回空 choices 时的处理 |
| **前置条件** | Mock DeepSeek 返回 `{ choices: [] }` |
| **测试步骤** | 1. 调用 `callChatCompletion(messages)` |
| **预期结果** | 1. 抛出 `AiServiceError("AI 返回空内容")` 2. 不进入重试 |

---

### 4.4 Token 与鉴权

#### IT-API-011：Token 过期

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证过期 Token 被拒绝 |
| **前置条件** | 签发一个过期 JWT（exp 在过去） |
| **测试步骤** | 1. 使用过期 Token 请求 `/api/moods/list` |
| **预期结果** | 1. 状态码 401 2. `{ code: 1002, message: "无效或过期令牌" }` |

#### IT-API-012：Token 从 Cookie 读取

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 authenticate 从 Cookie 中读取 token |
| **前置条件** | 已登录，Cookie 中有 token |
| **测试步骤** | 1. 请求 `/api/moods/list`（不设置 Authorization header） |
| **预期结果** | 1. `authenticate` 从 `req.cookies.token` 读取 token 2. 验证通过，正常返回数据 |

#### IT-API-013：Token 从 Header 读取

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 authenticate 从 Authorization header 读取 token |
| **前置条件** | 无 Cookie，Authorization header 有 `Bearer <token>` |
| **测试步骤** | 1. 请求 `/api/moods/list`，设置 `Authorization: Bearer <token>` |
| **预期结果** | 1. authenticate 从 header 读取 token 2. 验证通过 |

#### IT-API-014：前端 401 响应处理

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证 request.ts 拦截器处理 401 响应 |
| **前置条件** | 前端已登录，Token 过期 |
| **测试步骤** | 1. 发送一个 API 请求 2. 后端返回 401 |
| **预期结果** | 1. `handleUnauthorized` 被调用 2. localStorage 清除 token 3. 页面跳转到 `/login` 4. `unauthorizedRedirectPending` 防重复跳转 |

---

### 4.5 前后端数据契约

#### IT-API-015：情绪记录请求/响应格式

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证前端发送的情绪记录数据格式与后端期望一致 |
| **前置条件** | 用户已登录 |
| **测试步骤** | 1. 前端发送 `{ emotions: [{ emotionTypeId: 1, intensity: 7, isPrimary: true }], note: "开心", trigger: "考试通过" }` 2. 后端处理后返回 |
| **预期结果** | 1. 后端 `express-validator` 验证通过 2. 返回 `{ code: 0, message: "记录成功", data: { id: <number> } }` |

#### IT-API-016：管理端 KPI 响应格式

| 字段 | 内容 |
|------|------|
| **测试目标** | 验证管理端 KPI 接口返回格式与前端期望一致 |
| **前置条件** | admin 用户已登录 |
| **测试步骤** | 1. GET `/api/admin/kpi` |
| **预期结果** | 1. `{ code: 0, data: { totalUsers, totalMoods, totalActivities, ... } }` 2. 所有字段为数字类型 3. 数据库表不存在时各字段为 0 |

---

## 五、潜在集成缺陷与风险清单

### 5.1 高风险

| ID | 位置 | 缺陷描述 | 影响 |
|----|------|---------|------|
| R-INT-001 | [app.ts→routes](file:///d:/桌面/ccooddee/mood_health_server/src/app.ts) | 路由挂载顺序：`/api/ai` 路由含 `/counseling`, `/treehole/gentle-reply`, `/context/analyze`, `/insight` 等端点，但 `/api/ai/history` 端点由独立的 `aiHistoryRoutes` 提供，需确认两者是否冲突 | 路由冲突 |
| R-INT-002 | [activityRepository.ts:L184-L213](file:///d:/桌面/ccooddee/mood_health_server/src/repositories/activityRepository.ts#L184-L213) | `join` 方法中 INSERT 和 UPDATE 在同一事务中，但 INSERT 失败会回滚，而 UPDATE 的 `affectedRows === 0` 也会回滚，但这两者之间没有间隙锁，并发时可能两个请求同时通过 INSERT 但 UPDATE 时只有一个成功 | 并发报名超限 |
| R-INT-003 | [cache.ts:L85-L103](file:///d:/桌面/ccooddee/mood_health_server/src/utils/cache.ts#L85-L103) | `clearMoodCache` 使用 `redisClient.keys()` 扫描全库，生产环境大量 key 时会导致 Redis 阻塞 | 性能雪崩 |
| R-INT-004 | [moodRepository.ts:L214-L273](file:///d:/桌面/ccooddee/mood_health_server/src/repositories/moodRepository.ts#L214-L273) | `createMood` 事务中逐个插入 mood_emotions 和 mood_tags，使用串行 `await` 而非批量 INSERT，记录数多时事务时间过长 | 事务锁持有时间长 |

### 5.2 中风险

| ID | 位置 | 缺陷描述 | 影响 |
|----|------|---------|------|
| R-INT-005 | [redis.client.ts](file:///d:/桌面/ccooddee/mood_health_server/src/utils/redis.client.ts) | RedisClient 单例的 `execute` 方法在 `fallbackEnabled=true` 时吞掉所有异常返回 null，调用方无法区分"Redis 正常返回 null"和"Redis 故障返回 null" | 缓存穿透 |
| R-INT-006 | [aiCallService.ts](file:///d:/桌面/ccooddee/mood_health_server/src/utils/ai/aiCallService.ts) | `callWithTemplate` 加载模板失败时无降级处理，直接抛出异常，导致整个 AI 调用链路中断 | 单点故障 |
| R-INT-007 | [moodService.ts→recordMood](file:///d:/桌面/ccooddee/mood_health_server/src/services/moodService.ts) | `recordMood` 在事务成功后调用 `clearMoodCache`，但缓存清除失败不会影响数据库写入，导致缓存与数据库不一致 | 脏读 |
| R-INT-008 | [server.ts](file:///d:/桌面/ccooddee/mood_health_server/src/server.ts) | 服务启动时强制调用 `connectMysql()`，MySQL 不可用时服务器直接退出 | 服务不可用 |
| R-INT-009 | [app.ts](file:///d:/桌面/ccooddee/mood_health_server/src/app.ts) | 404 处理在 errorHandler 之前，但 404 缺少 `ApiResponse` 格式包装，与其他错误响应格式不一致 | 响应格式不一致 |
| R-INT-010 | [activityRoutes.ts](file:///d:/桌面/ccooddee/mood_health_server/src/routes/activityRoutes.ts) | `GET /list`、`GET /detail/:id` 等公开端点未使用 `authenticate` 中间件，但 `auditOperation` 中间件依赖 `req.user` | 审计日志可能失效 |

### 5.3 低风险

| ID | 位置 | 缺陷描述 | 影响 |
|----|------|---------|------|
| R-INT-011 | [moodRepository.ts:L275-L304](file:///d:/桌面/ccooddee/mood_health_server/src/repositories/moodRepository.ts#L275-L304) | `hydrateMoodRows` 批量查询 mood_emotions 和 mood_tags 时使用 `IN (...)` 占位符，但 moodIds 数组为空时直接返回 `[]`，跳过后续查询 | 行为正确但缺少显式边界处理 |
| R-INT-012 | [recommendService.ts](file:///d:/桌面/ccooddee/mood_health_server/src/utils/ai/recommendService.ts) | `getRecommendations` 的 Redis 缓存 key 使用 `JSON.stringify(request)`，但 request 对象可能包含不可序列化字段 | 缓存 key 不一致 |
| R-INT-013 | [managementController.ts](file:///d:/桌面/ccooddee/mood_health_server/src/controllers/managementController.ts) | `getKpiStats` 使用 13 个并行 `safeCount` 查询，但 MySQL 连接池可能耗尽 | 连接池耗尽 |
| R-INT-014 | [authService.ts](file:///d:/桌面/ccooddee/mood_health_server/src/services/authService.ts) | `login` 中 `updateLastLoginAt` 失败被静默忽略，不影响登录流程但日志不完整 | 审计缺失 |
| R-INT-015 | [contentAuditService.ts→auditContent](file:///d:/桌面/ccooddee/mood_health_server/src/utils/ai/contentAuditService.ts) | `auditContent` 的 Redis 缓存命中后直接返回，但缓存可能包含过期数据（如敏感词列表更新后旧缓存仍然有效） | 缓存失效策略不完善 |

---

## 六、总结

### 修复优先级

| 优先级 | 缺陷编号 | 说明 |
|--------|---------|------|
| P0 | R-INT-002 | 活动并发报名超限 |
| P0 | R-INT-004 | createMood 串行插入效率低 |
| P1 | R-INT-003 | clearMoodCache Redis KEYS 阻塞 |
| P1 | R-INT-005 | Redis 降级无法区分故障 |
| P1 | R-INT-006 | AI 模板加载无降级 |
| P1 | R-INT-007 | 缓存清除失败导致不一致 |
| P2 | R-INT-001, R-INT-008~015 | 低风险改进项 |