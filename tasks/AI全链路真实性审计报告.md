# 大学生情绪健康管理平台 AI 全链路真实性审计报告

- Run ID：`20260719-232326-7dc99c6`
- 审计目录：`D:\桌面\ccooddee`
- Git HEAD：`7dc99c6dd670d7ad669e8d5ba2e6324d1a0dba15`
- 审计范围：只审计、不修复、不美化 UI、不暂存、不提交
- 证据目录：`tasks/evidence/ai-chain-audit/20260719-232326-7dc99c6/`

## 总结论

本轮没有任何 AI 功能达到“完整通过”标准。主要原因不是单个页面样式或接口 200，而是存在多处全链路断点：前端 AI API 封装编译失败、Node→FastAPI 端口/变量不一致且当前 FastAPI 未启动、E2E 数据库迁移 `0350` 重复版本阻断、AI 分析结果表为空、知识助手仍以新标签打开独立 Streamlit 并绕过 Node。

健康检查和 FastAPI 单元测试不能证明产品 AI 链路真实可用。当前必须先修 P0 链路问题，再谈 UI 优化。

## 主审计表

| 优先级 | 功能 | 当前真实链路 | 预期链路 | 问题位置 | 文件路径 | 证据 | 修复方案 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P0 | 知识助手 / LangChain 问答 | Vue 点击后 `window.open('http://localhost:8501/?user_id=...','_blank')`，进入独立 Streamlit；当前 8501 不可达 | Vue 内部路由 `/ai/knowledge-assistant` → Node → FastAPI/LangChain → 向量库 → DB | 新标签、绕过 Node、user_id 可伪造、端口不可达 | `src/App.vue:217-219`，`agent_app/app.py:82-87` | 8501 未监听；无 `/ai/knowledge-assistant` 路由 | 新增内部 Vue 页面；删除 popup；前端只调 Node；Node 代理到 FastAPI LangChain；用户 ID 由 Node 鉴权注入 |
| P0 | Node→Python AI 服务 | Node `.env` 指向 8000，部分脚本/默认值指向 8001，当前 8000/8001 均未启动 | Node 使用唯一 `AI_SERVICE_BASE_URL` 指向已启动 FastAPI | 端口和变量约定冲突 | `mood_health_server/.env:46`，`scripts/start-all.ps1:33`，`fastApiClient.ts:8-10` | 8000/8001 连接失败 | 统一变量名和端口；doctor 覆盖 FastAPI 和 Provider；启动脚本写入 Node 实际读取变量 |
| P0 | 情绪洞察页面 | `InsightPage` 错用 `moodAnalysis.ts` 的 `request.post('/api/ai/insight')`，编译失败 | 页面调用正确 Node API，并按响应字段展示 | 前端 API 封装和字段契约 | `src/views/mood/InsightPage.vue:71,100-106`，`src/api/moodAnalysis.ts:175-176` | typecheck 报 `request.post` 不存在 | 改用统一 request 调用形式；明确 `/api/moods/insight` 统计和 `/api/ai/insight` AI 洞察的字段契约 |
| P0 | AI 情绪分析 | 页面主要读取 latest/history；记录保存后不触发分析；结果表为空；FastAPI 不可达 | 记录落库 → Node 查询用户数据 → FastAPI `/api/analyze/mood` → DeepSeek → `mood_analysis_versions` 保存 → 前端读取同一结果 | 生成触发、结果持久化、运行服务 | `MoodAnalysis.vue:294-300,338-339`，`moodRecordStore.ts:823`，`analysisDispatcher.ts:174-179` | DB：`moods=9`，`mood_analysis_versions=0` | 明确生成按钮/自动触发；调用 POST `/api/mood-analyses`；保存后读取同一表同一 userId/period |
| P0 | E2E 验收与数据库迁移 | Playwright global setup 在 migration 阶段失败 | 能创建隔离测试库并执行四条端到端链路 | 重复 migration 版本 | `0350_create_counseling_sessions.up.sql`，`0350_create_user_ai_profiles.up.sql`，`migrationRunner.ts:78-86` | `Duplicate migration version: 0350` | 重新编号冲突 migration；同步迁移测试期望；再跑 E2E |
| P0 | AI 个性化建议保存/历史 | 前端调用 `/api/moods/advice/save/history`，Node 无对应路由；反馈前端调 `/api/ai/feedback`，Node 实际为 `/api/feedback` | 建议生成、保存、历史、反馈均通过 Node 同一路由契约 | 路由未挂载/路径不一致 | `src/api/advice.ts:41,59`，`AiSuggestCard.vue:245-248`，`feedbackRoutes.ts:8` | 静态路由搜索无匹配 | 补齐 Node advice 路由或改前端到真实路由；保存表和读取字段统一 |
| P1 | 心理咨询 AI 对话 | 主链路意图为 `/api/counseling/send`，但前端 `request.post/get` 编译失败；`counseling_sessions` 表缺失 | 三轮上下文 → Node 保存消息 → FastAPI/Provider → 保存回复 → 刷新恢复 | 前端封装、DB migration、Provider 证据 | `src/api/counseling.ts:130-149`，`counselingSessionService.ts:122-162` | typecheck 失败；DB 缺表；Provider 未验证 | 修 request wrapper；修 migration；记录 provider/model/latency/fallbackUsed；跑三轮 E2E |
| P1 | 量表 AI 解读 | 量表提交后调用 `request.post('/api/ai/interpret')`，编译失败；AI 文本经 query 传结果页，缺持久化证据 | 量表结果保存 → Node 调 AI → 解读绑定 session/user 保存 → 结果页刷新可读 | 前端封装和解读保存 | `Questionnaire.vue:186-218`，`questionnaire.ts:89-95` | typecheck 失败；`assessment_sessions=0` | 改用正确 API 封装；AI 解读保存到 assessment session/history |
| P1 | 周报/月报/汇总报告 | `/api/moods/weekly-report` 是统计；`/api/ai/report` 可生成模型报告但未见保存表 | 统计报告与 AI 报告分层；AI 报告生成并持久化 | 汇总生产者缺失 | `mood.ts:101-103`，`ai.ts:49-51`，`aiMoodReportService.ts:30-72` | 未发现稳定报告表或定时生产者 | 建立 report 表/生成任务/读取接口；设置页不能只存 localStorage |
| P1 | 首页/仪表盘 AI 汇总 | 读取分散统计或页面临时计算，未见统一 AI 汇总表 | 首页汇总由 Node 读取持久化或明确实时统计来源 | 数据来源不清 | 首页/Store 分散读取 mood/report 接口 | 汇总生产表缺失 | 定义原始记录、统计、AI 分析、周/月报、建议、风险提示的数据边界 |
| P1 | 风险识别/预警 | `mood_alerts` 表存在但当前计数 0；多为规则/业务逻辑，AI 风险链未验证 | 风险输入 → Node/Python 判定 → 预警保存 → 前端读取 | 运行证据缺失 | `MoodAlert.vue`，`moodAlertService`，量表 case 逻辑 | DB：`mood_alerts=0` | 合成风险文本验收；区分规则预警和 AI 风险识别；保存 requestId |
| P1 | 统一错误、日志、降级 | requestId 生成但成功响应不带；错误可能新生成 requestId；固定 fallback 未标记 | requestId 贯穿 Vue/Node/Python/Provider；降级必须 `fallbackUsed=true` | 响应契约与错误处理 | `requestId.ts:6-10`，`apiResponse.ts:29-31`，`errorHandler.ts:30` | 页面多处只显示泛化错误 | 统一响应 contract；前端展示错误类型/requestId；日志记录 provider/model/latency/fallbackUsed |
| P1 | AI 历史/反馈 | 历史路由存在但当前表为空；反馈前后端路径不一致 | AI 结果、建议、反馈统一保存和读取 | 路由/数据契约 | `aiHistoryRoutes.ts`，`aiHistoryRepository.ts`，`feedbackRoutes.ts`，`AiSuggestCard.vue` | DB：`ai_analysis_history=0`，`ai_feedback=0` | 统一 `/api/ai/history` 与 `/api/feedback` 使用方，补保存触发 |

