# AUD-03 数据库、汇总生产和用户隔离

## 当前测试库只读探测

连接来源：`mood_health_server/.env` 中的本地 E2E MySQL 配置，数据库名 `mood_health_e2e`，端口 `3316`。只执行表存在性与计数查询，不读取真实日记正文。

| 表/集合 | 状态 | 计数 | 审计含义 |
| --- | --- | ---: | --- |
| `users` | 存在 | 51 | 测试库存在用户数据 |
| `moods` | 存在 | 9 | 原始情绪记录已存在 |
| `mood_emotions` | 存在 | 9 | 情绪关系表有数据 |
| `mood_tags` | 存在 | 4 | 标签关系表有数据 |
| `mood_analysis_versions` | 存在 | 0 | 当前库没有持久化 AI 情绪分析结果 |
| `ai_analysis_history` | 存在 | 0 | 当前库没有 AI 历史记录 |
| `mood_alerts` | 存在 | 0 | 当前库没有预警记录 |
| `ai_feedback` | 存在 | 0 | 当前库没有 AI 反馈记录 |
| `assessment_sessions` | 存在 | 0 | 当前库没有量表会话 |
| `counseling_sessions` | 缺失 | - | 咨询持久化表未应用 |
| `ai_replies` | 缺失 | - | 未发现该活动表 |
| `agent_conversations` | 缺失 | - | Streamlit 知识助手对话表未在当前库应用 |
| `analysis_tasks` | 缺失 | - | 未发现分析任务表 |

## 汇总数据来源区分

| 数据类型 | 当前生产者 | 当前保存位置 | 当前读取接口 | 结论 |
| --- | --- | --- | --- | --- |
| 原始情绪记录 | `moodService.recordMood` | `moods`、`mood_emotions`、`mood_tags` | `/api/moods/list` 等 | 存在落库链路，但本轮 E2E 被迁移阻断 |
| 情绪统计 | `moodService` 查询统计 | 不单独保存 | `/api/moods/trend`、`/api/moods/weekly-report`、`/api/moods/insight` | 是实时/按需统计，不是 AI 汇总 |
| AI 情绪分析 | 代码中存在 `mood_analysis_versions` 与 dispatcher | `mood_analysis_versions` | `/api/mood-analyses/latest`、`/api/mood-analyses` | 当前库为 0，生成与读取未通过端到端验证 |
| 周报 | `/api/moods/weekly-report` 统计；`/api/ai/report` 模型报告 | 未发现稳定报告表 | 分散接口 | 无真实生产和保存链路证据 |
| 月报 | `/api/ai/report` 可按 monthly prompt 生成 | 未发现稳定报告表 | 分散接口 | 无持久化证据 |
| 首页汇总 | 页面/Store 汇总多接口或临时计算 | 未发现独立汇总表 | 首页/仪表盘读取分散接口 | 不可标记为 AI 汇总生产链 |
| AI 建议 | `moodRecordStore` 调用分析后保存建议 | 前端期望 `/api/moods/advice/*`，Node 无匹配路由 | 期望 history 接口 | 保存/历史断链 |
| 风险提示 | `moodAlertService` 规则与量表高风险 case | `mood_alerts`、`cases` | `/api/moods/alerts` 等 | 当前库 `mood_alerts=0`，AI 风险链未验证 |
| 心理咨询记录 | `counselingSessionService` | `counseling_sessions` | `/api/counseling/sessions` | 表缺失，端到端失败风险 |
| 知识助手对话 | `agent_app` 直接 MySQL | `agent_conversations` | Streamlit 直接读取 | 绕过 Node，当前库缺表 |

## 用户隔离证据

代码层存在部分隔离设计：

- `counselingSessionService.ts:59-62`：按 `user_id` 和 `session_id` 读取会话。
- `counselingSessionService.ts:80-84`：按 `user_id` 列出会话。
- `aiHistoryRepository.ts:87`、`:93-95`：AI 历史列表按 `user_id` 查询。
- `aiHistoryController.ts:107-115`：AI 历史详情读取后再检查 ownership。
- `moodRepository.ts` 多处查询包含 `user_id`。

但本轮跨用户读取验收未通过，原因是 E2E 数据库迁移在 `0350` 版本冲突处中断，无法创建干净隔离测试场景。因此用户隔离只能标记为“有代码意图，缺当前端到端证据”，不能标记通过。

