# AUD-04 至 AUD-10 功能链路发现

## 情绪记录、趋势统计、首页汇总

- 入口：`src/router/index.ts:30-58` 的 `/mood/record`、`/mood/archive`、`/mood/insight`、`/mood/analysis`。
- 提交事件：`src/views/mood/MoodRecord.vue:399-400` 调用 `handleSubmit -> store.submitRecord`。
- 前端 API：`src/api/mood.ts:78-80`，`POST /api/moods/record`。
- Node 路由：`mood_health_server/src/routes/moodRoutes.ts:26`。
- Controller/Service：`moodController.ts:45`，`moodService.ts:167-183`。
- 数据写入：`moodRepository.ts:225` 写 `moods`，`:245` 写 `mood_emotions`，`:255` 写 `mood_tags`。
- 关键问题：`moodService.recordMood` 返回 `analysisJob: null`，`src/stores/moodRecordStore.ts:823` 也将 `analysisJob` 固定为 null；情绪记录提交后不会真实触发 AI 分析。
- 统计接口：`/api/moods/trend`、`/api/moods/weekly-report`、`/api/moods/insight` 是数据库统计，不是 DeepSeek/LangChain 汇总。

## 情绪洞察获取失败

- 实际页面：`src/views/mood/InsightPage.vue`。
- 实际导入：`InsightPage.vue:71` 从 `@/api/moodAnalysis` 导入 `getMoodInsight`。
- 实际调用：`InsightPage.vue:100-106` 调用 `getMoodInsight({ period })`。
- API 文件：`src/api/moodAnalysis.ts:175-176` 使用 `request.post('/api/ai/insight', data)`。
- 编译证据：`npm run typecheck:all` 报 `src/api/moodAnalysis.ts(176,18): request.post` 不存在。
- 根因边界：请求大概率断在前端 API 封装，不一定能发到 Node；页面 catch 后只显示固定“获取洞察失败”提示。
- 字段问题：`/api/ai/insight` 返回 `{ analysis }`，而页面读取 `content/trend` 等结构；`/api/moods/insight` 返回统计结构，但该页面未调用正确 wrapper。
- Node 另一路：`aiInsightController.ts:19-43` 在 Node 内生成 prompt 并调用模型；空数据时直接返回固定鼓励文本，未标记 `fallbackUsed=true`。

结论：这不是文案问题，首个失败边界是前端错误导入和 `request.post` API 使用错误；其次是响应字段契约不一致。

## AI 情绪分析没有数据

目标链路应为：用户提交情绪记录 → `moods/mood_emotions/mood_tags` 落库 → 分析接口查询 → Python `/api/analyze/mood` → DeepSeek → `mood_analysis_versions` 保存 → `/api/mood-analyses/latest` 读取 → 页面展示。

当前证据：

- 原始记录存在：测试库 `moods=9`。
- 结果表为空：`mood_analysis_versions=0`。
- 页面 `src/views/mood/MoodAnalysis.vue:294-300` 主要调用 `getLatestAnalysis` 读取现有分析。
- 页面刷新逻辑 `MoodAnalysis.vue:338-339` 只重新读取 `loadAnalysis()`，不创建分析。
- 创建 API 存在：`src/api/moodAnalysis.ts:111-113` `POST /api/mood-analyses`。
- Node 路由存在：`moodAnalysisRoutes.ts:14-17`。
- Python dispatcher 存在：`analysisDispatcher.ts:174-179` 会请求 `/api/analyze/mood`，`:201-206` 有保存到 `mood_analysis_versions` 的代码意图。
- 当前 FastAPI 未启动：8000/8001 均不可达。
- 当前 E2E 被迁移 `0350` 冲突阻断，无法证明创建、保存、刷新读取。

结论：当前“记录有数据但分析没有数据”的事实边界是结果表没有分析版本；页面主要读取而不是生成；Node→Python 当前运行不可达。

## 周报、月报和个性化建议

- `src/api/mood.ts:101-103` 调用 `/api/moods/weekly-report`，Node `moodController.ts:167-172` + `moodService.ts:308-312` 返回数据库统计报告。
- `src/api/ai.ts:49-51` 调用 `/api/ai/report`，Node `aiInterpretationController.ts:54-64` 调用 `aiMoodReportService`。
- `aiMoodReportService.ts:30-46`、`:54-72` 区分 weekly/monthly prompt，但未发现报告持久化表和稳定读取接口。
- 设置页周报推送使用 localStorage，无真实定时生产或通知任务证据。
- `src/api/advice.ts:41`、`:59` 调用 `/api/moods/advice/save` 和 `/api/moods/advice/history`，但 `moodRoutes.ts` 没有挂载对应路由。
- `src/components/mood/AiSuggestCard.vue:245-248` 提交 `/api/ai/feedback`，但实际反馈路由是 `app.ts:204` + `feedbackRoutes.ts:8` 的 `/api/feedback`。