## 每个功能真实调用链

### 1. 情绪记录

- 入口：`/mood/record`，`src/views/mood/MoodRecord.vue`，`handleSubmit`。
- 前端调用：`src/api/mood.ts`，`POST /api/moods/record`，BaseURL 来自 `VITE_API_BASE_URL=http://localhost:3000`。
- Node 链路：`moodRoutes.ts:26` → `moodController.ts:45` → `moodService.ts:167-183` → `moodRepository.ts`。
- Python/模型：无。
- 数据：写 `moods`、`mood_emotions`、`mood_tags`，使用 `user_id`。
- 展示：Store 更新本地记录；`analysisJob` 固定为空。
- 结论：部分通过。记录链路存在，但本轮 E2E 未完成，且不会触发 AI 分析。

### 2. 情绪趋势或统计

- 入口：情绪档案/分析页。
- 前端调用：`/api/moods/trend`、`/api/moods/weekly-report`、`/api/moods/insight`。
- Node 链路：`moodRoutes.ts` 已挂载。
- Python/模型：无。
- 数据：按 `moods` 及关系表实时统计。
- 结论：部分通过。它是统计功能，不是 AI 汇总。

### 3. 情绪洞察

- 入口：`/mood/insight`，`src/views/mood/InsightPage.vue`。
- 前端调用：实际导入 `src/api/moodAnalysis.ts` 的 `getMoodInsight`，调用 `request.post('/api/ai/insight')`。
- Node 链路：`/api/ai/insight` 存在。
- Python/模型：Node 内部 prompt 调用，不是固定 Python AI 服务链。
- 数据：页面传 period，Node 根据前端传入 summary/trend 生成文本。
- 展示：页面读取字段与接口返回不一致。
- 结论：未通过。首个失败边界为前端 API 封装编译错误和响应契约不一致。

