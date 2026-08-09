# 模块4：接口清单文档

> 状态：已生效（基于代码现状）
> 日期：2026-07-16
> 版本：v1.0
> 说明：已开发接口如实转录现有Controller代码；待开发接口依据PRD业务需求正向设计。

---

## 一、已开发接口（存量）

### 1. 认证模块 (Auth)

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| POST | `/api/auth/register` | 否 | 用户注册 |
| POST | `/api/auth/login` | 否 | 用户登录 |
| GET | `/api/auth/me` | 是 | 获取当前用户信息 |

#### POST /api/auth/register

**请求体**：
```json
{
  "username": "string (必填, 3-50字符)",
  "password": "string (必填, 6-100字符)",
  "email": "string (可选)",
  "nickname": "string (可选)"
}
```

**成功响应** (201)：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 1,
    "username": "testuser",
    "role": "student"
  },
  "requestId": "uuid"
}
```

**错误码**：10003 (用户名已存在)

---

#### POST /api/auth/login

**请求体**：
```json
{
  "username": "string (必填)",
  "password": "string (必填)"
}
```

**成功响应** (200)：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "token": "jwt_token_string",
    "user": {
      "id": 1,
      "username": "testuser",
      "role": "student",
      "nickname": "昵称"
    }
  },
  "requestId": "uuid"
}
```

**错误码**：10002 (用户名或密码错误), 20002 (用户已被禁用)

---

#### GET /api/auth/me

**请求头**：`Authorization: Bearer <token>`

**成功响应** (200)：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 1,
    "username": "testuser",
    "role": "student",
    "nickname": "昵称",
    "email": "test@example.com",
    "avatarUrl": null
  },
  "requestId": "uuid"
}
```

**错误码**：10001 (未认证), 10005 (Token无效)

---

### 2. 情绪记录模块 (Mood)

| 方法 | 路径 | 认证 | 角色 | 说明 |
|---|---|---|---|---|
| POST | `/api/moods/record` | 是 | 全部 | 记录情绪 |
| GET | `/api/moods/list` | 是 | 全部 | 情绪记录列表 |
| GET | `/api/moods/weekly-report` | 是 | 全部 | 周报数据 |
| GET | `/api/moods/trend` | 是 | 全部 | 情绪趋势 |
| GET | `/api/moods/types` | 是 | 全部 | 情绪类型列表 |
| DELETE | `/api/moods/:id` | 是 | 全部 | 删除情绪记录 |

#### POST /api/moods/record

**请求体**：
```json
{
  "emotions": [{ "typeId": 1, "intensity": 7, "isPrimary": true }],
  "tags": ["学习", "社交"],
  "note": "今天心情不错",
  "trigger": "考试通过",
  "recordedAt": "2026-07-16T08:00:00.000Z"
}
```

**成功响应** (201)：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 42,
    "userId": 1,
    "note": "今天心情不错",
    "trigger": "考试通过",
    "emotions": [{ "typeId": 1, "name": "开心", "intensity": 7, "isPrimary": true }],
    "tags": [{ "id": 1, "name": "学习" }],
    "recordedAt": "2026-07-16T08:00:00.000Z",
    "createdAt": "2026-07-16T08:00:00.000Z"
  },
  "requestId": "uuid"
}
```

---

#### GET /api/moods/list

**Query 参数**：`page`, `pageSize`, `startDate`, `endDate`, `emotionTypeId`, `tagId`

**成功响应** (200)：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [ ... ],
    "pagination": { "page": 1, "pageSize": 20, "total": 50, "totalPages": 3 }
  },
  "requestId": "uuid"
}
```

---

#### GET /api/moods/weekly-report

**Query 参数**：`startDate`, `endDate`（可选）

**成功响应** (200)：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "records": [ ... ],
    "statistics": {
      "totalRecords": 7,
      "averageIntensity": 6.5,
      "primaryEmotions": [{ "name": "开心", "count": 4 }],
      "emotionDistribution": { ... }
    }
  },
  "requestId": "uuid"
}
```

---

#### GET /api/moods/trend

**Query 参数**：`period` (7/30/90)

