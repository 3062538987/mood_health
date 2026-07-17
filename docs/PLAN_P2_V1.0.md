# P2 v1.0 开发计划

> 基于《江宇芳开发任务1.0.xlsx》"待完成视图"中 P2 优先级任务
> 日期：2026-07-17

---

## 一、代码审计结论

共 11 个 P2 任务，审计结果如下：

| 任务ID | 功能 | 审计结论 | 说明 |
|--------|------|----------|------|
| P2-MOB-01 | 核心页面响应式布局 | **已包含** | main.scss 有 768px/480px 断点；DefaultLayout 有移动底部导航；Header/Sidebar 有响应式适配 |
| P2-MOB-02 | 移动端图表与表单体验 | **已包含** | 图表/表单已基本适配；部分页面已有响应式 CSS |
| P2-SCALE-01 | 新增量表配置 | **已包含** | assessment_instruments/versions/items 表支持动态配置；scoringEngine.ts 基于 JSON 规则计分 |
| P2-SCALE-02 | 多量表结果历史 | **已包含** | QuestionnaireHistory.vue + QuestionnaireResult.vue；后端支持多量表查询 |
| P2-ACT-01 | 活动报名与提醒 | **部分包含** | 报名/取消报名已实现；**缺失**: 活动提醒通知 |
| P2-ACT-02 | 活动反馈与评分 | **未实现** | feedbackService.ts 仅处理 AI 反馈；无活动反馈/评分功能 |
| P2-ACT-03 | 活动效果统计 | **部分包含** | ActivityDetail 有基本统计；**缺失**: 管理端活动统计页面 |
| P0-DEMO-01 | 演示账号与演示数据 | **已包含** | demo-init.mjs + profileSeed.ts 有 3 个演示账号 + 5 条情绪记录 |
| P0-DEMO-02 | 端到端演示路径 | **部分包含** | GuidePage.vue 有引导页；**缺失**: 答辩演示脚本步骤提示 |
| P0-DEMO-03 | 加载/空状态/错误提示 | **部分包含** | SoftLoadingState/SoftEmptyState 组件存在；部分页面状态不全 |
| P0-DEMO-04 | 论文—功能—测试证据映射 | **已包含** | 大量测试文件；验收文档完备；无需额外开发 |

---

## 二、需开发模块（共 4 个）

### 模块 1: P2-ACT-01 — 活动提醒功能

**当前状态**: 活动报名/取消报名已实现，但无提醒机制

**开发计划**:

1. **数据库**: 新增 `activity_reminders` 表 (migration 0300)
   - 字段: id, activity_id, user_id, remind_at, is_sent, created_at
   
2. **后端**:
   - `activityRepository.ts`: 新增 createReminder / getPendingReminders / markSent
   - `activityController.ts`: 新增 POST /api/activities/:id/remind 接口
   - `activityRoutes.ts`: 添加提醒路由

3. **前端**:
   - `ActivityDetail.vue`: 已报名用户显示"设置提醒"按钮
   - `activityApi.ts`: 新增 setReminder API

**核心文件**:
- `mood_health_server/src/db/migrations/0300_create_activity_reminders.up.sql`
- `mood_health_server/src/repositories/activityRepository.ts`
- `mood_health_server/src/controllers/activityController.ts`
- `mood_health_server/src/routes/activityRoutes.ts`
- `src/api/activityApi.ts`
- `src/views/improve/ActivityDetail.vue`

---

### 模块 2: P2-ACT-02 — 活动反馈与评分

**当前状态**: 完全没有活动反馈功能

**开发计划**:

1. **数据库**: 新增 `activity_feedback` 表 (migration 0310)
   - 字段: id, activity_id, user_id, rating (1-5), comment, created_at
   - 唯一约束: (activity_id, user_id) 防止重复提交

2. **后端**:
   - 新建 `activityFeedbackService.ts`
   - `activityController.ts`: 新增 POST /api/activities/:id/feedback + GET /api/activities/:id/feedback
   - `activityRoutes.ts`: 添加反馈路由

3. **前端**:
   - `ActivityDetail.vue`: 已报名用户活动结束后显示反馈表单(星级评分+文字)
   - `activityApi.ts`: 新增 submitFeedback / getFeedback API

**核心文件**:
- `mood_health_server/src/db/migrations/0310_create_activity_feedback.up.sql`
- `mood_health_server/src/services/activityFeedbackService.ts` (新建)
- `mood_health_server/src/controllers/activityController.ts`
- `mood_health_server/src/routes/activityRoutes.ts`
- `src/api/activityApi.ts`
- `src/views/improve/ActivityDetail.vue`

---

### 模块 3: P2-ACT-03 — 活动效果统计

**当前状态**: 管理端无活动统计页面

**开发计划**:

1. **后端**:
   - `activityController.ts`: 新增 GET /api/activities/stats 管理端统计接口
     - 返回: 总活动数、总报名数、平均报名率、评分分布、反馈数
   - `activityRoutes.ts`: 添加管理端路由 (需 admin 权限)

2. **前端**:
   - 新建 `src/views/admin/ActivityStats.vue` 管理端活动统计页面
   - `src/api/activityApi.ts`: 新增 getActivityStats API
   - 在 `AdminLayout.vue` 导航中添加入口

**核心文件**:
- `mood_health_server/src/controllers/activityController.ts`
- `mood_health_server/src/routes/activityRoutes.ts`
- `src/views/admin/ActivityStats.vue` (新建)
- `src/api/activityApi.ts`
- `src/views/admin/AdminLayout.vue`

---

### 模块 4: P0-DEMO-02/03 — 演示路径增强 + 状态补全

**当前状态**: 引导页存在但无演示步骤；部分页面缺少加载/空/错误状态

**开发计划**:

1. **演示路径增强**:
   - `GuidePage.vue`: 增加答辩演示模式 (6 步脚本: 登录→情绪记录→测评→AI建议→社区→管理分析)
   - 每个步骤可点击跳转到对应页面

2. **状态补全** (检查并补全以下页面):
   - `MoodRecord.vue`: 提交加载状态
   - `Questionnaire.vue`: 提交中/空题目/网络错误状态
   - `Counseling.vue`: AI 响应中/失败重试状态
   - `TreeHole.vue`: 空列表/发布失败状态
   - `MusicTherapy.vue`: 加载/播放失败状态
   - `Achievements.vue`: 空成就状态

**核心文件**:
- `src/views/guide/GuidePage.vue`
- `src/views/mood/MoodRecord.vue`
- `src/views/improve/Questionnaire.vue`
- `src/views/counseling/Counseling.vue`
- `src/views/relax/TreeHole.vue`
- `src/views/relax/MusicTherapy.vue`
- `src/views/achievements/Achievements.vue`

---

## 三、执行顺序

```
模块 1: P2-ACT-01 活动提醒 → 模块 2: P2-ACT-02 活动反馈评分
    ↓
模块 3: P2-ACT-03 活动效果统计
    ↓
模块 4: P0-DEMO-02/03 演示路径+状态补全
```

每完成一个模块 → 验证通过 → 提交 GitHub master