结论：周/月 AI 报告与统计报告混用；AI 建议保存、历史、反馈接口存在路由断链。

## 心理咨询质量与链路

- 主页面：`src/views/counseling/Counseling.vue`。
- 活动 API 意图：`src/api/counseling.ts:142-149` 调用 `/api/counseling/send`。
- 编译证据：`src/api/counseling.ts` 多处 `request.get/post` 不存在。
- Node 路由：`counselingRoutes.ts:12-17` 已挂载 `/send`、`/sessions`、`/sessions/:id`。
- Node controller：`counselingController.ts:103` `sessionCounselingHandler`。
- 会话保存：`counselingController.ts:116-122` 保存用户消息，`:133-140` 构建上下文、调用模型、保存回复。
- 上下文：`counselingSessionService.ts:122-162` 构建系统 prompt 与最近消息。
- Prompt：`counselingSessionService.ts:132-150` 包含支持性回应、禁止诊断、危机建议边界。
- 数据库：当前 `counseling_sessions` 表缺失。
- 旧路由：`/api/ai/counseling` 仍存在，属于遗留重复实现。

结论：代码有上下文会话设计，但当前前端编译失败、表缺失、FastAPI/Provider 未验证，不能证明三轮上下文、保存和 DeepSeek 调用。

## 量表 AI 解读

- 页面：`src/views/improve/Questionnaire.vue`。
- 提交后调用：`Questionnaire.vue:186-204` 提交量表后调用 AI 解读并通过 router query 带到结果页。
- 失败处理：`Questionnaire.vue:207-218` AI 解读失败时仍跳转结果页并设置 `aiFailed=true`。
- API 断点：`src/api/questionnaire.ts:89-95` 使用 `request.post('/api/ai/interpret')`，编译失败。
- 正确备用 API 文件：`src/api/ai.ts:41-43` 有 `getInterpretation`，但当前页面没有使用。
- Node 路由：`aiInterpretationRoutes.ts:14`。
- Controller：`aiInterpretationController.ts:19-32` 调用 `aiAssessmentService.generateInterpretation`。
- 持久化：未发现 AI 解读按 `assessment_session_id` 保存到量表结果历史的完整链路。

结论：量表业务得分和 AI 文本解读不能混为通过；AI 解读当前断在前端封装并缺持久化证据。

## 知识助手与 LangChain

- 点击入口：`src/App.vue:29` 导航点击 `@click.prevent="openAgentAssistant"`。
- 移动端入口：`src/App.vue:121`。
- 实际代码：`src/App.vue:217-219` 使用 `window.open(\`http://localhost:8501/?user_id=${userId}\`, '_blank')`。
- 当前端口：8501 未监听，所以点击目标打不开。
- 目标架构缺失：`src/router/index.ts` 中没有 `/ai/knowledge-assistant` 内部路由。
- Streamlit：`agent_app/app.py:82-87` 从查询参数读取 `user_id`，默认 1。
- Streamlit 数据访问：`agent_app/db/conversation_store.py:31` 直接创建/访问 `agent_conversations`。
- LangChain：`agent_app/model/factory.py:20-23` 使用 DeepSeek-compatible ChatOpenAI，`:29-38` 使用 HuggingFace Embedding。
- Agent：`agent_app/agent/react_agent.py:37` 使用 `MessagesPlaceholder(chat_history)`，`:120-127` 传入历史，`:155` 有固定 fallback 文本。
- 当前测试：`agent_app` 未发现自动化测试。

结论：当前知识助手是独立 Streamlit 应用，新标签打开、绕过 Node、暴露/伪造 user_id、当前端口不可达，属于 P0。

## 错误、requestId、日志与降级

- Node requestId middleware：`mood_health_server/src/middleware/requestId.ts:6-10` 生成 requestId/header。
- 成功响应：`apiResponse.ts:29-31` 的 `apiSuccess` 不包含 requestId。
- 错误响应：`apiFailure` 支持 requestId，但多数 controller 直接返回时未传。
- 全局错误：`errorHandler.ts:30` 新生成 requestId，而不是稳定使用当前请求的 `res.locals.requestId`。
- 前端：`src/utils/request.ts:84`、`:97`、`:245` 能保留 requestId 字段，但页面多处只显示泛化错误。
- Python：`/api/analyze/mood` contract 可包含 requestId；`/api/ai/chat` 响应缺少 requestId、fallbackUsed、latency。
- 降级风险：`aiInsightController.ts` 空数据直接返回固定鼓励文本；`agent_app/agent/react_agent.py:155` 有固定 fallback；均未统一返回 `fallbackUsed=true`。

结论：当前错误链路不能稳定定位 Vue→Node→Python→Provider 的同一 requestId；降级和固定回复存在伪装成正常业务成功的风险。

