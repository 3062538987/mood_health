# 模块3：统一API契约规范

> 状态：已生效（基于代码现状）
> 日期：2026-07-16
> 版本：v1.0
> 强制范围：所有现有及新增接口必须遵守

---

## 1. 请求基础约定

### 1.1 请求方式

| 操作 | HTTP 方法 | 说明 |
|---|---|---|
| 查询 | GET | 参数通过 Query String 传递 |
| 创建 | POST | 参数通过 Request Body (JSON) 传递 |
| 全量更新 | PUT | 参数通过 Request Body (JSON) 传递 |
| 部分更新 | PATCH | 预留，当前未使用 |
| 删除 | DELETE | 参数通过 URL Path 传递 |

### 1.2 URL 命名风格

```
基础路径: /api/{resource}

- 资源名使用小写复数形式（kebab-case）：/api/moods, /api/cases
- 子资源嵌套不超过 2 层：/api/cases/:id/interventions
- 动作资源使用动词：/api/auth/login, /api/auth/register
- 管理接口使用 /api/admin 前缀：/api/admin/users, /api/admin/moods
- 不使用文件扩展名：禁止 .json, .xml 后缀
- 路径参数使用 :id 形式（Express 风格），非 {id}
```

### 1.3 请求头约定

| 头名称 | 必需 | 说明 |
|---|---|---|
| `Content-Type` | 是 | 固定为 `application/json` |
| `Authorization` | 条件 | 认证接口：`Bearer <jwt_token>` |
| `Accept` | 推荐 | `application/json` |

### 1.4 分页入参标准

分页查询统一使用以下 Query String 参数：

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|---|---|---|---|---|
| `page` | number | 否 | 1 | 页码，从 1 开始 |
| `pageSize` | number | 否 | 20 | 每页记录数，最大 100 |
| `sort` | string | 否 | — | 排序字段，格式 `field:asc` 或 `field:desc` |

分页查询的响应必须包含 `pagination` 元数据（见 2.3 节）。

---

## 2. 全局统一返回结构体

### 2.1 成功响应模板

```json
{
  "code": 0,
  "message": "ok",
  "data": { ... },
  "requestId": "uuid"
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | number | 固定为 `0` 表示成功 |
| `message` | string | 固定为 `"ok"` |
| `data` | any | 业务数据，可以是对象、数组、null |
| `requestId` | string | 请求唯一标识（UUID），用于日志追踪 |

### 2.2 异常响应模板

```json
{
  "code": 40001,
  "message": "用户名已存在",
  "data": null,
  "requestId": "uuid"
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | number | 业务错误码（见 2.4 节） |
| `message` | string | 人类可读的错误描述 |
| `data` | any | 固定为 `null` |
| `requestId` | string | 请求唯一标识 |

### 2.3 分页成功响应模板

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [ ... ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 150,
      "totalPages": 8
    }
  },
  "requestId": "uuid"
}
```

### 2.4 错误码规则

**格式**：`{模块码}{错误序号}`，共 5 位数字。

```
模块码：
  1xxxx — 认证/授权
  2xxxx — 用户
  3xxxx — 情绪记录
  4xxxx — 测评
  5xxxx — 个案
  6xxxx — 管理
  7xxxx — AI 服务
  8xxxx — 系统

错误序号：
  001-099 — 参数校验错误
  100-199 — 业务逻辑错误
  200-299 — 资源不存在
  300-399 — 权限不足
  900-999 — 服务器内部错误
