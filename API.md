# API 接口文档

## 树洞模块

### 获取帖子列表
- **URL**: `/api/posts?page=1&pageSize=10`
- **方法**: GET
- **参数**: 
  - `page`: 页码（默认 1）
  - `pageSize`: 每页条数（默认 10）
- **响应示例**:
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 1,
        "userId": 1,
        "username": "user1",
        "title": "测试帖子",
        "content": "这是一个测试帖子",
        "isAnonymous": false,
        "likes": 5,
        "commentCount": 2,
        "createdAt": "2026-03-02T12:00:00Z"
      }
    ],
    "total": 100
  }
}
```

### 获取帖子详情
- **URL**: `/api/posts/:id`
- **方法**: GET
- **参数**: 
  - `id`: 帖子ID
- **响应示例**:
```json
{
  "code": 0,
  "data": {
    "id": 1,
    "userId": 1,
    "username": "user1",
    "title": "测试帖子",
    "content": "这是一个测试帖子",
    "isAnonymous": false,
    "likes": 5,
    "createdAt": "2026-03-02T12:00:00Z",
    "comments": [
      {
        "id": 1,
        "postId": 1,
        "userId": 2,
        "username": "user2",
        "content": "这是一个评论",
        "isAnonymous": false,
        "createdAt": "2026-03-02T12:30:00Z"
      }
    ]
  }
}
```

### 创建帖子
- **URL**: `/api/posts`
- **方法**: POST
- **认证**: 需要 JWT token
- **参数**:
```json
{
  "title": "测试帖子",
  "content": "这是一个测试帖子",
  "isAnonymous": false
}
```
- **响应示例**:
```json
{
  "code": 0,
  "data": {
    "id": 1,
    "userId": 1,
    "username": "user1",
    "title": "测试帖子",
    "content": "这是一个测试帖子",
    "isAnonymous": false,
    "likes": 0,
    "createdAt": "2026-03-02T12:00:00Z"
  }
}
```

### 点赞帖子
- **URL**: `/api/posts/:id/like`
- **方法**: POST
- **认证**: 需要 JWT token
- **参数**: 
  - `id`: 帖子ID
- **响应示例**:
```json
{
  "code": 0,
  "data": {
    "likes": 6
  }
}
```

### 获取评论列表
- **URL**: `/api/posts/:id/comments`
- **方法**: GET
- **参数**: 
  - `id`: 帖子ID
- **响应示例**:
```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "postId": 1,
      "userId": 2,
      "username": "user2",
      "content": "这是一个评论",
      "isAnonymous": false,
      "createdAt": "2026-03-02T12:30:00Z"
    }
  ]
}
```

### 发表评论
- **URL**: `/api/posts/:id/comments`
- **方法**: POST
- **认证**: 需要 JWT token
- **参数**:
```json
{
  "content": "这是一个评论",
  "isAnonymous": false
}
```
- **响应示例**:
```json
{
  "code": 0,
  "data": {
    "id": 2,
    "postId": 1,
    "userId": 1,
    "username": "user1",
    "content": "这是一个评论",
    "isAnonymous": false,
    "createdAt": "2026-03-02T13:00:00Z"
  }
}
```

## 问卷模块

### 获取问卷列表
- **URL**: `/api/questionnaires`
- **方法**: GET
- **响应示例**:
```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "title": "情绪健康问卷",
      "description": "了解你的情绪健康状况",
      "createdAt": "2026-03-02T10:00:00Z"
    }
  ]
}
```

### 获取问卷详情
- **URL**: `/api/questionnaires/:id`
- **方法**: GET
- **参数**: 
  - `id`: 问卷ID
- **响应示例**:
```json
{
  "code": 0,
  "data": {
    "id": 1,
    "title": "情绪健康问卷",
    "description": "了解你的情绪健康状况",
    "createdAt": "2026-03-02T10:00:00Z",
    "questions": [
      {
        "id": 1,
        "questionnaire_id": 1,
        "question_text": "你最近一周的情绪状态如何？",
        "options": ["非常好", "良好", "一般", "较差", "非常差"]
      }
    ]
  }
}
```

### 提交问卷答案
- **URL**: `/api/questionnaires/:id/submit`
- **方法**: POST
- **认证**: 需要 JWT token
- **参数**:
```json
{
  "answers": [
    {
      "question_id": 1,
      "answer": "良好"
    }
  ]
}
```
- **响应示例**:
```json
{
  "code": 0,
  "message": "提交答案成功"
}
```

### 获取用户问卷历史
- **URL**: `/api/questionnaires/user/questionnaires`
- **方法**: GET
- **认证**: 需要 JWT token
- **响应示例**:
```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "questionnaireId": 1,
      "title": "情绪健康问卷",
      "submittedAt": "2026-03-02T14:00:00Z"
    }
  ]
}
```

## 认证模块

### 注册
- **URL**: `/api/auth/register`
- **方法**: POST
- **参数**:
```json
{
  "username": "user1",
  "email": "user1@example.com",
  "password": "password123"
}
```
- **响应示例**:
```json
{
  "code": 0,
  "message": "注册成功"
}
```

### 登录
- **URL**: `/api/auth/login`
- **方法**: POST
- **参数**:
```json
{
  "username": "user1",
  "password": "password123"
}
```
- **响应示例**:
```json
{
  "code": 0,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "user1",
      "email": "user1@example.com",
      "role": "user"
    }
  }
}
```

### 获取当前用户信息
- **URL**: `/api/auth/me`
- **方法**: GET
- **认证**: 需要 JWT token
- **响应示例**:
```json
{
  "code": 0,
  "data": {
    "user": {
      "id": 1,
      "username": "user1",
      "email": "user1@example.com",
      "role": "user"
    }
  }
}
```

## 情绪模块

### 记录情绪
- **URL**: `/api/moods`
- **方法**: POST
- **认证**: 需要 JWT token
- **参数**:
```json
{
  "moodType": "happy",
  "intensity": 8,
  "note": "今天很开心",
  "recordDate": "2026-03-02"
}
```
- **响应示例**:
```json
{
  "code": 0,
  "message": "记录成功"
}
```

### 获取情绪列表
- **URL**: `/api/moods?page=1&limit=20`
- **方法**: GET
- **认证**: 需要 JWT token
- **参数**: 
  - `page`: 页码（默认 1）
  - `limit`: 每页条数（默认 20）
- **响应示例**:
```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "mood_type": "happy",
      "intensity": 8,
      "note": "今天很开心",
      "record_date": "2026-03-02",
      "created_at": "2026-03-02T12:00:00Z"
    }
  ]
}
```

### 获取情绪周报
- **URL**: `/api/moods/weekly-report`
- **方法**: GET
- **认证**: 需要 JWT token
- **响应示例**:
```json
{
  "code": 0,
  "data": {
    "averageIntensity": 7.5,
    "moodDistribution": {
      "happy": 3,
      "sad": 1,
      "angry": 0,
      "anxious": 1,
      "calm": 2
    },
    "trend": [
      { "date": "2026-02-26", "intensity": 7 },
      { "date": "2026-02-27", "intensity": 8 },
      { "date": "2026-02-28", "intensity": 7 },
      { "date": "2026-02-29", "intensity": 6 },
      { "date": "2026-03-01", "intensity": 8 },
      { "date": "2026-03-02", "intensity": 8 }
    ]
  }
}
```

## 活动模块

### 获取活动列表
- **URL**: `/api/activities`
- **方法**: GET
- **响应示例**:
```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "title": "情绪管理工作坊",
      "description": "学习如何管理情绪",
      "startTime": "2026-03-10T14:00:00Z",
      "endTime": "2026-03-10T16:00:00Z",
      "location": "线上",
      "maxParticipants": 50,
      "currentParticipants": 20,
      "createdAt": "2026-03-01T10:00:00Z"
    }
  ]
}
```

### 获取活动详情
- **URL**: `/api/activities/:id`
- **方法**: GET
- **参数**: 
  - `id`: 活动ID
- **响应示例**:
```json
{
  "code": 0,
  "data": {
    "id": 1,
    "title": "情绪管理工作坊",
    "description": "学习如何管理情绪",
    "startTime": "2026-03-10T14:00:00Z",
    "endTime": "2026-03-10T16:00:00Z",
    "location": "线上",
    "maxParticipants": 50,
    "currentParticipants": 20,
    "createdAt": "2026-03-01T10:00:00Z"
  }
}
```

### 报名活动
- **URL**: `/api/activities/:id/register`
- **方法**: POST
- **认证**: 需要 JWT token
- **参数**: 
  - `id`: 活动ID
- **响应示例**:
```json
{
  "code": 0,
  "message": "报名成功"
}
```

### 获取我的活动
- **URL**: `/api/activities/my`
- **方法**: GET
- **认证**: 需要 JWT token
- **响应示例**:
```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "title": "情绪管理工作坊",
      "startTime": "2026-03-10T14:00:00Z",
      "endTime": "2026-03-10T16:00:00Z",
      "location": "线上",
      "registeredAt": "2026-03-02T15:00:00Z"
    }
  ]
}
```
