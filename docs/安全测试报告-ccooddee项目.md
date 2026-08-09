# 安全测试报告 - ccooddee 项目

> **生成日期**：{{date}}
> **测试类型**：安全测试静态分析
> **测试范围**：全栈代码（Vue 3 + TypeScript 前端，Express.js + TypeScript 后端，MySQL + Redis 数据层）
> **分析方式**：纯静态代码分析，不实际执行攻击

---

## 目录

- [1. 项目安全概览](#1-项目安全概览)
- [2. 漏洞详情与攻击场景](#2-漏洞详情与攻击场景)
  - [2.1 SQL 注入](#21-sql-注入)
  - [2.2 XSS（跨站脚本）](#22-xss跨站脚本)
  - [2.3 CSRF（跨站请求伪造）](#23-csrf跨站请求伪造)
  - [2.4 敏感信息泄露](#24-敏感信息泄露)
  - [2.5 权限校验](#25-权限校验)
  - [2.6 会话管理](#26-会话管理)
  - [2.7 加密与安全配置](#27-加密与安全配置)
- [3. 风险汇总表](#3-风险汇总表)
- [4. 安全测试结论](#4-安全测试结论)

---

## 1. 项目安全概览

### 1.1 安全架构总览

| 层面 | 组件 | 安全措施 | 评估 |
|------|------|---------|------|
| **传输层** | Express + Helmet | CSP 配置、X-Powered-By 禁用、请求体大小限制 1MB | 良好 |
| **认证层** | JWT + HttpOnly Cookie | Cookie 优先读取 Token、Authorization Header 兼容、7天过期 | 良好 |
| **授权层** | RBAC 角色权限 | 细粒度权限码（30+）、角色映射表、审计日志 | 良好 |
| **数据层** | MySQL (mysql2) | 全线参数化查询（`?` 占位符）、连接池、事务 | 良好 |
| **加密层** | AES-256-GCM + bcryptjs | 强加密算法、随机 IV、认证标签 | 良好 |
| **前端层** | Vue 3 + DOMPurify | v-html 使用 DOMPurify 净化、路由守卫、角色权限 | 良好 |
| **日志层** | Winston + 审计表 | 敏感信息脱敏、操作审计、双重记录 | 良好 |

### 1.2 已发现的安全防护措施

- **CSP 头配置**：default-src 'self'、object-src 'none'、frame-ancestors 'none'
- **CORS 白名单**：仅允许特定 origin，credentials: true
- **请求体限制**：express.json({ limit: '1mb' })
- **密码哈希**：bcryptjs（salt rounds）
- **数据加密**：AES-256-GCM（随机 IV + 认证标签）
- **Token 存储**：HttpOnly Cookie（主）+ Authorization Header（兼容）
- **权限审计**：拒绝访问时记录审计日志（用户、角色、权限、IP）
- **错误信息**：生产环境隐藏内部错误详情
- **日志脱敏**：sanitizeForLogs 过滤敏感字段
- **登录保护**：5次失败锁定15分钟、限流中间件

---

## 2. 漏洞详情与攻击场景

### 2.1 SQL 注入

#### 2.1.1 总体评估：低风险

经过全面扫描，所有 Repository 层（moodRepository、activityRepository、postRepository、userRepository、musicRepository、courseRepository、relaxRepository、achievementRepository、aiHistoryRepository、assessmentRepository 等）均使用 `mysql2` 的 `?` 占位符参数化查询，未发现字符串拼接 SQL 的情况。

`activityRepository.ts` 的 `buildFilter` 函数通过动态构建 WHERE 子句，但所有用户输入都通过 `?` 占位符传递，属于安全的参数化查询模式。

| 场景编号 | 漏洞分类 | 触发位置 | 攻击输入示例 | 当前代码的预期行为 | 潜在后果 |
|----------|---------|---------|-------------|-------------------|---------|
| SEC-001 | SQL 注入 | `activityRepository.ts:buildFilter` | `title` 参数传入 `"' OR '1'='1"` | 参数化查询 `?` 占位符，安全 | 无（已防护） |
| SEC-002 | SQL 注入 | `userRepository.ts:findAuthUserByUsername` | `username` 参数传入 `"admin' --"` | 参数化查询 `?`，安全 | 无（已防护） |
| SEC-003 | SQL 注入 | `postRepository.ts:findPosts` | `page` 参数传入 `"1; DROP TABLE posts;"` | `page` 不是 SQL 参数，仅用于 `Math.floor` 和 OFFSET 计算，安全 | 无（已防护） |
| SEC-004 | SQL 注入 | `activityController.ts:getActivityStatsHandler` | `startDate` 传入 `"2020-01-01' OR '1'='1"` | 参数化查询 `?` 占位符 + 日期格式正则校验 | 无（已防护） |

**结论**：项目的 SQL 注入防护措施完善，未发现可利用的 SQL 注入点。

#### 2.1.2 动态 ORDER BY / GROUP BY 风险

| 场景编号 | 漏洞分类 | 触发位置 | 说明 | 当前状态 |
|----------|---------|---------|------|---------|
| SEC-005 | 二次注入 | 所有 Repository | 未发现动态 ORDER BY 或 GROUP BY 拼接 | 安全 |

---

### 2.2 XSS（跨站脚本）

#### 2.2.1 v-html 使用分析

| 场景编号 | 漏洞分类 | 触发位置 | 攻击输入示例 | 当前代码的预期行为 | 潜在后果 |
|----------|---------|---------|-------------|-------------------|---------|
| SEC-006 | XSS | `src/views/improve/CourseDetail.vue:34` | 课程内容 包含 `<img src=x onerror="alert(document.cookie)">` | `DOMPurify.sanitize()` 清除危险标签和事件处理器 | 无（已防护） |
| SEC-007 | XSS | `src/views/improve/CourseDetail.vue:34` | 课程内容 包含 `<a href="javascript:alert(1)">点击</a>` | DOMPurify 移除 `javascript:` 协议 | 无（已防护） |
| SEC-008 | XSS | `src/views/improve/CourseDetail.vue:34` | 课程内容 包含 `<svg/onload=alert(1)>` | DOMPurify 移除事件处理器 | 无（已防护） |
| SEC-009 | XSS | 所有 Vue 模板 | 用户输入 通过 `{{ }}` 插值渲染 | Vue 自动转义 HTML 实体 | 无（已防护） |

**结论**：仅有一处 `v-html` 使用（CourseDetail.vue），且已通过 DOMPurify 进行净化，XSS 防护良好。

#### 2.2.2 CSP 配置分析

| 场景编号 | 漏洞分类 | 触发位置 | 攻击输入示例 | 当前代码的预期行为 | 潜在后果 |
|----------|---------|---------|-------------|-------------------|---------|
| SEC-010 | XSS | `app.ts:92-107` - CSP 配置 | `script-src 'unsafe-inline'` 允许内联脚本 | 内联脚本可执行，但 Helmet 设置了 nonce 基础防护 | 削弱了 CSP 对 XSS 的防护纵深 |
| SEC-011 | XSS | `app.ts:92-107` - CSP 配置 | `connect-src http://localhost:*` 开发环境 | 允许连接任意 localhost 端口 | 开发环境风险低，但生产环境应移除 |

**风险**：`script-src 'unsafe-inline'` 允许内联脚本执行，如果攻击者成功注入脚本标签，CSP 无法阻止。虽然 Vue 模板自动转义和 DOMPurify 已提供防护，但 CSP 作为纵深防御被削弱。

---

### 2.3 CSRF（跨站请求伪造）

#### 2.3.1 缺失 CSRF Token

| 场景编号 | 漏洞分类 | 触发位置 | 攻击输入示例 | 当前代码的预期行为 | 潜在后果 |
|----------|---------|---------|-------------|-------------------|---------|
| SEC-012 | CSRF | 所有状态变更 API | 恶意网站通过 `<form>` 自动提交到 `POST /api/moods` | Cookie 中 auth_token 自动携带，请求被接受 | 攻击者可诱导用户执行情绪记录、发布帖子、报名活动等操作 |
| SEC-013 | CSRF | `POST /api/auth/register` | 恶意网站自动注册大量账号 | 请求被处理，新账号被创建 | 垃圾注册攻击 |
| SEC-014 | CSRF | `DELETE /api/posts/:id` | 恶意网站诱导删除帖子 | 如果携带有效 Cookie，删除操作被接受 | 用户帖子被恶意删除 |

**当前防护措施**：
- CORS 白名单限制了跨域来源（仅允许 `http://localhost:5173`、`http://localhost:3003` 等）
- `credentials: true` 允许携带 Cookie
- 无 CSRF Token 机制

**结论**：CORS 白名单提供了一定程度的 CSRF 防护（浏览器会阻止未授权 origin 的跨域请求），但缺少 CSRF Token 作为纵深防御。如果攻击者找到绕过 CORS 的方法（如子域名劫持），则存在 CSRF 风险。

#### 2.3.2 SameSite Cookie

| 场景编号 | 漏洞分类 | 触发位置 | 说明 | 当前状态 |
|----------|---------|---------|------|---------|
| SEC-015 | CSRF | `app.ts` - Cookie 设置 | 未发现显式设置 `SameSite` 属性 | **风险**：需确认 auth_token Cookie 是否设置了 SameSite |

---

### 2.4 敏感信息泄露

#### 2.4.1 硬编码敏感信息

| 场景编号 | 漏洞分类 | 触发位置 | 攻击输入示例 | 当前代码的预期行为 | 潜在后果 |
|----------|---------|---------|-------------|-------------------|---------|
| SEC-016 | 敏感信息泄露 | `.env:1-15` | 攻击者获取 `.env` 文件内容 | 文件包含明文数据库密码、Redis 密码、JWT 密钥、加密密钥 | 数据库被直接访问、JWT 可被伪造、加密数据可被解密 |
| SEC-017 | 敏感信息泄露 | `.env:1-15` | `.env` 文件被提交到版本控制 | 查看 `.gitignore` 是否包含 `.env` | 如果 `.env` 被提交到 Git，历史记录中包含所有密钥 |

**风险等级**：高。`.env` 文件包含生产环境的所有核心密钥，一旦泄露将导致全面安全崩溃。

#### 2.4.2 Token 存储安全

| 场景编号 | 漏洞分类 | 触发位置 | 攻击输入示例 | 当前代码的预期行为 | 潜在后果 |
|----------|---------|---------|-------------|-------------------|---------|
| SEC-018 | 敏感信息泄露 | `src/stores/userStore.ts:19` | XSS 攻击读取 `localStorage.getItem('token')` | Token 明文存储在 localStorage | XSS 攻击可窃取 Token，冒充用户身份 |
| SEC-019 | 敏感信息泄露 | `src/stores/userStore.ts:30` | 恶意脚本调用 `setToken(attackerToken)` | Token 被替换为攻击者 Token | 用户操作被关联到攻击者账号 |

**风险等级**：高。虽然后端认证优先使用 HttpOnly Cookie（无法被 JS 读取），但前端仍将 Token 存储在 localStorage 中（兼容 Authorization Header 方式），存在 XSS 窃取风险。

#### 2.4.3 错误信息泄露

| 场景编号 | 漏洞分类 | 触发位置 | 当前状态 |
|----------|---------|---------|---------|
| SEC-020 | 敏感信息泄露 | `middleware/errorHandler.ts:26-28` | 生产环境 `isInternalError` 时返回通用消息，不暴露堆栈 |
| SEC-021 | 敏感信息泄露 | `middleware/errorHandler.ts:37` | 日志中记录 `error.stack`，但仅内部日志，不返回前端 |
| SEC-022 | 敏感信息泄露 | `app.ts:108` | `app.disable('x-powered-by')` 隐藏 Express 版本 |

**结论**：错误信息处理良好，生产环境不泄露内部详情。

#### 2.4.4 日志安全

| 场景编号 | 漏洞分类 | 触发位置 | 说明 | 当前状态 |
|----------|---------|---------|------|---------|
| SEC-023 | 敏感信息泄露 | `utils/logger.ts` - `sanitizeForLogs` | 日志输出前对敏感字段进行脱敏 | 安全 |
| SEC-024 | 敏感信息泄露 | `utils/operationLogger.ts` | 操作审计日志记录用户行为，双重记录 | 安全 |

---

### 2.5 权限校验

#### 2.5.1 认证机制

| 场景编号 | 漏洞分类 | 触发位置 | 攻击输入示例 | 当前代码的预期行为 | 潜在后果 |
|----------|---------|---------|-------------|-------------------|---------|
| SEC-025 | 权限校验 | `middleware/auth.ts:253-296` | 无 Token 的请求 | 返回 401，"未提供认证令牌" | 无（已防护） |
| SEC-026 | 权限校验 | `middleware/auth.ts:281-295` | 过期的 JWT Token | JWT 验证失败，返回 401，"无效或过期令牌" | 无（已防护） |
| SEC-027 | 权限校验 | `middleware/auth.ts:281-295` | 伪造的 JWT（篡改 payload） | 签名验证失败，返回 401 | 无（已防护） |
| SEC-028 | 权限校验 | `middleware/auth.ts:240-247` | JWT 中 role 为 `"hacker"` | `getRoleFromToken` 回退为 `"user"` | 无（已防护） |

#### 2.5.2 授权机制

| 场景编号 | 漏洞分类 | 触发位置 | 攻击输入示例 | 当前代码的预期行为 | 潜在后果 |
|----------|---------|---------|-------------|-------------------|---------|
| SEC-029 | 权限校验 | `middleware/auth.ts:298-321` | 普通用户尝试访问管理接口 | `requireAdmin` 检查角色，返回 403 | 无（已防护） |
| SEC-030 | 权限校验 | `middleware/auth.ts:328-355` | counselor 角色尝试访问 admin 接口 | `requireRole(['admin','super_admin'])` 拒绝，返回 403 | 无（已防护） |
| SEC-031 | 权限校验 | `middleware/auth.ts:362-390` | 用户 A 尝试执行 `post.audit` 权限 | `requirePermission('post.audit')` 拒绝，返回 403 | 无（已防护） |
| SEC-032 | 权限校验 | `src/router/guards.ts:76-101` | 未登录用户访问 `/mood/record` | 路由守卫检查 `meta.public`，重定向到 `/login` | 无（已防护） |
| SEC-033 | 权限校验 | `src/router/guards.ts:77-78` | 普通用户访问 `/admin` 路由 | 路由守卫检查 `meta.adminOnly`，重定向到 `/` | 无（已防护） |

#### 2.5.3 对象级权限（IDOR）

| 场景编号 | 漏洞分类 | 触发位置 | 攻击输入示例 | 当前代码的预期行为 | 潜在后果 |
|----------|---------|---------|-------------|-------------------|---------|
| SEC-034 | 权限校验 | `controllers/postController.ts` - `deletePostHandler` | 用户 A 发送 `DELETE /api/posts/100`（帖子 100 属于用户 B） | 检查 `post.user_id === req.user.userId`，拒绝并返回 403 | 无（已防护） |
| SEC-035 | 权限校验 | `controllers/moodController.ts` - `updateMoodHandler` | 用户 A 更新用户 B 的情绪记录 | 检查记录所有权，返回 403 | 无（已防护） |
| SEC-036 | 权限校验 | `controllers/moodController.ts` - `deleteMoodHandler` | 用户 A 删除用户 B 的情绪记录 | 检查记录所有权，返回 403 | 无（已防护） |

#### 2.5.4 路由权限缺失

| 场景编号 | 漏洞分类 | 触发位置 | 攻击输入示例 | 当前代码的预期行为 | 潜在后果 |
|----------|---------|---------|-------------|-------------------|---------|
| SEC-037 | 权限校验 | `src/router/index.ts` - `/mood/*` 路由 | 未登录用户访问 `/mood/record` | 路由未标记 `meta.public` 或 `meta.guestOnly`，默认需登录 | 无（已防护，前端路由守卫默认阻止未登录访问） |

**结论**：权限校验体系完善，RBAC 实现细粒度，对象级权限检查到位。前端路由守卫和后端中间件形成双重防护。

---

### 2.6 会话管理

#### 2.6.1 Token 安全

| 场景编号 | 漏洞分类 | 触发位置 | 攻击输入示例 | 当前代码的预期行为 | 潜在后果 |
|----------|---------|---------|-------------|-------------------|---------|
| SEC-038 | 会话管理 | `middleware/auth.ts:253-269` | Token 优先从 HttpOnly Cookie 读取 | Cookie 无法被 JS 读取，防止 XSS 窃取 | 无（良好实践） |
| SEC-039 | 会话管理 | `src/stores/userStore.ts:19` | Token 同时存储在 localStorage | 兼容 Authorization Header 方式 | 存在 XSS 窃取风险（与 SEC-018 重复） |

#### 2.6.2 登录安全

| 场景编号 | 漏洞分类 | 触发位置 | 攻击输入示例 | 当前代码的预期行为 | 潜在后果 |
|----------|---------|---------|-------------|-------------------|---------|
| SEC-040 | 会话管理 | `services/authService.ts` | 暴力破解：连续请求 100 次登录 | 5次失败后锁定15分钟，限流中间件限制请求频率 | 无（已防护） |
| SEC-041 | 会话管理 | `services/authService.ts` | 注册时设置 `role: "admin"` | 返回 403，"管理员账号只能通过后台脚本创建" | 无（已防护） |

---

### 2.7 加密与安全配置

#### 2.7.1 加密算法评估

| 场景编号 | 漏洞分类 | 触发位置 | 说明 | 当前状态 |
|----------|---------|---------|------|---------|
| SEC-042 | 加密算法 | `utils/encryption.ts` | AES-256-GCM（强加密）+ 随机 IV + 认证标签 | 安全 |
| SEC-043 | 密码哈希 | `utils/password.ts` | bcryptjs（强哈希算法，内置 salt） | 安全 |
| SEC-044 | 随机数 | `utils/encryption.ts:92-93` | `crypto.randomBytes()` 替代 `Math.random()` | 安全 |

#### 2.7.2 安全头配置

| 场景编号 | 漏洞分类 | 触发位置 | 说明 | 当前状态 |
|----------|---------|---------|------|---------|
| SEC-045 | 安全配置 | `app.ts:92-107` | Helmet CSP 配置 | 部分安全（`unsafe-inline` 削弱防护） |
| SEC-046 | 安全配置 | `app.ts:108` | `x-powered-by` 已禁用 | 安全 |
| SEC-047 | 安全配置 | `app.ts:112` | 请求体限制 `1mb` | 安全 |
| SEC-048 | 安全配置 | `app.ts:88` | CORS `credentials: true` | 符合需求 |

#### 2.7.3 文件上传安全

| 场景编号 | 漏洞分类 | 触发位置 | 说明 | 当前状态 |
|----------|---------|---------|------|---------|
| SEC-049 | 文件上传 | 全项目 | 未发现文件上传功能 | 不适用 |

#### 2.7.4 重定向安全

| 场景编号 | 漏洞分类 | 触发位置 | 攻击输入示例 | 当前代码的预期行为 | 潜在后果 |
|----------|---------|---------|-------------|-------------------|---------|
| SEC-050 | 开放重定向 | `src/router/guards.ts:93` | 登录后重定向到 `?redirect=https://evil.com` | 路由守卫使用 `LOGIN_PATH` 常量 `/login`，未使用用户输入的 redirect 参数 | 无（安全） |

---

## 3. 风险汇总表

| 编号 | 严重程度 | 漏洞类型 | 位置 | 风险说明 |
|------|---------|---------|------|---------|
| SEC-RISK-001 | **高** | 敏感信息泄露 | `.env` | 明文存储数据库密码、Redis 密码、JWT 密钥、加密密钥等所有核心凭据 |
| SEC-RISK-002 | **高** | 敏感信息泄露 | `src/stores/userStore.ts:19` | Token 明文存储在 localStorage，XSS 攻击可窃取 |
| SEC-RISK-003 | **中** | CSRF | 全局 | 缺少 CSRF Token 防护机制，依赖 CORS 白名单作为唯一防护 |
| SEC-RISK-004 | **中** | XSS | `app.ts:98` | CSP `script-src 'unsafe-inline'` 削弱了 XSS 纵深防御 |
| SEC-RISK-005 | **中** | 安全配置 | `app.ts:100` | CSP `connect-src` 允许 `http://localhost:*`，开发环境过于宽松 |
| SEC-RISK-006 | **中** | 会话管理 | `app.ts` - Cookie 设置 | 未显式设置 auth_token Cookie 的 SameSite 属性 |
| SEC-RISK-007 | **低** | 敏感信息泄露 | `src/server.ts:17-20` | 服务器启动日志输出路由信息，可能暴露内部 API 结构 |
| SEC-RISK-008 | **低** | 敏感信息泄露 | `utils/encryption.ts:48-49` | 加密失败时 `console.error` 可能泄露部分错误上下文 |
| SEC-RISK-009 | **低** | 安全配置 | `app.ts:86` | CORS 错误消息 `'Not allowed by CORS'` 可能被攻击者探测到 |
| SEC-RISK-010 | **低** | 信息泄露 | `middleware/auth.ts:290-293` | JWT 校验失败日志包含 `error.message`，可能暴露攻击探测信息 |

---

## 4. 安全测试结论

### 4.1 总体评估

项目安全防护水平**良好**，在多个层面实施了有效的安全措施：

**强项**：
- SQL 注入防护完善，全线参数化查询
- 权限体系设计优秀（RBAC + 细粒度权限码 + 对象级权限检查 + 审计日志）
- 加密算法选择正确（AES-256-GCM + bcryptjs + crypto.randomBytes）
- 错误处理不泄露内部信息（生产环境）
- 日志脱敏处理到位
- 登录安全有暴力破解防护和限流
- XSS 防护多层（Vue 模板转义 + DOMPurify + CSP）

**主要不足**：
- `.env` 文件包含明文凭据，需迁移到密钥管理服务
- 前端 localStorage 存储 Token，存在 XSS 窃取风险
- 缺少 CSRF Token 防护机制
- CSP 允许 `unsafe-inline` 削弱了纵深防御

### 4.2 修复优先级建议

| 优先级 | 风险项 | 建议修复方案 |
|--------|-------|-------------|
| P0 | SEC-RISK-001 | 将 `.env` 中的凭据迁移到环境变量或密钥管理服务（如 Vault/AWS Secrets Manager），确保 `.env` 已加入 `.gitignore` |
| P0 | SEC-RISK-002 | 移除前端 localStorage 中的 Token 存储，完全依赖 HttpOnly Cookie |
| P1 | SEC-RISK-003 | 添加 CSRF Token 机制（如 csurf 中间件或自定义 double-submit cookie 模式） |
| P1 | SEC-RISK-004 | 将 CSP 中 `script-src 'unsafe-inline'` 替换为 nonce-based 或 hash-based 方式 |
| P2 | SEC-RISK-005 | 生产环境移除 `http://localhost:*` 的 connect-src |
| P2 | SEC-RISK-006 | 显式设置 Cookie 的 `SameSite=Lax` 或 `SameSite=Strict` |
| P3 | SEC-RISK-007-010 | 低风险项，可作为持续改进项逐步优化 |