```

**已定义错误码（基于代码现状）**：

| 错误码 | 说明 | 来源模块 |
|---|---|---|
| 10001 | 未认证，请先登录 | 认证 |
| 10002 | 用户名或密码错误 | 认证 |
| 10003 | 用户名已存在 | 认证 |
| 10004 | 权限不足 | 认证 |
| 10005 | Token 无效或已过期 | 认证 |
| 20001 | 用户不存在 | 用户 |
| 20002 | 用户已被禁用 | 用户 |
| 30001 | 情绪记录不存在 | 情绪 |
| 40001 | 测评工具不存在 | 测评 |
| 40002 | 测评会话不存在 | 测评 |
| 50001 | 个案不存在 | 个案 |
| 50002 | 个案状态不允许此操作 | 个案 |
| 89999 | 服务器内部错误 | 系统 |
| 80001 | 请求参数校验失败 | 系统 |

### 2.5 HTTP 状态码约定

| HTTP 状态码 | 使用场景 |
|---|---|
| 200 | 成功（含业务数据） |
| 201 | 资源创建成功 |
| 400 | 参数校验失败 |
| 401 | 未认证 / Token 无效 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 409 | 业务冲突（如用户名重复） |
| 422 | 请求格式正确但语义错误 |
| 500 | 服务器内部错误 |
| 503 | 功能未启用（非核心模块） |

**注意**：HTTP 状态码与业务错误码共同使用。HTTP 状态码表示协议层结果，业务错误码 `code` 表示业务层结果。

---

## 3. 通用数据格式约定

### 3.1 时间格式

| 方向 | 格式 | 示例 |
|---|---|---|
| API 响应 | ISO 8601 字符串 | `"2026-07-16T08:30:00.000Z"` |
| API 请求 | ISO 8601 字符串 | `"2026-07-16T08:30:00.000Z"` |
| 数据库存储 | DATETIME(3) UTC | `2026-07-16 08:30:00.000` |

**规则**：
- 所有 API 时间字段使用 UTC 时区的 ISO 8601 格式
- 前端负责根据用户本地时区展示
- 数据库存储使用 `UTC_TIMESTAMP(3)` 确保一致性

### 3.2 ID 字段命名

| 场景 | 命名 | 类型 | 示例 |
|---|---|---|---|
| 当前资源 ID | `id` | number | `{ "id": 42 }` |
| 外键关联 | `{resource}_id` | number | `{ "user_id": 7 }` |
| 编码字段 | `code` | string | `{ "code": "PHQ9" }` |

**规则**：
- 主键统一使用 `id`，类型为 `number`（数据库 INT UNSIGNED）
- 外键字段使用 `{被引用表名单数}_id` 格式，如 `user_id`、`case_id`
- 编码字段使用 `code`，类型为 `string`

### 3.3 布尔字段

| 方向 | 数据库 | API 响应 | API 请求 |
|---|---|---|---|
| 存储 | `TINYINT(1)`, 0/1 | `boolean` (true/false) | `boolean` (true/false) |

**规则**：
- 数据库层使用 `TINYINT(1)` 存储 0/1
- Repository 层负责将 0/1 映射为 `boolean`
- API 层始终使用 JSON `boolean` 类型

### 3.4 JSON 字段

| 字段后缀 | 含义 | 示例 |
|---|---|---|
| `_json` | 字段值为 JSON 类型 | `options_json`, `scoring_rule_json` |

**规则**：
- 数据库 JSON 列以 `_json` 结尾
- API 响应中自动解析为 JSON 对象/数组
- Repository 层负责 `JSON.parse()` / `JSON.stringify()` 转换

### 3.5 密文字段

| 字段后缀 | 含义 | 存储方式 |
|---|---|---|
| `_ciphertext` | 加密存储 | AES-256-GCM，Base64 编码 |

**规则**：
- 加密字段以 `_ciphertext` 结尾
- Service 层负责加密（写入）和解密（读取）
- API 响应中返回解密后的明文
- 加密密钥由环境变量 `ENCRYPTION_KEY` 提供

---

## 4. 全局异常处理规范

### 4.1 异常处理流程

```
Controller 调用 Service
  ↓ 抛出 BusinessError
Service 调用 Repository
  ↓ 抛出 BusinessError 或 DatabaseError
全局错误中间件 (errorHandler.ts)
  ↓ 统一捕获，格式化响应
