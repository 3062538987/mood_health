# 安全最佳实践审查报告

**项目**: 情绪健康管理系统 (Mood Health)  
**审查日期**: 2026-07-16  
**技术栈**: 后端 Express 5.x + TypeScript, 前端 Vue 3 + TypeScript  
**审查范围**: 后端 (mood_health_server/src/) + 前端 (src/) + 配置文件

---

## 执行摘要

本次安全审查覆盖了项目的后端 Express API、前端 Vue 应用以及配置文件，共发现 **10 个安全发现**（1 个严重，2 个高危，4 个中危，3 个低危）。

**关键发现**:
- 生产环境 JWT 密钥已提交到代码仓库中（严重）
- 前端 JWT Token 存储在 localStorage 中，存在 XSS 窃取风险（高危）
- 两处 `v-html` 未对内容做 HTML 消毒处理（高危）
- 请求体解析未设置大小限制，存在 DoS 风险（中危）

---

## 发现清单

### 严重 (Critical)

---

#### [FINDING-01] 生产环境 JWT 密钥硬编码并提交到代码仓库

- **规则 ID**: EXPRESS-SESS-002
- **严重性**: **Critical**
- **位置**: [mood_health_server/.env.production#L2](file:///c:/Users/EDY/Desktop/论文/mood_health_server/.env.production#L2)
- **证据**:
  ```
  JWT_SECRET=PgXE6IPkc2RytVotObhPnqxlRWj+MJCxJX7s91i3vKg=
  ```
- **影响**: 攻击者获取此密钥后可伪造任意用户的 JWT Token，以任意身份（包括管理员）登录系统，完全绕过认证机制。
- **修复方案**:
  1. 立即轮换此 JWT 密钥
  2. 将 `.env.production` 加入 `.gitignore`（或删除其中的敏感值）
  3. 生产环境密钥应通过环境变量注入（如 Docker Compose 的 `environment` 或 secrets manager），而不是硬编码在文件中
  4. 若 `.env.production` 已推送至远程仓库，需在 Git 历史中彻底清除（使用 `git filter-branch` 或 `BFG Repo-Cleaner`）
- **缓解措施**: 在密钥轮换完成前，确保仓库访问权限受到严格控制

---

### 高危 (High)

---

#### [FINDING-02] 前端 JWT Token 存储在 localStorage 中

- **规则 ID**: VUE-AUTH-001 / JS-STORAGE-001
- **严重性**: **High**
- **位置**: [src/stores/userStore.ts#L19](file:///c:/Users/EDY/Desktop/论文/src/stores/userStore.ts#L19), [src/stores/userStore.ts#L32](file:///c:/Users/EDY/Desktop/论文/src/stores/userStore.ts#L32), [src/utils/request.ts#L107](file:///c:/Users/EDY/Desktop/论文/src/utils/request.ts#L107)
- **证据**:
  ```typescript
  // userStore.ts:19
  const token = ref<string>(localStorage.getItem('token') || '')
  // userStore.ts:32
  localStorage.setItem('token', newToken)
  // request.ts:107
  const token = localStorage.getItem('token')
  ```
- **影响**: 任何 XSS 漏洞（包括第三方依赖中的 XSS）都可直接读取 localStorage 中的 JWT Token 并发送给攻击者，导致账户接管。Token 有效期为 7 天，攻击窗口较长。
- **修复方案**:
  1. **(推荐)** 改用 HttpOnly Cookie 存储 session token，由后端 `Set-Cookie` 设置，前端自动携带
  2. 若必须使用 Bearer Token，将 Token 仅保存在内存中（Pinia store 变量），页面刷新后要求重新登录
  3. 缩短 Token 有效期（如 15 分钟），配合 Refresh Token 机制（Refresh Token 使用 HttpOnly Cookie）
  4. 作为过渡方案，添加严格的 CSP 策略防止 XSS 执行
- **缓解措施**: 部署 CSP 头（`script-src` 限制），减少 XSS 攻击面

---

#### [FINDING-03] v-html 渲染未消毒的 HTML 内容，存在 XSS 风险

- **规则 ID**: VUE-XSS-001
- **严重性**: **High**
- **位置 1**: [src/views/improve/CourseDetail.vue#L34](file:///c:/Users/EDY/Desktop/论文/src/views/improve/CourseDetail.vue#L34)
  ```html
  <div class="article-content" v-html="course.content"></div>
  ```
- **位置 2**: [src/views/improve/QuestionnaireResult.vue#L45](file:///c:/Users/EDY/Desktop/论文/src/views/improve/QuestionnaireResult.vue#L45)
  ```html
  <div class="ai-content" v-html="aiContentHtml"></div>
  ```
- **影响**: 
  - CourseDetail: 若课程内容被管理员或数据库注入恶意脚本，所有查看该课程的用户将执行攻击代码
  - QuestionnaireResult: AI 返回的内容若被污染（如 API 中间人攻击），可能导致 XSS
- **修复方案**:
  1. 对 `course.content` 使用 HTML 消毒库（如 `DOMPurify`）处理后再渲染
  2. 对 AI 返回内容同样使用 `DOMPurify` 消毒
  3. 示例代码：
     ```typescript
     import DOMPurify from 'dompurify'
     const sanitizedContent = DOMPurify.sanitize(rawContent)
     ```
  4. 若内容为 Markdown，使用安全的 Markdown 渲染器（如 `marked` + `DOMPurify`）
- **缓解措施**: 部署严格的 CSP 策略

---

### 中危 (Medium)

---

#### [FINDING-04] express.json() 未设置请求体大小限制

- **规则 ID**: EXPRESS-BODY-001
- **严重性**: **Medium**
- **位置**: [mood_health_server/src/app.ts#L72](file:///c:/Users/EDY/Desktop/论文/mood_health_server/src/app.ts#L72)
- **证据**:
  ```typescript
  app.use(express.json())
  ```
- **影响**: 攻击者可发送超大 JSON 请求体导致服务器内存耗尽（DoS）。Express 默认限制为 100KB，但显式设置更安全且便于审计。
- **修复方案**:
  ```typescript
  app.use(express.json({ limit: '1mb' }))
  ```
  根据业务需求调整限制值（如文件上传接口可单独放宽）

---

#### [FINDING-05] 未禁用 X-Powered-By 响应头

- **规则 ID**: EXPRESS-FINGERPRINT-001
- **严重性**: **Medium**
- **位置**: [mood_health_server/src/app.ts](file:///c:/Users/EDY/Desktop/论文/mood_health_server/src/app.ts) (缺失)
- **证据**: 未找到 `app.disable('x-powered-by')` 调用
- **影响**: 暴露服务器使用 Express 框架，为攻击者提供版本指纹信息，便于针对性攻击。
- **修复方案**:
  在 `createApp()` 函数中，helmet() 之后添加：
  ```typescript
  app.disable('x-powered-by')
  ```

---

#### [FINDING-06] 生产环境文件 .env.production 未加入 .gitignore

- **规则 ID**: VUE-SECRETS-001 / General
- **严重性**: **Medium**
- **位置**: [mood_health_server/.env.production](file:///c:/Users/EDY/Desktop/论文/mood_health_server/.env.production)
- **证据**: `.gitignore` 中仅包含 `.env`，未包含 `.env.production`。该文件现包含真实 JWT 密钥。
- **影响**: 敏感配置可能被意外提交到版本控制。
- **修复方案**:
  1. 在 `.gitignore` 中添加 `mood_health_server/.env.production`
  2. 创建 `.env.production.example` 模板文件（不含真实密钥）供部署参考
  3. 使用 `git rm --cached mood_health_server/.env.production` 从 Git 跟踪中移除

---

#### [FINDING-07] 登录接口缺少用户名粒度的频率限制

- **规则 ID**: EXPRESS-AUTH-001
- **严重性**: **Medium**
- **位置**: [mood_health_server/src/app.ts#L127-L133](file:///c:/Users/EDY/Desktop/论文/mood_health_server/src/app.ts#L127-L133)
- **证据**:
  ```typescript
  const limiter = rateLimit({
    windowMs: loginRateLimitWindowMs,
    max: loginRateLimitMax,
    message: '请求过于频繁，请稍后再试',
  })
  app.use('/api/auth/login', limiter)
  ```
- **影响**: 当前仅按 IP 限流。攻击者可使用多个 IP 对同一用户名进行暴力破解，或同一 IP 尝试多个用户名。缺少按用户名粒度的锁定机制。
- **修复方案**:
  1. 使用 `rate-limiter-flexible` 实现按用户名+IP 的双重限流
  2. 连续失败 N 次后锁定账户一段时间
  3. 添加验证码机制（如 5 次失败后要求验证码）
- **备注**: 此为增强建议，当前已有基本的 IP 限流，风险较低

---

### 低危 (Low)

---

#### [FINDING-08] 前端广泛使用 localStorage 存储用户偏好

- **规则 ID**: JS-STORAGE-001
- **严重性**: **Low**
- **位置**: 
  - [src/views/user/Setting.vue#L265-L297](file:///c:/Users/EDY/Desktop/论文/src/views/user/Setting.vue#L265-L297)
  - [src/components/relax/MoodWoodenFish.vue#L83-L97](file:///c:/Users/EDY/Desktop/论文/src/components/relax/MoodWoodenFish.vue#L83-L97)
  - [src/stores/moodRecordStore.ts#L378](file:///c:/Users/EDY/Desktop/论文/src/stores/moodRecordStore.ts#L378)
- **影响**: 用户偏好设置（提醒时间、音效、草稿）存储在 localStorage 中，可被 XSS 篡改，但非敏感数据，影响有限。
- **修复方案**: 当前用法可接受。建议不做改动，但需注意：从 localStorage 读取的值应始终做类型校验，不可信任。

---

#### [FINDING-09] Helmet CSP 未配置

- **规则 ID**: EXPRESS-HEADERS-001
- **严重性**: **Low**
- **位置**: [mood_health_server/src/app.ts#L70](file:///c:/Users/EDY/Desktop/论文/mood_health_server/src/app.ts#L70)
- **证据**:
  ```typescript
  app.use(helmet())
  ```
  Helmet 已启用，但未配置 CSP（Content-Security-Policy）。
- **影响**: 缺少 CSP 作为 XSS 防御的纵深防线。考虑到前端使用了 `v-html`，CSP 尤为重要。
- **修复方案**:
  ```typescript
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }))
  ```
- **备注**: CSP 配置需根据实际资源加载情况调整，建议先在 Report-Only 模式下测试。

---

#### [FINDING-10] 生产环境启用开发模式 Demo 种子数据

- **规则 ID**: General
- **严重性**: **Low**
- **位置**: [.env.production.example#L20](file:///c:/Users/EDY/Desktop/论文/.env.production.example#L20) (模板中已正确)
- **证据**: 当前 `.env` 文件中 `ALLOW_DEMO_SEED=true`。`.env.production.example` 模板中已正确设置为 `false`。
- **影响**: 若生产环境误用开发配置，会创建 Demo 用户和已知密码。
- **修复方案**: 
  1. 确保生产部署流程使用独立的 `.env.production` 文件
  2. 在生产环境的 Docker Compose 或部署脚本中强制设置 `ALLOW_DEMO_SEED=false`
- **备注**: 当前 `.env` 仅用于本地开发，影响有限

---

## 已确认安全项

以下方面经过审查，确认符合安全最佳实践：

| 检查项 | 状态 |
|--------|------|
| SQL 注入防护（使用参数化查询） | 通过 |
| Helmet 安全头（基本配置） | 通过 |
| 自定义错误处理器（避免堆栈泄露） | 通过 |
| CORS 白名单配置 | 通过 |
| 密码加密（bcrypt + salt） | 通过 |
| 数据加密（AES-256-GCM） | 通过 |
| RBAC 权限控制 | 通过 |
| 审计日志记录 | 通过 |
| 无 eval/child_process 等危险调用 | 通过 |
| 无 Node.js --inspect 暴露 | 通过 |
| 认证使用 Bearer Token（非 Cookie，无 CSRF 风险） | 通过 |
| rate-limit 中间件已配置 | 通过 |
| .env 已加入 .gitignore | 通过 |
| Vite 仅暴露必要的 VITE_ 前缀变量 | 通过 |
| 前端路由守卫仅用于 UX，后端做权限强制 | 通过 |

---

## 优先级修复建议

1. **立即修复**: [FINDING-01] 轮换 JWT 密钥并清理 Git 历史
2. **本周内修复**: [FINDING-02] Token 存储方案, [FINDING-03] v-html 消毒
3. **下次迭代**: [FINDING-04] 请求体限制, [FINDING-05] X-Powered-By, [FINDING-06] Gitignore, [FINDING-09] CSP 配置
4. **后续优化**: [FINDING-07] 登录频率限制, [FINDING-08] localStorage 偏好, [FINDING-10] Demo 种子

---

*报告生成时间: 2026-07-16 | 审查工具: 安全最佳实践技能 (Security Best Practices Skill)*