### 4. AI 情绪分析

- 入口：`/mood/analysis`，`src/views/mood/MoodAnalysis.vue`。
- 前端调用：`GET /api/mood-analyses/latest`、`GET /api/mood-analyses`；创建 API 存在但页面刷新按钮不触发生成。
- Node 链路：`moodAnalysisRoutes.ts` 已挂载；`analysisDispatcher.ts` 有调用 FastAPI 的代码。
- Python/模型：目标 `/api/analyze/mood`，当前 8000/8001 不可达。
- 数据：当前库 `moods=9`，`mood_analysis_versions=0`。
- 展示：无 latest 时页面只显示无分析/错误状态。
- 结论：未通过。

### 5. 情绪周报或汇总报告

- 入口：周报/统计卡片和 AI 报告 API。
- 前端调用：`GET /api/moods/weekly-report`、`POST /api/ai/report`。
- Node 链路：两套路由均存在。
- Python/模型：`/api/ai/report` 走 Node AI prompt；不是统一 Python 推理链。
- 数据：未发现稳定周报/月报保存表。
- 结论：未通过。没有真实汇总生产和保存链路。

### 6. AI 个性化建议

- 入口：情绪记录 Store 与建议卡片。
- 前端调用：`/api/ai/context/analyze`、`/api/moods/advice/save`、`/api/moods/advice/history`。
- Node 链路：advice save/history 无真实挂载。
- Python/模型：不统一。
- 数据：保存/读取断链。
- 展示：可能只能展示临时建议。
- 结论：未通过。

### 7. 心理咨询 AI 对话

- 入口：`/counseling`，`src/views/counseling/Counseling.vue`。
- 前端调用：`/api/counseling/send`，但 API 文件使用不存在的 `request.post/get`。
- Node 链路：`counselingRoutes.ts` 已挂载；controller/service 有会话保存和历史上下文逻辑。
- Python/模型：当前代码路径主要通过 Node AI client 调模型，不是严格 Node→FastAPI；Provider 未验证。
- 数据：目标表 `counseling_sessions` 当前缺失。
- 结论：未通过。代码有设计意图，但端到端证据缺失。

