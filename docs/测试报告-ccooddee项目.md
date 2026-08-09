# 测试报告 - ccooddee 项目

**生成日期**：2026-07-18  
**分析范围**：`d:\桌面\ccooddee\` 全部代码文件  
**分析方法**：静态代码分析（未执行实际测试）  
**分析工具**：人工审查 + 自动化搜索

---

## 一、项目概述

### 1.1 项目类型与定位

本系统是一个 **B2B 校园心理健康全栈平台**，面向学校师生提供情绪记录、心理测评、AI 咨询、放松疗愈、团体活动等功能。

### 1.2 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Vue 3 + TypeScript | ^3.5.25 |
| 构建工具 | Vite | ^5.2.0 |
| UI 组件库 | Element Plus | ^2.13.3 |
| 状态管理 | Pinia | ^2.3.1 |
| 路由 | Vue Router | ^4.6.3 |
| 图表 | ECharts | ^5.4.3 |
| 后端框架 | Express.js + TypeScript | ^5.2.1 |
| 数据库 | MySQL (mysql2) | ^3.23.0 |
| 缓存 | Redis (ioredis) | ^5.10.0 |
| 认证 | JWT (jsonwebtoken) | ^9.0.3 |
| 密码加密 | bcryptjs | ^3.0.3 |
| 数据加密 | AES-256-GCM (crypto) | 内置 |
| 日志 | Winston + DailyRotateFile | ^3.19.0 |
| 前端测试 | Vitest + happy-dom | ^2.0.0 |
| 后端测试 | Jest + ts-jest | ^30.2.0 |
| E2E 测试 | Playwright | ^1.61.1 |
| AI 服务 | DeepSeek API (OpenAI 兼容) | - |

### 1.3 项目结构

```
ccooddee/
├── src/                          # 前端 Vue 3 源码
│   ├── api/                      # 前端 API 调用层（20个模块）
│   ├── views/                    # 页面组件（auth/mood/relax/improve/admin/user/counseling）
│   ├── components/               # 复用组件（counseling/mood/relax/shared/treehole）
│   ├── stores/                   # Pinia 状态管理（user/mood/relax/achievement）
│   ├── router/                   # 路由配置 + 导航守卫
│   ├── composables/              # 组合式函数
│   ├── utils/                    # 前端工具函数
│   ├── config/                   # 前端配置（featureFlags）
│   ├── __tests__/                # 前端单元测试（44个测试文件）
│   └── assets/                   # 样式与图片资源
├── mood_health_server/           # 后端 Express 源码
│   ├── src/
│   │   ├── controllers/          # 控制器（22个文件）
│   │   ├── services/             # 业务服务层（13个文件）
│   │   ├── repositories/         # 数据访问层（14个文件）
│   │   ├── routes/               # 路由定义（17个文件）
│   │   ├── middleware/           # 中间件（auth/errorHandler/validateRequest）
│   │   ├── utils/                # 工具函数（ai/加密/缓存/日志/密码/计分）
│   │   ├── config/               # 配置（MySQL/AI）
│   │   ├── db/                   # 数据库迁移（31个迁移文件）+ 种子数据
│   │   └── types/                # 类型定义
│   └── tests/                    # 后端单元测试（44个测试文件）
├── tests/e2e/                    # E2E 测试（Playwright）
├── scripts/                      # 运维脚本
├── docker/                       # Docker 配置
├── docs/                         # 技术文档
└── tasks/                        # 任务管理文档
```

### 1.4 核心模块与对外接口

| 模块 | 路由前缀 | 功能描述 |
|------|----------|----------|
| 认证 | `/api/auth` | 注册、登录、登出、获取当前用户、注销账号 |
| 情绪 | `/api/moods` | 记录、列表、更新、删除、趋势、周报、分析、洞察、对比、提醒 |
| 问卷 | `/api/questionnaires` | 问卷列表、答题、结果、历史 |
| AI | `/api/ai` | 心理咨询、量表解读、情绪报告、历史记录、树洞回复 |
| 管理 | `/api` (混合) | 用户管理、角色管理、KPI、趋势、分布、模块使用 |
| 活动 | `/api/activities` | CRUD、报名、取消、提醒、反馈 |
| 树洞 | `/api/posts` | 发帖、评论、列表 |
| 音乐 | `/api/music` | 音乐列表 |
| 课程 | `/api/courses` | 课程列表 |
| 放松 | `/api/relax` | 放松记录 |
| 成就 | `/api/achievements` | 成就查看 |
| 推荐 | `/api/recommend` | 内容推荐 |
| 反馈 | `/api` (feedback) | 活动反馈 |
| 审计 | `/api/audit` | 审计日志 |
| 案例 | `/api/cases` | 案例管理 |
| 提示词 | `/api/prompts` | Prompt 模板管理 |

---

## 二、分层测试用例设计

### 2.1 单元测试

#### 2.1.1 认证模块 (authService)

##### TC-UT-AUTH-001：密码哈希与验证
- **测试目标**：验证 bcrypt 密码哈希与比对功能正确性
- **前置条件**：无
- **测试步骤**：
  1. 调用 `hashPassword('TestPass123')` 生成哈希
  2. 调用 `comparePassword('TestPass123', hash)` 比对正确密码
  3. 调用 `comparePassword('WrongPass', hash)` 比对错误密码
- **预期结果**：
  - 哈希值为非空字符串，长度 > 0
  - 正确密码比对返回 `true`
  - 错误密码比对返回 `false`

##### TC-UT-AUTH-002：密码强度检测
- **测试目标**：验证 `getPasswordStrength` 函数分类正确
- **前置条件**：无
- **测试步骤**：
  1. 输入 `"123"` → 检测强度
  2. 输入 `"abc12345"` → 检测强度
  3. 输入 `"Abc@12345xyz"` → 检测强度
- **预期结果**：
  - 返回 `"weak"` / `"medium"` / `"strong"` 依次对应

##### TC-UT-AUTH-003：注册 - 用户名/密码为空
- **测试目标**：`authService.register` 对空输入的处理
- **前置条件**：模拟 repository
- **测试步骤**：
  1. 调用 `register({ username: '', password: '' })`
  2. 调用 `register({ username: 'test', password: '' })`
  3. 调用 `register({})`
- **预期结果**：均抛出 `BusinessError` 异常，消息为 `"请提供用户名和密码"`

##### TC-UT-AUTH-004：注册 - 管理员角色禁止
- **测试目标**：前端注册不允许指定管理员角色
- **前置条件**：模拟 repository
- **测试步骤**：
  1. 调用 `register({ username: 'admin', password: 'pass123', role: 'admin' })`
  2. 调用 `register({ username: 'admin', password: 'pass123', isAdmin: true })`
- **预期结果**：均抛出 `HttpException`，状态码 403

##### TC-UT-AUTH-005：登录 - 用户不存在
- **测试目标**：`authService.login` 对不存在用户的处理
- **前置条件**：模拟 repository 返回 `null`
- **测试步骤**：调用 `login({ username: 'nobody', password: 'pass' })`
- **预期结果**：抛出 `HttpException`，状态码 401，消息包含"用户名或密码错误"

##### TC-UT-AUTH-006：JWT Token 生成
- **测试目标**：验证 JWT 签名正确性
- **前置条件**：设置 JWT_SECRET 环境变量
- **测试步骤**：
  1. 模拟登录成功获取 token
  2. 使用 `jwt.verify(token, secret)` 验证
- **预期结果**：解码后的 payload 包含 `userId`、`username`、`role` 字段，`exp` 在 7 天后

##### TC-UT-AUTH-007：email 默认生成逻辑
- **测试目标**：`buildDefaultEmail` 函数边界情况
- **前置条件**：无
- **测试步骤**：
  1. 输入 `"test_user"` → 生成 email
  2. 输入 `"!!invalid!!"` → 生成 email
  3. 输入 `""` → 生成 email
- **预期结果**：
  - 正常输入生成 `test_user_{timestamp}{random}@temp.user`
  - 特殊字符被过滤，回退为 `user_{timestamp}{random}@temp.user`
  - 空字符串回退为 `user_{timestamp}{random}@temp.user`

#### 2.1.2 情绪模块 (moodService)

##### TC-UT-MOOD-001：情绪记录 - 强度边界值
- **测试目标**：`normalizeEmotions` 对强度范围的校验
- **前置条件**：无
- **测试步骤**：
  1. 输入 `[{ emotionTypeId: 1, intensity: 0 }]`
  2. 输入 `[{ emotionTypeId: 1, intensity: 1 }]`
  3. 输入 `[{ emotionTypeId: 1, intensity: 10 }]`
  4. 输入 `[{ emotionTypeId: 1, intensity: 11 }]`
- **预期结果**：
  - intensity=0 抛出 `BusinessError`（强度必须在 1-10 之间）
  - intensity=1 通过
  - intensity=10 通过
  - intensity=11 抛出 `BusinessError`

##### TC-UT-MOOD-002：情绪记录 - 主情绪数量限制
- **测试目标**：一条记录最多只能有一个主情绪
- **前置条件**：无
- **测试步骤**：
  1. 输入两个 `isPrimary: true` 的情绪
  2. 输入一个默认（index=0 自动为主情绪）和一个 `isPrimary: true`
- **预期结果**：均抛出 `BusinessError`（"一条情绪记录最多只能有一个主要情绪"）

##### TC-UT-MOOD-003：情绪记录 - 空情绪列表
- **测试目标**：空情绪列表的处理
- **前置条件**：无
- **测试步骤**：调用 `normalizeEmotions([])`
- **预期结果**：抛出 `BusinessError`（"至少需要选择一种情绪"）

##### TC-UT-MOOD-004：周报 - 无记录
- **测试目标**：`getWeeklyReport` 无记录时的默认返回
- **前置条件**：模拟 repository 返回空数组
- **测试步骤**：调用 `moodService.getWeeklyReport(userId)`
- **预期结果**：返回 `{ averageIntensity: 0, dailyData: [], mostFrequentMood: '', summary: "本周暂无情绪记录。" }`

##### TC-UT-MOOD-005：趋势 - 日期范围计算
- **测试目标**：`resolveTrendStartDate` 对不同范围的计算
- **前置条件**：固定当前日期为 2026-07-18
- **测试步骤**：
  1. range='week' → 计算开始日期
  2. range='month' → 计算开始日期
  3. range='quarter' → 计算开始日期
- **预期结果**：
  - week: 2026-07-11
  - month: 2026-06-18
  - quarter: 2026-04-19

##### TC-UT-MOOD-006：周期对比 - 无记录
- **测试目标**：`getPeriodComparison` 在两个周期均无记录时的处理
- **前置条件**：模拟 repository 返回空数组
- **测试步骤**：调用 `moodService.getPeriodComparison(userId, 'week')`
- **预期结果**：`changeDescription` 为"两个周期均无记录，开始记录后可查看趋势对比。"

##### TC-UT-MOOD-007：情绪分析 - 趋势方向判断
- **测试目标**：`getMoodAnalysis` 的趋势方向计算
- **前置条件**：模拟 repository 返回至少 3 天数据
- **测试步骤**：
  1. 模拟后半段平均强度明显高于前半段
  2. 模拟后半段平均强度明显低于前半段
  3. 模拟两段差异小于 0.5
- **预期结果**：分别返回 `'improving'`、`'declining'`、`'stable'`

##### TC-UT-MOOD-008：洞察 - 周期范围计算
- **测试目标**：`resolvePeriodRange` 各周期范围
- **前置条件**：固定当前日期为 2026-07-18
- **测试步骤**：分别测试 day/week/month/year
- **预期结果**：
  - day: 开始=2026-07-18, 结束=2026-07-18
  - week: 开始=2026-07-11, 结束=2026-07-18
  - month: 开始=2026-06-18, 结束=2026-07-18
  - year: 开始=2025-07-18, 结束=2026-07-18

#### 2.1.3 计分引擎 (scoringEngine)

##### TC-UT-SCORE-001：正向计分
- **测试目标**：`calculateScore` 基础正向计分
- **前置条件**：无
- **测试步骤**：输入 `[{itemId:1, score:3}, {itemId:2, score:4}]`，rule=`{type:'sum', min_score:0, max_score:5}`
- **预期结果**：总分=7

##### TC-UT-SCORE-002：反向计分
- **测试目标**：反向题目计分
- **前置条件**：无
- **测试步骤**：输入 `[{itemId:1, score:1}]`，rule=`{type:'sum', min_score:0, max_score:4, reverse_items:[1]}`
- **预期结果**：总分=3（4-1=3）

##### TC-UT-SCORE-003：风险分层查找
- **测试目标**：`findRiskLevel` 根据总分匹配风险等级
- **前置条件**：定义 stratification 含 3 个等级
- **测试步骤**：
  1. 总分 5 → 查找
  2. 总分 15 → 查找
  3. 总分 25 → 查找
- **预期结果**：分别匹配低/中/高风险等级

##### TC-UT-SCORE-004：未知风险等级
- **测试目标**：总分不在任何范围时的兜底
- **前置条件**：定义 stratification 范围 0-30
- **测试步骤**：输入总分 100
- **预期结果**：返回 `{ riskLevel: '未知', riskColor: 'gray', suggestion: '' }`

#### 2.1.4 加密模块 (encryption)

##### TC-UT-ENCRYPT-001：加密解密往返
- **测试目标**：AES-256-GCM 加密后解密的一致性
- **前置条件**：ENCRYPTION_KEY 环境变量已设置
- **测试步骤**：
  1. `encrypt("Hello World")` 获得密文
  2. `decrypt(密文)` 获得明文
- **预期结果**：解密后 = "Hello World"

##### TC-UT-ENCRYPT-002：空值/非加密文本处理
- **测试目标**：`decrypt` 对空值和非加密文本的容错
- **前置条件**：ENCRYPTION_KEY 已设置
- **测试步骤**：
  1. `decrypt("")` 
  2. `decrypt("plain text")`
  3. `encryptField(null)`
  4. `decryptField(null)`
- **预期结果**：
  - 解密空字符串返回空字符串
  - 非 JSON 格式的文本原样返回
  - encryptField(null) 返回 null
  - decryptField(null) 返回 null

#### 2.1.5 API 响应格式 (apiResponse)

##### TC-UT-API-001：成功响应格式
- **测试目标**：`apiSuccess` 的返回格式
- **前置条件**：无
- **测试步骤**：调用 `apiSuccess({ id: 1 }, '自定义消息')`
- **预期结果**：`{ code: 0, message: '自定义消息', data: { id: 1 } }`

##### TC-UT-API-002：失败响应 - 禁止 code=0
- **测试目标**：`apiFailure(0, ...)` 应抛出错误
- **前置条件**：无
- **测试步骤**：调用 `apiFailure(0, '错误')`
- **预期结果**：抛出 `Error`（"失败响应必须使用非零业务码"）

##### TC-UT-API-003：HTTP 状态码映射
- **测试目标**：`businessCodeForHttpStatus` 的映射表
- **前置条件**：无
- **测试步骤**：分别测试 400/401/403/404/409/500/503/502
- **预期结果**：分别返回 1001/1002/1003/1004/1009/1500/1503/1500

#### 2.1.6 内容过滤 (contentFilter)

##### TC-UT-CF-001：安全内容
- **测试目标**：`filterContent` 对安全文本的判断
- **前置条件**：无
- **测试步骤**：输入 `"今天天气真好，心情很愉快"`
- **预期结果**：`{ isSafe: true, detectedWords: [], severity: 'low' }`

##### TC-UT-CF-002：单个敏感词
- **测试目标**：检测单个敏感词
- **前置条件**：无
- **测试步骤**：输入 `"这个内容涉及暴力元素"`
- **预期结果**：`{ isSafe: false, detectedWords: ['暴力'], severity: 'low' }`

##### TC-UT-CF-003：多个敏感词
- **测试目标**：检测多个敏感词的严重等级
- **前置条件**：无
- **测试步骤**：输入 `"包含暴力、毒品、诈骗的内容"`
- **预期结果**：`{ isSafe: false, severity: 'high' }`

#### 2.1.7 AI 安全服务 (aiSafetyService)

##### TC-UT-AISAFE-001：高风险内容检测
- **测试目标**：`detectHighRisk` 识别自杀/自残关键词
- **前置条件**：无
- **测试步骤**：
  1. `detectHighRisk("我想自杀")`
  2. `detectHighRisk("今天心情很好")`
  3. `detectHighRisk("")`
- **预期结果**：
  - 返回 `true`
  - 返回 `false`
  - 返回 `false`

##### TC-UT-AISAFE-002：输出字段完整性校验
- **测试目标**：`validateOutput` 对 JSON 输出的校验
- **前置条件**：无
- **测试步骤**：
  1. 输入 `{ summary: 'a', possibleCauses: 'b', todayActions: ['c'], whenToSeekHelp: 'd' }`
  2. 输入 `{ summary: '', possibleCauses: 'b', todayActions: ['c'], whenToSeekHelp: 'd' }`
  3. 输入 `{ summary: 'a', possibleCauses: 'b', todayActions: [], whenToSeekHelp: 'd' }`
- **预期结果**：
  - 返回 `true`
  - 返回 `false`（summary 为空）
  - 返回 `false`（todayActions 为空数组）

##### TC-UT-AISAFE-003：输出脱敏
- **测试目标**：`sanitizeOutput` 对手机号和身份证号的脱敏
- **前置条件**：无
- **测试步骤**：输入 `{ content: "手机号13812345678，身份证110101199001011234"}`
- **预期结果**：输出中手机号和身份证号被替换为 `[手机号]` 和 `[身份证号]`

#### 2.1.8 前端请求工具 (request.ts)

##### TC-UT-REQ-001：响应解包 - 成功码
- **测试目标**：`unwrapResponse` 对 code=0 的处理
- **前置条件**：无
- **测试步骤**：输入 `{ code: 0, data: { name: 'test' }, message: 'ok' }`
- **预期结果**：返回 `{ name: 'test' }`

##### TC-UT-REQ-002：响应解包 - 业务错误
- **测试目标**：`unwrapResponse` 对非零 code 的处理
- **前置条件**：无
- **测试步骤**：输入 `{ code: 1001, message: '参数错误', data: null }`
- **预期结果**：抛出 `ApiRequestError`，kind='business'

##### TC-UT-REQ-003：响应解包 - 缺少 code 字段
- **测试目标**：非标准响应的处理
- **前置条件**：无
- **测试步骤**：输入 `{ data: 'raw' }`
- **预期结果**：抛出 `ApiRequestError`（"响应缺少业务状态码"）

#### 2.1.9 前端路由守卫 (guards.ts)

##### TC-UT-GUARD-001：未登录访问受保护页面
- **测试目标**：`getRouteRedirect` 对未登录用户的处理
- **前置条件**：userStore.isLoggedIn = false
- **测试步骤**：模拟路由 `to.meta.public = undefined`
- **预期结果**：返回 `/login`

##### TC-UT-GUARD-002：已登录访问访客页面
- **测试目标**：已登录用户不应访问登录/注册页
- **前置条件**：userStore.isLoggedIn = true
- **测试步骤**：模拟路由 `to.meta.guestOnly = true`
- **预期结果**：返回 `/`

##### TC-UT-GUARD-003：角色权限检查
- **测试目标**：`requirePermission` 对不同角色的权限判断
- **前置条件**：userStore 已设置
- **测试步骤**：
  1. admin 角色检查 `'user.manage'`
  2. user 角色检查 `'user.manage'`
  3. admin 角色检查 `'system.config'`
- **预期结果**：true / false / false

##### TC-UT-GUARD-004：新手引导重定向
- **测试目标**：`shouldRedirectToGuide` 的判断逻辑
- **前置条件**：localStorage 无 guideCompleted
- **测试步骤**：模拟首次进入首页（from.matched.length === 0）
- **预期结果**：返回 true

---

### 2.2 集成测试

#### 2.2.1 认证系统集成

##### TC-INT-AUTH-001：注册 → 登录 → 获取用户信息 完整链路
- **测试目标**：验证认证全流程
- **前置条件**：数据库运行中，测试用户不存在
- **测试步骤**：
  1. POST `/api/auth/register` 注册新用户
  2. POST `/api/auth/login` 登录获取 token
  3. GET `/api/auth/me` 使用 token 获取用户信息
- **预期结果**：
  - 注册返回 201，code=0
  - 登录返回 200，code=0，含 token 和 user 对象，Set-Cookie 包含 auth_token
  - /me 返回 200，user 对象包含正确的 username

##### TC-INT-AUTH-002：重复注册
- **测试目标**：防止重复用户名注册
- **前置条件**：用户 `testuser` 已存在
- **测试步骤**：POST `/api/auth/register` 使用相同用户名
- **预期结果**：返回 400，消息包含"已存在"

##### TC-INT-AUTH-003：登录失败不泄露用户存在性
- **测试目标**：错误消息统一不区分"用户不存在"和"密码错误"
- **前置条件**：数据库运行中
- **测试步骤**：
  1. 使用不存在的用户名登录
  2. 使用存在的用户名+错误密码登录
- **预期结果**：两次均返回 401，消息均为"用户名或密码错误"

##### TC-INT-AUTH-004：Token 过期处理
- **测试目标**：过期 token 被拒绝
- **前置条件**：生成一个已过期的 JWT token
- **测试步骤**：使用过期 token 请求 GET `/api/auth/me`
- **预期结果**：返回 401

##### TC-INT-AUTH-005：注销账号
- **测试目标**：DELETE `/api/auth/me` 完整流程
- **前置条件**：用户已登录
- **测试步骤**：
  1. DELETE `/api/auth/me`
  2. 使用相同 token 再次请求 GET `/api/auth/me`
- **预期结果**：
  - 第一次返回 200，code=0，清除 auth_token cookie
  - 第二次返回 401

#### 2.2.2 情绪记录集成

##### TC-INT-MOOD-001：记录 → 查询 → 更新 → 删除 完整 CRUD
- **测试目标**：情绪记录完整生命周期
- **前置条件**：用户已登录，情绪类型已存在
- **测试步骤**：
  1. POST `/api/moods` 创建记录（emotions 格式）
  2. GET `/api/moods` 查询列表，验证新记录存在
  3. PUT `/api/moods/:id` 更新记录
  4. DELETE `/api/moods/:id` 删除记录
  5. GET `/api/moods` 验证记录已删除
- **预期结果**：
  - 创建返回 201，code=0
  - 列表中包含新记录
  - 更新返回 200，code=0
  - 删除返回 200，code=0
  - 列表中不再包含该记录

##### TC-INT-MOOD-002：兼容旧版 moodType 格式
- **测试目标**：旧版纯文本情绪类型格式兼容
- **前置条件**：用户已登录
- **测试步骤**：POST `/api/moods` 使用 `{ moodType: "开心", intensity: 5 }` 格式
- **预期结果**：返回 201，记录成功创建

##### TC-INT-MOOD-003：新版 emotions 数组格式
- **测试目标**：新版结构化情绪数据格式
- **前置条件**：用户已登录
- **测试步骤**：POST `/api/moods` 使用 `{ emotions: [{ emotionTypeId: 1, intensity: 7 }], tagIds: [1,2] }` 格式
- **预期结果**：返回 201，记录成功创建

##### TC-INT-MOOD-004：情绪类型不存在的错误处理
- **测试目标**：引用不存在的情绪类型
- **前置条件**：用户已登录
- **测试步骤**：POST `/api/moods` 使用 `{ moodType: "不存在的情绪", intensity: 5 }`
- **预期结果**：返回 400，消息"情绪类型不存在"

##### TC-INT-MOOD-005：跨用户数据隔离
- **测试目标**：用户 A 不能查询/修改/删除用户 B 的记录
- **前置条件**：两个用户各有一条记录
- **测试步骤**：
  1. 用户 A 查询列表（只能看到自己的记录）
  2. 用户 A 尝试更新用户 B 的记录
  3. 用户 A 尝试删除用户 B 的记录
- **预期结果**：
  - 列表中不包含用户 B 的记录
  - 更新返回 404
  - 删除返回 404

#### 2.2.3 AI 模块集成

##### TC-INT-AI-001：心理咨询完整调用链
- **测试目标**：POST `/api/ai/counseling` 端到端调用
- **前置条件**：AI_ENABLED=true, DEEPSEEK_API_KEY 有效
- **测试步骤**：
  1. 发送 `{ message: "最近学习压力很大，感觉焦虑" }`
  2. 发送包含风险关键词的消息 `{ message: "我觉得活着没意思" }`
- **预期结果**：
  - 正常消息：返回 200，data.response 为非空 AI 回复，data.riskLevel='low'
  - 风险消息：返回 200，data.riskLevel='medium'，data.hasRiskContent=true

##### TC-INT-AI-002：AI 不可用时的错误处理
- **测试目标**：AI_ENABLED=false 时的响应
- **前置条件**：AI_ENABLED=false
- **测试步骤**：POST `/api/ai/counseling`
- **预期结果**：返回 500，包含错误信息

##### TC-INT-AI-003：量表解读生成
- **测试目标**：POST `/api/ai/interpretation` 生成量表解读
- **前置条件**：AI 可用，Prompt 模板存在
- **测试步骤**：发送完整的量表数据
- **预期结果**：返回 200，data 包含 AI 生成的解读内容

##### TC-INT-AI-004：情绪报告生成
- **测试目标**：POST `/api/ai/mood-report` 生成周报/月报
- **前置条件**：AI 可用
- **测试步骤**：
  1. 发送 type='weekly' 的请求
  2. 发送 type='monthly' 的请求
- **预期结果**：均返回 200，data 包含 AI 生成的报告

##### TC-INT-AI-005：AI 分析历史记录保存
- **测试目标**：POST `/api/ai/history` 保存分析记录
- **前置条件**：用户已登录
- **测试步骤**：
  1. POST 保存一条分析记录
  2. GET 查询历史列表
  3. GET 查询详情
- **预期结果**：
  - 保存返回 200，code=0
  - 列表包含新记录
  - 详情返回完整数据

##### TC-INT-AI-006：树洞温柔回复
- **测试目标**：POST `/api/ai/treehole-reply` 生成回复
- **前置条件**：AI 可用
- **测试步骤**：发送 `{ content: "今天考试没考好，很难过" }`
- **预期结果**：返回 200，data.reply 为温暖共情的回复，data.is_fallback=false

#### 2.2.4 管理后台集成

##### TC-INT-ADMIN-001：用户列表查询
- **测试目标**：GET `/api/admin/users` 分页查询
- **前置条件**：管理员已登录，数据库有用户数据
- **测试步骤**：发送 GET 请求
- **预期结果**：返回 200，data.list 包含用户数组，含 id/username/email/role/createdAt

##### TC-INT-ADMIN-002：用户角色更新
- **测试目标**：PUT `/api/admin/users/role` 更新用户角色
- **前置条件**：管理员已登录，目标用户存在
- **测试步骤**：发送 `{ userId: 2, targetRole: 'admin' }`
- **预期结果**：返回 200，code=0，目标用户角色已更新

##### TC-INT-ADMIN-003：禁止删除超级管理员
- **测试目标**：不能删除 super_admin 角色用户
- **前置条件**：管理员已登录，目标用户为 super_admin
- **测试步骤**：DELETE `/api/admin/users/:id`
- **预期结果**：返回 403

##### TC-INT-ADMIN-004：KPI 统计
- **测试目标**：GET `/api/admin/kpi` 统计数据
- **前置条件**：管理员已登录
- **测试步骤**：发送 GET 请求（可选 startDate/endDate）
- **预期结果**：返回 200，data 包含 totalUsers/moodRecords/assessments/posts 等字段

##### TC-INT-ADMIN-005：模块使用统计
- **测试目标**：GET `/api/admin/analytics/module-usage`
- **前置条件**：管理员已登录，提供 startDate/endDate
- **测试步骤**：发送 GET 请求
- **预期结果**：返回 200，data 为数组，每项含 name/metric/count/description

#### 2.2.5 活动模块集成

##### TC-INT-ACT-001：活动报名完整流程
- **测试目标**：查看活动 → 报名 → 取消报名
- **前置条件**：用户已登录，活动存在且未满员
- **测试步骤**：
  1. GET 活动列表
  2. POST `/api/activities/:id/join` 报名
  3. GET 我的活动列表
  4. POST `/api/activities/:id/cancel` 取消报名
- **预期结果**：
  - 列表返回活动数据
  - 报名返回 200，code=0
  - 我的活动列表包含该活动
  - 取消报名返回 200，code=0

##### TC-INT-ACT-002：活动满员报名
- **测试目标**：满员活动的报名拒绝
- **前置条件**：活动已满员
- **测试步骤**：POST `/api/activities/:id/join`
- **预期结果**：返回 400，消息"报名失败，活动名额已满"

##### TC-INT-ACT-003：重复报名检测
- **测试目标**：同一用户不能重复报名
- **前置条件**：用户已报名该活动
- **测试步骤**：再次 POST `/api/activities/:id/join`
- **预期结果**：返回 400，消息"您已经报名过该活动"

##### TC-INT-ACT-004：活动提醒设置
- **测试目标**：设置活动提醒
- **前置条件**：用户已报名活动，活动开始时间 > 当前时间 + 30分钟
- **测试步骤**：
  1. POST `/api/activities/:id/reminder`
  2. GET `/api/activities/:id/reminder/status`
- **预期结果**：
  - 设置成功返回 200，data.remindAt 为活动开始前 30 分钟
  - 状态查询返回 hasReminder=true

##### TC-INT-ACT-005：活动反馈提交
- **测试目标**：活动结束后提交反馈
- **前置条件**：用户已报名，活动已结束
- **测试步骤**：POST `/api/activities/:id/feedback` 发送 `{ rating: 4, comment: "很好" }`
- **预期结果**：返回 201，code=0

#### 2.2.6 问卷模块集成

##### TC-INT-QNR-001：问卷提交与评分
- **测试目标**：POST `/api/questionnaires/assessments` 完整流程
- **前置条件**：用户已登录，问卷存在
- **测试步骤**：发送 `{ answers: [{ itemId: 1, score: 3 }, ...], assessmentVersionId: 1 }`
- **预期结果**：返回 200，data 包含 totalScore/riskLevel/suggestion

##### TC-INT-QNR-002：答案格式错误
- **测试目标**：非数组格式的 answers
- **前置条件**：用户已登录
- **测试步骤**：发送 `{ answers: "wrong format" }`
- **预期结果**：返回 400

---

### 2.3 功能测试（用户视角）

#### 2.3.1 注册与登录流程

##### TC-FUNC-AUTH-001：新用户注册 → 自动登录 → 访问首页
- **测试目标**：完整的首次使用流程
- **前置条件**：应用已启动，数据库运行中
- **测试步骤**：
  1. 访问 `/register` 页面
  2. 填写用户名、密码表单并提交
  3. 注册成功后自动跳转到登录页
  4. 使用刚注册的账号登录
  5. 登录成功后进入首页
- **预期结果**：
  - 注册成功提示
  - 登录成功后显示用户头像/用户名
  - 首页显示情绪记录入口

##### TC-FUNC-AUTH-002：登录态持久化
- **测试目标**：刷新页面后登录状态保持
- **前置条件**：用户已登录
- **测试步骤**：
  1. 刷新浏览器页面
  2. 检查是否仍显示已登录状态
- **预期结果**：通过 cookie 恢复会话，无需重新登录

##### TC-FUNC-AUTH-003：登出后重定向
- **测试目标**：登出后无法访问受保护页面
- **前置条件**：用户已登录
- **测试步骤**：
  1. 点击登出按钮
  2. 尝试访问 `/mood/record`
- **预期结果**：自动跳转到 `/login`

#### 2.3.2 情绪记录流程

##### TC-FUNC-MOOD-001：记录今日情绪
- **测试目标**：完整的情绪记录提交流程
- **前置条件**：用户已登录
- **测试步骤**：
  1. 进入情绪记录页面 `/mood/record`
  2. 选择情绪类型（如"开心"）
  3. 调节情绪强度滑块
  4. 填写情绪描述
  5. 选择标签/触发因素
  6. 点击提交
- **预期结果**：
  - 提交成功提示
  - 表单重置
  - 可在情绪档案中查看新记录

##### TC-FUNC-MOOD-002：情绪档案浏览
- **测试目标**：查看历史情绪记录列表
- **前置条件**：用户有历史情绪记录
- **测试步骤**：
  1. 进入情绪档案页面 `/mood/archive`
  2. 浏览列表
  3. 使用情绪类型筛选
  4. 分页浏览
- **预期结果**：列表正确显示，筛选和分页功能正常

##### TC-FUNC-MOOD-003：情绪洞察页面
- **测试目标**：情绪洞察数据可视化
- **前置条件**：用户有足够的历史情绪数据
- **测试步骤**：
  1. 进入情绪洞察页面 `/mood/insight`
  2. 切换时间范围（日/周/月/年）
  3. 查看概览卡片、分布图、趋势图、极性图
- **预期结果**：各图表正确渲染，数据与实际记录一致

##### TC-FUNC-MOOD-004：情绪记录草稿恢复
- **测试目标**：未提交的表单自动保存草稿
- **前置条件**：用户已登录
- **测试步骤**：
  1. 开始填写情绪记录但未提交
  2. 离开页面
  3. 重新进入情绪记录页面
- **预期结果**：弹出草稿恢复对话框，可选择恢复或丢弃

#### 2.3.3 心理咨询对话

##### TC-FUNC-AI-001：心理咨询对话
- **测试目标**：与 AI 咨询助手进行对话
- **前置条件**：用户已登录，AI 服务可用
- **测试步骤**：
  1. 进入心理咨询页面 `/counseling`
  2. 输入"最近压力很大"，发送
  3. 等待 AI 回复
  4. 继续对话
- **预期结果**：
  - AI 回复温暖、共情
  - 不包含诊断性语句
  - 对话历史正确显示

##### TC-FUNC-AI-002：风险内容自动检测
- **测试目标**：发送风险内容时的特殊处理
- **前置条件**：用户已登录，AI 服务可用
- **测试步骤**：输入"我觉得活着没意思"
- **预期结果**：AI 回复中包含关心和建议寻求专业帮助的内容

#### 2.3.4 问卷测评

##### TC-FUNC-QNR-001：完成心理测评问卷
- **测试目标**：完整的问卷答题流程
- **前置条件**：用户已登录
- **测试步骤**：
  1. 进入问卷列表 `/improve/questionnaire`
  2. 选择一个问卷开始答题
  3. 逐题作答
  4. 提交问卷
  5. 查看结果页面
- **预期结果**：
  - 每题正确渲染
  - 提交后显示总分和风险等级
  - 可选查看 AI 解读

#### 2.3.5 放松中心

##### TC-FUNC-RELAX-001：木鱼敲击
- **测试目标**：木鱼组件交互
- **前置条件**：用户已登录，nonCoreModules 启用
- **测试步骤**：
  1. 进入放松中心
  2. 点击木鱼
- **预期结果**：木鱼有弹跳动画，产生音效反馈，不消失

##### TC-FUNC-RELAX-002：音乐疗愈
- **测试目标**：音乐播放功能
- **前置条件**：用户已登录，音乐数据存在
- **测试步骤**：
  1. 进入音乐疗愈页面 `/relax/music`
  2. 选择一首音乐
  3. 点击播放
- **预期结果**：音乐正常播放，有声音输出

#### 2.3.6 管理后台

##### TC-FUNC-ADMIN-001：管理员仪表盘
- **测试目标**：数据看板正确显示
- **前置条件**：管理员登录
- **测试步骤**：
  1. 进入 `/admin/dashboard`
  2. 查看各统计卡片
  3. 查看图表
- **预期结果**：所有 KPI 数据正确渲染，图表可交互

##### TC-FUNC-ADMIN-002：用户管理
- **测试目标**：管理员管理用户
- **前置条件**：管理员登录
- **测试步骤**：
  1. 查看用户列表
  2. 修改用户角色
  3. 停用/删除用户
- **预期结果**：操作为非空后列表更新，操作日志记录

---

### 2.4 异常测试

#### 2.4.1 输入异常

##### TC-EXC-001：SQL 注入 - 登录用户名
- **测试目标**：防止 SQL 注入攻击
- **前置条件**：MySQL 数据库
- **测试步骤**：使用 `username: "admin' OR '1'='1"` 登录
- **预期结果**：登录失败（使用参数化查询，不会被注入）

##### TC-EXC-002：XSS - 情绪描述
- **测试目标**：防止存储型 XSS
- **前置条件**：用户已登录
- **测试步骤**：提交情绪描述 `<script>alert('xss')</script>`
- **预期结果**：前端显示时被转义，不执行脚本

##### TC-EXC-003：超长输入
- **测试目标**：超过限制的输入处理
- **前置条件**：用户已登录
- **测试步骤**：
  1. 心理咨询消息超过 1000 字
  2. 树洞内容超过 1000 字
- **预期结果**：返回 400，提示"消息内容不能超过1000字"

##### TC-EXC-004：请求体过大
- **测试目标**：Express 请求体大小限制
- **前置条件**：无
- **测试步骤**：发送超过 1MB 的 JSON 请求体
- **预期结果**：返回 413 或类似错误（Express.json limit 为 1mb）

##### TC-EXC-005：非法 JSON 请求体
- **测试目标**：解析非法 JSON 的容错
- **前置条件**：无
- **测试步骤**：发送 `Content-Type: application/json` 但 body 为 `{invalid json`
- **预期结果**：返回 400 错误

##### TC-EXC-006：非法分页参数
- **测试目标**：负数/零/超大分页参数
- **前置条件**：用户已登录
- **测试步骤**：
  1. GET `/api/moods?page=0`
  2. GET `/api/moods?page=-1`
  3. GET `/api/moods?page=999999`
- **预期结果**：
  - page=0 被修正为 1
  - page=-1 被修正为 1
  - page=999999 返回空列表

#### 2.4.2 网络与超时异常

##### TC-EXC-007：AI 服务超时
- **测试目标**：AI API 调用超时的处理
- **前置条件**：模拟 AI 服务延迟 > 30s
- **测试步骤**：POST `/api/ai/counseling`
- **预期结果**：返回 500，前端显示"请求超时"提示

##### TC-EXC-008：MySQL 连接失败
- **测试目标**：数据库不可用时的处理
- **前置条件**：停止 MySQL 服务
- **测试步骤**：启动后端服务
- **预期结果**：服务启动失败，记录错误日志

##### TC-EXC-009：Redis 连接失败
- **测试目标**：Redis 不可用时的降级处理
- **前置条件**：停止 Redis 服务
- **测试步骤**：请求需要缓存的操作
- **预期结果**：缓存操作静默失败，不阻断主流程，日志记录警告

##### TC-EXC-010：AI API Key 无效
- **测试目标**：无效 API Key 的错误处理
- **前置条件**：设置无效的 DEEPSEEK_API_KEY
- **测试步骤**：POST `/api/ai/counseling`
- **预期结果**：返回 500，错误消息包含"AI API Key 无效"

#### 2.4.3 并发异常

##### TC-EXC-011：活动报名并发
- **测试目标**：最后一名额同时报名
- **前置条件**：活动剩余 1 个名额
- **测试步骤**：两个用户同时 POST `/api/activities/:id/join`
- **预期结果**：一个成功，一个返回"报名失败，活动名额已满"

##### TC-EXC-012：同一用户重复提交情绪记录
- **测试目标**：防止快速双击提交
- **前置条件**：用户已登录
- **测试步骤**：快速连续点击提交按钮
- **预期结果**：前端防抖（300ms）确保只提交一次

#### 2.4.4 空值与缺失数据

##### TC-EXC-013：数据库表为空
- **测试目标**：空数据库的查询容错
- **前置条件**：数据库表无数据
- **测试步骤**：请求各列表/统计接口
- **预期结果**：返回空列表或 0 值，不抛出 500 错误

##### TC-EXC-014：环境变量缺失
- **测试目标**：缺少必需环境变量的启动行为
- **前置条件**：删除 JWT_SECRET 环境变量
- **测试步骤**：启动后端服务
- **预期结果**：服务启动失败，抛出明确错误信息

##### TC-EXC-015：ENCRYPTION_KEY 缺失
- **测试目标**：加密模块加载时缺少密钥
- **前置条件**：删除 ENCRYPTION_KEY 环境变量
- **测试步骤**：启动后端服务
- **预期结果**：服务启动失败（模块顶层 throw），抛出"ENCRYPTION_KEY environment variable is required"

---

### 2.5 安全测试

#### 2.5.1 认证与授权

##### TC-SEC-001：未认证访问受保护 API
- **测试目标**：所有 API 接口的认证检查
- **前置条件**：无 token
- **测试步骤**：不带 Authorization 头请求各 API 端点
- **预期结果**：返回 401 或 403

##### TC-SEC-002：角色越权访问
- **测试目标**：学生角色访问管理员接口
- **前置条件**：使用 student 角色 token
- **测试步骤**：请求 GET `/api/admin/users`
- **预期结果**：返回 403

##### TC-SEC-003：权限细化检查
- **测试目标**：`requirePermission` 中间件的权限控制
- **前置条件**：student 角色
- **测试步骤**：请求需要 `user.manage` 权限的接口
- **预期结果**：返回 403

##### TC-SEC-004：Token 篡改
- **测试目标**：篡改 JWT payload 的检测
- **前置条件**：生成一个有效 token
- **测试步骤**：修改 token 中的 role 字段后重新编码（无密钥签名）
- **预期结果**：返回 401（签名验证失败）

##### TC-SEC-005：Cookie HttpOnly 保护
- **测试目标**：防止 XSS 窃取 token
- **前置条件**：用户已登录
- **测试步骤**：检查登录响应 Set-Cookie 头
- **预期结果**：auth_token cookie 设置了 `HttpOnly` 和 `SameSite=Lax`

##### TC-SEC-006：登录限流
- **测试目标**：防止暴力破解
- **前置条件**：配置登录限流
- **测试步骤**：短时间内连续发送大量登录请求
- **预期结果**：超过限制后返回 429 "请求过于频繁"

#### 2.5.2 数据安全

##### TC-SEC-007：密码强度检测
- **测试目标**：弱密码警告
- **前置条件**：无
- **测试步骤**：使用 `"123456"` 注册
- **预期结果**：前端应进行密码强度校验（当前后端无要求）

##### TC-SEC-008：敏感字段脱敏日志
- **测试目标**：日志中不包含密码/JWT/身份证号
- **前置条件**：请求包含敏感字段
- **测试步骤**：发送包含 password 的请求，检查日志
- **预期结果**：日志中密码字段被替换为 `[REDACTED]`

##### TC-SEC-009：加密字段存储
- **测试目标**：情绪笔记和触发因素加密存储
- **前置条件**：用户提交情绪记录
- **测试步骤**：直接查询数据库 moods 表
- **预期结果**：`note_ciphertext` 和 `trigger_ciphertext` 字段为加密格式（非明文）

##### TC-SEC-010：CORS 配置
- **测试目标**：跨域请求限制
- **前置条件**：非允许的 Origin
- **测试步骤**：从非白名单域名发送请求
- **预期结果**：返回 CORS 错误

#### 2.5.3 内容安全

##### TC-SEC-011：敏感词过滤
- **测试目标**：树洞帖子内容审查
- **前置条件**：用户已登录
- **测试步骤**：发送包含暴力/色情等敏感词的帖子
- **预期结果**：帖子被标记为待审核或拒绝

##### TC-SEC-012：XSS 防护 - CSP 头
- **测试目标**：Content-Security-Policy 头配置
- **前置条件**：无
- **测试步骤**：请求任意页面，检查响应头
- **预期结果**：包含 `Content-Security-Policy` 头，且 `script-src` 不包含 `unsafe-eval`

##### TC-SEC-013：Helmet 安全头
- **测试目标**：Helmet 中间件安全头配置
- **前置条件**：无
- **测试步骤**：请求任意页面，检查响应头
- **预期结果**：包含 `X-Content-Type-Options`、`X-Frame-Options`、`X-XSS-Protection` 等安全头，`X-Powered-By` 被禁用

---

### 2.6 性能测试建议

#### 2.6.1 已识别的性能瓶颈

##### PERF-001：情绪列表 hydate 查询 - N+1 问题
- **位置**：`moodRepository.hydrateMoodRows()`
- **问题描述**：先查询 moods 列表，再对每批 mood ID 查询 emotions 和 tags，虽然使用了 IN 批量查询，但每次查询情绪列表都会触发两次 JOIN 查询
- **建议**：考虑使用单次 JOIN 查询直接返回完整结果，或增加查询结果缓存

##### PERF-002：管理后台 KPI 统计 - 13 个独立查询
- **位置**：`managementRepository.getKpiStats()`
- **问题描述**：使用 `Promise.all` 并行执行 13 个独立 COUNT 查询，虽然已并行化，但在大数据量下仍可能较慢
- **建议**：考虑使用物化视图或定时汇总表，减少实时聚合查询

##### PERF-003：AI 推荐 enrichWithRealContent - 循环查询
- **位置**：`recommendService.enrichWithRealContent()`
- **问题描述**：对每个推荐项依次执行数据库查询，N 个推荐项产生 N 次数据库查询
- **建议**：按类型分组后批量查询，减少数据库往返次数

##### PERF-004：情绪洞察周期对比 - 按周聚合
- **位置**：`moodService.getMoodInsight()`
- **问题描述**：`weekMap` 使用 `Math.ceil(d.getDate() / 7)` 计算周数，跨月时可能产生不准确的周标签
- **建议**：使用 ISO 周数计算或时间库函数

##### PERF-005：加密解密操作
- **位置**：`moodService.listMoods()` 中对每条记录调用 `decryptField`
- **问题描述**：列表查询时对每条记录的 note 和 trigger 进行解密，大量记录时解密开销显著
- **建议**：考虑前端按需解密，或使用更高效的加密方案

##### PERF-006：Redis 缓存使用不一致
- **位置**：`cache.ts` 和多个控制器
- **问题描述**：部分接口（如活动列表）使用 Redis 缓存，但情绪趋势/分析接口未使用 `getOrSetMoodCache`
- **建议**：统一缓存策略，对高频读取的数据增加缓存层

#### 2.6.2 性能测试场景建议

| 场景 | 并发数 | 目标 | 指标 |
|------|--------|------|------|
| 情绪记录提交 | 50 | 验证写入性能 | P95 < 500ms |
| 情绪列表查询 | 100 | 验证分页+解密性能 | P95 < 300ms |
| AI 心理咨询 | 10 | 验证 AI 调用链 | P95 < 15s |
| 管理后台 KPI | 5 | 验证并行查询 | P95 < 2s |
| 活动报名（并发） | 20 | 验证事务隔离 | 无超卖 |
| 登录接口 | 50 | 验证限流+bcrypt | P95 < 1s |

---

### 2.7 可测试性评估

#### 2.7.1 优点

| 方面 | 评估 |
|------|------|
| 依赖注入 | `authService`、`moodService`、`managementService` 均支持通过 `dependencies` 参数注入 mock，设计良好 |
| 接口抽象 | `MoodDatabase`、`MysqlExecutor` 等接口定义清晰，便于 mock |
| 单例与工厂 | `createApp()` 工厂函数支持测试环境创建独立实例 |
| 错误分类 | 定义了 `AppError`/`BusinessError`/`HttpException`/`AiServiceError` 等分层错误类 |
| 测试基础设施 | 前端 Vitest、后端 Jest、E2E Playwright 均已配置 |

#### 2.7.2 可改进点

| 方面 | 问题 | 影响 |
|------|------|------|
| 控制器直接实例化 | 部分控制器在模块顶层 `const moodService = createMoodService()` 实例化，测试时无法注入 mock | 降低单元测试隔离性 |
| 全局单例 | `aiClient`、`recommendService`、`contentAuditService` 使用单例模式，测试间状态可能污染 | 需要测试后重置状态 |
| 环境变量直接读取 | 多处代码直接 `process.env.XXX` 而非通过配置对象注入 | 测试时需要设置/清除环境变量 |
| 文件系统依赖 | `encryption.ts` 模块顶层检查 ENCRYPTION_KEY，加载即失败 | 测试环境必须设置该变量 |
| 数据库直连 | `aiHistoryController` 直接使用 `getMysqlPool()` 而非 repository 层 | 违反分层架构，难以 mock |
| 前端 localStorage | `userStore` 直接操作 `localStorage`，测试需要 mock | 增加测试复杂度 |

---

## 三、缺陷风险清单

### 3.1 高风险

| ID | 风险描述 | 位置 | 影响 | 建议 |
|----|----------|------|------|------|
| R-HIGH-001 | `encryption.ts` 模块顶层 `throw new Error("ENCRYPTION_KEY environment variable is required")`，缺少该变量时整个进程无法启动 | `encryption.ts:5-7` | 服务完全不可用 | 改为延迟加载，在首次调用时才检查 |
| R-HIGH-002 | `aiHistoryController` 直接使用 `getMysqlPool()` 绕过 repository 层，无参数化查询保护（虽然使用了 `?` 占位符） | `aiHistoryController.ts:30-44` | 架构不一致，增加维护风险 | 迁移到 repository 层 |
| R-HIGH-003 | `aiClient.callAI()` 中 `retryCount` 是实例属性，重试期间若被并发调用可能互相干扰 | `aiClient.ts:16` | 并发 AI 调用时重试计数不准确 | 改为局部变量或使用闭包 |
| R-HIGH-004 | `moodController.recordMood` 中 `req.user!` 使用非空断言，若中间件未正确设置 user 将导致运行时错误 | `moodController.ts:13` | 未捕获的 TypeError | 增加明确的空值检查 |

### 3.2 中风险

| ID | 风险描述 | 位置 | 影响 | 建议 |
|----|----------|------|------|------|
| R-MED-001 | `moodService.recordMood` 中 `encryptField` 和 `decryptField` 的回退实现使用 `require()` 动态加载，可能导致循环依赖 | `moodService.ts:160-172` | 模块加载失败 | 改为直接 import |
| R-MED-002 | 前端 `userStore.trySessionRestore` 在从 cookie 恢复会话时设置 `token.value = 'session'` 作为占位符，非真实 token | `userStore.ts:114-115` | 后续 API 调用可能因无效 token 失败 | 使用后端返回的实际 token |
| R-MED-003 | `contentFilter.ts` 敏感词列表包含大量组合词（如"涉毒涉黄涉赌涉枪涉爆涉邪"），实际匹配效率低，且可能与短词重复匹配 | `contentFilter.ts:1-94` | 性能问题，误报率高 | 使用 Trie 树或 AC 自动机优化 |
| R-MED-004 | `moodController` 中 `getMoodTypes` 和 `getTagsHandler` 使用不一致的响应格式（`{ code: 0, data }` vs `apiSuccess()`） | `moodController.ts:263-288` | 前端解析不一致 | 统一使用 `apiSuccess` |
| R-MED-005 | 活动报名并发控制依赖数据库事务，但 `hasUserJoined` 检查在 `join` 事务外部 | `activityController.ts:105-106` | 极小概率的重复报名 | 将检查移入事务内或使用数据库唯一约束 |
| R-MED-006 | 用户删除时 `userRepository.deleteUser` 直接删除关联数据，无软删除或审计日志 | `userRepository.ts:210-230` | 数据不可恢复 | 增加软删除或删除前确认日志 |
| R-MED-007 | AI 服务调用 `callChatCompletion` 无重试机制，一次失败即返回错误 | `aiClient.ts:185-241` | AI 可用性降低 | 增加指数退避重试 |

### 3.3 低风险

| ID | 风险描述 | 位置 | 影响 | 建议 |
|----|----------|------|------|------|
| R-LOW-001 | `moodService.buildAnalysisRecommendations` 中 `recommendations.slice(0, 5)` 限制，但代码中最多添加 4 条建议 | `moodService.ts:151` | 无实际影响 | 移除冗余 slice |
| R-LOW-002 | 前端 `request.ts` 中 loading 计数器使用模块级变量，多个组件同时请求时共享 loading 状态 | `request.ts:37-38` | loading 显示不一致 | 使用请求级 loading 控制 |
| R-LOW-003 | `authService.buildDefaultEmail` 使用 `Math.random()` 非加密随机数 | `authService.ts:42` | 邮箱可预测性 | 使用 `crypto.randomBytes` |
| R-LOW-004 | 前端 `MoodRecordScript.ts` 中 `moodTypes` 的 id 使用英文（如 'happy'），但后端 moodType 匹配使用中文（如 '开心'） | `MoodRecordScript.ts:60-105` | 可能匹配失败 | 统一前后端情绪类型标识 |
| R-LOW-005 | `vite.config.ts` 中未代理所有 `/api/` 路径，如 `/api/relax`、`/api/recommend` 等未配置 | `vite.config.ts:76-109` | 开发环境代理不完整 | 使用通配代理规则 |
| R-LOW-006 | `managementController` 中 `userManageHandler` 仅记录日志未执行实际操作 | `managementController.ts:79-97` | 功能不完整 | 实现实际的用户管理逻辑或标记为废弃 |

### 3.4 已处理但需注意的风险

| ID | 风险描述 | 位置 | 处理方式 |
|----|----------|------|----------|
| R-FIXED-001 | 管理后台 SQL 查询中列名错误（如 `moods.intensity` → `mood_emotions.intensity`） | `managementRepository.ts` | 已修复，使用 `safeCount()` 兜底 |
| R-FIXED-002 | 数据库表缺失导致 500 错误 | 多个 repository | 已使用 try-catch + safeCount 包装 |
| R-FIXED-003 | AI 路由未挂载到 app.ts | `app.ts` | 已合并到 aiInterpretationRoutes |

---

## 四、测试覆盖统计

### 4.1 现有测试

| 测试层级 | 测试框架 | 测试文件数 | 测试用例数（估算） |
|----------|----------|------------|-------------------|
| 前端单元测试 | Vitest | 44 | ~180 |
| 后端单元测试 | Jest | 44 | ~213 |
| E2E 测试 | Playwright | 1 | ~5 |

### 4.2 测试覆盖缺口

| 模块 | 当前覆盖 | 缺口 |
|------|----------|------|
| 情绪洞察 (MoodInsight) | 无 | 新增页面，无对应测试 |
| 活动反馈 (ActivityFeedback) | 无 | 无测试覆盖 |
| 内容审核 (ContentAudit) | 部分 | 缺乏 AI 深度审核集成测试 |
| 推荐系统 (Recommend) | 部分 | 缺乏个性化推荐测试 |
| 加密解密 (Encryption) | 部分 | 缺乏边界值测试 |
| 计分引擎 (ScoringEngine) | 无 | 无独立测试 |
| 前端路由守卫 | 部分 | 缺乏 guides.ts 完整测试 |
| 并发场景 | 无 | 无并发测试 |
| 性能测试 | 无 | 仅 baseline 脚本 |

---

## 五、总结

### 5.1 总体评价

本项目是一个功能较为完整的校园心理健康平台，**代码架构清晰，采用了分层设计（Controller → Service → Repository）**，且服务层支持依赖注入，具备较好的可测试性。系统已覆盖了从认证、情绪记录、AI 分析到管理后台的完整功能链路。

### 5.2 主要关注点

1. **加密模块** (`encryption.ts`) 的模块顶层异常抛出是最大的可用性风险
2. **AI 模块**的重试机制和并发安全需要加强
3. **内容安全**的敏感词列表需要优化（去重 + 算法优化）
4. **前后端数据格式**存在不一致处（如响应格式、情绪类型标识）
5. **并发场景**（活动报名、情绪提交）的控制需要加强
6. **测试覆盖**在新功能模块（情绪洞察、活动反馈）存在明显缺口

### 5.3 建议优先级

| 优先级 | 行动项 |
|--------|--------|
| P0 | 修复 encryption.ts 启动时崩溃风险 (R-HIGH-001) |
| P0 | 统一前后端响应格式 (R-MED-004) |
| P1 | 增加 AI 调用重试机制 (R-MED-007) |
| P1 | 优化敏感词过滤算法 (R-MED-003) |
| P1 | 补充新功能模块测试（情绪洞察、活动反馈） |
| P2 | 统一缓存策略 (PERF-006) |
| P2 | 优化批量查询 N+1 问题 (PERF-001) |
| P2 | 增加并发测试和性能测试 |