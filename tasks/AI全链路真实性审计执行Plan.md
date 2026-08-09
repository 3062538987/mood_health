# 大学生情绪健康管理平台 AI 全链路真实性审计执行 Plan

运行编号：`20260719-232326-7dc99c6`  
审计现场：`D:\桌面\ccooddee`  
绑定 Git HEAD：`7dc99c6dd670d7ad669e8d5ba2e6324d1a0dba15`  
执行阶段：第一阶段，只审计、不修复、不美化 UI、不改业务源码。

## 1. 目标与交付物

本轮执行一次 AI 全链路真实性审计，目标是验证所有 AI 功能是否真的走通：

`Vue 前端 -> Node/Express 统一业务网关 -> Python FastAPI AI 服务 -> DeepSeek/LangChain/向量数据库 -> 业务数据库 -> 页面展示`

最终交付：

- `tasks/AI全链路真实性审计执行Plan.md`
- `tasks/AI全链路真实性审计报告.md`
- `tasks/evidence/ai-chain-audit/20260719-232326-7dc99c6/`
- 12 项指定 AI 功能及额外发现功能的真实链路清单
- 已通过、部分通过、未通过、未验证风险、剩余 P0、下一步最小修复清单

通过标准必须同时具备：用户事件、前端请求、Node 接收、Python 接收、真实 Provider 调用、正确用户数据读写、响应字段匹配、刷新或重新登录后仍可读取。缺少任一关键证据不得标记通过。

## 2. 执行约束与证据标准

- 不停止或复用当前 3000/3001 用户进程。
- 不连接生产库；仅使用隔离端口、隔离测试库或只读静态证据。
- 使用合成测试用户，不使用真实心理日记、真实 Cookie、真实 Token 或完整心理对话入报告。
- 真实模型调用如缺少 Key 或服务不可用，标记为“真实 Provider 未验证”，不得用 Mock 结果补成通过。
- 构建、类型检查、Lint、前端测试、Node 测试、FastAPI 测试、E2E 均独立执行，失败不阻止后续证据收集。
- 旧报告、Mock 测试、健康检查、HTTP 200、服务启动和代码文件存在只能作为线索，不能作为功能通过证据。

状态定义：

- 通过：完整链路和持久化均有当前提交证据。
- 部分通过：用户结果可见，但上下文、保存、用户隔离、requestId 或 Provider 证据缺失。
- 未通过：页面不可用、假 AI、错误数据、数据丢失或跨用户访问。
- 未验证风险：因缺 Key、缺服务或缺可观测性无法证明；不得算通过。

## 3. 审计任务

### AUD-00：冻结现场与建立证据目录

- 记录物理目录、Git HEAD、分支、`git status --short`、Node/Python/npm 版本、监听端口和活动进程。
- 记录当前未提交文件，但不覆盖、不暂存、不清理。
- 独立运行：
  - `npm run typecheck:all`
  - `npm run lint:check`
  - `npm run build:all`
  - `npm run test:run`
  - `npm --prefix mood_health_server run test:stable`
  - `python -m pytest -q`，工作目录 `mood_health_ai_service`
  - `npm run doctor:strict`
- 输出每条命令、退出码、失败测试和警告。
- 确认 `agent_app` 是否缺少自动化测试。

### AUD-01：建立全部 AI 功能静态注册地图

逐项追踪情绪记录、趋势统计、洞察、AI 分析、周报/月报、个性化建议、咨询、量表解读、知识助手、LangChain 问答、风险预警、首页汇总，并补充树洞 AI、AI 历史、反馈和 Prompt 管理。

每项记录：Vue 路由、组件、按钮/事件、方法、Store、API 封装、Axios BaseURL、拦截器、Vite Proxy、硬编码地址、是否直连 Python/模型、Mock 或固定返回、Express 路由挂载、Controller、Service、Repository、FastAPI 路由、Provider、Prompt、模型配置、LangChain、Embedding、向量库、输入表、结果表、用户 ID、生成接口、读取接口和页面字段。

重点路径：`src/router/index.ts`、`src/api/`、`src/utils/request.ts`、`vite.config.ts`、`mood_health_server/src/app.ts`、Node routes/controllers/services、`mood_health_ai_service/app`、`agent_app`。

### AUD-02：审计启动、端口和环境变量真实性

