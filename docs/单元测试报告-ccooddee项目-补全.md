# 单元测试报告 - ccooddee 项目（补全篇）

**生成日期**：2026-07-18  
**分析范围**：`d:\桌面\ccooddee\` 中之前未覆盖的模块  
**分析方法**：静态代码分析（未执行实际测试）  
**项目语言/框架**：后端 Express.js + TypeScript / 前端 Vue 3 + TypeScript

> 本报告为[单元测试报告-ccooddee项目.md](单元测试报告-ccooddee项目.md)的补全，覆盖 AI 服务、缓存、日志、验证中间件、控制器等模块。

---

## 一、AI 安全服务模块

### 1.1 aiSafetyService.ts — AI 安全校验

#### 函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `detectHighRisk(text)` | `text: string` | `boolean` | 无 |
| `validateOutput(output)` | `output: Record<string, unknown>` | `boolean` | 无 |
| `getSafeFallback(isHighRisk)` | `isHighRisk: boolean` | `object` | 无 |
| `sanitizeOutput(output)` | `output: Record<string, unknown>` | `Record<string, unknown>` | 无 |
| `buildSafeResponse(errorCode, isHighRisk)` | `errorCode: number, isHighRisk: boolean` | `{ code, message, data }` | 日志 |

---

#### 1.1.1 detectHighRisk — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-AIS-001 | 含自杀关键词 | 无 | `"我想自杀"` | `true` |
| UT-AIS-002 | 含自残关键词 | 无 | `"我会割腕"` | `true` |
| UT-AIS-003 | 安全内容 | 无 | `"今天心情不太好"` | `false` |
| UT-AIS-004 | 空字符串 | 无 | `""` | `false` |
| UT-AIS-005 | 大写混合 | 无 | `"想死"` | `true`（`toLowerCase` 后匹配） |

#### 1.1.2 detectHighRisk — 边界值

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-AIS-006 | 含空格+敏感词 | 无 | `" 自杀 "` | `true`（`includes` 匹配子串） |
| UT-AIS-007 | 敏感词在长文本中 | 无 | `"a".repeat(1000) + "自杀"` | `true` |

#### 1.1.3 validateOutput — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-AIS-008 | 完整有效输出 | 无 | `{ summary: "ok", possibleCauses: "...", todayActions: ["a"], whenToSeekHelp: "..." }` | `true` |
| UT-AIS-009 | 缺少 summary | 无 | `{ possibleCauses: "...", todayActions: ["a"], whenToSeekHelp: "..." }` | `false` |
| UT-AIS-010 | todayActions 为空数组 | 无 | `{ summary: "ok", possibleCauses: "...", todayActions: [], whenToSeekHelp: "..." }` | `false` |
| UT-AIS-011 | todayActions 含非字符串 | 无 | `{ summary: "ok", possibleCauses: "...", todayActions: [123], whenToSeekHelp: "..." }` | `false`（`typeof a === 'string'` 失败） |
| UT-AIS-012 | summary 为空字符串 | 无 | `{ summary: "   ", possibleCauses: "...", todayActions: ["a"], whenToSeekHelp: "..." }` | `false`（`trim()` 后为空） |
| UT-AIS-013 | null 输入 | 无 | `null` | `false`（`!output` 为 true） |

#### 1.1.4 sanitizeOutput — 输入输出验证

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-AIS-014 | 脱敏手机号 | 无 | `{ text: "13812345678" }` | `{ text: "[手机号]" }` |
| UT-AIS-015 | 脱敏身份证号 | 无 | `{ text: "110101199001011234" }` | `{ text: "[身份证号]" }` |
| UT-AIS-016 | 脱敏数组中的手机号 | 无 | `{ items: ["13812345678"] }` | `{ items: ["[手机号]"] }` |
| UT-AIS-017 | 无敏感信息 | 无 | `{ text: "hello" }` | `{ text: "hello" }` |
| UT-AIS-018 | 非字符串值 | 无 | `{ count: 123 }` | `{ count: 123 }`（直接透传） |

#### 1.1.5 buildSafeResponse — 边界值

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-AIS-019 | TIMEOUT 错误 | 无 | `errorCode=1503, isHighRisk=false` | `message: "AI 服务响应超时..."` |
| UT-AIS-020 | HIGH_RISK 错误 | 无 | `errorCode=1506, isHighRisk=true` | `message: "检测到高风险内容..."` |
| UT-AIS-021 | 未知错误码 | 无 | `errorCode=9999, isHighRisk=false` | `message: "AI 服务暂时不可用"`（默认） |

---

## 二、AI 调用服务

### 2.1 aiCallService.ts — AI 模板调用

#### 函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `callWithTemplate(templateName, variables, options?)` | `templateName: string, variables: Record<string, string>, options: { model?, temperature?, maxTokens? }` | `Promise<string>` | 数据库查询、AI 调用 |
| `callDirect(systemPrompt, userPrompt, options?)` | `systemPrompt: string, userPrompt: string, options: { model?, temperature?, maxTokens? }` | `Promise<string>` | AI 调用 |
| `isAiAvailable()` | 无 | `boolean` | 读取配置 |

---

#### 2.1.1 callWithTemplate — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-AIC-001 | AI 未启用 | `aiConfig.enabled=false` | `templateName="any"` | 抛出 `Error("AI 服务未启用...")` |
| UT-AIC-002 | 模板不存在 | AI 已启用 | `templateName="nonexistent"` | 抛出 `Error("Prompt 模板不存在...")` |
| UT-AIC-003 | 变量替换 | 模板存在，变量 `{{mood}}` | `templateName="t", variables={mood:"开心"}` | `{{mood}}` 被替换为 `"开心"` |
| UT-AIC-004 | 空变量 | 模板存在 | `templateName="t", variables={}` | 正常返回 AI 响应 |

#### 2.1.2 callDirect — 边界值

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-AIC-005 | 空 systemPrompt | AI 已启用 | `systemPrompt=""` | AI 调用正常（空 system prompt 合法） |
| UT-AIC-006 | 超长 prompt | AI 已启用 | `systemPrompt="a".repeat(100000)` | 取决于 AI API 限制 |

#### 2.1.3 isAiAvailable — 边界值

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-AIC-007 | 已启用且有 key | `enabled=true, deepseekApiKey="sk-xxx"` | 无 | `true` |
| UT-AIC-008 | 启用但无 key | `enabled=true, deepseekApiKey=""` | 无 | `false` |
| UT-AIC-009 | 未启用 | `enabled=false` | 无 | `false` |

---

## 三、内容审核服务

### 3.1 contentAuditService.ts — AI 内容审核

#### 函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `auditContent(request)` | `request: ContentAuditRequest` | `Promise<ContentAuditResult>` | Redis 缓存、AI 调用 |
| `basicContentFilter(content)` | `content: string` | `Omit<ContentAuditResult, 'timestamp'>` | 无 |
| `shouldAutoReject(content)` | `content: string` | `Promise<boolean>` | 调用 auditContent |
| `shouldMarkForReview(content)` | `content: string` | `Promise<boolean>` | 调用 auditContent |
| `sanitizeContent(content)` | `content: string` | `string` | 无 |

---

#### 3.1.1 basicContentFilter — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-CAS-001 | 安全内容 | 无 | `"今天天气很好"` | `{ isSafe: true, detectedIssues: [], severity: "low" }` |
| UT-CAS-002 | 含1个敏感词 | 无 | `"谈论暴力问题"` | `{ isSafe: false, severity: "medium" }`（1个→中） |
| UT-CAS-003 | 含3个敏感词 | 无 | `"暴力恐怖自杀"` | `{ isSafe: false, severity: "high" }` |
| UT-CAS-004 | 内容过长 | 无 | `"a".repeat(5001)` | `detectedIssues: ["内容过长"]` |
| UT-CAS-005 | 含过多链接 | 无 | 6个 URL | `detectedIssues: ["包含过多链接"]` |

#### 3.1.2 basicContentFilter — 边界值

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-CAS-006 | 刚好5000字符 | 无 | `"a".repeat(5000)` | 不含"内容过长" |
| UT-CAS-007 | 刚好5001字符 | 无 | `"a".repeat(5001)` | 含"内容过长" |
| UT-CAS-008 | 刚好5个链接 | 无 | 5个 URL | 不含"包含过多链接" |
| UT-CAS-009 | 刚好6个链接 | 无 | 6个 URL | 含"包含过多链接" |

#### 3.1.3 sanitizeContent — 输入输出验证

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-CAS-010 | 隐藏手机号 | 无 | `"13812345678"` | `"***"` |
| UT-CAS-011 | 隐藏邮箱 | 无 | `"test@example.com"` | `"***"` |
| UT-CAS-012 | 隐藏链接 | 无 | `"https://example.com"` | `"***"` |
| UT-CAS-013 | 空内容 | 无 | `""` | `""` |
| UT-CAS-014 | 无敏感信息 | 无 | `"hello"` | `"hello"` |

---

## 四、推荐服务

### 4.1 recommendService.ts — 情绪推荐

#### 函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `getRecommendations(request)` | `request: ContentRecommendationRequest` | `Promise<RecommendationResult>` | Redis 缓存、AI 调用、数据库查询 |
| `getPersonalizedRecommendations(userId, mood, limit?)` | `userId: number, mood: string, limit: number` | `Promise<RecommendationResult>` | 数据库查询（情绪历史、测评历史）、AI 调用 |
| `enrichWithRealContent(items)` | `items: RecommendationItem[]` | `Promise<RecommendationItem[]>` | 3次数据库查询/项 |
| `saveRecommendationClick(userId, itemId, itemType)` | `userId: number, itemId: string, itemType: string` | `Promise<void>` | 仅日志 |

---

#### 4.1.1 getRecommendations — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-REC-001 | mood 为字符串 | 缓存未命中 | `mood="开心"` | 正常返回 `RecommendationResult` |
| UT-REC-002 | mood 为数组 | 缓存未命中 | `mood=["开心","焦虑"]` | 取第一项 `"开心"` |
| UT-REC-003 | mood 为空数组 | 缓存未命中 | `mood=[]` | 默认 `"平静"` |
| UT-REC-004 | 带 userPreferences | 缓存未命中 | `userPreferences=["音乐","运动"]` | 偏好被拼入 prompt |
| UT-REC-005 | AI 返回格式错误 | 缓存未命中 | 模拟 AI 返回非 JSON | 返回空 items 兜底 |

#### 4.1.2 enrichWithRealContent — 边界值

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-REC-006 | 所有类型匹配 | 数据库有数据 | `items=[{type:"music"},{type:"course"},{type:"activity"}]` | 每个 item 被真实数据替换 |
| UT-REC-007 | 数据库无匹配 | 数据库为空 | `items=[{type:"music"}]` | 返回原 item（未替换） |
| UT-REC-008 | 未知 type | 数据库有数据 | `items=[{type:"unknown"}]` | 返回原 item（未匹配） |
| UT-REC-009 | 数据库错误 | 模拟 DB 异常 | `items=[{type:"music"}]` | catch 返回原 item |

---

## 五、缓存模块

### 5.1 cache.ts — Redis 缓存操作

#### 函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `setCache(key, value, ttl?)` | `key: string, value: unknown, ttl: number` | `Promise<void>` | Redis 写入、内存 Set |
| `getCache<T>(key)` | `key: string` | `Promise<T \| null>` | Redis 读取 |
| `clearActivityCache()` | 无 | `Promise<void>` | Redis 批量删除、内存 Set 清空 |
| `deleteCache(key)` | `key: string` | `Promise<void>` | Redis 删除、内存 Set 删除 |
| `getOrSetMoodCache<T>(key, fetchFn)` | `key: string, fetchFn: () => Promise<T>` | `Promise<T>` | Redis 读取/写入 |
| `clearMoodCache(userId)` | `userId: number` | `Promise<void>` | Redis KEYS 扫描、批量删除 |

---

#### 5.1.1 getOrSetMoodCache — 输入输出验证

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-CACHE-001 | 缓存命中 | Redis 已有数据 | `key="test", fetchFn=<mock>` | 返回缓存数据，fetchFn 不被调用 |
| UT-CACHE-002 | 缓存未命中 | Redis 无数据 | `key="test", fetchFn=<mock returns "data">` | 返回 `"data"`，数据被写入缓存 |
| UT-CACHE-003 | fetchFn 抛出异常 | Redis 无数据 | `fetchFn` 抛出 Error | 异常不被捕获，向上传播 |

#### 5.1.2 setCache / getCache — 边界值

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-CACHE-004 | setCache Redis 失败 | Redis 不可用 | 模拟 Redis 连接失败 | 静默失败（console.warn），不抛异常 |
| UT-CACHE-005 | getCache Redis 失败 | Redis 不可用 | 模拟 Redis 连接失败 | 返回 `null` |
| UT-CACHE-006 | getCache 非 JSON 值 | Redis 有非 JSON 数据 | `key="bad"` | `JSON.parse` 失败 → catch 返回 `null` |

#### 5.1.3 clearMoodCache — 边界值

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-CACHE-007 | userId=0 | Redis 可用 | `userId=0` | 搜索 `mood:trend:0:*` 等 patterns |
| UT-CACHE-008 | 无匹配缓存 | Redis 无匹配 key | `userId=999` | 静默成功（`keys` 返回空） |

---

## 六、日志模块

### 6.1 logger.ts — 日志脱敏

#### 函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `sanitizeForLogs(value, key?, depth?)` | `value: unknown, key: string, depth: number` | `unknown` | 无 |
| `summarizeRequestBody(body)` | `body: unknown` | `object \| null` | 无 |

---

#### 6.1.1 sanitizeForLogs — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-LOG-001 | 敏感 key 脱敏 | 无 | `value="secret", key="password"` | `"[REDACTED]"` |
| UT-LOG-002 | JWT token 脱敏 | 无 | `value="Bearer eyJhbGci..."` | `"Bearer [REDACTED]"` |
| UT-LOG-003 | 身份证脱敏 | 无 | `value="110101199001011234"` | `"[REDACTED_ID_CARD]"` |
| UT-LOG-004 | 正常字符串 | 无 | `value="hello"` | `"hello"` |
| UT-LOG-005 | null 值 | 无 | `value=null` | `null` |
| UT-LOG-006 | Error 对象 | 非生产环境 | `new Error("test")` | `{ name: "Error", message: "test", stack: "..." }` |
| UT-LOG-007 | 深度超限 | 无 | 深度 6 的对象 | `"[TRUNCATED]"` |

#### 6.1.2 summarizeRequestBody — 边界值

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-LOG-008 | 含密码字段 | 无 | `{ password: "123", username: "test" }` | `redactedKeys: ["password"]` |
| UT-LOG-009 | 空对象 | 无 | `{}` | `{ type: "object", keyCount: 0, keys: [] }` |
| UT-LOG-010 | 字符串 body | 无 | `"hello"` | `{ type: "string", length: 5 }` |

---

## 七、验证中间件

### 7.1 validateRequest.ts — 请求参数验证

#### 函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `validateRequest(req, res, next)` | Express 中间件 | void | 无 |

---

#### 7.1.1 validateRequest — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-VAL-001 | 无验证错误 | `validationResult` 返回空 | 无 | `next()` 被调用 |
| UT-VAL-002 | 有验证错误 | `validationResult` 返回 1 个错误 | 无 | `res.status(400).json({ code: 1001, ... })` |
| UT-VAL-003 | 敏感字段脱敏 | 错误在 `password` 字段 | 无 | `value` 字段从响应中移除 |
| UT-VAL-004 | 多个验证错误 | `validationResult` 返回 3 个错误 | 无 | 返回 3 个错误的数组 |

---

## 八、控制器模块

### 8.1 treeholeController.ts — 树洞温柔回复

#### 函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `generateGentleReply(req, res)` | Express handler | void | AI 调用 |

---

#### 8.1.1 generateGentleReply — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-TH-001 | 正常倾诉 | AI 可用 | `{ content: "今天心情不好" }` | `200 { code: 0, data: { reply, is_fallback: false } }` |
| UT-TH-002 | 空内容 | 无 | `{ content: "" }` | `400 "内容不能为空"` |
| UT-TH-003 | 纯空格 | 无 | `{ content: "   " }` | `400 "内容不能为空"` |
| UT-TH-004 | 超长内容 | 无 | `{ content: "a".repeat(1001) }` | `400 "内容长度不能超过1000字"` |

#### 8.1.2 generateGentleReply — 边界值

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-TH-005 | 刚好1000字 | AI 可用 | `{ content: "a".repeat(1000) }` | 正常处理 |
| UT-TH-006 | 1个字符 | AI 可用 | `{ content: "好" }` | 正常处理 |
| UT-TH-007 | AI 调用失败 | AI 不可用 | `{ content: "test" }` | `500` 错误 |

---

### 8.2 managementController.ts — 管理控制器

#### 关键函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `parseAdminMoodListQuery(req)` | `AuthRequest` | `AdminMoodListQuery` | 无 |
| `getClientIp(req)` | `AuthRequest` | `string` | 无 |

---

#### 8.2.1 parseAdminMoodListQuery — 边界值

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-MC-001 | 默认分页 | `req.query` 为空 | 无 | `{ page: 1, pageSize: 20 }` |
| UT-MC-002 | 自定义分页 | `req.query.page="3", req.query.pageSize="50"` | 无 | `{ page: 3, pageSize: 50 }` |
| UT-MC-003 | 负数页码 | `req.query.page="-1"` | 无 | `page` 被 clamp 为 `1` |
| UT-MC-004 | 超大 pageSize | `req.query.pageSize="1000"` | 无 | `pageSize` 被 clamp 为 `100` |

#### 8.2.2 getClientIp — 边界值

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-MC-005 | x-forwarded-for 存在 | `req.headers['x-forwarded-for']="1.2.3.4, 5.6.7.8"` | 无 | `"1.2.3.4"` |
| UT-MC-006 | x-forwarded-for 不存在 | 无 x-forwarded-for | 无 | `req.ip` 或 `"-"` |

---

## 九、管理 Repository

### 9.1 managementRepository.ts — safeCount

#### 函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `safeCount(query, params)` | `query: string, params: unknown[]` | `Promise<number>` | 无 |

---

#### 9.1.1 safeCount — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-MR-001 | 正常查询 | 数据库正常 | `"SELECT COUNT(*) as total FROM users"` | 返回 count 数字 |
| UT-MR-002 | SQL 执行失败 | 表不存在 | `"SELECT COUNT(*) as total FROM nonexistent"` | 返回 `0`（catch），console.error 日志 |
| UT-MR-003 | 返回 0 行 | 表为空 | 正常查询 | 返回 `0` |

---

## 十、潜在缺陷与风险清单

### 10.1 高风险

| ID | 位置 | 缺陷描述 | 影响 |
|----|------|---------|------|
| BUG2-001 | [recommendService.ts:L210-L274](file:///d:/桌面/ccooddee/mood_health_server/src/utils/ai/recommendService.ts#L210-L274) | `enrichWithRealContent` 对每个 item 执行一次数据库查询，N 个 items 产生 N 次独立查询（N+1 问题） | 性能瓶颈 |
| BUG2-002 | [recommendService.ts:L92-L92](file:///d:/桌面/ccooddee/mood_health_server/src/utils/ai/recommendService.ts#L92-L92) | `enrichWithRealContent` 中 `item.id` 被覆盖为数据库 ID，但 `saveRecommendationClick` 只写日志，点击统计丢失 | 功能缺失 |
| BUG2-003 | [contentAuditService.ts:L145-L148](file:///d:/桌面/ccooddee/mood_health_server/src/utils/ai/contentAuditService.ts#L145-L148) | `basicContentFilter` 使用 `includes` 做子串匹配，与 `contentFilter.ts` 有重复逻辑且敏感词列表不一致 | 维护困难、匹配不一致 |
| BUG2-004 | [aiSafetyService.ts:L88-L108](file:///d:/桌面/ccooddee/mood_health_server/src/utils/ai/aiSafetyService.ts#L88-L108) | `sanitizeOutput` 的身份证正则 `\d{6}\d{8}\d{4}` 会匹配到 18 位数字中的前 18 位，但第一个正则 `\d{17}[\dXx]` 已先匹配，导致第二个正则实际不会触发 | 逻辑冗余 |

### 10.2 中风险

| ID | 位置 | 缺陷描述 | 影响 |
|----|------|---------|------|
| BUG2-005 | [cache.ts:L118-L130](file:///d:/桌面/ccooddee/mood_health_server/src/utils/cache.ts#L118-L130) | `getOrSetMoodCache` 中 `fetchFn` 抛出异常不会被捕获，导致调用方必须自行处理异常 | 缺少容错 |
| BUG2-006 | [cache.ts:L85-L103](file:///d:/桌面/ccooddee/mood_health_server/src/utils/cache.ts#L85-L103) | `clearMoodCache` 使用 `redisClient.keys()` 扫描全库，在生产环境大数据量下性能极差 | 性能风险 |
| BUG2-007 | [recommendService.ts:L64-L64](file:///d:/桌面/ccooddee/mood_health_server/src/utils/ai/recommendService.ts#L64-L64) | `request.mood` 为数组时取第一项，但字段名 `mood` 暗示是单值，类型歧义 | 语义模糊 |
| BUG2-008 | [contentAuditService.ts:L177-L177](file:///d:/桌面/ccooddee/mood_health_server/src/utils/ai/contentAuditService.ts#L177-L177) | `basicContentFilter` 中 `detectedIssues.length >= 1` 永远为 true（因为走到这里必然 >=1），但仍写了 `else if` | 冗余条件 |
| BUG2-009 | [aiCallService.ts:L19-L60](file:///d:/桌面/ccooddee/mood_health_server/src/utils/ai/aiCallService.ts#L19-L60) | `callWithTemplate` 每次调用都加载全部 4 个分类的模板到内存，无缓存 | 性能浪费 |
| BUG2-010 | [contentAuditService.ts:L17-L24](file:///d:/桌面/ccooddee/mood_health_server/src/utils/ai/contentAuditService.ts#L17-L24) | `ContentAuditService.SENSITIVE_WORDS` 与 `contentFilter.ts` 的敏感词列表重复定义，且本列表缺少去重（仍含"赌博"、"诈骗"、"勒索"各2次） | 重复维护 |

### 10.3 低风险

| ID | 位置 | 缺陷描述 | 影响 |
|----|------|---------|------|
| BUG2-011 | [logger.ts:L26-L28](file:///d:/桌面/ccooddee/mood_health_server/src/utils/logger.ts#L26-L28) | `sanitizeForLogs` 深度超过 5 返回 `"[TRUNCATED]"`，但深层嵌套对象可能丢失关键上下文 | 日志不完整 |
| BUG2-012 | [validateRequest.ts:L7-L28](file:///d:/桌面/ccooddee/mood_health_server/src/middleware/validateRequest.ts#L7-L28) | `validateRequest` 对 `SENSITIVE_FIELDS` 脱敏，但敏感字段列表不包含 `newPassword`、`oldPassword` 等变体 | 敏感信息可能泄露 |
| BUG2-013 | [treeholeController.ts:L22-L51](file:///d:/桌面/ccooddee/mood_health_server/src/controllers/treeholeController.ts#L22-L51) | `generateGentleReply` 未做内容安全检测（无敏感词过滤），用户可能输入危险内容 | 安全风险 |
| BUG2-014 | [contentAuditService.ts:L231-L238](file:///d:/桌面/ccooddee/mood_health_server/src/utils/ai/contentAuditService.ts#L231-L238) | `sanitizeContent` 中 `\d{11}` 会匹配 11位连续数字中的任意位置，可能误匹配非手机号 | 过度脱敏 |
| BUG2-015 | [recommendService.ts:L120-L132](file:///d:/桌面/ccooddee/mood_health_server/src/utils/ai/recommendService.ts#L120-L132) | `saveRecommendationClick` 方法体只有日志，未实际保存点击数据到数据库 | 功能缺失 |

---

## 十一、总结

### 修复优先级

| 优先级 | 缺陷编号 | 说明 |
|--------|---------|------|
| P0 | BUG2-001 | enrichWithRealContent N+1 查询 |
| P0 | BUG2-003 | contentAuditService 敏感词列表不一致 |
| P1 | BUG2-005 | getOrSetMoodCache fetchFn 异常传播 |
| P1 | BUG2-008 | basicContentFilter 冗余条件 |
| P1 | BUG2-010 | 敏感词列表重复+未去重 |
| P2 | BUG2-002, BUG2-004, BUG2-006, BUG2-007, BUG2-009 | 功能缺失/逻辑冗余 |
| P2 | BUG2-011~015 | 低风险改进项 |