# 单元测试报告 - ccooddee 项目

**生成日期**：2026-07-18  
**分析范围**：`d:\桌面\ccooddee\` 全部代码文件  
**分析方法**：静态代码分析（未执行实际测试）  
**项目语言/框架**：后端 Express.js + TypeScript / 前端 Vue 3 + TypeScript

---

## 一、项目概述

| 层级 | 技术 | 关键测试模块 |
|------|------|-------------|
| 后端 | Express + TypeScript | utils/ (password, encryption, contentFilter, scoringEngine, apiResponse, errors), services/ (authService, moodService), middleware/ (auth, errorHandler) |
| 前端 | Vue 3 + TypeScript | utils/ (request.ts), router/ (guards.ts), stores/ (userStore), views/mood/ (MoodRecordScript) |

---

## 二、后端工具函数模块

### 2.1 password.ts — 密码工具

#### 函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `hashPassword(password, saltRounds?)` | `password: string`, `saltRounds: number = 10` | `Promise<string>` | bcrypt 计算 |
| `comparePassword(password, hashedPassword)` | `password: string`, `hashedPassword: string` | `Promise<boolean>` | bcrypt 比对 |
| `generateRandomPassword(length?)` | `length: number = 12` | `string` | Math.random() |
| `getPasswordStrength(password)` | `password: string` | `'weak' \| 'medium' \| 'strong'` | 无 |

---

#### 2.1.1 hashPassword — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-PW-001 | 有效密码+默认盐值 | 无 | `password="MyP@ss123"` | 返回 bcrypt hash 字符串（以 `$2a$10$` 开头） |
| UT-PW-002 | 有效密码+自定义盐值 | 无 | `password="abc", saltRounds=5` | 返回 bcrypt hash 字符串 |
| UT-PW-003 | 空字符串密码 | 无 | `password=""` | bcrypt 处理空字符串，返回 hash |
| UT-PW-004 | 极长密码 | 无 | `password="a".repeat(10000)` | 正常返回 hash（bcrypt 自动截断72字节） |
| UT-PW-005 | saltRounds=0 | 无 | `password="test", saltRounds=0` | bcrypt 内部可能报错或使用默认值 |

#### 2.1.2 hashPassword — 边界值分析

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-PW-006 | saltRounds 最小值1 | 无 | `saltRounds=1` | 正常返回 hash |
| UT-PW-007 | saltRounds 大值20 | 无 | `saltRounds=20` | 正常返回 hash（计算时间较长） |

#### 2.1.3 comparePassword — 输入输出验证

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-PW-008 | 密码匹配 | 已生成 hash | `password="test", hashedPassword=<hash>` | `true` |
| UT-PW-009 | 密码不匹配 | 已生成 hash | `password="wrong", hashedPassword=<hash>` | `false` |
| UT-PW-010 | 空密码对比 | 无 | `password="", hashedPassword=""` | `false`（catch 返回 false） |
| UT-PW-011 | 无效 hash 格式 | 无 | `password="test", hashedPassword="invalid"` | `false`（catch 返回 false） |

#### 2.1.4 generateRandomPassword — 边界值

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-PW-012 | 默认长度 | 无 | 无参数 | 12位字符串，包含大小写字母+数字+特殊字符 |
| UT-PW-013 | 自定义长度 | 无 | `length=16` | 16位字符串 |
| UT-PW-014 | 长度0 | 无 | `length=0` | 空字符串 `""` |
| UT-PW-015 | 负长度 | 无 | `length=-5` | 空字符串 `""`（循环不执行） |

#### 2.1.5 getPasswordStrength — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-PW-016 | 弱密码—纯数字 | 无 | `"12345678"` | `"weak"`（长度>=8得分1，含数字得分1，总分2≤2） |
| UT-PW-017 | 弱密码—纯字母 | 无 | `"abcdefgh"` | `"weak"`（长度>=8得分1，小写1，总分2≤2） |
| UT-PW-018 | 中等密码—字母+数字 | 无 | `"abcd1234"` | `"medium"`（长度>=8得分1，数字1，小写1，总分3） |
| UT-PW-019 | 中等密码—长短混合 | 无 | `"Abc123"` | `"medium"`（长度<8得0分，大写1，小写1，数字1，总分3） |
| UT-PW-020 | 强密码—全类型 | 无 | `"P@ssw0rd123!"` | `"strong"`（长度>=8且>=12得2分，数字1，大小写各1，特殊字符1，总分6≥5） |
| UT-PW-021 | 强密码—最少5分 | 无 | `"Abcdef123!"` | `"strong"`（总分5） |
| UT-PW-022 | 空字符串 | 无 | `""` | `"weak"`（总分0） |
| UT-PW-023 | 长度<8的强组合 | 无 | `"A1!b"` | `"weak"`（长度0分，大写1，小写1，数字1，特殊字符1，总分4，但长度<8得分0） |

---

### 2.2 encryption.ts — 加密解密模块

#### 函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `encrypt(text)` | `text: string` | `string`（JSON序列化的加密数据） | crypto随机IV |
| `decrypt(encryptedData)` | `encryptedData: string` | `string` | 无 |
| `encryptField(value)` | `value: string \| null \| undefined` | `string \| null` | 无 |
| `decryptField(value)` | `value: string \| null \| undefined` | `string \| null` | 无 |
| `generateEncryptionKey()` | 无 | `string`（64字符hex） | crypto.randomBytes |

---

#### 2.2.1 encrypt/decrypt — 输入输出验证

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-ENC-001 | 加密解密往返 | ENCRYPTION_KEY 已设置 | `"Hello World"` | `encrypt("Hello World")` → 解密后为 `"Hello World"` |
| UT-ENC-002 | 加密中文内容 | ENCRYPTION_KEY 已设置 | `"你好世界"` | 加密解密往返成功 |
| UT-ENC-003 | 加密空字符串 | ENCRYPTION_KEY 已设置 | `""` | 直接返回 `""`（不加密） |
| UT-ENC-004 | 加密长文本 | ENCRYPTION_KEY 已设置 | `"a".repeat(10000)` | 加密解密往返成功 |
| UT-ENC-005 | 解密非加密文本 | ENCRYPTION_KEY 已设置 | `"plain text"` | 直接返回 `"plain text"`（不包含 `{`） |
| UT-ENC-006 | 解密空字符串 | ENCRYPTION_KEY 已设置 | `""` | 直接返回 `""` |
| UT-ENC-007 | 解密格式错误的JSON | ENCRYPTION_KEY 已设置 | `"{invalid}"` | `JSON.parse` throw → catch 返回原值 `"{invalid}"` |

#### 2.2.2 encrypt/decrypt — 异常测试

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-ENC-008 | ENCRYPTION_KEY 未设置 | `process.env.ENCRYPTION_KEY` 未设置 | `"test"` | `getKey()` 抛出 `Error("ENCRYPTION_KEY environment variable is required")` |
| UT-ENC-009 | ENCRYPTION_KEY 长度错误 | `ENCRYPTION_KEY` 为 16 字节 hex | `"test"` | `getKey()` 抛出 `Error("Invalid encryption key length...")` |
| UT-ENC-010 | 解密时 authTag 被篡改 | ENCRYPTION_KEY 已设置 | 加密数据，authTag 修改后 | `decipher.final` 失败 → catch 返回原加密数据 |

#### 2.2.3 encryptField/decryptField — 边界值

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-ENC-011 | encryptField null | ENCRYPTION_KEY 已设置 | `null` | `null` |
| UT-ENC-012 | encryptField undefined | ENCRYPTION_KEY 已设置 | `undefined` | `null` |
| UT-ENC-013 | encryptField 有效值 | ENCRYPTION_KEY 已设置 | `"sensitive"` | 加密后的字符串 |
| UT-ENC-014 | decryptField null | ENCRYPTION_KEY 已设置 | `null` | `null` |
| UT-ENC-015 | decryptField undefined | ENCRYPTION_KEY 已设置 | `undefined` | `null` |

#### 2.2.4 generateEncryptionKey — 输入输出验证

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-ENC-016 | 生成密钥 | 无 | 无 | 64字符 hex 字符串 |
| UT-ENC-017 | 两次生成不同 | 无 | 调用两次 | 两次结果不同 |

---

### 2.3 contentFilter.ts — 内容过滤器

#### 函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `filterContent(content)` | `content: string` | `ContentFilterResult { isSafe, detectedWords, severity }` | 无 |
| `shouldAutoReject(content)` | `content: string` | `boolean` | 无 |
| `shouldMarkForReview(content)` | `content: string` | `boolean` | 无 |

---

#### 2.3.1 filterContent — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-CF-001 | 安全内容 | 无 | `"今天天气真好"` | `{ isSafe: true, detectedWords: [], severity: "low" }` |
| UT-CF-002 | 含单个敏感词 | 无 | `"讨论暴力问题"` | `{ isSafe: false, detectedWords: ["暴力"], severity: "low" }` |
| UT-CF-003 | 含2个敏感词 | 无 | `"涉及暴力和色情"` | `{ isSafe: false, severity: "medium" }` |
| UT-CF-004 | 含3个及以上敏感词 | 无 | `"暴力恐怖自杀"` | `{ isSafe: false, severity: "high" }` |
| UT-CF-005 | 空字符串 | 无 | `""` | `{ isSafe: true, detectedWords: [], severity: "low" }` |

#### 2.3.2 filterContent — 边界值分析

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-CF-006 | 刚好2个敏感词（边界） | 无 | `"暴力毒品"` | `severity: "medium"`（2个→中） |
| UT-CF-007 | 刚好3个敏感词（边界） | 无 | `"暴力毒品自杀"` | `severity: "high"`（3个→高） |
| UT-CF-008 | 大小写混合 | 无 | `"暴Li"` | `{ isSafe: true }`（`includes` 区分大小写，但代码用了 `toLowerCase`） |

#### 2.3.3 shouldAutoReject / shouldMarkForReview

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-CF-009 | 应自动拒绝 | 无 | 3个以上敏感词 | `shouldAutoReject` → `true` |
| UT-CF-010 | 不应自动拒绝 | 无 | 1个敏感词 | `shouldAutoReject` → `false` |
| UT-CF-011 | 应标记审核 | 无 | 1-2个敏感词 | `shouldMarkForReview` → `true` |
| UT-CF-012 | 不应标记审核 | 无 | 安全内容 | `shouldMarkForReview` → `false` |

---

### 2.4 scoringEngine.ts — 计分引擎

#### 函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `calculateScore(answers, rule)` | `answers: Array<{itemId, score}>, rule: ScoringRule` | `number` | 无 |
| `findRiskLevel(totalScore, stratification, suggestion)` | `totalScore: number, stratification: RiskStratification, suggestion: SuggestionTemplate` | `ScoringResult` | 无 |
| `scoreAssessment(answers, rule, stratification, suggestion)` | 同上组合 | `ScoringResult` | 调用上述两个函数 |

---

#### 2.4.1 calculateScore — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-SC-001 | 正向计分 | `rule.reverse_items=[]` | `answers=[{itemId:1,score:3},{itemId:2,score:4}]` | `7`（3+4） |
| UT-SC-002 | 反向计分 | `rule.reverse_items=[1], max_score=5` | `answers=[{itemId:1,score:1}]` | `4`（5-1=4） |
| UT-SC-003 | 混合计分 | `rule.reverse_items=[2], max_score=5` | `answers=[{itemId:1,score:3},{itemId:2,score:2}]` | `6`（3 + (5-2)=6） |
| UT-SC-004 | 空答案 | `rule.reverse_items=[]` | `answers=[]` | `0` |
| UT-SC-005 | 无 reverse_items | `rule.reverse_items=undefined` | `answers=[{itemId:1,score:5}]` | `5` |

#### 2.4.2 calculateScore — 边界值分析

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-SC-006 | 反向计分最小值 | `rule.max_score=5, reverse_items=[1]` | `answers=[{itemId:1,score:5}]` | `0`（5-5=0） |
| UT-SC-007 | 反向计分最大值 | `rule.max_score=5, reverse_items=[1]` | `answers=[{itemId:1,score:0}]` | `5`（5-0=5） |
| UT-SC-008 | 负分数 | `rule.reverse_items=[]` | `answers=[{itemId:1,score:-1}]` | `-1`（无校验） |
| UT-SC-009 | 超出 max_score | `rule.max_score=5, reverse_items=[1]` | `answers=[{itemId:1,score:10}]` | `-5`（5-10=-5，无校验） |

#### 2.4.3 findRiskLevel — 输入输出验证

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-SC-010 | 匹配正常等级 | 3个等级 [0,10], [11,20], [21,30] | `totalScore=15` | `{ riskLevel: "中等", ... }` |
| UT-SC-011 | 匹配边界值 | 等级 [0,10] | `totalScore=0` | 匹配第一个等级 |
| UT-SC-012 | 匹配上边界 | 等级 [0,10] | `totalScore=10` | 匹配第一个等级 |
| UT-SC-013 | 未匹配任何等级 | 等级 [0,10], [20,30] | `totalScore=15` | `{ riskLevel: "未知", riskColor: "gray", suggestion: "" }` |
| UT-SC-014 | 空等级列表 | `stratification.levels=[]` | `totalScore=10` | `{ riskLevel: "未知", ... }` |

---

### 2.5 apiResponse.ts — API 响应格式

#### 函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `apiSuccess(data, message?)` | `data: T, message: string = '操作成功'` | `ApiResponse<T>` | 无 |
| `apiFailure(code, message, data?)` | `code: number, message: string, data: T = null` | `ApiResponse<T>` | 无 |
| `businessCodeForHttpStatus(statusCode)` | `statusCode: number` | `number` | 无 |

---

#### 2.5.1 apiSuccess — 输入输出验证

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-API-001 | 正常成功响应 | 无 | `data={id:1}, message="成功"` | `{ code: 0, message: "成功", data: {id:1} }` |
| UT-API-002 | data 为 null | 无 | `data=null` | `{ code: 0, message: "操作成功", data: null }` |
| UT-API-003 | 默认消息 | 无 | `data="test"` | `code: 0, message: "操作成功"` |

#### 2.5.2 apiFailure — 异常测试

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-API-004 | 正常失败响应 | 无 | `code=400, message="参数错误"` | `{ code: 400, message: "参数错误", data: null }` |
| UT-API-005 | code=0 应抛出 | 无 | `code=0, message="错误"` | 抛出 `Error("失败响应必须使用非零业务码")` |
| UT-API-006 | 带 data 的失败 | 无 | `code=400, message="验证失败", data={errors:[]}` | `{ code: 400, message: "验证失败", data: {errors:[]} }` |

#### 2.5.3 businessCodeForHttpStatus — 边界值

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-API-007 | 400 | 无 | `400` | `1001`（BAD_REQUEST） |
| UT-API-008 | 401 | 无 | `401` | `1002`（UNAUTHORIZED） |
| UT-API-009 | 500+ | 无 | `502` | `1500`（INTERNAL_ERROR） |
| UT-API-010 | 未知状态码 | 无 | `418` | `1001`（default BAD_REQUEST） |

---

### 2.6 errors.ts — 自定义错误类

#### 2.6.1 AppError — 输入输出验证

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-ERR-001 | 创建 AppError | 无 | `new AppError("msg", 500)` | `statusCode=500, isOperational=true, timestamp` 非空 |
| UT-ERR-002 | 创建 BusinessError | 无 | `new BusinessError("msg")` | `statusCode=400` |
| UT-ERR-003 | 创建 HttpException | 无 | `new HttpException("msg", 404)` | `statusCode=404` |
| UT-ERR-004 | 创建 DatabaseError | 无 | `new DatabaseError("msg", err)` | `statusCode=500, originalError=err` |
| UT-ERR-005 | 创建 AiServiceError | 无 | `new AiServiceError("msg", err, "DeepSeek")` | `statusCode=500, serviceName="DeepSeek"` |

---

## 三、后端服务层

### 3.1 authService.ts — 认证服务

#### 函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `buildDefaultEmail(username, now?, randomSuffix?)` | `username: string, now: () => Date, randomSuffix: () => string` | `string` | 无 |
| `register(input)` | `input: { username, password, role?, isAdmin? }` | `Promise<void>` | 数据库写入、密码哈希 |
| `login(input)` | `input: { username, password }` | `Promise<LoginResult>` | 数据库查询、密码比对、JWT签发、更新登录时间 |
| `getMe(userId)` | `userId: number` | `Promise<PublicUser>` | 数据库查询 |
| `deleteMe(userId)` | `userId: number` | `Promise<{ deleted, username }>` | 数据库删除 |

---

#### 3.1.1 buildDefaultEmail — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-AS-001 | 正常用户名 | 固定 now 和 randomSuffix | `username="testuser"` | 以 `testuser_` 开头，以 `@temp.user` 结尾 |
| UT-AS-002 | 含特殊字符用户名 | 固定 now, randomSuffix | `username="用户@name!"` | 特殊字符被移除，只保留 `a-z0-9_` |
| UT-AS-003 | 超长用户名 | 固定 now, randomSuffix | `username="a".repeat(50)` | 截断到12字符 `"aaaaaaaaaaaa_..."` |
| UT-AS-004 | 纯特殊字符用户名 | 固定 now, randomSuffix | `username="!@#$%^"` | 前缀为 `"user"`（默认值） |

#### 3.1.2 register — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-AS-005 | 正常注册 | 用户名不存在 | `{ username: "newuser", password: "P@ss123" }` | 成功，无返回值 |
| UT-AS-006 | 用户名已存在 | 用户名已存在 | `{ username: "exist", password: "123" }` | 抛出 `BusinessError("用户名已存在")` |
| UT-AS-007 | 空用户名 | 无 | `{ username: "", password: "123" }` | 抛出 `BusinessError("请提供用户名和密码")` |
| UT-AS-008 | 空密码 | 无 | `{ username: "user", password: "" }` | 抛出 `BusinessError("请提供用户名和密码")` |
| UT-AS-009 | 尝试管理员注册 | 无 | `{ username: "admin", password: "123", role: "admin" }` | 抛出 `HttpException(403, "管理员账号只能通过后台脚本创建")` |
| UT-AS-010 | 尝试设置 isAdmin | 无 | `{ username: "user", password: "123", isAdmin: true }` | 抛出 `HttpException(403)` |

#### 3.1.3 login — 输入输出验证

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-AS-011 | 正常登录 | 用户已注册 | `{ username: "user", password: "P@ss123" }` | 返回 `{ token, user }` |
| UT-AS-012 | 密码错误 | 用户已注册 | `{ username: "user", password: "wrong" }` | 抛出 `BusinessError("用户名或密码错误，请重试")` |
| UT-AS-013 | 用户不存在 | 无 | `{ username: "nouser", password: "123" }` | 抛出 `BusinessError("用户名或密码错误，请重试")`（不泄露用户存在性） |
| UT-AS-014 | 空用户名 | 无 | `{ username: "", password: "123" }` | 抛出 `BusinessError("请提供用户名和密码")` |

#### 3.1.4 getMe / deleteMe

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-AS-015 | getMe 存在用户 | 用户 id=1 存在 | `userId=1` | 返回 PublicUser 对象 |
| UT-AS-016 | getMe 不存在用户 | 用户 id=999 不存在 | `userId=999` | 抛出 `BusinessError("用户不存在")` |
| UT-AS-017 | deleteMe 存在用户 | 用户 id=1 存在 | `userId=1` | `{ deleted: true, username: "xxx" }` |
| UT-AS-018 | deleteMe 不存在用户 | 用户 id=999 不存在 | `userId=999` | `{ deleted: false, username: null }` |

---

### 3.2 moodService.ts — 情绪服务

#### 函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `buildAnalysisRecommendations(negativeRatio, trendDirection, consecutiveLowDays)` | `negativeRatio: number, trendDirection: 'improving'\|'declining'\|'stable', consecutiveLowDays: number` | `string[]` | 无 |
| `recordMood(input)` | `input: { userId, note, trigger, recordedAt, emotions, tagIds }` | `Promise<number>` | 数据库写入、加密 |
| `listMoods(userId, options)` | `userId: number, options: { page, limit, emotionTypeId? }` | `Promise<{ list, total, page, limit }>` | 数据库查询、解密 |
| `updateMood(input)` | `input: { id, userId, note, trigger, recordedAt, emotions, tagIds }` | `Promise<boolean>` | 数据库更新 |
| `deleteMood(userId, moodId)` | `userId: number, moodId: number` | `Promise<boolean>` | 数据库删除 |
| `getMoodTrend(userId, range)` | `userId: number, range: 'week'\|'month'\|'quarter'` | `Promise<MoodTrendData>` | 数据库查询 |
| `getWeeklyReport(userId)` | `userId: number` | `Promise<WeeklyReport>` | 数据库查询 |
| `getPeriodComparison(userId, period)` | `userId: number, period: 'week'\|'month'` | `Promise<PeriodComparison>` | 数据库查询 |
| `getMoodAnalysis(userId, range)` | `userId: number, range: 'week'\|'month'\|'quarter'` | `Promise<MoodAnalysis>` | 数据库查询 |
| `getMoodInsight(userId, period)` | `userId: number, period: 'day'\|'week'\|'month'\|'year'` | `Promise<MoodInsight>` | 数据库查询 |

---

#### 3.2.1 buildAnalysisRecommendations — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-MS-001 | 全正常 | 无 | `negativeRatio=0.2, trendDirection="stable", consecutiveLowDays=0` | 仅默认建议（1条） |
| UT-MS-002 | 高负向比 | 无 | `negativeRatio=0.7, trendDirection="stable", consecutiveLowDays=0` | 2条建议（默认+负向占比） |
| UT-MS-003 | 下降趋势 | 无 | `negativeRatio=0.3, trendDirection="declining", consecutiveLowDays=0` | 2条建议 |
| UT-MS-004 | 连续低天数 | 无 | `negativeRatio=0.3, trendDirection="stable", consecutiveLowDays=5` | 2条建议 |
| UT-MS-005 | 全部触发 | 无 | `negativeRatio=0.8, trendDirection="declining", consecutiveLowDays=5` | 4条建议（全部） |

#### 3.2.2 buildAnalysisRecommendations — 边界值分析

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-MS-006 | negativeRatio=0.6 边界 | 无 | `negativeRatio=0.6, trendDirection="stable", consecutiveLowDays=0` | 2条建议（>=0.6触发） |
| UT-MS-007 | negativeRatio=0.59 边界 | 无 | `negativeRatio=0.59, trendDirection="stable", consecutiveLowDays=0` | 1条建议（<0.6不触发） |
| UT-MS-008 | consecutiveLowDays=3 边界 | 无 | `negativeRatio=0.3, trendDirection="stable", consecutiveLowDays=3` | 2条建议（>=3触发） |
| UT-MS-009 | consecutiveLowDays=2 边界 | 无 | `negativeRatio=0.3, trendDirection="stable", consecutiveLowDays=2` | 1条建议（<3不触发） |

#### 3.2.3 recordMood — 输入输出验证

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-MS-010 | 正常记录情绪 | 用户存在，情绪类型存在 | `{ userId: 1, note: "今天很开心", trigger: "", recordedAt: new Date(), emotions: [{emotionTypeId:1, intensity:7, isPrimary:true}], tagIds: [] }` | 返回 moodId（数字） |
| UT-MS-011 | 多情绪记录 | 同上 | emotions 含2个情绪 | 返回 moodId |
| UT-MS-012 | 带标签记录 | 标签已存在 | tagIds=[1,2] | 返回 moodId |

---

## 四、后端中间件

### 4.1 auth.ts — 认证中间件

#### 函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `isValidUserRole(role)` | `role: unknown` | `boolean`（类型守卫） | 无 |
| `authenticate(req, res, next)` | Express 中间件 | void | 设置 req.user |
| `requireAdmin(req, res, next)` | Express 中间件 | void | 审计日志 |
| `requireRole(roles)` | `roles: string[]` → 返回中间件 | void | 审计日志 |
| `requirePermission(permission)` | `permission: string` → 返回中间件 | void | 数据库查询、审计日志 |

---

#### 4.1.1 isValidUserRole — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-AU-001 | 有效角色 student | 无 | `"student"` | `true` |
| UT-AU-002 | 有效角色 super_admin | 无 | `"super_admin"` | `true` |
| UT-AU-003 | 无效角色 | 无 | `"hacker"` | `false` |
| UT-AU-004 | 非字符串 | 无 | `123` | `false` |
| UT-AU-005 | null | 无 | `null` | `false` |
| UT-AU-006 | undefined | 无 | `undefined` | `false` |

#### 4.1.2 authenticate — 边界值分析

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-AU-007 | 无 token | 无 cookie/auth header | 请求无 token | `res.status(401)` + `apiFailure` |
| UT-AU-008 | 有效 token | 已签发有效 JWT | 正确 token | `next()` 被调用，`req.user` 已设置 |
| UT-AU-009 | 过期 token | 已签发过期 JWT | 过期 token | `res.status(401)` + `"无效或过期令牌"` |
| UT-AU-010 | 篡改 token | 正常 JWT | 被篡改 token | `res.status(401)` |
| UT-AU-011 | JWT_SECRET 未配置 | 环境变量缺失 | 有效 token | `res.status(500)` + `"服务配置错误"` |
| UT-AU-012 | 非法角色 token | 有效 JWT 但 role="hacker" | 有效 token | token 验证通过，但 role 被降级为 `"user"` |

#### 4.1.3 requireAdmin — 边界值

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-AU-013 | admin 角色 | `req.user.role="admin"` | 无 | `next()` 被调用 |
| UT-AU-014 | super_admin 角色 | `req.user.role="super_admin"` | 无 | `next()` 被调用 |
| UT-AU-015 | student 角色 | `req.user.role="student"` | 无 | `res.status(403)` |
| UT-AU-016 | 无 req.user | `req.user=undefined` | 无 | `res.status(401)` |

---

### 4.2 errorHandler.ts — 错误处理中间件

#### 4.2.1 errorHandler — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-EH-001 | AppError 400 | 无 | `new AppError("msg", 400)` | `res.status(400).json(apiFailure(1001, "msg"))` |
| UT-EH-002 | 普通 Error 500 | 无 | `new Error("db error")` | `res.status(500).json(apiFailure(1500, "db error"))` |
| UT-EH-003 | 生产环境 500 | `NODE_ENV=production` | `new Error("secret")` | `message: "服务器内部错误"`（脱敏） |
| UT-EH-004 | ValidationError | 无 | `{ name: "ValidationError", array: ()=>[] }` | `res.status(400).json(apiFailure(1001, "请求参数验证失败"))` |

---

## 五、前端工具函数

### 5.1 request.ts — HTTP 请求模块

#### 函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `unwrapResponse(payload)` | `payload: unknown` | `T`（data 字段） | 可能抛出 ApiRequestError |
| `handleUnauthorized()` | 无 | `boolean` | localStorage 清除、路由跳转 |
| `startLoading()` | 无 | void | loadingCount++、显示 loading |
| `endLoading()` | 无 | void | loadingCount--、隐藏 loading |

---

#### 5.1.1 unwrapResponse — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-REQ-001 | 成功响应 | 无 | `{ code: 0, data: { id: 1 }, message: "ok" }` | 返回 `{ id: 1 }` |
| UT-REQ-002 | 业务错误 | 无 | `{ code: 1001, message: "参数错误" }` | 抛出 `ApiRequestError(kind="business", code=1001)` |
| UT-REQ-003 | 缺少 code 字段 | 无 | `{ data: {} }` | 抛出 `ApiRequestError("响应缺少业务状态码")` |
| UT-REQ-004 | 非对象 payload | 无 | `"string"` | 抛出 `ApiRequestError("响应缺少业务状态码")` |
| UT-REQ-005 | null payload | 无 | `null` | 抛出 `ApiRequestError("响应缺少业务状态码")` |
| UT-REQ-006 | code 为非数字 | 无 | `{ code: "0", data: {} }` | `code === 0` → `"0" === 0` → `false` → 抛出业务错误 |

#### 5.1.2 handleUnauthorized — 边界值

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-REQ-007 | 首次 401 | 不在 login 页 | 无 | 清除 token，跳转 login，返回 `true` |
| UT-REQ-008 | 重复 401 | `unauthorizedRedirectPending=true` | 无 | 返回 `false`（防重复跳转） |
| UT-REQ-009 | 已在 login 页 | 当前路由 `/login` | 无 | 返回 `true`，不跳转 |

---

### 5.2 guards.ts — 路由守卫

#### 函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `normalizeRole(role)` | `role: string \| undefined` | `UserRole` | 无 |
| `requirePermission(userStore, permission?)` | 用户状态，权限码 | `boolean` | 无 |
| `shouldRedirectToGuide(to, from)` | 路由对象 | `boolean` | 读取 localStorage |
| `getRouteRedirect(to, userStore)` | 路由对象，用户状态 | `string \| null` | 无 |

---

#### 5.2.1 normalizeRole — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-GD-001 | admin 角色 | 无 | `"admin"` | `"admin"` |
| UT-GD-002 | super_admin 角色 | 无 | `"super_admin"` | `"super_admin"` |
| UT-GD-003 | 其他角色 | 无 | `"student"` | `"user"` |
| UT-GD-004 | undefined | 无 | `undefined` | `"user"` |

#### 5.2.2 requirePermission — 边界值

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-GD-005 | 无权限要求 | 无 | `permission=undefined` | `true` |
| UT-GD-006 | 未登录 | `isLoggedIn=false` | `permission="user.manage"` | `false` |
| UT-GD-007 | super_admin 有权限 | `role="super_admin", isLoggedIn=true` | `permission="user.manage"` | `true` |
| UT-GD-008 | user 无权限 | `role="user", isLoggedIn=true` | `permission="user.manage"` | `false`（user 无任何权限） |

#### 5.2.3 getRouteRedirect — 边界值

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-GD-009 | 公开页面+未登录 | `to.meta.public=true, isLoggedIn=false` | 无 | `null`（不拦截） |
| UT-GD-010 | 非公开页面+未登录 | `to.meta.public=false, isLoggedIn=false` | 无 | `"/login"` |
| UT-GD-011 | 游客页面+已登录 | `to.meta.guestOnly=true, isLoggedIn=true` | 无 | `"/"` |
| UT-GD-012 | admin 页面+非 admin | `to.meta.adminOnly=true, isAdmin=false` | 无 | `"/"` |

---

## 六、前端状态管理

### 6.1 userStore.ts — 用户状态

#### 关键函数签名

| 函数 | 输入参数 | 返回值 | 副作用 |
|------|---------|--------|--------|
| `login(username, password)` | `string, string` | `Promise<boolean>` | API 调用、token 写入 localStorage、user 状态更新 |
| `register(username, password, confirmPassword)` | `string, string, string` | `Promise<boolean>` | API 调用 |
| `logout()` | 无 | void | localStorage 清除、user 清空、跳转 login |
| `fetchUserInfo()` | 无 | `Promise<boolean>` | API 调用 (/api/auth/me) |
| `trySessionRestore()` | 无 | `Promise<boolean>` | API 调用、token 恢复 |

---

#### 6.1.1 register — 等价类划分

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-US-001 | 密码不匹配 | 无 | `password="123", confirmPassword="456"` | 返回 `false`，显示错误消息 |
| UT-US-002 | 正常注册 | 用户名可用 | `username="new", password="P@ss123", confirmPassword="P@ss123"` | 返回 `true` |
| UT-US-003 | 空用户名 | 无 | `username=""` | 返回 `false` |

#### 6.1.2 trySessionRestore — 边界值

| 用例ID | 测试目标 | 前置条件 | 输入数据 | 预期输出 |
|--------|---------|---------|---------|---------|
| UT-US-004 | 有 token | localStorage 有 token | 无 | API 调用成功，`user.value` 已设置 |
| UT-US-005 | 无 token | localStorage 无 token | 无 | 返回 `false`，`authInitialized=true` |
| UT-US-006 | API 失败 | token 过期 | 无 | `catch` 返回 `false`，`authInitialized=true` |

---

## 七、潜在缺陷与风险清单

### 7.1 高风险

| ID | 位置 | 缺陷描述 | 影响 |
|----|------|---------|------|
| BUG-001 | [password.ts:L59-L67](file:///d:/桌面/ccooddee/mood_health_server/src/utils/password.ts#L59-L67) | `generateRandomPassword` 使用 `Math.random()` 而非 `crypto.randomBytes()`，生成密码可预测 | 安全风险 |
| BUG-002 | [password.ts:L59-L67](file:///d:/桌面/ccooddee/mood_health_server/src/utils/password.ts#L59-L67) | `generateRandomPassword` 当 `length <= 0` 时返回空字符串，未校验参数合法性 | 空密码绕过 |
| BUG-003 | [scoringEngine.ts:L44-L49](file:///d:/桌面/ccooddee/mood_health_server/src/utils/scoringEngine.ts#L44-L49) | `calculateScore` 不校验 `answer.score` 范围，负值或超大值直接参与计算 | 错误计分 |
| BUG-004 | [scoringEngine.ts:L44-L49](file:///d:/桌面/ccooddee/mood_health_server/src/utils/scoringEngine.ts#L44-L49) | 反向计分时 `rule.max_score - answer.score` 可能产生负数（如 score > max_score） | 负分输出 |
| BUG-005 | [contentFilter.ts:L102-L110](file:///d:/桌面/ccooddee/mood_health_server/src/utils/contentFilter.ts#L102-L110) | `filterContent` 使用 `includes` 进行子串匹配，效率为 O(n*m)，且对大文本无长度限制 | 性能问题、DoS风险 |
| BUG-006 | [apiResponse.ts:L29](file:///d:/桌面/ccooddee/mood_health_server/src/utils/apiResponse.ts#L29) | `apiFailure` 的 `code` 参数类型为 `number`，但调用方可能传入非数字值 | 类型不安全 |

### 7.2 中风险

| ID | 位置 | 缺陷描述 | 影响 |
|----|------|---------|------|
| BUG-007 | [password.ts:L80-L95](file:///d:/桌面/ccooddee/mood_health_server/src/utils/password.ts#L80-L95) | `getPasswordStrength` 对长度<8的密码，即使含多种字符类型也只能得0分（长度检查在前），但长度得分占比大 | 评分偏差 |
| BUG-008 | [password.ts:L43-L48](file:///d:/桌面/ccooddee/mood_health_server/src/utils/password.ts#L43-L48) | `comparePassword` 在异常时返回 `false`，无法区分"密码不匹配"和"bcrypt 内部错误" | 日志缺失 |
| BUG-009 | [encryption.ts:L53-L80](file:///d:/桌面/ccooddee/mood_health_server/src/utils/encryption.ts#L53-L80) | `decrypt` 在解析失败时静默返回原始数据，可能掩盖真正的数据损坏问题 | 数据静默丢失 |
| BUG-010 | [request.ts:L37-L38](file:///d:/桌面/ccooddee/src/utils/request.ts#L37-L38) | `loadingCount` 是模块级变量，多个组件同时请求时共享状态，可能导致 loading 提前关闭或永不关闭 | UI 显示异常 |
| BUG-011 | [request.ts:L67-L86](file:///d:/桌面/ccooddee/src/utils/request.ts#L67-L86) | `unwrapResponse` 中 `payload.code === 0` 使用严格相等，后端返回 `code: "0"`（字符串）会被误判为失败 | 响应解析错误 |
| BUG-012 | [guards.ts:L37-L42](file:///d:/桌面/ccooddee/src/router/guards.ts#L37-L42) | `normalizeRole` 对非 admin/super_admin 角色统一返回 `"user"`，与后端 `getRoleFromToken` 中 `isValidUserRole` 行为不一致（后端支持 `student/counselor`） | 权限判断不一致 |
| BUG-013 | [auth.ts:L240-L247](file:///d:/桌面/ccooddee/mood_health_server/src/middleware/auth.ts#L240-L247) | `getRoleFromToken` 对非法角色回退为 `"user"`，但 `"user"` 不在 `isValidUserRole` 的 key 中（key 为 `student|counselor|super_admin|user|admin`，`"user"` 是有效的） | 实际无问题，但角色语义不清晰 |

### 7.3 低风险

| ID | 位置 | 缺陷描述 | 影响 |
|----|------|---------|------|
| BUG-014 | [password.ts:L90](file:///d:/桌面/ccooddee/mood_health_server/src/utils/password.ts#L90) | `getPasswordStrength` 特殊字符正则 `[!@#$%^&*(),.?":{}|<>]` 不包含下划线 `_`、反引号 `` ` ``、方括号 `[]` 等常见特殊字符 | 评分不完整 |
| BUG-015 | [contentFilter.ts:L1-L53](file:///d:/桌面/ccooddee/mood_health_server/src/utils/contentFilter.ts#L1-L53) | 敏感词列表中有重复词（如"赌博"出现2次、"诈骗"出现2次、"勒索"出现2次） | 重复匹配 |
| BUG-016 | [scoringEngine.ts:L62-L78](file:///d:/桌面/ccooddee/mood_health_server/src/utils/scoringEngine.ts#L62-L78) | `findRiskLevel` 当多个等级范围重叠时，只返回第一个匹配的等级 | 可能误判风险等级 |
| BUG-017 | [auth.ts:L253-L296](file:///d:/桌面/ccooddee/mood_health_server/src/middleware/auth.ts#L253-L296) | `authenticate` 中 cookie 优先于 header，但没有对 cookie 做签名验证，仅依赖 JWT 自身校验 | 依赖 JWT 安全性即可 |
| BUG-018 | [moodService.ts:L133-L153](file:///d:/桌面/ccooddee/mood_health_server/src/services/moodService.ts#L133-L153) | `buildAnalysisRecommendations` 的 `trendDirection` 参数类型为字符串字面量联合，但调用方可能传入其他值 | TypeScript 编译时检查，运行时无额外校验 |

---

## 八、总结

### 8.1 测试覆盖建议

| 模块 | 现有测试 | 需补充测试用例数 |
|------|---------|----------------|
| password.ts | 部分 | 14 |
| encryption.ts | 部分 | 12 |
| contentFilter.ts | 部分 | 8 |
| scoringEngine.ts | 无 | 10 |
| apiResponse.ts | 部分 | 8 |
| errors.ts | 无 | 5 |
| authService.ts | 部分 | 12 |
| moodService.ts | 部分 | 10 |
| auth middleware | 部分 | 12 |
| errorHandler | 部分 | 4 |
| request.ts (前端) | 部分 | 8 |
| guards.ts (前端) | 无 | 10 |
| userStore.ts (前端) | 部分 | 6 |

### 8.2 修复优先级

| 优先级 | 缺陷编号 | 说明 |
|--------|---------|------|
| P0 | BUG-001, BUG-002 | 密码安全性问题 |
| P0 | BUG-003, BUG-004 | 计分引擎无输入校验 |
| P1 | BUG-005, BUG-006 | 性能与类型安全 |
| P1 | BUG-007, BUG-008 | 密码强度评分偏差 |
| P2 | BUG-009 ~ BUG-018 | 低风险改进项 |