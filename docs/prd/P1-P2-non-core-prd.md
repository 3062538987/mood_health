# P1/P2 非核心模块 PRD

## 1. 文档状态

- 状态：已实现（回顾性 PRD）
- 日期：2026-07-16
- 版本：v1.0
- 上游：P0/v1.0 + V1.1 核心业务与 AI 增强已完成
- 架构基座：MySQL 8.4 + Repository 模式

## 2. 产品目标

P1/P2 阶段将 R0 期间停用的 6 个非核心模块从 SQLite 迁移至 MySQL，并重新启用路由：

1. **数据库迁移**：将 SQLite 旧表迁移为 MySQL InnoDB 表，建立外键约束和索引。
2. **Repository 重构**：用 Repository 模式替换旧 SQLite Model 直接操作。
3. **路由启用**：移除 503 占位，启用真实业务路由。
4. **前端 Feature Flag 调整**：恢复前端入口可见性。

## 3. 范围

### 3.1 纳入模块

| 模块 | 路由前缀 | 数据表 | 接口数 |
|---|---|---|---|
| 音乐 | `/api/music` | `musics` | 3 |
| 课程 | `/api/courses` | `courses` | 3 |
| 放松 | `/api/relax` | `relax_records` | 4 |
| 活动 | `/api/activities` | `activities`、`activity_participants` | 5 |
| 树洞帖子 | `/api/posts` | `posts`、`comments`、`post_likes`、`comment_likes` | 6 |
| 成就 | `/api/achievements` | `achievement_definitions`、`user_achievements` | 4 |

**合计**：6 模块 / 11 张表 / 25 个接口

### 3.2 不纳入范围

- 模块功能增强或 UI 重做
- 内容审核 AI 集成
- 推送通知

## 4. 功能需求

### 4.1 音乐模块

**路由**：

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/api/music/` | 否 | 音乐列表 |
| GET | `/api/music/:id` | 否 | 音乐详情 |
| POST | `/api/music/` | 是(admin) | 添加音乐 |
| PUT | `/api/music/:id` | 是(admin) | 更新音乐 |
| DELETE | `/api/music/:id` | 是(admin) | 删除音乐 |

**数据表 `musics`**：title, artist, url, duration, category, cover

### 4.2 课程模块

**路由**：

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/api/courses/` | 否 | 课程列表 |
| GET | `/api/courses/:id` | 否 | 课程详情 |
| POST | `/api/courses/` | 是(admin) | 添加课程 |
| PUT | `/api/courses/:id` | 是(admin) | 更新课程 |
| DELETE | `/api/courses/:id` | 是(admin) | 删除课程 |

**数据表 `courses`**：title, description, cover_url, content, category, study_count, type(video/article)

### 4.3 放松模块

**路由**：

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/api/relax/records` | 是 | 放松记录列表 |
| POST | `/api/relax/records` | 是 | 保存放松记录 |
| GET | `/api/relax/records/:id` | 是 | 放松记录详情 |
| GET | `/api/relax/statistics` | 是 | 放松统计 |

**数据表 `relax_records`**：user_id (FK→users CASCADE), activity_type, start_time, end_time, metrics(JSON), mood_tag

### 4.4 活动模块

**路由**：

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/api/activities/list` | 否 | 活动列表 |
| GET | `/api/activities/detail/:id` | 否 | 活动详情 |
| GET | `/api/activities/detail-with-participants/:id` | 否 | 活动详情(含参与者) |
| POST | `/api/activities/join/:id` | 是 | 报名活动 |
| POST | `/api/activities/cancel/:id` | 是 | 取消报名 |
| GET | `/api/activities/my-joined` | 是 | 我报名的活动 |
| POST | `/api/activities/` | 是(admin) | 创建活动 |
| PUT | `/api/activities/:id` | 是(admin) | 更新活动 |
| DELETE | `/api/activities/:id` | 是(admin) | 删除活动 |