API 响应
```

### 4.2 业务异常类 (BusinessError)

```typescript
// 代码中实际使用的异常类（utils/errors.ts）
class BusinessError extends Error {
  code: number;       // 业务错误码
  httpStatus: number; // HTTP 状态码
  constructor(code: number, message: string, httpStatus?: number)
}
```

### 4.3 异常处理规则

| 场景 | 处理方式 | HTTP 状态码 | 业务错误码 |
|---|---|---|---|
| 参数校验失败 | express-validator 检查 → 400 | 400 | 80001 |
| 未认证 | JWT 中间件拦截 → 401 | 401 | 10001 |
| 权限不足 | 权限中间件拦截 → 403 | 403 | 10004 |
| 资源不存在 | Service 抛出 BusinessError | 404 | 2xxxx-4xxxx |
| 业务冲突 | Service 抛出 BusinessError | 409 | 对应业务码 |
| 数据库错误 | Repository 抛出 → 全局捕获 | 500 | 89999 |
| 未捕获异常 | 全局错误中间件捕获 | 500 | 89999 |
| 功能未启用 | 路由中间件返回 503 | 503 | — |

### 4.4 日志记录规范

| 日志级别 | 使用场景 | 示例 |
|---|---|---|
| INFO | 正常业务流程 | 用户登录、情绪记录创建 |
| WARN | 业务异常 | 用户不存在、权限不足 |
| ERROR | 系统异常 | 数据库连接失败、未捕获异常 |

- 审计日志（audit_logs 表）：记录所有管理操作（创建、更新、删除、权限变更）
- 应用日志（logger.ts）：结构化 JSON 日志，包含 `requestId`、`userId`、`action`、`timestamp`

---

## 5. 认证与鉴权规范

### 5.1 JWT Token 规范

| 配置项 | 说明 |
|---|---|
| 签名算法 | HS256 |
| 密钥 | 环境变量 `JWT_SECRET` |
| Token 类型 | Bearer |
| 请求头 | `Authorization: Bearer <token>` |
| Token 内容 | `{ userId, roleCode, iat, exp }` |
| 过期时间 | 代码中定义 |

### 5.2 权限校验规范

```
流程：
1. authMiddleware → 验证 JWT，解析 userId、roleCode
2. 挂载到 req.user: { userId, roleCode }
3. 管理员路由 → requireAdmin → 检查 roleCode ∈ {super_admin, admin}
4. 咨询师路由 → requireCounselor → 检查 roleCode ∈ {counselor, super_admin, admin}
5. 细粒度权限 → requirePermission('permission_code') → 查询 role_permissions
```

### 5.3 角色权限矩阵

| 权限 | super_admin | admin | counselor | student |
|---|---|---|---|---|
| 管理用户 | YES | YES | NO | NO |
| 查看审计日志 | YES | NO | NO | NO |
| 管理个案 | YES | YES | YES | NO |
| 管理测评 | YES | YES | NO | NO |
| 管理 Prompt | YES | YES | NO | NO |
| 情绪记录 | YES | YES | YES | YES |
| 测评参与 | YES | YES | YES | YES |
| 查看自己的情绪 | YES | YES | YES | YES |

---

## 6. CORS 与安全配置

### 6.1 CORS 配置

| 配置项 | 值 |
|---|---|
| 允许来源 | 环境变量 `FRONTEND_URL` |
| 允许方法 | GET, POST, PUT, DELETE, OPTIONS |
| 允许头 | Content-Type, Authorization |
| 凭证支持 | true |

### 6.2 安全头

| 安全头 | 值 |
|---|---|
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY |
| X-XSS-Protection | 1; mode=block |

### 6.3 请求体大小限制

| 接口类型 | 限制 |
|---|---|
| 常规接口 | 100KB |
| 文件上传接口 | 5MB（预留） |

### 6.4 限流策略

- 全局：express-rate-limit 中间件，单 IP 100 请求/分钟
- 登录接口：单 IP 10 次/分钟
- 注册接口：单 IP 5 次/分钟