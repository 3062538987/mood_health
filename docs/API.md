# API 文档

> 本文件是仓库 API 说明的权威版本。根目录 `API.md` 仅作为跳转入口。

## 概述

本文档描述了大学生情绪健康管理平台的所有 API 接口。

**基础 URL**：

- 开发环境：`http://localhost:3000/api`
- 生产环境：根据实际部署配置

**认证方式**：

- 使用 JWT (JSON Web Token) 认证
- 在请求头中添加：`Authorization: Bearer <token>`

## 认证接口

### 1. 用户注册

**接口**：`POST /auth/register`

**描述**：注册新用户

**说明**：注册时无需提交邮箱，系统将自动分配临时邮箱（`@temp.user`）

**请求体**：

```json
{
  "username": "string",
  "password": "string"
}
```

**响应**：

```json
{
  "code": 0,
  "message": "注册成功",
  "data": {
    "userId": 1,
    "username": "testuser",
    "email": "test@example.com",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. 用户登录

**接口**：`POST /auth/login`

**描述**：用户登录

**请求体**：

```json
{
  "username": "string",
  "password": "string"
}
```

**响应**：

```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "userId": 1,
    "username": "testuser",
    "email": "test@example.com",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 3. 获取当前用户信息

**接口**：`GET /auth/me`

**描述**：获取当前登录用户的信息

**认证**：需要

**响应**：

```json
{
  "code": 0,
  "data": {
    "userId": 1,
    "username": "testuser",
    "email": "test@example.com",
    "nickname": "测试用户",
    "avatar": "https://example.com/avatar.jpg",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## 情绪管理接口

### 1. 记录情绪

**接口**：`POST /moods`

**描述**：记录新的情绪

**认证**：需要

**请求体**：

```json
{
  "moodType": "happy",
  "moodLevel": 5,
  "content": "今天心情很好",
  "tags": ["工作", "学习"]
}
```

**响应**：

```json
{
  "code": 0,
  "message": "记录成功",
  "data": {
    "id": 1,
    "userId": 1,
    "moodType": "happy",
    "moodLevel": 5,
    "content": "今天心情很好",
    "tags": ["工作", "学习"],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2. 获取情绪列表

**接口**：`GET /moods`

**描述**：获取用户的情绪记录列表

**认证**：需要

**查询参数**：

- `page` (number): 页码，默认 1
- `pageSize` (number): 每页数量，默认 20
- `startDate` (string): 开始日期，格式 YYYY-MM-DD
- `endDate` (string): 结束日期，格式 YYYY-MM-DD
- `moodType` (string): 情绪类型

**响应**：

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 1,
        "userId": 1,
        "moodType": "happy",
        "moodLevel": 5,
        "content": "今天心情很好",
        "tags": ["工作", "学习"],
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

### 3. 获取情绪周报

**接口**：`GET /moods/weekly-report`

**描述**：获取用户本周的情绪报告

**认证**：需要

**响应**：

```json
{
  "code": 0,
  "data": {
    "averageLevel": 3.5,
    "moodDistribution": {
      "happy": 3,
      "sad": 1,
      "anxious": 2
    },
    "totalRecords": 6,
    "weekStart": "2024-01-01",
    "weekEnd": "2024-01-07"
  }
}
```

### 4. 更新情绪记录

**接口**：`PUT /moods/:id`

**描述**：更新指定的情绪记录

**认证**：需要

**请求体**：

```json
{
  "moodType": "happy",
  "moodLevel": 4,
  "content": "今天心情不错",
  "tags": ["工作"]
}
```

**响应**：

```json
{
  "code": 0,
  "message": "更新成功"
}
```

### 5. 删除情绪记录

**接口**：`DELETE /moods/:id`

**描述**：删除指定的情绪记录

**认证**：需要

**响应**：

```json
{
  "code": 0,
  "message": "删除成功"
}
```

### 6. 获取情绪趋势

**接口**：`GET /moods/trend`

**描述**：获取用户的情绪趋势数据

**认证**：需要

**查询参数**：

- `days` (number): 天数，默认 30

**响应**：

```json
{
  "code": 0,
  "data": [
    {
      "date": "2024-01-01",
      "averageLevel": 3.5,
      "count": 2
    }
  ]
}
```

### 7. 获取情绪类型列表

**接口**：`GET /moods/types`

**描述**：获取所有情绪类型

**认证**：需要

**响应**：

```json
{
  "code": 0,
  "data": [
    {
      "name": "happy",
      "label": "开心",
      "emoji": "😊"
    },
    {
      "name": "sad",
      "label": "难过",
      "emoji": "😢"
    }
  ]
}
```

## AI 情绪分析接口

### 1. AI 情绪分析

**接口**：`POST /api/analyze-mood`

**描述**：使用 AI 分析用户情绪

**认证**：不需要（由限流保护）

**基础 URL**：`http://localhost:8000`

**请求体**：

```json
{
  "content": "今天心情很好，完成了很多工作",
  "mood_level": 5
}
```

**响应**：

```json
{
  "analysis": "用户情绪积极，工作成就感强，建议保持这种良好的状态。",
  "suggestions": ["继续保持积极的工作态度", "适当奖励自己的努力", "与朋友分享你的成就"]
}
```

**限流**：每个客户端每分钟最多 10 次请求

### 2. 保存 AI 建议

**接口**：`POST /moods/advice/save`

**描述**：保存 AI 建议到历史记录

**认证**：需要

**请求体**：

```json
{
  "moodRecordId": 1,
  "analysis": "用户情绪积极，工作成就感强",
  "suggestions": ["继续保持积极的工作态度", "适当奖励自己的努力"]
}
```

**响应**：

```json
{
  "code": 0,
  "message": "保存成功"
}
```

### 3. 获取 AI 建议历史

**接口**：`GET /moods/advice/history`

**描述**：获取用户的 AI 建议历史记录

**认证**：需要

**查询参数**：

- `page` (number): 页码，默认 1
- `pageSize` (number): 每页数量，默认 20

**响应**：

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 1,
        "userId": 1,
        "moodRecordId": 1,
        "analysis": "用户情绪积极",
        "suggestions": ["建议1", "建议2"],
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 10
  }
}
```

## 树洞接口

### 1. 获取帖子列表

**接口**：`GET /posts`

**描述**：获取树洞帖子列表

**认证**：需要

**查询参数**：

- `page` (number): 页码，默认 1
- `pageSize` (number): 每页数量，默认 20

**响应**：

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 1,
        "content": "今天心情不好",
        "isAnonymous": true,
        "likeCount": 5,
        "commentCount": 3,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 50
  }
}
```

