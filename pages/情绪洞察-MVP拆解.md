# 情绪洞察 MVP 拆解

## MVP 范围

只做核心：**数据聚合 + 图表展示 + AI 分析**。词云、连续天数、点击联动、导出等功能留到 v2。

## 模块拆解

| 模块 | 文件 | 职责 |
|------|------|------|
| M1 后端聚合API | moodRepository.ts + moodService.ts + moodController.ts + moodRoutes.ts | 新增 getMoodInsight 方法，返回分布/趋势/极性数据 |
| M2 后端AI洞察API | aiInsightController.ts + 注册到 aiInterpretationRoutes.ts | 接收 insightData，调用 DeepSeek 生成文字分析 |
| M3 前端图表组件 | EmotionPieChart.vue / IntensityTrendChart.vue / PolarityBarChart.vue | 三个 ECharts 图表组件 |
| M4 前端洞察页面 | MoodInsight.vue | 组合图表+AI分析的主页面 |
| M5 路由注册 | router/index.ts | 注册 /mood/insight 路由 + 导航 |

## 执行顺序

M1 → M2 → M3 → M4 → M5（后端先行，前端随后）

## 每步验证

- M1: `curl` 测试 API 返回正确数据结构
- M2: `curl` 测试 AI 返回文字分析
- M3-M5: TypeScript 编译 + vitest 测试
- 全部完成: 前后端全量测试

## 文件清单

```
新增:
  mood_health_server/src/controllers/aiInsightController.ts
  src/views/mood/MoodInsight.vue
  src/components/mood/EmotionPieChart.vue
  src/components/mood/IntensityTrendChart.vue
  src/components/mood/PolarityBarChart.vue

修改:
  mood_health_server/src/repositories/moodRepository.ts
  mood_health_server/src/services/moodService.ts
  mood_health_server/src/controllers/moodController.ts
  mood_health_server/src/routes/moodRoutes.ts
  mood_health_server/src/routes/aiInterpretationRoutes.ts
  src/router/index.ts
```