- 对照一键启动、`dev:all`、PM2、Vite、Node AI Client、FastAPI Settings、Streamlit 和 `.env` 加载目录。
- 验证 `AI_SERVICE_BASE_URL`、`FASTAPI_BASE_URL`、8000/8001/8501、`HTTP_PROXY/NO_PROXY` 的实际生效值，只输出非敏感地址。
- 检查 Node、FastAPI、Provider、LangChain 服务是否启动及由哪个命令启动。
- 验证 doctor 是否覆盖 Python、Key、内部 Token、Provider 和知识助手。

### AUD-03：审计数据库、汇总生产和用户隔离

- 以活动 migration runner 为准，列出 MySQL、Redis、Chroma 及任何 PostgreSQL/MongoDB 依赖。
- 区分原始情绪、统计、AI 分析、周报、月报、首页汇总、建议、风险和咨询记录。
- 列出表、字段、Repository/Service、写入触发器、读取接口、定时任务及保存周期。
- 核对 `moods/mood_emotions/mood_tags`、`mood_analysis_versions`、`ai_analysis_history`、`mood_alerts`、`counseling_sessions`、`ai_replies` 等活动表与遗留迁移。
- 搜索 cron、worker、queue、`setInterval` 和页面临时计算；无真实生产者或保存链路时标记“未完成”。
- 用测试用户 B 尝试读取用户 A 的分析、历史和会话 ID，验证隔离；无法运行时标记未验证风险。

### AUD-04 至 AUD-10：逐功能链路审计

- AUD-04：情绪记录、趋势统计和首页汇总。
- AUD-05：情绪洞察与 AI 情绪分析，重点定位“情绪洞察获取失败”和“情绪分析没有数据”的首个失败边界。
- AUD-06：周报、月报和个性化建议，区分统计报告、AI 报告和 UI 设置。
- AUD-07：心理咨询与风险识别，验证三轮上下文、Provider、保存、Prompt、安全边界和模板降级。
- AUD-08：量表 AI 解读，区分业务得分、AI 解读和保存历史。
- AUD-09：知识助手、LangChain 和向量库，捕获 `window.open`、`_blank`、8501、Streamlit、绕过 Node、query user_id 和向量库持久化问题。
- AUD-10：统一响应、错误、日志和降级，核对 requestId、provider、model、latency、fallbackUsed 和敏感日志泄露。

### AUD-11：四条真实端到端验收

1. 情绪记录与分析：新增三条不同日期记录；数据库确认；触发分析；确认 Node、Python、DeepSeek；确认结果保存；刷新并重新登录读取同一结果。
2. 汇总报告：生成七日周报；核对数据范围；确认保存；重新登录后比较报告 ID 或内容摘要。
3. 心理咨询：连续三轮；第三轮包含历史；确认真实 Provider；确认无模板降级；确认会话记录保存和刷新恢复。
4. 知识助手：点击后不得产生 popup；URL 应为内部路由；请求应依次经过 Node、FastAPI/LangChain、向量检索，并在原页面展示。

失败同样保存为审计证据，不因中途失败跳过其余场景。

### AUD-12：汇总报告与最小修复清单

报告主表固定为：

| 优先级 | 功能 | 当前真实链路 | 预期链路 | 问题位置 | 文件路径 | 证据 | 修复方案 |
| --- | --- | --- | --- | --- | --- | --- | --- |

每个功能附：功能入口、前端调用、Node 链路、Python/Provider/LangChain 链路、数据链路、前端展示、错误与降级、运行证据编号、结论。

最终固定输出：

1. 已通过功能。
2. 部分通过功能。
3. 未通过功能。
4. 剩余 P0。
5. 每个功能真实调用链。
6. 每个功能测试证据。
7. 按“清假成功 -> 前端唯一入口 -> Node->Python -> Provider -> 数据读写 -> 汇总/建议 -> 知识助手 -> 错误状态 -> UI”的最小修复清单。

## 4. 停止条件

- 缺少真实 AI Key 时，不使用 Mock 补成通过。
- 审计阶段发现 P0 也不修改代码；完成其他独立功能审计后统一交付报告。
- 如果发现必须连接生产库、使用真实心理数据或执行破坏性操作才能继续，则停止对应子项并标记“未验证风险”。
