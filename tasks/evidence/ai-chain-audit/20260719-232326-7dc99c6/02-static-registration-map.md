# AUD-01 静态注册地图

本文件只记录“当前代码中真实注册或被调用的链路”。代码存在但没有注册、没有调用方、路由不匹配或只是独立页面，均不标记为通过。

## 前端统一请求层

- `src/utils/apiBase.ts:31`：`VITE_API_BASE_URL` 作为前端 BaseURL 来源。
- `src/utils/request.ts:47-48`：读取 BaseURL 并判断是否已经包含 `/api`。
- `src/utils/request.ts:141`：Axios `baseURL` 使用上方结果。
- `src/utils/request.ts:149`：请求拦截器。
- `src/utils/request.ts:157`：当 base 已含 `/api` 时剥离重复 `/api/`。
- `src/utils/request.ts:264`：默认导出为 `service.request(config) as Promise<T>`，不是 Axios 实例。
- `vite.config.ts:78`：`/api -> http://localhost:3000`。
- `vite.config.ts:82`：`/ai -> http://localhost:8000`，存在前端直连 Python 的架构风险。
- 根 `.env`：`VITE_API_BASE_URL=http://localhost:3000`，开发态绕过 Vite proxy 直接访问 Node。

## Node 真实挂载点

- `mood_health_server/src/app.ts:183`：`/api/moods`
- `mood_health_server/src/app.ts:184`：`/api/questionnaires`
- `mood_health_server/src/app.ts:195`：`/api/ai`，AI 解读/洞察/报告/旧咨询
- `mood_health_server/src/app.ts:196`：`/api/ai`，AI 历史
- `mood_health_server/src/app.ts:204`：`/api`，反馈路由实际为 `/api/feedback`
- `mood_health_server/src/app.ts:206`：`/api`，情绪分析版本路由实际为 `/api/mood-analyses`
- `mood_health_server/src/app.ts:207`：`/api/counseling`

## FastAPI 真实挂载点

- `mood_health_ai_service/app/main.py:110`：挂载 `analyze_router`
- `mood_health_ai_service/app/main.py:111`：挂载 `chat_router`
- `mood_health_ai_service/app/routers/analyze.py:18`：`POST /api/analyze/mood`
- `mood_health_ai_service/app/routers/chat.py:14`：`POST /api/ai/chat`
- `mood_health_ai_service/app/config.py:28-30`：模型配置为 `AI_API_KEY`、`AI_BASE_URL=https://api.deepseek.com/v1`、`AI_MODEL=deepseek-chat`
- `mood_health_ai_service/app/providers/openai_compatible.py:37-39`：通过 OpenAI-compatible client 调用外部模型。

## 功能入口与链路摘要

| 功能 | 页面/组件 | 前端 API | Node 路由 | Python/Provider | 当前链路状态 |
| --- | --- | --- | --- | --- | --- |
| 情绪记录 | `src/views/mood/MoodRecord.vue` | `src/api/mood.ts` `POST /api/moods/record` | `/api/moods/record` 已挂载 | 无 AI 调用 | 记录链路存在；提交后不触发 AI 分析 |
| 情绪趋势/统计 | `src/views/mood/ArchivePage.vue`、`MoodAnalysis.vue` | `/api/moods/trend`、`/api/moods/weekly-report` | `/api/moods/*` 已挂载 | 无 AI 调用 | 统计链路为数据库统计，不是 AI 汇总 |
| 情绪洞察页面 | `src/views/mood/InsightPage.vue` | 错用 `src/api/moodAnalysis.ts` 的 `request.post('/api/ai/insight')` | `/api/ai/insight` 已挂载 | Node 内直接 prompt 调用 | 前端 API 封装编译失败，页面链路断在前端 |
| MoodAnalysis 洞察统计 | `src/views/mood/MoodAnalysis.vue` | `src/api/moodInsight.ts` `GET /api/moods/insight` | `/api/moods/insight` 已挂载 | 无 AI 调用 | 这是统计洞察，不是 AI 洞察 |
| AI 情绪分析 | `src/views/mood/MoodAnalysis.vue` | `GET /api/mood-analyses/latest`、`GET /api/mood-analyses` | 已挂载 | 存在 `analysisDispatcher`，但真实触发链未验证 | 页面主要读取已有结果，刷新不生成新分析 |
| 周报/月报 | 页面与 API 分散 | `/api/moods/weekly-report`、`/api/ai/report` | 两套路由均存在 | `/api/ai/report` 走 Node AI prompt | 统计报告与模型报告混用；无持久化生产链路证据 |
| AI 个性化建议 | `src/stores/moodRecordStore.ts`、`AiSuggestCard.vue` | `/api/ai/context/analyze`、`/api/moods/advice/save`、`/api/moods/advice/history` | advice save/history 无匹配 Node 路由 | 不统一 | 保存/历史接口断链 |
| 心理咨询 AI 对话 | `src/views/counseling/Counseling.vue` | `/api/counseling/send` | 已挂载 | Node 直接调用 `callChatCompletion` | 前端 API 封装编译失败；DB 表缺失；Provider 未验证 |
| 量表 AI 解读 | `src/views/improve/Questionnaire.vue` | `request.post('/api/ai/interpret')` | `/api/ai/interpret` 已挂载 | Node prompt 调用 | 前端 API 封装编译失败；AI 解读未保存到 assessment 历史 |
| AI 知识助手 | `src/App.vue` | `window.open('http://localhost:8501/?user_id=...')` | 绕过 Node | Streamlit/LangChain 独立应用 | P0：新标签、8501 不可达、URL user_id 可伪造 |
| LangChain 知识库问答 | `agent_app/app.py` | Streamlit 页面 | 无 Node 网关 | `agent_app` 直接 MySQL + LangChain + DeepSeek | 不符合目标架构；当前端口未启动 |
| 风险识别/预警 | `MoodAlert.vue`、咨询安全服务、量表高风险 case | `/api/moods/alerts` 等 | 部分存在 | 多为规则或业务逻辑 | 未验证真实 AI 风险链路 |
| 首页/仪表盘 AI 汇总 | 首页卡片/统计入口 | 读取 mood/stat/report 分散接口 | 部分存在 | 无统一 AI 汇总生产者 | 临时统计或占位不能算 AI 汇总 |