### 2. 发帖

**接口**：`POST /posts`

**描述**：发布新帖子

**认证**：需要

**请求体**：

```json
{
  "content": "今天心情不好",
  "isAnonymous": true
}
```

**响应**：

```json
{
  "code": 0,
  "message": "发布成功",
  "data": {
    "id": 1,
    "content": "今天心情不好",
    "isAnonymous": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 3. 点赞帖子

**接口**：`POST /posts/:id/like`

**描述**：点赞或取消点赞帖子

**认证**：需要

**响应**：

```json
{
  "code": 0,
  "message": "操作成功",
  "data": {
    "isLiked": true,
    "likeCount": 6
  }
}
```

### 4. 评论帖子

**接口**：`POST /posts/:id/comments`

**描述**：评论帖子

**认证**：需要

**请求体**：

```json
{
  "content": "加油！",
  "isAnonymous": false
}
```

**响应**：

```json
{
  "code": 0,
  "message": "评论成功",
  "data": {
    "id": 1,
    "content": "加油！",
    "isAnonymous": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## 活动接口

### 1. 获取活动列表

**接口**：`GET /activities`

**描述**：获取团体辅导活动列表

**认证**：需要

**查询参数**：

- `page` (number): 页码，默认 1
- `pageSize` (number): 每页数量，默认 20
- `type` (string): 活动类型

**响应**：

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 1,
        "title": "情绪管理工作坊",
        "description": "学习情绪管理技巧",
        "type": "workshop",
        "startTime": "2024-01-15T10:00:00.000Z",
        "endTime": "2024-01-15T12:00:00.000Z",
        "location": "心理咨询中心",
        "maxParticipants": 20,
        "currentParticipants": 15,
        "isRegistered": false
      }
    ],
    "total": 10
  }
}
```

### 2. 报名活动

**接口**：`POST /activities/:id/register`

**描述**：报名参加活动

**认证**：需要

**响应**：

```json
{
  "code": 0,
  "message": "报名成功"
}
```

## 问卷接口

### 1. 获取问卷列表

**接口**：`GET /questionnaires`

**描述**：获取问卷列表

**认证**：需要

**响应**：

```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "title": "情绪状态评估问卷",
      "description": "评估当前情绪状态",
      "questionCount": 20,
      "estimatedTime": 10,
      "isActive": true
    }
  ]
}
```

### 2. 提交问卷

**接口**：`POST /questionnaires/:id/submit`

**描述**：提交问卷答案

**认证**：需要

**请求体**：

```json
{
  "answers": [
    {
      "questionId": 1,
      "answer": "经常"
    },
    {
      "questionId": 2,
      "answer": "有时"
    }
  ]
}
```

**响应**：

```json
{
  "code": 0,
  "message": "提交成功",
  "data": {
    "score": 75,
    "level": "良好",
    "suggestions": ["保持良好的作息习惯", "适当进行体育锻炼"]
  }
}
```

## 错误响应

所有接口在发生错误时返回以下格式：

```json
{
  "code": 400,
  "message": "错误描述",
  "errors": [
    {
      "field": "username",
      "message": "用户名不能为空"
    }
  ]
}
```

## 状态码说明

| 状态码 | 说明             |
| ------ | ---------------- |
| 0      | 成功             |
| 400    | 请求参数错误     |
| 401    | 未认证或认证失败 |
| 403    | 无权限访问       |
| 404    | 资源不存在       |
| 500    | 服务器内部错误   |

## 限流说明

- **AI 分析接口**：每个客户端每分钟最多 10 次请求
- **其他接口**：每个客户端每分钟最多 100 次请求

## API 文档访问

### FastAPI 自动文档

AI 服务使用 FastAPI，提供自动生成的 API 文档：

- Swagger UI：`http://localhost:8000/docs`
- ReDoc：`http://localhost:8000/redoc`

### Node.js API 文档

可以使用 Swagger JSDoc 生成文档，或使用 Postman 导入 API 集合。
