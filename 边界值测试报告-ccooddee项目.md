# 边界值测试报告 - ccooddee 项目

> **生成日期**：{{date}}
> **测试类型**：边界值测试分析
> **测试范围**：全栈代码（Vue 3 + TypeScript 前端，Express.js + TypeScript 后端，MySQL + Redis 数据层）
> **分析方式**：纯静态代码分析，不实际运行

---

## 目录

- [1. 代码范围简述](#1-代码范围简述)
- [2. 边界值测试用例](#2-边界值测试用例)
  - [2.1 用户认证模块](#21-用户认证模块)
  - [2.2 情绪记录模块](#22-情绪记录模块)
  - [2.3 活动管理模块](#23-活动管理模块)
  - [2.4 树洞帖子模块](#24-树洞帖子模块)
  - [2.5 AI 咨询模块](#25-ai-咨询模块)
  - [2.6 AI 解读与报告模块](#26-ai-解读与报告模块)
  - [2.7 AI 历史记录模块](#27-ai-历史记录模块)
  - [2.8 管理后台模块](#28-管理后台模块)
  - [2.9 音乐/课程/放松模块](#29-音乐课程放松模块)
  - [2.10 测评问卷模块](#210-测评问卷模块)
  - [2.11 加密与安全模块](#211-加密与安全模块)
  - [2.12 前端表单验证](#212-前端表单验证)
- [3. 边界风险清单](#3-边界风险清单)

---

## 1. 代码范围简述

| 维度 | 说明 |
|------|------|
| **语言** | TypeScript（前后端统一）、Vue 3 SFC |
| **后端框架** | Express.js，分层架构 Controller → Service → Repository |
| **前端框架** | Vue 3 + Element Plus + Pinia |
| **数据库** | MySQL (mysql2)，Redis (ioredis) |
| **认证** | JWT + bcryptjs + HttpOnly Cookie |
| **主要输入来源** | REST API 请求体/查询参数/路径参数、前端表单、数据库列约束 |
| **验证框架** | express-validator（后端）、Element Plus 表单验证 + 自定义 validation.ts（前端） |

---

## 2. 边界值测试用例

### 2.1 用户认证模块

#### 2.1.1 注册接口

| 模块/文件 | 函数/接口 | 参数名 | 边界类型 | 输入值 | 预期行为 |
|-----------|-----------|--------|----------|--------|----------|
| authRoutes.ts | POST /api/auth/register | username | 下边界-1 | `"ab"`（2字符） | 返回 400，提示"用户名需为3-20位" |
| authRoutes.ts | POST /api/auth/register | username | 下边界 | `"abc"`（3字符） | 校验通过 |
| authRoutes.ts | POST /api/auth/register | username | 上边界 | `"a".repeat(20)`（20字符） | 校验通过 |
| authRoutes.ts | POST /api/auth/register | username | 上边界+1 | `"a".repeat(21)`（21字符） | 返回 400，提示"用户名需为3-20位" |
| authRoutes.ts | POST /api/auth/register | username | 空值 | `""`（空字符串） | 返回 400，正则不匹配 |
| authRoutes.ts | POST /api/auth/register | username | 空值 | `null` | 返回 400 |
| authRoutes.ts | POST /api/auth/register | username | 极端数据 | `"   "`（纯空格，3字符） | 返回 400，正则不匹配空格 |
| authRoutes.ts | POST /api/auth/register | username | 极端数据 | `"<script>alert(1)</script>"`（含XSS，20字符） | 返回 400，正则不匹配 `<>` |
| authRoutes.ts | POST /api/auth/register | username | 极端数据 | `"🙂😀😁"`（3个emoji） | 返回 400，正则不匹配 emoji |
| authRoutes.ts | POST /api/auth/register | username | 极端数据 | `"用户_123"`（中英文数字下划线混合） | 校验通过 |
| authRoutes.ts | POST /api/auth/register | password | 下边界-1 | `"12345"`（5字符） | 返回 400，提示"密码至少6个字符" |
| authRoutes.ts | POST /api/auth/register | password | 下边界 | `"123456"`（6字符） | 校验通过 |
| authRoutes.ts | POST /api/auth/register | password | 极端数据 | `"a".repeat(10000)`（10000字符超长密码） | **风险**：无上限校验，可能通过但哈希耗时 |
| authRoutes.ts | POST /api/auth/register | password | 空值 | `""`（空字符串） | 返回 400 |
| authRoutes.ts | POST /api/auth/register | password | 极端数据 | `"\0\0\0\0\0\0"`（含空字符，6字符） | 可能通过校验，行为未定义 |
| authRoutes.ts | POST /api/auth/register | email | 上边界 | `"12345@qq.com"`（5位QQ号） | 校验通过 |
| authRoutes.ts | POST /api/auth/register | email | 上边界 | `"12345678901@qq.com"`（11位QQ号） | 校验通过 |
| authRoutes.ts | POST /api/auth/register | email | 上边界+1 | `"123456789012@qq.com"`（12位QQ号） | 返回 400 |
| authRoutes.ts | POST /api/auth/register | email | 下边界-1 | `"1234@qq.com"`（4位QQ号） | 返回 400 |
| authRoutes.ts | POST /api/auth/register | email | 空值 | `null` | 校验通过（optional），邮箱为空 |
| authRoutes.ts | POST /api/auth/register | email | 空值 | `""` | 返回 400，正则不匹配 |
| authRoutes.ts | POST /api/auth/register | email | 极端数据 | `"test@gmail.com"` | 返回 400，非QQ邮箱 |
| validation.ts | isValidUsername | username | 下边界-1 | `"ab"` | 返回 false |
| validation.ts | isValidUsername | username | 下边界 | `"abc"` | 返回 true |
| validation.ts | isValidUsername | username | 上边界 | `"a".repeat(20)` | 返回 true |
| validation.ts | isValidUsername | username | 上边界+1 | `"a".repeat(21)` | 返回 false |
| validation.ts | getPasswordStrength | password | 下边界 | `"123456"`（6字符纯数字） | 返回 'weak'（得分≤2） |
| validation.ts | getPasswordStrength | password | 边界转折 | `"password123"`（含数字+小写，得分3） | 返回 'medium' |
| validation.ts | getPasswordStrength | password | 边界转折 | `"P@ssw0rd123"`（含大小写+数字+特殊字符，得分5） | 返回 'strong' |
| validation.ts | isValidPhone | phone | 下边界 | `"13000000000"` | 返回 true |
| validation.ts | isValidPhone | phone | 上边界 | `"19999999999"` | 返回 true |
| validation.ts | isValidPhone | phone | 极端数据 | `"12000000000"`（第二位为2） | 返回 false |
| validation.ts | isValidPhone | phone | 极端数据 | `"110000000000"`（12位） | 返回 false |
| validation.ts | isValidPhone | phone | 极端数据 | `"1380013800"`（10位） | 返回 false |

#### 2.1.2 登录接口

| 模块/文件 | 函数/接口 | 参数名 | 边界类型 | 输入值 | 预期行为 |
|-----------|-----------|--------|----------|--------|----------|
| authRoutes.ts | POST /api/auth/login | username | 空值 | `""` | 返回 400，提示"用户名不能为空" |
| authRoutes.ts | POST /api/auth/login | username | 空值 | 未传递 | 返回 400 |
| authRoutes.ts | POST /api/auth/login | password | 空值 | `""` | 返回 400，提示"密码不能为空" |
| authRoutes.ts | POST /api/auth/login | password | 空值 | 未传递 | 返回 400 |
| authService.ts | login | username | 极端数据 | 不存在的用户名 | 返回 401，递增失败计数 |
| authService.ts | login | username | 极端数据 | 第1次失败 | Redis 计数=1 |
| authService.ts | login | username | 极端数据 | 第5次失败 | Redis 计数=5，触发锁定 |
| authService.ts | login | username | 极端数据 | 第6次（锁定后） | 返回 429，提示15分钟后重试 |
| authService.ts | login | username | 极端数据 | 第5次成功（在第4次失败后） | 登录成功，清除失败计数 |

#### 2.1.3 前端登录/注册表单

| 模块/文件 | 函数/接口 | 参数名 | 边界类型 | 输入值 | 预期行为 |
|-----------|-----------|--------|----------|--------|----------|
| Login.vue | form.username | username | 空值 | `""` | 字段验证失败，显示错误 |
| Login.vue | form.password | password | 空值 | `""` | 字段验证失败，显示错误 |
| Register.vue | form.password | password | 下边界-1 | `"12345"`（5字符） | 字段验证失败，HTML5 minlength 不满足 |
| Register.vue | form.password | password | 下边界 | `"123456"`（6字符） | 验证通过 |
| Register.vue | form.confirmPassword | confirmPassword | 极端数据 | 与 password 不一致 | 验证失败，提示密码不匹配 |
| Register.vue | form.email | email | 极端数据 | `"test@163.com"` | 验证失败，非QQ邮箱格式 |

---

### 2.2 情绪记录模块

| 模块/文件 | 函数/接口 | 参数名 | 边界类型 | 输入值 | 预期行为 |
|-----------|-----------|--------|----------|--------|----------|
| moodRoutes.ts | POST /api/moods | emotions | 下边界-1 | `[]`（空数组） | 返回 400，提示"至少需要1个情绪" |
| moodRoutes.ts | POST /api/moods | emotions | 下边界 | `[{emotionTypeId:1, intensity:1}]` | 通过 |
| moodRoutes.ts | POST /api/moods | emotions[].intensity | 下边界-1 | `0` | 返回 400，提示"强度必须在1-10之间" |
| moodRoutes.ts | POST /api/moods | emotions[].intensity | 下边界 | `1` | 通过 |
| moodRoutes.ts | POST /api/moods | emotions[].intensity | 上边界 | `10` | 通过 |
| moodRoutes.ts | POST /api/moods | emotions[].intensity | 上边界+1 | `11` | 返回 400 |
| moodRoutes.ts | POST /api/moods | emotions[].intensity | 极端数据 | `-1` | 返回 400 |
| moodRoutes.ts | POST /api/moods | emotions[].intensity | 极端数据 | `3.14` | 返回 400（isInt 不通过） |
| moodRoutes.ts | POST /api/moods | emotions[].intensity | 极端数据 | `Number.MAX_VALUE` | 返回 400 |
| moodRoutes.ts | POST /api/moods | note | 上边界 | `"a".repeat(2000)` | 通过 |
| moodRoutes.ts | POST /api/moods | note | 上边界+1 | `"a".repeat(2001)` | 返回 400 |
| moodRoutes.ts | POST /api/moods | note | 空值 | `""` | 通过（optional） |
| moodRoutes.ts | POST /api/moods | tags | 上边界 | `"a".repeat(50)` | 通过 |
| moodRoutes.ts | POST /api/moods | tags | 上边界+1 | `"a".repeat(51)` | 返回 400 |
| moodController.ts | recordMood | moodType | 空值 | `undefined` + intensity 无 | 返回 400，"情绪类型和强度为必填" |
| moodController.ts | recordMood | intensity | 空值 | `undefined` | 返回 400，"情绪类型和强度为必填" |
| moodController.ts | recordMood | intensity | 下边界-1 | `0` | 返回 400，"强度必须在1-10之间" |
| moodController.ts | recordMood | intensity | 上边界+1 | `11` | 返回 400 |
| moodController.ts | recordMood | intensity | 极端数据 | `NaN` | 返回 400（`Number.isFinite` 检查） |
| moodController.ts | recordMood | intensity | 极端数据 | `Infinity` | 返回 400 |
| moodController.ts | recordMood | intensity | 极端数据 | `-Infinity` | 返回 400 |
| moodController.ts | recordMood | intensity | 极端数据 | `"5"`（字符串） | `Number("5")=5`，通过 |
| moodController.ts | recordMood | intensity | 极端数据 | `"abc"`（非数字字符串） | 返回 400（`Number.isFinite` 检查） |
| moodController.ts | recordMood | emotions | 极端数据 | 数组元素缺 emotionTypeId | 返回 400，"情绪数据格式错误" |
| moodController.ts | recordMood | emotions | 极端数据 | 数组元素缺 intensity | 返回 400，"情绪数据格式错误" |
| moodController.ts | recordMood | tagIds | 极端数据 | 超长数组 | **风险**：无上限，可能创建大量标签 |
| moodController.ts | updateMoodHandler | moodId | 下边界-1 | `0` | 返回 400，"无效的记录 ID" |
| moodController.ts | updateMoodHandler | moodId | 下边界 | `1` | 通过 |
| moodController.ts | updateMoodHandler | moodId | 极端数据 | `-1` | 返回 400 |
| moodController.ts | updateMoodHandler | moodId | 极端数据 | `NaN` | 返回 400 |
| moodController.ts | updateMoodHandler | moodId | 极端数据 | `3.14` | 返回 400（`Number.isInteger` 检查） |
| moodController.ts | updateMoodHandler | moodId | 极端数据 | `Number.MAX_SAFE_INTEGER` | **风险**：通过校验但数据库可能不存在记录 |
| moodController.ts | getMoodList | page | 下边界-1 | `0` | `parseInt("0")=0 \|\| 1` → 默认值1 |
| moodController.ts | getMoodList | page | 极端数据 | `-1` | `parseInt("-1")=-1 \|\| 1` → 默认值1（falsy） |
| moodController.ts | getMoodList | page | 极端数据 | `"abc"` | `parseInt("abc")=NaN \|\| 1` → 默认值1 |
| moodController.ts | getMoodList | page | 极端数据 | `Number.MAX_VALUE` | **风险**：极大值可能溢出 |
| moodController.ts | getMoodList | limit | 极端数据 | `0` | `parseInt("0")=0 \|\| 20` → 默认值20 |
| moodController.ts | getMoodList | limit | 极端数据 | `-1` | `parseInt("-1")=-1 \|\| 20` → 默认值20 |
| moodController.ts | getMoodTrend | range | 上边界 | `"quarter"` | 通过 |
| moodController.ts | getMoodTrend | range | 极端数据 | `"year"` | 返回 400，"无效的时间范围" |
| moodController.ts | getMoodTrend | range | 极端数据 | `""` | 返回 400 |
| moodController.ts | getMoodInsightHandler | period | 上边界 | `"year"` | 通过 |
| moodController.ts | getMoodInsightHandler | period | 极端数据 | `"decade"` | 返回 400 |
| moodController.ts | createTagHandler | name | 空值 | `""` | 返回 400，"标签名称不能为空" |
| moodController.ts | createTagHandler | name | 空值 | `null` | 返回 400 |
| moodController.ts | createTagHandler | name | 极端数据 | `"   "`（纯空格） | `name.trim()` 后为空，等同于空字符串检查 |
| moodController.ts | createTagHandler | name | 极端数据 | `"a".repeat(500)`（超长标签名） | **风险**：无长度限制，数据库可能截断 |

---

### 2.3 活动管理模块

| 模块/文件 | 函数/接口 | 参数名 | 边界类型 | 输入值 | 预期行为 |
|-----------|-----------|--------|----------|--------|----------|
| activityRoutes.ts | POST /api/activities | title | 下边界 | `"a"`（1字符） | 通过 |
| activityRoutes.ts | POST /api/activities | title | 下边界-1 | `""` | 返回 400 |
| activityRoutes.ts | POST /api/activities | title | 上边界 | `"a".repeat(100)` | 通过 |
| activityRoutes.ts | POST /api/activities | title | 上边界+1 | `"a".repeat(101)` | 返回 400 |
| activityRoutes.ts | POST /api/activities | description | 上边界 | `"a".repeat(5000)` | 通过 |
| activityRoutes.ts | POST /api/activities | description | 上边界+1 | `"a".repeat(5001)` | 返回 400 |
| activityRoutes.ts | POST /api/activities | maxParticipants | 下边界 | `1` | 通过 |
| activityRoutes.ts | POST /api/activities | maxParticipants | 下边界-1 | `0` | 返回 400 |
| activityRoutes.ts | POST /api/activities | maxParticipants | 上边界 | `9999` | 通过 |
| activityRoutes.ts | POST /api/activities | maxParticipants | 上边界+1 | `10000` | 返回 400 |
| activityRoutes.ts | POST /api/activities | maxParticipants | 极端数据 | `-1` | 返回 400 |
| activityRoutes.ts | POST /api/activities | location | 上边界 | `"a".repeat(200)` | 通过 |
| activityRoutes.ts | POST /api/activities | location | 上边界+1 | `"a".repeat(201)` | 返回 400 |
| activityRoutes.ts | POST /api/activities | startTime | 极端数据 | `"not-a-date"` | 返回 400（isISO8601 不通过） |
| activityRoutes.ts | POST /api/activities | startTime | 极端数据 | `""` | 返回 400 |
| activityRoutes.ts | POST /api/activities | startTime | 极端数据 | `"1970-01-01T00:00:00Z"` | 通过，但可能不符合业务逻辑 |
| activityRoutes.ts | POST /api/activities | startTime | 极端数据 | `"2099-12-31T23:59:59Z"`（极远未来） | 通过，但可能不符合业务逻辑 |
| activityController.ts | createActivityHandler | startTime/endTime | 隐式边界 | endTime < startTime | **风险**：无校验，可能创建非法活动 |
| activityController.ts | getActivityList | page | 空值 | 未传递 | `parseInt(undefined) \|\| 1` → 1 |
| activityController.ts | getActivityList | page | 极端数据 | `0` | `parseInt("0")=0 \|\| 1` → 1 |
| activityController.ts | getActivityList | limit | 空值 | 未传递 | `parseInt(undefined) \|\| 10` → 10 |
| activityController.ts | getActivityList | limit | 极端数据 | `-1` | `parseInt("-1")=-1 \|\| 10` → 10 |
| activityController.ts | getActivityList | limit | 极端数据 | `Number.MAX_VALUE` | **风险**：无上限限制，可能导致内存问题 |
| activityController.ts | getActivityDetail | id | 极端数据 | `NaN` | `parseInt("abc")=NaN`，findById(NaN) 返回空 |
| activityController.ts | getActivityDetail | id | 极端数据 | `-1` | 查询不存在的活动，返回 404 |
| activityController.ts | submitFeedbackHandler | rating | 下边界-1 | `0` | 返回 400 |
| activityController.ts | submitFeedbackHandler | rating | 下边界 | `1` | 通过 |
| activityController.ts | submitFeedbackHandler | rating | 上边界 | `5` | 通过 |
| activityController.ts | submitFeedbackHandler | rating | 上边界+1 | `6` | 返回 400 |
| activityController.ts | submitFeedbackHandler | rating | 极端数据 | `3.5` | **风险**：`rating < 1 \|\| rating > 5` 检查通过，但 DB CHECK 约束可能拒绝 |
| activityController.ts | submitFeedbackHandler | rating | 空值 | `null` | `!rating` 为 true，返回 400 |
| activityController.ts | submitFeedbackHandler | rating | 空值 | `0` | `!rating` 为 true（0是falsy），被误判为空 |
| activityController.ts | setReminderHandler | remindAt | 隐式边界 | 活动已开始 | `remindAt <= new Date()`，返回 400 |
| activityController.ts | getActivityStatsHandler | startDate | 极端数据 | SQL 注入片段 | **风险**：直接拼接到 SQL，存在注入风险 |
| activityController.ts | getActivityStatsHandler | endDate | 极端数据 | `"2020-01-01' OR '1'='1"` | **风险**：SQL 注入 |

---

### 2.4 树洞帖子模块

| 模块/文件 | 函数/接口 | 参数名 | 边界类型 | 输入值 | 预期行为 |
|-----------|-----------|--------|----------|--------|----------|
| postController.ts | createPostHandler | title | 空值 | `""` | 返回 400，"标题不能为空" |
| postController.ts | createPostHandler | title | 空值 | `"   "`（纯空格） | 返回 400（trim 后为空） |
| postController.ts | createPostHandler | title | 极端数据 | `"a".repeat(201)` | **风险**：DB VARCHAR(200)，可能截断 |
| postController.ts | createPostHandler | content | 空值 | `""` | 返回 400，"内容不能为空" |
| postController.ts | createPostHandler | content | 极端数据 | `"a".repeat(65536)`（超长文本） | **风险**：TEXT 类型可存储，但可能影响性能 |
| postController.ts | createPostHandler | content | 极端数据 | SQL 注入片段 `"'; DROP TABLE posts; --"` | 参数化查询应安全处理 |
| postController.ts | createPostHandler | content | 极端数据 | XSS 片段 `<script>alert(1)</script>` | 应通过内容过滤 |
| postRoutes.ts | POST /api/posts/:id/audit | status | 下边界 | `0`（待审核） | 通过 |
| postRoutes.ts | POST /api/posts/:id/audit | status | 上边界 | `2`（已拒绝） | 通过 |
| postRoutes.ts | POST /api/posts/:id/audit | status | 上边界+1 | `3` | 返回 400 |
| postRoutes.ts | POST /api/posts/:id/audit | status | 极端数据 | `-1` | 返回 400 |
| postRoutes.ts | POST /api/posts/:id/audit | audit_remark | 上边界 | `"a".repeat(500)` | 通过 |
| postRoutes.ts | POST /api/posts/:id/audit | audit_remark | 上边界+1 | `"a".repeat(501)` | 返回 400 |
| postController.ts | getPostByIdHandler | id | 极端数据 | `NaN` | 返回 400，"无效的帖子ID" |
| postController.ts | getPostByIdHandler | id | 极端数据 | `-1` | 通过 isNaN，但 findPostById 返回 null |
| postController.ts | createCommentHandler | content | 空值 | `""` | 返回 400，"评论内容不能为空" |
| postController.ts | createCommentHandler | content | 极端数据 | `"a".repeat(10000)` | **风险**：无长度限制，TEXT 可存储但可能影响性能 |
| postController.ts | getPostsHandler | page | 极端数据 | `0` | `parseInt("0")=0 \|\| 1` → 1 |
| postController.ts | getPostsHandler | pageSize | 极端数据 | `-1` | `parseInt("-1")=-1 \|\| 10` → 10 |
| postController.ts | getPostsHandler | pageSize | 极端数据 | `Number.MAX_VALUE` | **风险**：无上限限制 |

---

### 2.5 AI 咨询模块

| 模块/文件 | 函数/接口 | 参数名 | 边界类型 | 输入值 | 预期行为 |
|-----------|-----------|--------|----------|--------|----------|
| counselingController.ts | counselingHandler | message | 空值 | `""` | 返回 400，"消息内容不能为空" |
| counselingController.ts | counselingHandler | message | 空值 | `"   "`（纯空格） | 返回 400（trim 后为空） |
| counselingController.ts | counselingHandler | message | 下边界 | `"a"`（1字符） | 通过 |
| counselingController.ts | counselingHandler | message | 上边界 | `"a".repeat(1000)` | 通过 |
| counselingController.ts | counselingHandler | message | 上边界+1 | `"a".repeat(1001)` | 返回 400，"消息内容不能超过1000字" |
| counselingController.ts | counselingHandler | message | 极端数据 | 包含风险关键词 `"自杀"` | 正常处理，标记风险等级 |
| counselingController.ts | counselingHandler | context | 空值 | `undefined` | 通过，不添加上下文 |
| counselingController.ts | counselingHandler | context | 空值 | `[]`（空数组） | 通过 |
| counselingController.ts | counselingHandler | context | 极端数据 | 超长对话历史（100条） | `slice(-10)` 只取最近10条，输入截断安全 |
| counselingController.ts | counselingHandler | context | 极端数据 | 非数组 `"string"` | `Array.isArray` 检查，不添加上下文 |
| counselingController.ts | counselingHandler | context | 极端数据 | 包含非法 role 的上下文 | 只处理 user/assistant，其他忽略 |

---

### 2.6 AI 解读与报告模块

| 模块/文件 | 函数/接口 | 参数名 | 边界类型 | 输入值 | 预期行为 |
|-----------|-----------|--------|----------|--------|----------|
| aiInterpretationController.ts | validateInterpretation | totalScore | 下边界 | `0` | 通过 |
| aiInterpretationController.ts | validateInterpretation | totalScore | 下边界-1 | `-1` | 返回 400 |
| aiInterpretationController.ts | validateInterpretation | totalScore | 极端数据 | `Number.MAX_VALUE` | **风险**：无上限，可能影响 AI 提示词 |
| aiInterpretationController.ts | validateInterpretation | maxScore | 下边界 | `0` | 通过 |
| aiInterpretationController.ts | validateInterpretation | maxScore | 极端数据 | `0`（totalScore > maxScore） | **风险**：无交叉校验，可能产生无意义结果 |
| aiInterpretationController.ts | validateInterpretation | itemScores | 下边界 | `[]` | 返回 400 |
| aiInterpretationController.ts | validateInterpretation | itemScores | 极端数据 | 超长数组（1000个元素） | **风险**：无上限，可能影响性能 |
| aiInterpretationController.ts | validateMoodReport | averageIntensity | 下边界 | `0` | 通过 |
| aiInterpretationController.ts | validateMoodReport | averageIntensity | 极端数据 | `-1` | 返回 400 |
| aiInterpretationController.ts | validateMoodReport | averageIntensity | 极端数据 | `3.1415926535`（高精度浮点） | 通过 |
| aiInterpretationController.ts | validateMoodReport | averageIntensity | 极端数据 | `Number.MAX_VALUE` | **风险**：无上限 |
| aiInterpretationController.ts | validateMoodReport | type | 上边界 | `"monthly"` | 通过 |
| aiInterpretationController.ts | validateMoodReport | type | 极端数据 | `"yearly"` | 返回 400 |
| aiInterpretationRoutes.ts | POST /api/ai/interpretation | message | 下边界 | `"a"`（1字符） | 通过 |
| aiInterpretationRoutes.ts | POST /api/ai/interpretation | message | 上边界 | `"a".repeat(1000)` | 通过 |
| aiInterpretationRoutes.ts | POST /api/ai/interpretation | message | 上边界+1 | `"a".repeat(1001)` | 返回 400 |

---

### 2.7 AI 历史记录模块

| 模块/文件 | 函数/接口 | 参数名 | 边界类型 | 输入值 | 预期行为 |
|-----------|-----------|--------|----------|--------|----------|
| aiHistoryController.ts | saveHistory | analysis_type | 空值 | `undefined` | 返回 400，"缺少必要参数" |
| aiHistoryController.ts | saveHistory | analysis_content | 空值 | `undefined` | 返回 400 |
| aiHistoryController.ts | saveHistory | analysis_type | 极端数据 | `"a".repeat(51)` | **风险**：DB VARCHAR(50)，可能截断 |
| aiHistoryController.ts | listHistory | page | 下边界 | `0` | `Math.max(1, 0)` → 1 |
| aiHistoryController.ts | listHistory | page | 下边界 | `-1` | `Math.max(1, -1)` → 1 |
| aiHistoryController.ts | listHistory | pageSize | 下边界 | `0` | `Math.max(1, 0)` → 1 → `Math.min(100, 1)` → 1 |
| aiHistoryController.ts | listHistory | pageSize | 上边界 | `100` | `Math.min(100, 100)` → 100 |
| aiHistoryController.ts | listHistory | pageSize | 上边界+1 | `101` | `Math.min(100, 101)` → 100 |
| aiHistoryController.ts | listHistory | pageSize | 极端数据 | `-1` | `Math.max(1, -1)` → 1 |
| aiHistoryController.ts | getHistoryDetail | id | 极端数据 | `NaN` | 返回 400，"无效的 ID" |
| aiHistoryController.ts | getHistoryDetail | id | 极端数据 | `-1` | 通过 isNaN，但 getHistoryDetail 返回 null |

---

### 2.8 管理后台模块

| 模块/文件 | 函数/接口 | 参数名 | 边界类型 | 输入值 | 预期行为 |
|-----------|-----------|--------|----------|--------|----------|
| managementController.ts | parseAdminMoodListQuery | page | 下边界 | `0` | `Number.isFinite(0) && 0 > 0` → false → 默认1 |
| managementController.ts | parseAdminMoodListQuery | page | 下边界 | `1` | 通过 |
| managementController.ts | parseAdminMoodListQuery | page | 极端数据 | `-1` | `Number.isFinite(-1) && -1 > 0` → false → 默认1 |
| managementController.ts | parseAdminMoodListQuery | page | 极端数据 | `NaN` | `Number.isFinite(NaN)` → false → 默认1 |
| managementController.ts | parseAdminMoodListQuery | pageSize | 下边界 | `0` | → 默认20 |
| managementController.ts | parseAdminMoodListQuery | pageSize | 上边界 | `100` | `Math.min(100, 100)` → 100 |
| managementController.ts | parseAdminMoodListQuery | pageSize | 上边界+1 | `101` | `Math.min(100, 101)` → 100 |
| managementController.ts | parseAdminMoodListQuery | pageSize | 极端数据 | `Number.MAX_VALUE` | `Math.min(100, Math.floor(MAX_VALUE))` → 100 |
| managementController.ts | parseAdminMoodListQuery | userId | 下边界 | `0` | `0 > 0` → false → undefined |
| managementController.ts | parseAdminMoodListQuery | userId | 下边界 | `1` | 通过 |
| managementController.ts | parseAdminMoodListQuery | userId | 极端数据 | `-1` | → undefined |
| managementController.ts | parseAdminMoodListQuery | userId | 极端数据 | `NaN` | `Number.isFinite(NaN)` → false → undefined |
| managementController.ts | adminUsersUpdateRoleHandler | userId | 下边界-1 | `0` | 返回 400 |
| managementController.ts | adminUsersUpdateRoleHandler | userId | 下边界 | `1` | 通过 |
| managementController.ts | adminUsersUpdateRoleHandler | targetRole | 极端数据 | `"superadmin"` | 返回 400 |
| managementController.ts | adminUsersUpdateRoleHandler | targetRole | 极端数据 | `null` | 返回 400 |
| managementController.ts | adminUsersUpdateRoleHandler | targetRole | 极端数据 | `""` | 返回 400 |
| managementController.ts | adminUsersDisableHandler | userId | 极端数据 | 当前登录用户ID | 返回 400，"不能停用当前登录用户" |
| managementController.ts | adminUsersDeleteHandler | userId | 极端数据 | 当前登录用户ID | 返回 400，"不能删除当前登录用户" |
| managementController.ts | getMoodTrendHandler | granularity | 极端数据 | `"month"` | `granularity || 'day'` → 'month'，但接口只支持 day/week |
| managementRoutes.ts | GET /api/admin/moods | page | 下边界 | `0` | 返回 400（isInt min:1） |
| managementRoutes.ts | GET /api/admin/moods | pageSize | 上边界+1 | `101` | 返回 400（isInt max:100） |
| managementRoutes.ts | GET /api/admin/moods | pageSize | 下边界-1 | `0` | 返回 400 |

---

### 2.9 音乐/课程/放松模块

| 模块/文件 | 函数/接口 | 参数名 | 边界类型 | 输入值 | 预期行为 |
|-----------|-----------|--------|----------|--------|----------|
| musicRoutes.ts | POST /api/music | title | 上边界 | `"a".repeat(200)` | 通过 |
| musicRoutes.ts | POST /api/music | title | 上边界+1 | `"a".repeat(201)` | 返回 400 |
| musicRoutes.ts | POST /api/music | artist | 上边界 | `"a".repeat(100)` | 通过 |
| musicRoutes.ts | POST /api/music | artist | 上边界+1 | `"a".repeat(101)` | 返回 400 |
| musicRoutes.ts | POST /api/music | duration | 下边界 | `1` | 通过 |
| musicRoutes.ts | POST /api/music | duration | 下边界-1 | `0` | 返回 400 |
| musicRoutes.ts | POST /api/music | duration | 极端数据 | `-1` | 返回 400 |
| musicRoutes.ts | POST /api/music | duration | 极端数据 | `Number.MAX_VALUE` | **风险**：无上限，可能溢出 |
| musicRoutes.ts | POST /api/music | category | 上边界 | `"a".repeat(50)` | 通过 |
| musicRoutes.ts | POST /api/music | category | 上边界+1 | `"a".repeat(51)` | 返回 400 |
| courseRoutes.ts | POST /api/courses | title | 上边界 | `"a".repeat(200)` | 通过 |
| courseRoutes.ts | POST /api/courses | title | 上边界+1 | `"a".repeat(201)` | 返回 400 |
| courseRoutes.ts | POST /api/courses | description | 上边界 | `"a".repeat(5000)` | 通过 |
| courseRoutes.ts | POST /api/courses | description | 上边界+1 | `"a".repeat(5001)` | 返回 400 |
| courseRoutes.ts | POST /api/courses | category | 上边界+1 | `"a".repeat(51)` | 返回 400 |
| relaxRoutes.ts | POST /api/relax | mode | 极端数据 | `"meditation"` | 返回 400 |
| relaxRoutes.ts | POST /api/relax | duration | 下边界 | `1` | 通过 |
| relaxRoutes.ts | POST /api/relax | duration | 下边界-1 | `0` | 返回 400 |
| relaxRoutes.ts | POST /api/relax | duration | 极端数据 | `Number.MAX_VALUE` | **风险**：无上限，可能溢出 |

---

### 2.10 测评问卷模块

| 模块/文件 | 函数/接口 | 参数名 | 边界类型 | 输入值 | 预期行为 |
|-----------|-----------|--------|----------|--------|----------|
| questionnaireRoutes.ts | POST /api/questionnaire/answers | answers[].score | 下边界 | `0` | 通过 |
| questionnaireRoutes.ts | POST /api/questionnaire/answers | answers[].score | 上边界 | `4` | 通过 |
| questionnaireRoutes.ts | POST /api/questionnaire/answers | answers[].score | 下边界-1 | `-1` | 返回 400 |
| questionnaireRoutes.ts | POST /api/questionnaire/answers | answers[].score | 上边界+1 | `5` | 返回 400 |
| questionnaireRoutes.ts | POST /api/questionnaire/answers | answers[].score | 极端数据 | `3.5` | 返回 400（isInt 不通过） |

---

### 2.11 加密与安全模块

| 模块/文件 | 函数/接口 | 参数名 | 边界类型 | 输入值 | 预期行为 |
|-----------|-----------|--------|----------|--------|----------|
| encryption.ts | encrypt | text | 空值 | `""` | 原样返回 `""` |
| encryption.ts | encrypt | text | 空值 | `null`（通过 encryptField） | 返回 null |
| encryption.ts | encrypt | text | 极端数据 | `"a".repeat(1000000)`（1MB文本） | **风险**：可能内存消耗过大 |
| encryption.ts | decrypt | encryptedData | 空值 | `""` | 原样返回 `""` |
| encryption.ts | decrypt | encryptedData | 极端数据 | 非 JSON 字符串 | 返回原值（`!startsWith("{")` 检查） |
| encryption.ts | decrypt | encryptedData | 极端数据 | 损坏的加密数据 | 返回原值（catch 后降级） |
| encryption.ts | getKey | ENCRYPTION_KEY | 极端数据 | 长度不足32字节的 hex | 抛出错误 |
| encryption.ts | getKey | ENCRYPTION_KEY | 极端数据 | 非 hex 字符串 | Buffer.from 可能产生不同长度 |
| authService.ts | login | redis | 极端数据 | Redis 不可用（lastError 非空） | 跳过锁定检查，降级运行 |
| authService.ts | login | JWT_SECRET | 空值 | `undefined` | 抛出 500 错误 |

---

### 2.12 前端表单验证

| 模块/文件 | 函数/接口 | 参数名 | 边界类型 | 输入值 | 预期行为 |
|-----------|-----------|--------|----------|--------|----------|
| validation.ts | validateForm | data | 空值 | `{}`（空对象） | 遍历 rules，逐个校验 |
| validation.ts | validateForm | rules | 空值 | `{}`（空 rules） | 返回 `{isValid: true, errors: []}` |
| validation.ts | isValidVerificationCode | code | 下边界-1 | `"12345"`（5位，默认length=6） | 返回 false |
| validation.ts | isValidVerificationCode | code | 下边界 | `"123456"`（6位） | 返回 true |
| validation.ts | isValidVerificationCode | code | 极端数据 | `"abcdef"`（6位字母） | 返回 false |
| validation.ts | isValidVerificationCode | length | 极端数据 | `0` | `new RegExp("^\\d{0}$")` 匹配空字符串 |
| Login.vue | handleFieldInput | form.username | 极端数据 | 超长字符串 | **风险**：无长度限制，仅后端校验 |
| Register.vue | form.password | password | 极端数据 | 超长字符串（10000字符） | **风险**：前端无上限 |

---

## 3. 边界风险清单

### 高风险 (P0)

| 编号 | 风险描述 | 所在文件 | 影响 |
|------|----------|----------|------|
| B-RISK-001 | **活动统计 SQL 注入**：`getActivityStatsHandler` 中 `startDate`/`endDate` 直接拼接到 SQL 语句，未使用参数化查询 | activityController.ts:402-411 | 可能导致 SQL 注入攻击 |
| B-RISK-002 | **密码无长度上限**：注册和登录接口均未对密码设置最大长度，前端也无限定 | authRoutes.ts:39, Login.vue | 超长密码可能导致 bcrypt 哈希性能问题或 DoS 攻击 |
| B-RISK-003 | **分页 limit/pageSize 无上限**：多个控制器中 `parseInt` 后无 `Math.min` 上限限制 | activityController.ts:19, moodController.ts:116, postController.ts:96 | 恶意请求可能传入极大值导致数据库全表扫描、内存耗尽 |
| B-RISK-004 | **活动评分 0 值误判**：`if (!rating)` 将 0 作为 falsy 值处理，虽然评分范围是 1-5，但逻辑不严谨 | activityController.ts:336 | 代码可读性差，若评分范围变更可能引入 bug |

### 中风险 (P1)

| 编号 | 风险描述 | 所在文件 | 影响 |
|------|----------|----------|------|
| B-RISK-005 | **活动起止时间无交叉校验**：`createActivityHandler` 和 `updateActivityHandler` 均未校验 `startTime < endTime` | activityController.ts:165-189 | 可能创建结束时间早于开始时间的无效活动 |
| B-RISK-006 | **评论内容无长度限制**：`createCommentHandler` 中 content 仅检查非空，未限制长度 | postController.ts:183-185 | 超长评论可能影响数据库和前端展示性能 |
| B-RISK-007 | **标签名无长度限制**：`createTagHandler` 中 name 仅检查非空和类型，未校验长度 | moodController.ts:311 | 超长标签名可能被数据库截断或导致存储错误 |
| B-RISK-008 | **情绪标签数组无上限**：`recordMood` 中 tagIds/tagNames 数组无大小限制 | moodController.ts:48,90 | 恶意请求可能创建大量标签，消耗数据库资源 |
| B-RISK-009 | **帖子标题长度未在控制器校验**：`createPostHandler` 仅检查非空，DB VARCHAR(200) 约束可能导致截断 | postController.ts:25-27 | 超长标题被截断，用户体验差 |
| B-RISK-010 | **放松时长无上限**：`duration` 仅校验 `min:1`，无最大值 | relaxRoutes.ts, musicRoutes.ts | 极大值可能溢出或产生无意义数据 |
| B-RISK-011 | **AI 解读 totalScore 无上限**：`isInt({ min: 0 })` 无最大值 | aiInterpretationController.ts:11 | 极大值可能导致 AI 提示词异常或 token 消耗过大 |
| B-RISK-012 | **测评 itemScores 数组无上限**：`isArray({ min: 1 })` 无最大值 | aiInterpretationController.ts:13 | 超大数组可能导致性能问题 |

### 低风险 (P2)

| 编号 | 风险描述 | 所在文件 | 影响 |
|------|----------|----------|------|
| B-RISK-013 | **用户名长度 DB 与验证不一致**：路由验证 3-20 字符，但 DB VARCHAR(50)，前端验证 3-20 | authRoutes.ts, users migration | 虽然多层一致，但 DB 层预留了更大空间 |
| B-RISK-014 | **情绪强度为浮点数时 isInt 校验拒绝**：虽然合理，但 `Number("3.14")` 在旧逻辑中可通过 | moodController.ts:73 | 旧版兼容路径可能接受浮点数，新版 emotions 路径拒绝 |
| B-RISK-015 | **页面参数负值处理不一致**：部分用 `parseInt \|\| 1`，部分用 `Math.max(1, ...)` | 多个控制器 | 负值在某些控制器中可能被误接受 |
| B-RISK-016 | **加密文本无大小限制**：`encrypt()` 函数对大文本无保护 | encryption.ts:28-29 | 1MB 以上文本加密可能导致内存问题 |
| B-RISK-017 | **前端表单无密码最大长度限制**：Register.vue 仅设 `minlength="6"`，无 `maxlength` | Register.vue:31 | 用户可能输入超长密码 |
| B-RISK-018 | **日期格式在前端无校验**：活动创建/编辑时日期选择器可能提交非法格式 | 前端活动相关视图 | 依赖后端 express-validator 拦截 |
| B-RISK-019 | **email 字段在注册时 optional 但登录时不可用**：注册允许 email 为空，但未设置默认值 | authRoutes.ts:40-43 | 用户注册时未填邮箱，后续功能可能受影响 |
| B-RISK-020 | **数据库 TEXT 列无应用层校验**：note、description、content 等 TEXT 列在控制器层无长度校验 | 多个控制器 | 超大数据可能影响 MySQL 性能和存储 |

---

## 总结

本次边界值测试分析共覆盖 **12 个功能模块**，设计 **180+ 个边界值测试用例**，发现 **20 个边界风险项**：

- **P0 高风险**：4 个（SQL 注入、密码无上限、分页无上限、0 值误判）
- **P1 中风险**：8 个（时间校验缺失、长度限制缺失、数组无上限等）
- **P2 低风险**：8 个（不一致问题、潜在性能问题、前端校验缺失等）

整体来看，项目在多数核心接口上已通过 express-validator 设置了基本的边界校验，但仍有以下系统性不足：
1. 控制器层手动分页解析缺少统一的上限保护
2. 部分字段（密码、评论、标签）缺少最大长度限制
3. 业务逻辑校验（如时间先后、分数字段）存在遗漏
4. SQL 拼接处存在注入风险