**数据表**：`activities` (title, description, start_time, end_time, max_participants, current_participants, location, image_url)、`activity_participants` (activity_id, user_id)

### 4.5 树洞帖子模块

**路由**：

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/api/posts/` | 否 | 帖子列表 |
| GET | `/api/posts/:id` | 否 | 帖子详情 |
| POST | `/api/posts/` | 是 | 发布帖子 |
| GET | `/api/posts/:id/comments` | 否 | 评论列表 |
| POST | `/api/posts/:id/comments` | 是 | 发表评论 |
| POST | `/api/posts/:id/like` | 是 | 点赞帖子 |
| POST | `/api/posts/comments/:commentId/like` | 是 | 点赞评论 |

**数据表**：`posts` (title, content, user_id SET NULL, is_anonymous, like_count, status, audit_remark)、`comments` (post_id CASCADE, user_id SET NULL, content, is_anonymous, like_count)、`post_likes` (post_id, user_id, UNIQUE)、`comment_likes` (comment_id, user_id, UNIQUE)

### 4.6 成就模块

**路由**：

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/api/achievements/` | 否 | 成就定义列表 |
| GET | `/api/achievements/user` | 是 | 我的成就 |
| POST | `/api/achievements/check` | 是 | 检查并解锁成就 |
| GET | `/api/achievements/progress` | 是 | 成就进度 |

**数据表**：`achievement_definitions` (id VARCHAR PK, name, description, type, threshold, icon, level bronze/silver/gold)、`user_achievements` (user_id, achievement_id, UNIQUE, unlocked_at)

**Seed 成就**：初次记录(bronze)、放松起步(bronze)、勇敢表达(silver)、稳定练习(gold)

## 5. 数据模型新增

P1/P2 共新增 11 张表（详见 [02-database-design.md](../tech-design/02-database-design.md) 2.2.20-2.2.30）：

| 序号 | 表名 | 中文名 | 迁移文件 |
|---|---|---|---|
| 20 | `musics` | 音乐 | 0190 |
| 21 | `courses` | 课程 | 0200 |
| 22 | `relax_records` | 放松记录 | 0210 |
| 23 | `activities` | 活动 | 0220 |
| 24 | `activity_participants` | 活动参与者 | 0220 |
| 25 | `posts` | 树洞帖子 | 0230 |
| 26 | `comments` | 评论 | 0230 |
| 27 | `post_likes` | 帖子点赞 | 0230 |
| 28 | `comment_likes` | 评论点赞 | 0230 |
| 29 | `achievement_definitions` | 成就定义 | 0240 |
| 30 | `user_achievements` | 用户成就 | 0240 |

所有表使用 InnoDB 引擎、utf8mb4 字符集，外键约束完整。

## 6. 旧代码处置

P1/P2 迁移完成后，R0 Phase-F 清退阶段删除了以下旧 SQLite Model 文件：

| 文件 | 替代 |
|---|---|
| `src/models/musicModel.ts` | `musicRepository.ts` |
| `src/models/courseModel.ts` | `courseRepository.ts` |
| `src/models/relaxModel.ts` | `relaxRepository.ts` |
| `src/models/activityModel.ts` | `activityRepository.ts` |
| `src/models/postModel.ts` | `postRepository.ts` |
| `src/models/commentModel.ts` | `postRepository.ts` |
| `src/models/achievementModel.ts` | `achievementRepository.ts` |
| `src/models/adviceModel.ts` | 功能废弃 |

## 7. 验收标准

- [x] 6 个模块 11 张表全部迁移至 MySQL
- [x] 6 个模块 Repository 实现完整 CRUD
- [x] 25 个接口全部启用（不再返回 503）
- [x] 旧 SQLite Model 文件已删除
- [x] 前端 Feature Flag 已调整
- [x] `npm run test:all` 全部通过
- [x] `npm run build:all` 退出 0
- [x] Migration `up → down → up` 测试通过