### 8. 量表 AI 解读

- 入口：`/improve/questionnaire/:id`。
- 前端调用：`src/api/questionnaire.ts` `request.post('/api/ai/interpret')`，编译失败。
- Node 链路：`/api/ai/interpret` 已挂载。
- Python/模型：Node prompt 调用，不是统一 FastAPI 推理链。
- 数据：AI 解读未证明绑定 assessment session 保存。
- 结论：未通过。

### 9. AI 知识助手

- 入口：顶部导航/移动端菜单。
- 前端调用：`window.open('http://localhost:8501/?user_id=...','_blank')`。
- Node 链路：无。
- Python/LangChain：Streamlit 直接使用 LangChain/DeepSeek/MySQL。
- 数据：`agent_conversations` 在当前库不存在。
- 结论：未通过，P0。

### 10. LangChain 知识库问答

- 入口：独立 `agent_app`。
- 前端调用：Streamlit，不在 Vue 内部。
- Node 链路：无。
- Python/LangChain：`agent_app` 直接创建 agent、embedding、检索。
- 数据：直接 MySQL，以 query `user_id` 区分用户。
- 结论：未通过。绕过统一网关且当前 8501 不可达。

### 11. 风险识别或预警

- 入口：情绪预警组件、咨询安全、量表高风险。
- 前端调用：`/api/moods/alerts` 等。
- Node 链路：部分存在。
- Python/模型：未证明真实 AI 风险识别。
- 数据：`mood_alerts=0`。
- 结论：未验证风险/部分未通过。

### 12. 首页或仪表盘 AI 汇总数据

- 入口：首页/仪表盘卡片。
- 前端调用：分散读取 mood/report/history 接口。
- Node 链路：部分存在。
- Python/模型：无统一 AI 汇总。
- 数据：没有明确汇总生产表。
- 结论：未通过。页面占位或临时统计不能视为 AI 汇总。

## 重点问题回答

### 问题一：情绪洞察获取失败

真实请求路径不是稳定的 `/api/moods/insight`，而是 `InsightPage.vue` 错导入 `moodAnalysis.ts` 后调用 `/api/ai/insight`。该 API 文件使用不存在的 `request.post`，本轮 typecheck 已直接报错。因此首个失败边界在前端封装，不是 Python、DeepSeek 或数据库。即使请求发出，页面读取字段和 `/api/ai/insight` 返回字段也不一致。

### 问题二：情绪分析没有数据

当前测试库存在原始情绪记录：`moods=9`，但分析结果表 `mood_analysis_versions=0`。情绪记录保存后 `analysisJob` 固定为空，页面刷新分析只是读取 latest，不触发生成。Node 到 Python 的目标端口当前不可达，所以无法证明 DeepSeek 被调用或分析结果保存。

### 问题三：汇总数据不知道在哪里

当前系统里需要区分：

- 原始情绪记录：`moods`、`mood_emotions`、`mood_tags`。
- 情绪统计：按需从 mood 表计算。
- AI 分析：目标表 `mood_analysis_versions`，当前为空。
- 周报/月报：统计接口和 AI report 接口分散，未发现稳定保存表。
- 首页汇总：多接口临时聚合，没有独立生产链。
- AI 建议：前端期望 advice save/history，但 Node 无匹配路由。
- 风险提示：`mood_alerts` 表存在但当前为空。

所以目前“汇总数据生产和保存链路”不能标记完成。

### 问题四：心理咨询质量不足

代码中有三轮上下文和心理支持 prompt 的设计，但当前无法证明真实质量链：前端咨询 API 编译失败、`counseling_sessions` 表缺失、Provider 未验证、旧 `/api/ai/counseling` 仍存在。缺少 provider、model、latency、fallbackUsed 的贯穿日志证据。

### 问题五：AI 知识助手跳转新页面且打不开

