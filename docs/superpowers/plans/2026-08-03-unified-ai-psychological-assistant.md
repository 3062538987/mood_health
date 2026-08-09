# AI 心理助手统一窗口实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将“AI 咨询”和“RAG 知识助手”合并为唯一的“AI 心理助手”窗口。

**Architecture:** Vue 只保留 `/counseling` 主入口，Node 使用唯一会话 API 进行风险判断和持久化，FastAPI 在非风险问题上按相关度自动融合知识库。回答始终保持心理陪伴语气，只在有可靠检索结果时显示来源。

**Tech Stack:** Vue 3 + TypeScript + Vitest, Node.js + Express + MySQL + Jest, FastAPI + Pydantic + ChromaDB + pytest。

## Global Constraints

- 用户可见名称统一为“AI 心理助手”，不显示“RAG”或模式切换。
- 不迁移现阶段两套旧会话数据。
- 知识来源仅在相似度达到 `RAG_MIN_SIMILARITY=0.60` 时展示。
- 不新增联网搜索、文件上传、知识库管理或人工咨询。
- 每个小改动单独验证并提交，只暂存本任务明确文件。

---

### Task 1: 统一 FastAPI 回答契约与检索策略

- [ ] 先写失败测试，覆盖知识问题、情绪倾诉、低相关度、风险输入、检索失败和 Provider 失败。
- [ ] 新增签名保护的统一回答端点，一次问题最多调用一次生成模型。
- [ ] 让检索器返回余弦相似度，仅保留达到配置阈值的最多三条资料。
- [ ] 运行 FastAPI 定向测试并单独提交。

### Task 2: 统一 Node 会话、风险与持久化主线

- [ ] 先写失败测试，覆盖契约映射、风险优先、会话归属、事务保存和失败降级。
- [ ] 扩展 `POST /api/counseling/send` 回应，增加 `sources`、`groundingUsed`、`requestId`、`provider`、`model` 和 `fallbackUsed`。
- [ ] 新增迁移，为 `counseling_sessions` 增加来源及调用元数据字段，并使用事务保存消息对。
- [ ] 运行 Node 定向测试并单独提交。

### Task 3: 合并 Vue 用户窗口

- [ ] 先写失败测试，覆盖单入口、旧路由重定向、按需显示来源、历史和失败重试。
- [ ] 将咨询页重命名为“AI 心理助手”，增加知识类示例问题与来源卡片。
- [ ] 将 `/ai/knowledge-assistant` 重定向至 `/counseling`，移除重复导航和用户可见技术词。
- [ ] 运行前端定向测试并单独提交。

### Task 4: 退役独立知识助手主路径

- [ ] 先写或调整失败测试，证明应用只挂载统一 AI 主路径。
- [ ] 停止挂载 `/api/knowledge-assistant`，删除不再使用的页面、API 封装及重复 Node 业务代码；保留已执行的历史迁移。
- [ ] 运行受影响测试并单独提交。

### Task 5: 端到端验收与回归

- [ ] 覆盖倾诉无来源、知识问题有来源、风险提示、刷新恢复、跨用户隔离和 AI 服务故障。
- [ ] 运行前端、Node、FastAPI 测试，以及类型检查和生产构建。
- [ ] 记录未能运行的真实 Provider、高负载或外部依赖验收风险，不将 HTTP 200 当作完成证据。
- [ ] 单独提交 E2E 与必要文档变更。