**成功响应** (200)：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "trend": [
      { "date": "2026-07-10", "averageIntensity": 6.5, "dominantEmotion": "开心" }
    ]
  },
  "requestId": "uuid"
}
```

---

### 3. 测评模块 (Questionnaire)

| 方法 | 路径 | 认证 | 角色 | 说明 |
|---|---|---|---|---|
| GET | `/api/questionnaires/` | 是 | 全部 | 测评工具列表 |
| GET | `/api/questionnaires/history` | 是 | 全部 | 测评历史 |
| GET | `/api/questionnaires/:id` | 是 | 全部 | 测评详情 |
| GET | `/api/questionnaires/:id/questions` | 是 | 全部 | 测评题目列表 |
| POST | `/api/questionnaires/assessments` | 是 | 全部 | 提交测评 |
| GET | `/api/questionnaires/assessments/:id` | 是 | 全部 | 测评结果详情 |

#### GET /api/questionnaires/

**成功响应** (200)：
```json
{
  "code": 0,
  "message": "ok",
  "data": [
    { "id": 1, "code": "PHQ9", "name": "PHQ-9 抑郁症筛查量表", "description": "...", "status": "active" }
  ],
  "requestId": "uuid"
}
```

---

#### GET /api/questionnaires/:id/questions

**成功响应** (200)：
```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": 1,
      "itemOrder": 1,
      "itemText": "做事时提不起劲或没有兴趣",
      "itemType": "single_choice",
      "optionsJson": [{ "label": "没有", "score": 0 }, { "label": "有几天", "score": 1 }, { "label": "一半以上时间", "score": 2 }, { "label": "几乎每天", "score": 3 }],
      "reverseScored": false
    }
  ],
  "requestId": "uuid"
}
```

---

#### GET /api/questionnaires/history

**Query 参数**：`page`, `pageSize`

**成功响应** (200)：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": 1,
        "instrumentName": "PHQ-9 抑郁症筛查量表",
        "versionLabel": "v1.0",
        "rawScore": 12,
        "screeningLevel": "moderate",
        "status": "submitted",
        "startedAt": "2026-07-16T08:00:00.000Z",
        "submittedAt": "2026-07-16T08:10:00.000Z"
      }
    ],
    "pagination": { "page": 1, "pageSize": 20, "total": 5, "totalPages": 1 }
  },
  "requestId": "uuid"
}
```

---

#### POST /api/questionnaires/assessments

**请求体**：
```json
{
  "questionnaire_id": 1,
  "answers": [
    { "itemId": 1, "score": 2 },
    { "itemId": 2, "score": 3 }
  ]
}
```

**成功响应** (201)：
```json
{
  "code": 0,
  "message": "测评提交成功",
  "data": {
    "sessionId": 1,
    "totalScore": 12,
    "riskLevel": "moderate",
    "riskColor": "#FFC107",
    "suggestion": "建议关注情绪变化，如有持续低落请寻求帮助"
  },
  "requestId": "uuid"
}
```

**错误码**：40001 (测评工具不存在), 40002 (测评会话不存在)

---

#### GET /api/questionnaires/assessments/:id

**成功响应** (200)：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "sessionId": 1,
    "instrumentName": "PHQ-9 抑郁症筛查量表",
    "versionLabel": "v1.0",
    "rawScore": 12,
    "screeningLevel": "moderate",
    "answers": [
      { "itemId": 1, "itemText": "做事时提不起劲或没有兴趣", "score": 2 }
    ],
    "startedAt": "2026-07-16T08:00:00.000Z",
    "submittedAt": "2026-07-16T08:10:00.000Z"
  },
  "requestId": "uuid"
}
```

---

### 4. 风险个案模块 (Case)

| 方法 | 路径 | 认证 | 角色 | 说明 |
|---|---|---|---|---|
| GET | `/api/cases/` | 是 | admin/counselor | 个案列表 |
| GET | `/api/cases/:id` | 是 | admin/counselor | 个案详情 |
| POST | `/api/cases/` | 是 | admin | 创建个案 |
| PUT | `/api/cases/:id/assign` | 是 | admin | 指派咨询师 |
| POST | `/api/cases/:id/interventions` | 是 | counselor | 添加干预记录 |
| PUT | `/api/cases/:id/refer` | 是 | counselor | 转介个案 |
| PUT | `/api/cases/:id/close` | 是 | counselor | 结案 |

#### GET /api/cases/

**Query 参数**：`page`, `pageSize`, `status`, `riskLevel`, `counselorId`

**成功响应** (200)：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": 1,
        "studentUserId": 5,
        "studentName": "张三",
        "assignedCounselorId": 2,
        "counselorName": "李咨询师",
        "status": "open",
        "riskLevel": "high",
        "createdAt": "2026-07-16T08:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "pageSize": 20, "total": 10, "totalPages": 1 }
  },
  "requestId": "uuid"
}
```

---

#### POST /api/cases/

**请求体**：
```json
{
  "studentUserId": 5,
  "sourceSessionId": 10,
  "riskLevel": "high",
  "summary": "测评显示重度抑郁症状"
}
```

