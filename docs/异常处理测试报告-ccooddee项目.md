# 异常与错误处理测试报告 - ccooddee 项目

> **生成日期**：{{date}}
> **测试类型**：异常与错误处理测试分析
> **测试范围**：全栈代码（Vue 3 + TypeScript 前端，Express.js + TypeScript 后端，MySQL + Redis 数据层）
> **分析方式**：纯静态代码分析，不实际运行

---

## 目录

- [1. 项目错误处理机制概述](#1-项目错误处理机制概述)
- [2. 异常测试用例](#2-异常测试用例)
  - [2.1 非法输入](#21-非法输入)
  - [2.2 网络异常与超时](#22-网络异常与超时)
  - [2.3 资源与系统异常](#23-资源与系统异常)
  - [2.4 权限与安全异常](#24-权限与安全异常)
  - [2.5 第三方服务异常](#25-第三方服务异常)
- [3. 错误处理缺陷风险清单](#3-错误处理缺陷风险清单)

---

## 1. 项目错误处理机制概述

### 1.1 全局错误处理架构

| 组件 | 位置 | 说明 |
|------|------|------|
| **全局错误中间件** | `middleware/errorHandler.ts` | 统一捕获所有未处理的异常，识别 ValidationError，生产环境隐藏内部错误详情 |
| **404 处理器** | `middleware/errorHandler.ts` - `notFoundHandler` | 匹配不到路由时抛出 AppError(404) |
| **自定义错误类** | `utils/errors.ts` | `AppError`、`BusinessError`、`HttpException`、`AuthError`、`AiServiceError`、`RedisError` |
| **API 响应工具** | `utils/apiResponse.ts` | `apiSuccess()`/`apiFailure()` 统一响应格式，`businessCodeForHttpStatus()` 映射 HTTP 状态码到业务码 |
| **日志系统** | `utils/logger.ts` | Winston + DailyRotateFile，14天保留，20MB切割，敏感信息自动脱敏 |
| **操作审计** | `utils/operationLogger.ts` | 双重记录（Winston 文件 + 数据库审计表），DB 写入失败不阻塞请求 |
| **请求日志** | `app.ts` - morgan 中间件 | JSON 格式的结构化 HTTP 请求日志，包含 IP、认证状态、请求体摘要 |

### 1.2 中间件管道错误处理

```
helmet → cors → requestLogger → rateLimiter → cookieParser → jsonParser → compression
  → authenticate → validateRequest → controllers
  → notFoundHandler → errorHandler
```

- **rateLimiter**：登录接口限流，15 分钟窗口，开发环境 100 次，生产环境 20 次
- **authenticate**：JWT 验证失败返回 401，记录日志
- **validateRequest**：express-validator 验证失败抛出 ValidationError，由 errorHandler 统一处理为 400
- **CORS**：未匹配的 origin 返回 `Not allowed by CORS` 错误
- **bodyParser**：请求体限制 1MB，超限自动拒绝

### 1.3 数据库与缓存层错误处理

| 组件 | 重试 | 超时 | 降级 |
|------|------|------|------|
| **MySQL 连接池** | 3 次重试，间隔 2s | 连接超时 5s，查询超时 5s | 无降级，连接失败抛异常 |
| **Redis 客户端** | 10 次重连，指数退避 | 命令执行超时 5s | 可降级返回 null，lastError 标记 |
| **缓存操作** | 无重试 | 无独立超时 | 失败时 console.warn，静默返回 null |

### 1.4 AI 服务层错误处理

| 组件 | 重试 | 超时 | 降级 |
|------|------|------|------|
| **AI 客户端** | 最多 `aiConfig.maxRetries` 次，指数退避 | `aiConfig.timeout` | 重试耗尽抛出 `AiServiceError` |
| **内容审核服务** | 无独立重试（依赖 AI 客户端） | 依赖 AI 客户端 | AI 失败时降级为本地敏感词过滤 |
| **AI 审核解析** | 无 | 无 | JSON 解析失败默认 `isSafe: true` |

### 1.5 前端错误处理

| 组件 | 位置 | 说明 |
|------|------|------|
| **Axios 拦截器** | `utils/request.ts` | 请求/响应拦截，统一错误处理，401 自动跳转登录 |
| **ApiRequestError** | `utils/request.ts` | 自定义错误类，区分 http/network/config/business 错误类型 |
| **ElMessage** | Element Plus | 统一错误提示，toast 形式展示 |
| **Loading** | `utils/request.ts` | 全局加载状态管理，请求计数防重复 |

---

## 2. 异常测试用例

### 2.1 非法输入

#### 2.1.1 请求体格式异常

| 用例编号 | 异常场景分类 | 触发点 | 异常输入或条件 | 预期错误处理行为 |
|----------|-------------|--------|---------------|-----------------|
| EXC-001 | 非法输入 | 任意 API 端点 | 请求体超过 1MB | 返回 413 或 400，提示"请求体过大" |
| EXC-002 | 非法输入 | 任意 API 端点 | Content-Type: text/plain 发送非 JSON | 返回 400，提示"请求格式错误" |
| EXC-003 | 非法输入 | 任意 API 端点 | 请求体为空字符串 | 返回 400，提示"请求体不能为空" |
| EXC-004 | 非法输入 | 任意 API 端点 | JSON 格式错误（缺少引号/逗号） | 返回 400，提示"请求体 JSON 格式错误" |
| EXC-005 | 非法输入 | 任意 API 端点 | 请求体包含未定义字段（额外字段） | 正常处理，忽略额外字段 |

#### 2.1.2 认证参数异常

| 用例编号 | 异常场景分类 | 触发点 | 异常输入或条件 | 预期错误处理行为 |
|----------|-------------|--------|---------------|-----------------|
| EXC-006 | 非法输入 | POST /api/auth/register | username 为纯空格 3 个字符 | 返回 400，"用户名需为3-20位"（正则不匹配） |
| EXC-007 | 非法输入 | POST /api/auth/register | password 为空字符串 | 返回 400，"密码至少6个字符" |
| EXC-008 | 非法输入 | POST /api/auth/register | password 长度 10000 字符 | **风险**：无上限校验，可能通过但哈希极慢 |
| EXC-009 | 非法输入 | POST /api/auth/register | username 包含 SQL 注入片段 `"'; DROP TABLE users; --"` | 返回 400，正则不匹配 `<` `>` 等字符 |
| EXC-010 | 非法输入 | POST /api/auth/register | username 包含 emoji `"😀😀😀"` | 返回 400，正则不匹配 |
| EXC-011 | 非法输入 | POST /api/auth/register | email 为 `"test@163.com"`（非QQ邮箱） | 返回 400，提示"邮箱格式不正确" |
| EXC-012 | 非法输入 | POST /api/auth/login | username 为 `null` | 返回 400，"用户名不能为空" |
| EXC-013 | 非法输入 | POST /api/auth/login | password 为 `undefined`（未传递） | 返回 400，"密码不能为空" |

#### 2.1.3 情绪记录参数异常

| 用例编号 | 异常场景分类 | 触发点 | 异常输入或条件 | 预期错误处理行为 |
|----------|-------------|--------|---------------|-----------------|
| EXC-014 | 非法输入 | POST /api/moods | emotions 为空数组 `[]` | 返回 400，"至少需要1个情绪" |
| EXC-015 | 非法输入 | POST /api/moods | emotions[0].intensity 为 `0` | 返回 400，"强度必须在1-10之间" |
| EXC-016 | 非法输入 | POST /api/moods | emotions[0].intensity 为 `-1` | 返回 400 |
| EXC-017 | 非法输入 | POST /api/moods | emotions[0].intensity 为 `3.14` | 返回 400（isInt 不通过） |
| EXC-018 | 非法输入 | POST /api/moods | emotions[0].intensity 为 `"abc"` | 返回 400，`Number("abc")=NaN`，`Number.isFinite` 检查失败 |
| EXC-019 | 非法输入 | POST /api/moods | emotions[0].intensity 为 `Infinity` | 返回 400 |
| EXC-020 | 非法输入 | POST /api/moods | note 长度 2001 字符 | 返回 400，isLength max:2000 |
| EXC-021 | 非法输入 | POST /api/moods | tags 长度 51 字符 | 返回 400，isLength max:50 |
| EXC-022 | 非法输入 | POST /api/moods | emotionTypeId 为 `undefined` | 返回 400，"情绪数据格式错误" |
| EXC-023 | 非法输入 | POST /api/moods | emotions 为非数组 `"string"` | 返回 400，"情绪数据格式错误" |
| EXC-024 | 非法输入 | GET /api/moods/trend | range 为 `"year"` | 返回 400，"无效的时间范围" |
| EXC-025 | 非法输入 | PUT /api/moods/:id | moodId 为 `NaN` | 返回 400，"无效的记录 ID" |
| EXC-026 | 非法输入 | PUT /api/moods/:id | moodId 为 `3.14` | 返回 400（`Number.isInteger` 检查） |

#### 2.1.4 活动管理参数异常

| 用例编号 | 异常场景分类 | 触发点 | 异常输入或条件 | 预期错误处理行为 |
|----------|-------------|--------|---------------|-----------------|
| EXC-027 | 非法输入 | POST /api/activities | title 为空字符串 | 返回 400，"标题不能为空" |
| EXC-028 | 非法输入 | POST /api/activities | title 长度 101 字符 | 返回 400，isLength max:100 |
| EXC-029 | 非法输入 | POST /api/activities | maxParticipants 为 `0` | 返回 400 |
| EXC-030 | 非法输入 | POST /api/activities | maxParticipants 为 `10000` | 返回 400 |
| EXC-031 | 非法输入 | POST /api/activities | startTime 为 `"not-a-date"` | 返回 400（isISO8601 不通过） |
| EXC-032 | 非法输入 | POST /api/activities | startTime 晚于 endTime | **风险**：无交叉校验，可能创建非法活动 |
| EXC-033 | 非法输入 | POST /api/activities/:id/feedback | rating 为 `0` | **风险**：`!rating` 将 0 误判为空，返回 400 |
| EXC-034 | 非法输入 | POST /api/activities/:id/feedback | rating 为 `6` | 返回 400 |
| EXC-035 | 非法输入 | POST /api/activities/:id/feedback | rating 为 `3.5`（浮点数） | **风险**：`rating < 1 \|\| rating > 5` 通过，但 DB CHECK 可能拒绝 |

#### 2.1.5 树洞帖子参数异常

| 用例编号 | 异常场景分类 | 触发点 | 异常输入或条件 | 预期错误处理行为 |
|----------|-------------|--------|---------------|-----------------|
| EXC-036 | 非法输入 | POST /api/posts | title 为空字符串 | 返回 400，"标题不能为空" |
| EXC-037 | 非法输入 | POST /api/posts | title 为纯空格 `"   "` | 返回 400（trim 后为空） |
| EXC-038 | 非法输入 | POST /api/posts | content 为空字符串 | 返回 400，"内容不能为空" |
| EXC-039 | 非法输入 | POST /api/posts | content 包含 XSS 片段 `<script>alert(1)</script>` | 触发内容审核，可能标记为违规 |
| EXC-040 | 非法输入 | POST /api/posts/:id/comments | comment 内容为空 | 返回 400，"评论内容不能为空" |
| EXC-041 | 非法输入 | POST /api/posts/:id/audit | status 为 `3`（超出范围） | 返回 400，"无效的审核状态" |
| EXC-042 | 非法输入 | POST /api/posts/:id/audit | status 为 `-1` | 返回 400 |

#### 2.1.6 管理后台参数异常

| 用例编号 | 异常场景分类 | 触发点 | 异常输入或条件 | 预期错误处理行为 |
|----------|-------------|--------|---------------|-----------------|
| EXC-043 | 非法输入 | PUT /api/admin/users/:id/role | targetRole 为 `"superadmin"`（不存在的角色） | 返回 400 |
| EXC-044 | 非法输入 | PUT /api/admin/users/:id/role | userId 为 `0` | 返回 400 |
| EXC-045 | 非法输入 | GET /api/admin/moods | page 为 `0` | 返回 400（isInt min:1） |
| EXC-046 | 非法输入 | GET /api/admin/moods | pageSize 为 `101` | 返回 400（isInt max:100） |
| EXC-047 | 非法输入 | PUT /api/admin/users/:id/disable | userId 为当前登录用户 | 返回 400，"不能停用当前登录用户" |
| EXC-048 | 非法输入 | DELETE /api/admin/users/:id | userId 为当前登录用户 | 返回 400，"不能删除当前登录用户" |

#### 2.1.7 AI 模块参数异常

| 用例编号 | 异常场景分类 | 触发点 | 异常输入或条件 | 预期错误处理行为 |
|----------|-------------|--------|---------------|-----------------|
| EXC-049 | 非法输入 | POST /api/ai/interpretation | totalScore 为 `-1` | 返回 400 |
| EXC-050 | 非法输入 | POST /api/ai/interpretation | itemScores 为空数组 `[]` | 返回 400，"题目得分不能为空" |
| EXC-051 | 非法输入 | POST /api/ai/interpretation | message 为空字符串 | 返回 400 |
| EXC-052 | 非法输入 | POST /api/ai/interpretation | message 长度 1001 字符 | 返回 400 |
| EXC-053 | 非法输入 | POST /api/counseling | message 为空字符串 | 返回 400，"消息内容不能为空" |
| EXC-054 | 非法输入 | POST /api/counseling | message 长度 1001 字符 | 返回 400，"消息内容不能超过1000字" |
| EXC-055 | 非法输入 | POST /api/counseling | context 为非数组 `"string"` | `Array.isArray` 检查，不添加上下文 |
| EXC-056 | 非法输入 | POST /api/counseling | context 包含非法 role `"hacker"` | 只处理 user/assistant，其他忽略 |

---

### 2.2 网络异常与超时

#### 2.2.1 前端网络请求异常

| 用例编号 | 异常场景分类 | 触发点 | 异常输入或条件 | 预期错误处理行为 |
|----------|-------------|--------|---------------|-----------------|
| EXC-057 | 网络异常 | 全部前端 API 请求 | 网络断开（浏览器 offline） | 返回 `ApiRequestError(kind:'network')`，ElMessage 提示"网络连接失败，请检查网络" |
| EXC-058 | 网络异常 | 全部前端 API 请求 | 请求超时（10 秒无响应） | axios 抛出 `ECONNABORTED`，`error.request` 为真，提示"网络连接失败" |
| EXC-059 | 网络异常 | 全部前端 API 请求 | DNS 解析失败 | 提示"网络连接失败，请检查网络" |
| EXC-060 | 网络异常 | 全部前端 API 请求 | 服务端返回非 JSON 格式响应 | `unwrapResponse` 抛出 `kind:'business'`，提示"响应缺少业务状态码" |
| EXC-061 | 网络异常 | 全部前端 API 请求 | 服务端返回 500 且无 message 字段 | 提示"服务器内部错误" |
| EXC-062 | 网络异常 | 全部前端 API 请求 | 服务端返回 502/503 | 提示"请求失败 (502/503)"，无特殊处理 |
| EXC-063 | 网络异常 | 全部前端 API 请求 | 并发请求中部分失败 | 其他请求正常处理，失败的独立提示错误 |
| EXC-064 | 网络异常 | POST /api/auth/login | 401 且当前在登录页 | 跳过跳转登录页逻辑，仅提示错误 |
| EXC-065 | 网络异常 | POST /api/auth/login | 401 且不在登录页 | 清除 token，跳转 `/login?redirect=currentPath`，防重复跳转 |

#### 2.2.2 后端 AI 服务调用异常

| 用例编号 | 异常场景分类 | 触发点 | 异常输入或条件 | 预期错误处理行为 |
|----------|-------------|--------|---------------|-----------------|
| EXC-066 | 超时 | aiClient.ts - callChatCompletion | AI API 超时（超过 aiConfig.timeout） | 触发重试，最多 maxRetries 次，耗尽后抛出 `AiServiceError` |
| EXC-067 | 网络异常 | aiClient.ts - callChatCompletion | AI API 不可达（ECONNREFUSED） | 触发重试，全部失败后抛出 `AiServiceError` |
| EXC-068 | 网络异常 | aiClient.ts - callChatCompletion | AI API 返回 429（速率限制） | 触发重试（指数退避），可能缓解 |
| EXC-069 | 网络异常 | aiClient.ts - callChatCompletion | AI API 返回 500 | 触发重试，全部失败后抛出 `AiServiceError` |
| EXC-070 | 网络异常 | aiClient.ts - callChatCompletion | 重试过程中重试计数被并发修改 | **风险**：`retryCount` 不是线程安全的局部变量，并发可能导致重试次数不准确 |
| EXC-071 | 网络异常 | contentAuditService.ts | AI 审核 API 失败 | 降级为 `getLocalContentAudit()`，使用本地敏感词过滤 |
| EXC-072 | 网络异常 | contentAuditService.ts | AI 审核返回非 JSON 格式 | JSON 解析失败，默认 `isSafe: true`，提示"审核服务暂时不可用" |
| EXC-073 | 网络异常 | contentAuditService.ts | AI 审核缓存命中 | 跳过 AI 调用，直接返回缓存结果 |
| EXC-074 | 超时 | postController.ts - createPostHandler | AI 审核超时 | `catch` 块为空，静默吞掉异常，帖子进入待审核状态（`status: 0`） |

#### 2.2.3 数据库与缓存异常

| 用例编号 | 异常场景分类 | 触发点 | 异常输入或条件 | 预期错误处理行为 |
|----------|-------------|--------|---------------|-----------------|
| EXC-075 | 超时 | MySQL - query | 查询超时（超过 queryTimeoutMs） | mysql2 抛出超时错误，控制器 catch 返回 500 |
| EXC-076 | 超时 | MySQL - connect | 连接超时（超过 connectTimeoutMs） | 重试 3 次，间隔 2s，全部失败后抛出错误 |
| EXC-077 | 资源异常 | MySQL - 连接池 | 连接池耗尽（所有连接被占用） | `waitForConnections: true`，等待连接释放，`queueLimit: 0` 无排队上限 |
| EXC-078 | 资源异常 | Redis - set/get | Redis 不可用 | 降级返回 null，`lastError` 标记，打印 console.warn |
| EXC-079 | 资源异常 | Redis - del | Redis 不可用 | 降级，打印 console.warn |
| EXC-080 | 资源异常 | Redis - scan | Redis 不可用 | 降级，打印 console.warn（clearMoodCache） |
| EXC-081 | 资源异常 | cache.ts - setCache | Redis 缓存设置失败 | 静默降级，console.warn，不影响主流程 |
| EXC-082 | 资源异常 | cache.ts - getCache | Redis 缓存获取失败 | 静默降级，返回 null，触发回源查询 |
| EXC-083 | 资源异常 | cache.ts - getOrSetMoodCache | fetchFn 执行失败 | 抛出错误，不缓存错误结果 |
| EXC-084 | 资源异常 | authService.ts - login | Redis 不可用（lastError 非空） | 跳过登录锁定检查，仅 console.warn |
| EXC-085 | 资源异常 | authService.ts - login | Redis 不可用，登录成功 | 跳过清除失败计数，不影响登录流程 |

---

### 2.3 资源与系统异常

#### 2.3.1 环境配置异常

| 用例编号 | 异常场景分类 | 触发点 | 异常输入或条件 | 预期错误处理行为 |
|----------|-------------|--------|---------------|-----------------|
| EXC-086 | 资源异常 | app.ts - validateEnv() | JWT_SECRET 未设置 | 抛出 Error，"服务启动失败：缺少必要的环境变量" |
| EXC-087 | 资源异常 | app.ts - validateEnv() | MYSQL_HOST 未设置 | 抛出 Error，启动失败 |
| EXC-088 | 资源异常 | mysql.ts - readMysqlConfig | MYSQL_PORT 为 `"abc"` | 抛出 Error，"MYSQL_PORT 必须是 1-65535 的整数" |
| EXC-089 | 资源异常 | mysql.ts - readMysqlConfig | MYSQL_POOL_LIMIT 为 `0` | 抛出 Error，"MYSQL_POOL_LIMIT 必须是 1-30 的整数" |
| EXC-090 | 资源异常 | mysql.ts - readMysqlConfig | MYSQL_POOL_LIMIT 为 `31` | 抛出 Error |
| EXC-091 | 资源异常 | encryption.ts - getKey | ENCRYPTION_KEY 长度不足 32 字节 hex | 抛出错误 |
| EXC-092 | 资源异常 | authService.ts - login | jwtSecret 为 undefined（JWT_SECRET 为空字符串） | 抛出 HttpException(500)，"服务配置错误" |

#### 2.3.2 数据库操作异常

| 用例编号 | 异常场景分类 | 触发点 | 异常输入或条件 | 预期错误处理行为 |
|----------|-------------|--------|---------------|-----------------|
| EXC-093 | 资源异常 | 任意 Repository | 数据库死锁（ER_LOCK_DEADLOCK） | 控制器 catch 返回 500，无重试逻辑 |
| EXC-094 | 资源异常 | 任意 Repository | 唯一键冲突（ER_DUP_ENTRY） | 根据具体场景处理（如注册时 DuplicateUserError → BusinessError） |
| EXC-095 | 资源异常 | 任意 Repository | 外键约束失败 | 控制器 catch 返回 500，错误信息不明确 |
| EXC-096 | 资源异常 | 任意 Repository | 表不存在 | 控制器 catch 返回 500 |
| EXC-097 | 资源异常 | 任意 Repository | 字段不存在（SQL 语法错误） | 控制器 catch 返回 500 |
| EXC-098 | 资源异常 | checkMysqlHealth | MySQL 健康检查失败 | 返回 false，/health 接口返回 503 |

#### 2.3.3 加密/解密异常

| 用例编号 | 异常场景分类 | 触发点 | 异常输入或条件 | 预期错误处理行为 |
|----------|-------------|--------|---------------|-----------------|
| EXC-099 | 资源异常 | encryption.ts - encrypt | 传入空字符串 `""` | 原样返回 `""` |
| EXC-100 | 资源异常 | encryption.ts - encrypt | 传入 null（通过 encryptField） | 返回 null |
| EXC-101 | 资源异常 | encryption.ts - decrypt | 传入非 JSON 字符串 | 返回原值（`!startsWith("{")` 检查） |
| EXC-102 | 资源异常 | encryption.ts - decrypt | 传入损坏的加密数据 | 返回原值（catch 降级） |
| EXC-103 | 资源异常 | encryption.ts - decrypt | 传入空字符串 `""` | 原样返回 `""` |

#### 2.3.4 健康检查异常

| 用例编号 | 异常场景分类 | 触发点 | 异常输入或条件 | 预期错误处理行为 |
|----------|-------------|--------|---------------|-----------------|
| EXC-104 | 资源异常 | GET /health | MySQL 不健康，Redis 健康 | 返回 503，status: "unhealthy" |
| EXC-105 | 资源异常 | GET /health | MySQL 健康，Redis 不健康 | 返回 200，status: "degraded" |
| EXC-106 | 资源异常 | GET /health | MySQL 和 Redis 都不健康 | 返回 503，status: "unhealthy" |
| EXC-107 | 超时 | GET /health | 健康检查超时（> 2 秒） | `runWithTimeout` 超时返回 false，判定为不健康 |

---

### 2.4 权限与安全异常

#### 2.4.1 认证异常

| 用例编号 | 异常场景分类 | 触发点 | 异常输入或条件 | 预期错误处理行为 |
|----------|-------------|--------|---------------|-----------------|
| EXC-108 | 权限异常 | 所有需认证接口 | 未携带 Authorization header | 返回 401，"未登录"或 token 验证失败 |
| EXC-109 | 权限异常 | 所有需认证接口 | Token 过期（超过 7 天） | jwt.verify 失败，返回 401 |
| EXC-110 | 权限异常 | 所有需认证接口 | Token 被篡改（签名不匹配） | jwt.verify 失败，返回 401 |
| EXC-111 | 权限异常 | 所有需认证接口 | Token 格式错误（非 Bearer 格式） | 返回 401 |
| EXC-112 | 权限异常 | 所有需认证接口 | Token 为空字符串 | 返回 401 |
| EXC-113 | 权限异常 | 所有需认证接口 | Authorization header 为 `"Bearer "`（无 token） | 返回 401 |
| EXC-114 | 权限异常 | 所有需认证接口 | 伪造的 JWT（payload 中无 userId） | 返回 401 |

#### 2.4.2 授权异常

| 用例编号 | 异常场景分类 | 触发点 | 异常输入或条件 | 预期错误处理行为 |
|----------|-------------|--------|---------------|-----------------|
| EXC-115 | 权限异常 | 管理后台接口 | 普通用户访问管理员接口 | 返回 403，"没有权限访问该资源" |
| EXC-116 | 权限异常 | 管理后台接口 | 管理员 A 试图修改管理员 B 的角色 | 根据业务逻辑，可能返回 403 |
| EXC-117 | 权限异常 | 管理后台接口 | 普通用户试图查看所有用户列表 | 返回 403 |
| EXC-118 | 权限异常 | 树洞帖子 | 用户 A 试图删除用户 B 的帖子 | 返回 403，"无权操作此帖子" |
| EXC-119 | 权限异常 | 树洞帖子 | 用户 A 试图审核帖子（非管理员） | 返回 403 |
| EXC-120 | 权限异常 | 情绪记录 | 用户 A 试图修改用户 B 的情绪记录 | 返回 403 |

#### 2.4.3 登录安全异常

| 用例编号 | 异常场景分类 | 触发点 | 异常输入或条件 | 预期错误处理行为 |
|----------|-------------|--------|---------------|-----------------|
| EXC-121 | 权限异常 | POST /api/auth/login | 5 次错误密码后第 6 次尝试 | 返回 429，"登录失败次数过多，请15分钟后再试" |
| EXC-122 | 权限异常 | POST /api/auth/login | 锁定期间使用正确密码 | 返回 429，锁定期内仍被拒绝 |
| EXC-123 | 权限异常 | POST /api/auth/login | 锁定 15 分钟后重试（锁定期过期） | 正常登录，清除失败计数 |
| EXC-124 | 权限异常 | POST /api/auth/login | 连续 15 次请求（超过限流） | 返回 429，"请求过于频繁，请稍后再试" |
| EXC-125 | 权限异常 | POST /api/auth/register | 请求体中包含 `role: "admin"` | 抛出 HttpException(403)，"管理员账号只能通过后台脚本创建" |

#### 2.4.4 CORS 安全异常

| 用例编号 | 异常场景分类 | 触发点 | 异常输入或条件 | 预期错误处理行为 |
|----------|-------------|--------|---------------|-----------------|
| EXC-126 | 权限异常 | 所有 API 接口 | 来自未授权 origin 的跨域请求 | 返回 `"Not allowed by CORS"`，浏览器 CORS 错误 |
| EXC-127 | 权限异常 | 所有 API 接口 | 无 origin 的请求（如 Postman/同源探活） | 通过（`callback(null, true)`） |
| EXC-128 | 权限异常 | 所有 API 接口 | 来自授权 origin 的跨域请求 | 通过，设置 `credentials: true`，允许携带 Cookie |

---

### 2.5 第三方服务异常

#### 2.5.1 AI 服务异常

| 用例编号 | 异常场景分类 | 触发点 | 异常输入或条件 | 预期错误处理行为 |
|----------|-------------|--------|---------------|-----------------|
| EXC-129 | 第三方服务 | 心理咨询 POST /api/counseling | AI API 返回错误 | 控制器 catch 返回 500，"AI 服务暂时不可用" |
| EXC-130 | 第三方服务 | 情绪解读 POST /api/ai/interpretation | AI API 返回非预期格式 | JSON 解析失败或字段缺失，返回通用错误 |
| EXC-131 | 第三方服务 | 帖子创建 | 内容审核 AI 失败 | 静默降级，帖子以 `status: 0`（待审核）创建 |
| EXC-132 | 第三方服务 | 内容审核 | 基础敏感词过滤已检测到违规 | 直接返回结果，不调用 AI 接口 |
| EXC-133 | 第三方服务 | 内容审核 | AI 审核返回 JSON 中缺少 isSafe 字段 | 默认 `isSafe: true`，`??` 空值合并运算符保护 |

#### 2.5.2 前端 API 调用异常

| 用例编号 | 异常场景分类 | 触发点 | 异常输入或条件 | 预期错误处理行为 |
|----------|-------------|--------|---------------|-----------------|
| EXC-134 | 第三方服务 | 前端所有 API | 响应 code 字段非 0 | 抛出 `ApiRequestError(kind:'business')`，ElMessage 显示 message |
| EXC-135 | 第三方服务 | 前端所有 API | 响应缺少 code 字段 | 抛出 `ApiRequestError(kind:'business')`，提示"响应缺少业务状态码" |
| EXC-136 | 第三方服务 | 前端所有 API | 响应 data 字段为 null | 正常返回 null |
| EXC-137 | 第三方服务 | 前端所有 API | axios 请求配置错误（无网络请求发出） | 抛出 `ApiRequestError(kind:'config')`，提示"请求配置错误" |

---

## 3. 错误处理缺陷风险清单

### 高风险 (P0)

| 编号 | 风险描述 | 所在文件 | 影响 |
|------|----------|----------|------|
| EH-RISK-001 | **AI 审核失败静默吞掉异常**：`createPostHandler` 中 AI 内容审核的 catch 块为空，异常被完全忽略，帖子以 `status: 0`（待审核）创建，但用户不知道审核失败了 | postController.ts:67-70 | 用户可能发布违规内容而不知，审计日志缺失，问题排查困难 |
| EH-RISK-002 | **控制器统一返回 500 掩盖真实错误**：几乎所有控制器 catch 块都只返回 `{ code: 500, message: '服务器内部错误' }`，丢失了具体错误类型（如死锁、唯一键冲突、外键失败等） | 所有控制器文件 | 前端无法区分错误类型，用户看到模糊的"服务器内部错误"，调试困难 |
| EH-RISK-003 | **注册时密码无长度上限**：密码验证仅 `isLength({ min: 6 })`，无 max 限制，超长密码（如 10000 字符）会通过校验导致 bcrypt 哈希极慢 | authRoutes.ts:39 | 可能导致 DoS 攻击，服务器 CPU 资源耗尽 |
| EH-RISK-004 | **无数据库死锁重试逻辑**：Repository 层和 Controller 层均未处理 `ER_LOCK_DEADLOCK` 错误，直接返回 500 | 所有 Repository | 高并发场景下死锁后用户操作失败，无自动恢复 |

### 中风险 (P1)

| 编号 | 风险描述 | 所在文件 | 影响 |
|------|----------|----------|------|
| EH-RISK-005 | **活动评分 0 值误判为空**：`if (!rating)` 将 `0` 当作 falsy 值处理，虽然评分范围是 1-5，但代码逻辑不健壮 | activityController.ts:336 | 若评分范围变更，0 可能被错误拒绝 |
| EH-RISK-006 | **活动起止时间无交叉校验**：`createActivityHandler` 和 `updateActivityHandler` 中未校验 `startTime < endTime` | activityController.ts:165-189 | 可能创建结束时间早于开始时间的无效活动 |
| EH-RISK-007 | **缓存操作静默失败无告警**：`setCache`/`getCache`/`deleteCache` 失败时仅 `console.warn`，无日志系统记录，生产环境可能丢失 | cache.ts:13-15, 26-28, 54-55 | 缓存失效问题难以排查，运维无法感知 |
| EH-RISK-008 | **前端 502/503 无特殊处理**：axios 拦截器中仅处理了 401/403/404/500，502/503 等状态码显示通用消息 `"请求失败 (502)"` | request.ts:188-202 | 用户无法区分临时故障和永久故障 |
| EH-RISK-009 | **MySQL 连接池排队无上限**：`queueLimit: 0` 表示无限制排队，连接池耗尽时请求会无限堆积 | mysql.ts:85 | 可能导致内存耗尽，服务雪崩 |
| EH-RISK-010 | **AI 重试计数非线程安全**：`retryCount` 是函数内局部变量，但在 async 环境下可能被并发修改 | aiClient.ts:80-84 | 高并发时重试计数可能不准确 |

### 低风险 (P2)

| 编号 | 风险描述 | 所在文件 | 影响 |
|------|----------|----------|------|
| EH-RISK-011 | **authController 中 catch 重新抛出异常**：`login` 函数 catch 块打印日志后重新 `throw error`，依赖全局 errorHandler 处理 | authController.ts:40-47 | 错误处理链路长，可能丢失堆栈信息 |
| EH-RISK-012 | **healthController 中 createHealthHandler 无 try/catch**：虽然内部使用了 `runWithTimeout` 和 `.catch(() => false)`，但外层没有 try/catch | healthController.ts:31-51 | 若 `runWithTimeout` 本身抛出同步异常，可能导致 500 |
| EH-RISK-013 | **操作审计数据库写入失败不影响主流程**：`logOperation` 中 DB 写入失败仅记录日志，不计入请求结果 | operationLogger.ts:53-58 | 审计日志可能丢失，但这是合理的设计权衡 |
| EH-RISK-014 | **前端 loading 状态异常**：若 `startLoading` 和 `endLoading` 调用不匹配（如请求被取消），`loadingCount` 可能永远不为 0 | request.ts:37-62 | 后续请求 loading 动画卡住，页面永远显示加载中 |
| EH-RISK-015 | **CORS 错误信息泄露**：`origin` 回调中抛出 `new Error('Not allowed by CORS')`，错误信息可能被客户端收到 | app.ts:86 | 虽然浏览器会拦截 CORS 错误，但错误字符串可能包含敏感信息 |
| EH-RISK-016 | **404 处理器未区分格式**：`notFoundHandler` 总是返回 JSON 格式错误，对于非 API 路由（如前端静态资源）也返回 JSON | errorHandler.ts:54-56 | 浏览器直接访问非 API 路由时返回 JSON 而非 HTML 页面 |
| EH-RISK-017 | **内容审核 JSON 解析失败默认安全**：AI 返回非 JSON 时默认 `isSafe: true`，可能放过违规内容 | contentAuditService.ts:91-97 | 攻击者可能利用 AI 返回特定格式绕过审核 |
| EH-RISK-018 | **加密/解密错误静默返回原值**：`decrypt` 失败时降级返回原值，可能导致敏感数据以明文形式处理 | encryption.ts:56-58 | 若加密数据意外损坏，敏感数据可能被错误处理 |

---

## 总结

本次异常与错误处理测试分析共覆盖 **5 个异常场景分类**，设计 **137 个测试用例**，发现 **18 个错误处理缺陷风险项**：

- **P0 高风险**：4 个（AI 审核静默吞异常、控制器统一 500、密码无上限、无死锁重试）
- **P1 中风险**：6 个（评分误判、时间校验缺失、缓存静默失败、502/503 无处理、连接池排队无上限、重试计数非线程安全）
- **P2 低风险**：8 个（异常重抛、健康检查无 try/catch、审计日志丢失、loading 状态异常、CORS 信息泄露、404 格式单一、审核 JSON 默认安全、加密降级返回原值）

### 整体评价

**优点**：
- 全局错误中间件设计完善，生产环境隐藏内部错误详情
- 日志系统完善，支持敏感信息脱敏、按天切割、操作审计
- AI 服务和 Redis 有降级策略，核心流程不中断
- 前端 Axios 拦截器统一处理错误，401 自动跳转登录
- 登录安全有失败次数限制和限流保护

**主要不足**：
- 控制器层错误处理过于粗糙，统一返回 500 丢失了大量上下文
- AI 审核失败静默吞掉异常，存在安全隐患
- 缓存层操作失败无正式日志记录
- 缺少数据库死锁重试机制
- 部分边界校验缺失（密码长度、活动时间交叉校验等）