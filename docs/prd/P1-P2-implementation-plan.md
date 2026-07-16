# P1/P2 实施计划

## 1. 状态

- 分支：`codex/p0-phase-a`
- 上游：P1/P2 非核心模块 PRD 已批准
- 架构：MySQL 8.4 + Repository 模式

## 2. 任务清单

### P1-T1：音乐模块 Migration + Repository + 路由

**目标**：迁移音乐模块至 MySQL 并启用。

**内容**：
- 创建 `0190_create_musics.up.sql`（含 category 索引）
- 实现 `musicRepository.ts`（findAll、findById、create、update、remove）
- 更新 `musicController.ts` 调用 Repository
- 更新 `musicRoutes.ts` 启用路由（GET/POST/PUT/DELETE）

**验收**：
- `npm run db:migrate` 退出 0
- 音乐列表/详情/增删改查接口正常

### P1-T2：课程模块 Migration + Repository + 路由

**目标**：迁移课程模块至 MySQL 并启用。

**内容**：
- 创建 `0200_create_courses.up.sql`（含 category 索引、type CHECK 约束）
- 实现 `courseRepository.ts`
- 更新 `courseController.ts` 调用 Repository
- 更新 `courseRoutes.ts` 启用路由

**验收**：
- `npm run db:migrate` 退出 0
- 课程列表/详情/增删改查接口正常

### P1-T3：放松模块 Migration + Repository + 路由

**目标**：迁移放松记录模块至 MySQL 并启用。

**内容**：
- 创建 `0210_create_relax_records.up.sql`（含 user_id FK CASCADE、复合索引）
- 实现 `relaxRepository.ts`
- 更新 `relaxController.ts` 调用 Repository
- 更新 `relaxRoutes.ts` 启用路由

**验收**：
- `npm run db:migrate` 退出 0
- 放松记录/统计接口正常

### P1-T4：活动模块 Migration + Repository + 路由

**目标**：迁移活动模块至 MySQL 并启用。

**内容**：
- 创建 `0220_create_activities.up.sql`（含 activities + activity_participants 两张表）
- 实现 `activityRepository.ts`
- 更新 `activityController.ts` 调用 Repository
- 更新 `activityRoutes.ts` 启用路由（9 个接口）

**验收**：
- `npm run db:migrate` 退出 0
- 活动列表/报名/取消报名接口正常

### P2-T1：树洞帖子模块 Migration + Repository + 路由

**目标**：迁移树洞帖子模块至 MySQL 并启用。

**内容**：
- 创建 `0230_create_posts.up.sql`（含 posts/comments/post_likes/comment_likes 四张表，外键 SET NULL/CASCADE）
- 实现 `postRepository.ts`
- 更新 `postController.ts` 调用 Repository
- 更新 `postRoutes.ts` 启用路由（7 个接口）

**验收**：
- `npm run db:migrate` 退出 0
- 帖子列表/发布/评论/点赞接口正常

### P2-T2：成就模块 Migration + Repository + 路由

**目标**：迁移成就模块至 MySQL 并启用。

**内容**：
- 创建 `0240_create_achievements.up.sql`（含 achievement_definitions + user_achievements 两张表，Seed 4 条成就）
- 实现 `achievementRepository.ts`
- 更新 `achievementController.ts` 调用 Repository
- 更新 `achievementRoutes.ts` 启用路由（4 个接口）

**验收**：
- `npm run db:migrate` 退出 0
- 成就列表/解锁/进度接口正常

### P1/P2-T7：前端 Feature Flag 调整

**目标**：恢复前端非核心模块入口。

**内容**：
- 更新 `router/guards.ts` 移除相关 feature flag 限制
- 恢复导航菜单中非核心模块入口

**验收**：
- 前端可正常访问所有非核心模块页面
- `npm run build:all` 退出 0

### P1/P2-T8：旧 SQLite Model 清理

**目标**：删除已迁移的旧 SQLite Model 文件。

**内容**：
- 删除 `musicModel.ts`、`courseModel.ts`、`relaxModel.ts`、`activityModel.ts`、`postModel.ts`、`commentModel.ts`、`achievementModel.ts`、`adviceModel.ts`
- 更新相关测试引用

**验收**：
- `rg "from.*models/(music|course|relax|activity|post|comment|achievement|advice)Model"` 零命中
- `npm run test:all` 全部通过

## 3. 实施顺序

```
P1-T1 音乐模块 → P1-T2 课程模块 → P1-T3 放松模块
    ↓
P1-T4 活动模块 → P2-T1 树洞模块 → P2-T2 成就模块
    ↓
P1/P2-T7 前端 Feature Flag
    ↓
P1/P2-T8 旧 SQLite Model 清理
    ↓
P1/P2 Checkpoint
```