**成功响应** (201)：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 1,
    "studentUserId": 5,
    "status": "open",
    "riskLevel": "high",
    "createdAt": "2026-07-16T08:00:00.000Z"
  },
  "requestId": "uuid"
}
```

---

#### PUT /api/cases/:id/assign

**请求体**：
```json
{
  "counselorId": 2
}
```

---

#### POST /api/cases/:id/interventions

**请求体**：
```json
{
  "interventionType": "note",
  "content": "已与学生会谈，建议每周一次心理咨询"
}
```

---

#### PUT /api/cases/:id/refer

**请求体**：
```json
{
  "referralTarget": "校心理咨询中心",
  "referralReason": "需要专业心理咨询介入"
}
```

---

#### PUT /api/cases/:id/close

**请求体**：
```json
{
  "closureSummary": "学生情绪稳定，已达结案标准"
}
```

---


### 5. 管理模块 (Admin)

| 方法 | 路径 | 认证 | 角色 | 说明 |
|---|---|---|---|---|
| GET | `/api/admin/users` | 是 | admin | 用户列表 |
| GET | `/api/admin/moods` | 是 | admin | 全量情绪记录 |
| GET | `/api/admin/assessments` | 是 | admin | 全量测评会话列表 |
| GET | `/api/admin/assessments/:id` | 是 | admin | 任意用户测评详情 |
| PUT | `/api/admin/users` | 是 | admin | 更新用户角色 |
| DELETE | `/api/admin/users/:id` | 是 | admin | 删除用户 |
| PUT | `/api/admin/users/:id/disable` | 是 | admin | 禁用/启用用户 |
| POST | `/api/users/manage` | 是 | admin | 用户管理（兼容） |
| POST | `/api/roles/manage` | 是 | admin | 角色管理（兼容） |
| POST | `/api/system/config` | 是 | admin | 系统配置（兼容） |

#### GET /api/admin/users

**Query 参数**：`page`, `pageSize`, `role`, `status`, `search`

**成功响应** (200)：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": 1,
        "username": "testuser",
        "role": "student",
        "roleName": "学生",
        "nickname": "昵称",
        "status": "active",
        "lastLoginAt": "2026-07-16T08:00:00.000Z",
        "createdAt": "2026-07-01T00:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "pageSize": 20, "total": 100, "totalPages": 5 }
  },
  "requestId": "uuid"
}
```

---

#### PUT /api/admin/users/:id/disable

**请求体**：
```json
{
  "disabled": true
}
```

**成功响应** (200)：
```json
{
  "code": 0,
  "message": "ok",
  "data": null,
  "requestId": "uuid"
}
```

---

#### DELETE /api/admin/users/:id

**说明**：删除用户及关联数据（moods, tags, audit_logs, assessment_sessions 级联删除）。若用户有 open 状态 case，删除被 RESTRICT 阻止。

**成功响应** (200)：
```json
{
  "code": 0,
  "message": "ok",
  "data": null,
  "requestId": "uuid"
}
```

---

#### GET /api/admin/assessments

**Query 参数**：`page`, `pageSize`, `userId`, `instrumentId`, `riskLevel`, `startDate`, `endDate`

**成功响应** (200)：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": 1,
        "userId": 5,
        "username": "张三",
        "instrumentName": "PHQ-9 抑郁症筛查量表",
        "rawScore": 12,
        "screeningLevel": "moderate",
        "status": "submitted",
        "startedAt": "2026-07-16T08:00:00.000Z",
        "submittedAt": "2026-07-16T08:10:00.000Z"
      }
    ],
    "pagination": { "page": 1, "pageSize": 20, "total": 50, "totalPages": 3 }
  },
  "requestId": "uuid"
}
```

---

#### GET /api/admin/assessments/:id

**成功响应** (200)：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "sessionId": 1,
    "userId": 5,
    "username": "张三",
    "instrumentName": "PHQ-9 抑郁症筛查量表",
    "rawScore": 12,
    "screeningLevel": "moderate",
    "answers": [ ... ],
    "startedAt": "2026-07-16T08:00:00.000Z",
    "submittedAt": "2026-07-16T08:10:00.000Z"
  },
  "requestId": "uuid"
}
```

---

### 6. 审计日志模块 (Audit)

| 方法 | 路径 | 认证 | 角色 | 说明 |
|---|---|---|---|---|
| GET | `/api/audit/operation-logs` | 是 | super_admin | 操作日志列表 |

> 注：`GET /api/audit/all` 已于 2026-08-09 清理移除——它与 `operation-logs` 完全重复（同一 handler），保留 `operation-logs` 即可。

#### GET /api/audit/operation-logs

**Query 参数**：`page`, `pageSize`, `actorUserId`, `action`, `result`, `startDate`, `endDate`