点击代码就是 `src/App.vue:217-219` 的 `window.open`，目标 `http://localhost:8501/?user_id=...`。当前 8501 未监听，所以打不开；即使能打开，也会离开当前系统布局，绕过 Node，并把用户 ID 放在 URL 查询参数里。

## 端到端验收结果

| 验收 | 状态 | 证据 |
| --- | --- | --- |
| 情绪记录与分析 | 未通过 | E2E 在 migration 阶段失败；`moods=9`，`mood_analysis_versions=0`；FastAPI 不可达 |
| 汇总报告 | 未通过 | 未发现稳定保存表；E2E 未进入场景 |
| 心理咨询 | 未通过 | API 编译失败；`counseling_sessions` 表缺失；Provider 未验证 |
| 知识助手 | 未通过 | `window.open` 到 8501；8501 不可达；无内部路由/Node 网关 |

## 已通过功能

无。按本轮标准，必须同时具备用户事件、前端请求、Node 接收、Python 接收、真实 Provider 调用、正确用户数据读写、响应字段匹配、刷新或重新登录后仍可读取。当前没有功能满足全套证据。

## 部分通过功能

- 情绪记录：代码链路和数据库表存在，但 E2E 被 migration 阻断，且不触发 AI。
- 情绪趋势/统计：Node 统计链路存在，但不是 AI。
- FastAPI 单元测试：`78 passed`，但只证明 Python 层孤立测试，不证明产品链路。
- 心理咨询代码设计：存在会话、历史上下文和 prompt 设计，但运行链路未通过。

## 未通过功能

- 情绪洞察。
- AI 情绪分析。
- 情绪周报/月报 AI 汇总。
- AI 个性化建议保存/历史。
- 心理咨询端到端。
- 量表 AI 解读端到端。
- AI 知识助手。
- LangChain 知识库问答。
- 首页 AI 汇总。
- 风险识别/预警端到端。
- 统一错误、requestId、fallback 追踪。
- 四条端到端验收。

## 未验证风险

- DeepSeek 真实 Provider 调用：缺运行服务和 Key 证据。
- 跨用户隔离：代码中部分使用 `user_id`，但本轮无法建立两用户端到端场景。
- 向量库持久化：知识助手当前独立运行且端口不可达，未能验证重启后数据状态。
- Redis 故障降级：当前 `/health` 显示 Redis disconnected，但 AI 链路未进入可验证阶段。

## 剩余 P0

1. E2E migration `0350` 重复版本阻断。
2. 知识助手新标签、8501 不可达、绕过 Node。
3. 前端 AI API 封装使用 `request.get/post` 导致 typecheck/build 失败。
4. Node→FastAPI 端口和变量不一致，且当前 FastAPI 未运行。
5. 情绪分析结果表为空，生成/读取链路未打通。
6. AI 建议保存/历史接口无 Node 挂载。

## 下一步最小修复清单

1. 清除 Mock、固定回复和假成功：所有降级必须返回 `fallbackUsed=true`，固定鼓励/模板不能伪装成模型结果。
2. 固定前端到 Node 的唯一入口：修正 `request.get/post` 使用方式，移除前端 `/ai` 直连 Python proxy 风险。
3. 修复 Node→Python 调用：统一 `AI_SERVICE_BASE_URL` 与端口，doctor 覆盖 FastAPI 和 Provider。
4. 修复模型真实调用：记录 provider、model、latency、usage、fallbackUsed。
5. 修复数据库迁移：解决 `0350` 重复版本和 counseling 表缺失。
6. 修复情绪分析：明确生成触发，保存到 `mood_analysis_versions`，latest/history 读取同一表同一 userId/period。
7. 修复汇总报告和建议：建立周/月报、建议的生产、保存、读取接口，前后端路径一致。
8. 修复知识助手：实现 `/ai/knowledge-assistant` 内部路由；前端只调 Node；Node 再调 FastAPI/LangChain；不暴露 Python/Streamlit 地址。
9. 修复前端错误状态：页面展示错误类型和 requestId，不只显示“API 错误”。
10. 最后再做 UI 优化。