**成功响应** (200)：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": 1,
        "actorUserId": 1,
        "actorRoleCode": "super_admin",
        "action": "PROMPT_CREATE",
        "targetType": "prompt_template",
        "targetId": 5,
        "result": "success",
        "summary": "name=测评解读模板",
        "ipAddress": "127.0.0.1",
        "createdAt": "2026-07-16T08:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "pageSize": 20, "total": 200, "totalPages": 10 }
  },
  "requestId": "uuid"
}
```

---

### 7. AI 服务模块 (AI)

| 方法 | 路径 | 认证 | 角色 | 说明 |
|---|---|---|---|---|
| POST | `/api/ai/interpret` | 是 | 全部 | 测评结果 AI 解读 |
| POST | `/api/ai/report` | 是 | 全部 | 情绪报告 AI 生成 |

#### POST /api/ai/interpret

**请求体**：
```json
{
  "scaleName": "PHQ-9",
  "scaleType": "depression",
  "totalScore": 12,
  "maxScore": 27,
  "itemScores": [
    { "label": "兴趣减退", "score": 2 },
    { "label": "情绪低落", "score": 3 }
  ],
  "riskLevel": "moderate"
}
```

**成功响应** (200)：
```json
{
  "code": 0,
  "message": "AI 解读生成成功",
  "data": {
    "interpretation": "string",
    "suggestions": [ "string" ]
  },
  "requestId": "uuid"
}
```

**错误码**：503 (AI 服务未启用), 404 (Prompt 模板不存在)

---

#### POST /api/ai/report

**请求体**：
```json
{
  "userName": "张三",
  "dateRange": "2026-07-10 ~ 2026-07-16",
  "recordCount": 7,
  "primaryEmotions": "开心, 平静",
  "averageIntensity": 6.5,
  "mostFrequentMood": "开心",
  "type": "weekly",
  "trend": [ ... ],
  "highlights": [ ... ],
  "lowPoints": [ ... ],
  "emotionDistribution": { ... }
}
```

**成功响应** (200)：
```json
{
  "code": 0,
  "message": "AI 报告生成成功",
  "data": {
    "report": "string (Markdown 格式)"
  },
  "requestId": "uuid"
}
```

---
### 9. 健康检查 (Health)

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/health` | 否 | 系统健康检查 |

**成功响应** (200)：
```json
{
  "code": 0,
  "message": "服务健康",
  "data": {
    "status": "ok",
    "api": "healthy",
    "mysql": "connected",
    "redis": "connected"
  },
  "requestId": "uuid"
}
```

**降级响应** (503)：
```json
{
  "code": 89999,
  "message": "服务不可用",
  "data": {
    "status": "unhealthy",
    "api": "healthy",
    "mysql": "disconnected",
    "redis": "connected"
  },
  "requestId": "uuid"
}
```

---

### 10. 非核心模块（P1/P2 已启用）

以下模块在 R0 阶段已停用，P1/P2 阶段完成 MySQL 迁移并重新启用：

| 模块 | 路由前缀 | 启用时间 | 接口数 |
|---|---|---|---|
| 活动 | `/api/activities` | P1/P2 | 5 |
| 树洞帖子 | `/api/posts` | P1/P2 | 6 |
| 音乐 | `/api/music` | P1/P2 | 3 |
| 课程 | `/api/courses` | P1/P2 | 3 |
| 放松 | `/api/relax` | P1/P2 | 4 |
| 成就 | `/api/achievements` | P1/P2 | 4 |

> 这些模块已从 SQLite 迁移至 MySQL Repository 模式，前端 feature flag 已调整，可通过对应路由正常访问。

---

## 二、P0 待开发接口（已全部实现）

> P0/v1.0 规划的 4 个待开发接口已在 P0 阶段全部实现，接口详情见上方"已开发接口"对应模块。

| 接口 | 原计划 | 实现状态 |
|---|---|---|
| POST `/api/questionnaires/assessments` | P0-T2 | 已实现（含计分引擎 + 风险分层） |
| GET `/api/questionnaires/assessments/:id` | P0-T3 | 已实现 |
| POST `/api/cases/auto-create` | P0-T4 | 已移除（2026-08-09 反向审计清理孤儿端点） |
| GET `/api/admin/assessments` + `/:id` | P0-T5 | 已实现（管理员测评管理） |

---

## 三、接口分组索引

| 分组 | 路由前缀 | 已实现 | 待开发 |
|---|---|---|---|
| 认证 | `/api/auth` | 3 | 0 |
| 情绪 | `/api/moods` | 7 | 0 |
| 测评 | `/api/questionnaires` | 6 | 0 |
| 个案 | `/api/cases` | 7 | 0 |
| 管理 | `/api/admin` | 7 | 0 |
| 审计 | `/api/audit` | 1 | 0 |
| AI | `/api/ai` | 2 | 0 |
| 健康 | `/health` | 1 | 0 |
| 活动 | `/api/activities` | 5 | 0 |
| 树洞 | `/api/posts` | 6 | 0 |
| 音乐 | `/api/music` | 3 | 0 |
| 课程 | `/api/courses` | 3 | 0 |
| 放松 | `/api/relax` | 4 | 0 |
| 成就 | `/api/achievements` | 4 | 0 |
| **合计** | — | **64** | **0** |