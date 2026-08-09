# RAG 知识助手站内化设计

## 1. 背景与目标

当前顶部导航和移动端菜单中的“AI 知识助手”通过 `window.open` 打开 `http://localhost:8501/?user_id=...`。一键启动只启动 Vue、Node 和 FastAPI，并未启动 Streamlit 8501，因此入口会打开无法访问的新标签页。即使单独启动 Streamlit，前端仍会绕过 Node 鉴权，并允许用户修改 URL 中的 `user_id`。

本次修复采用站内统一链路：

`Vue /ai/knowledge-assistant → Node /api/knowledge-assistant/* → FastAPI /api/rag/answer → 向量检索 → DeepSeek-compatible Provider → Node 持久化 → Vue 展示`

目标是让登录用户在当前系统内完成知识问答，获得明确标注来源的 RAG 回答；不再依赖 Streamlit、8501 或前端传入的用户身份。

## 2. 范围

### 2.1 本次包含

- 将桌面端和移动端知识助手入口改为站内路由 `/ai/knowledge-assistant`。
- 新增 Vue 知识助手页面，支持提问、加载状态、来源展示、失败保留与重试。
- 新增 Node 鉴权接口，校验输入、注入登录用户 ID、调用 FastAPI、保存问答历史。
- 将 `agent_app` 中现有心理健康知识条目、向量检索和回答约束迁入 `mood_health_ai_service`。
- FastAPI 返回回答、检索来源、模型信息和请求标识；不得返回未标识的假成功文本。
- 新增知识助手消息持久化和按用户隔离的历史读取。
- 增加前端、Node、FastAPI 单元/契约测试，以及一条浏览器端到端验收路径。

### 2.2 本次不包含

- 不继续维护 Streamlit 作为产品入口。
- 不增加联网搜索、文件上传、管理员知识库编辑或文档自动采集。
- 不把知识助手和心理咨询会话合并；两个功能的提示词、数据和用户预期保持独立。
- 不重构无关 AI 功能。

## 3. 用户体验设计

导航入口仍显示“AI 知识助手”，点击后在当前标签页进入 `/ai/knowledge-assistant`。页面沿用现有全局导航、主题变量和响应式布局，核心区域包含：

1. 页面标题、能力边界和“不能替代专业诊断”的提示。
2. 首屏示例问题，例如考试焦虑、睡眠改善、情绪调节和求助资源。
3. 对话区：用户问题、助手回答、回答来源、时间和失败状态。
4. 输入区：最多 1000 字，发送期间禁用重复提交，支持失败重试。
5. 历史区：列出当前用户的知识问答会话，可进入既有会话或新建会话。

回答下方展示最多 3 条来源，来源由检索结果元数据产生，不能由模型自由编造。若服务不可用，页面显示可操作的错误信息并保留原问题，不展示模板答案冒充真实 RAG 结果。

## 4. 组件与接口

### 4.1 Vue

- 路由：`/ai/knowledge-assistant`，要求登录。
- 页面：`src/views/ai/KnowledgeAssistant.vue`。
- API：`src/api/knowledgeAssistant.ts`。
- 导航：`src/App.vue` 使用 `router.push('/ai/knowledge-assistant')`，删除 `window.open` 和 8501 地址。

建议的前端响应结构：

```ts
interface KnowledgeAnswer {
  sessionId: string
  answer: string
  sources: Array<{ title: string; reference: string }>
  requestId: string
  provider: string
  model: string
  fallbackUsed: false
}
```

### 4.2 Node

所有接口使用现有 `authenticate` 中间件，用户身份只取自 `req.user.userId`：

- `POST /api/knowledge-assistant/messages`
  - 请求：`{ message: string, sessionId?: string }`
  - 行为：校验输入、生成/验证会话 ID、读取最近上下文、调用 FastAPI、保存消息对。
- `GET /api/knowledge-assistant/sessions`
  - 返回当前登录用户的会话摘要。
- `GET /api/knowledge-assistant/sessions/:id/messages`
  - 仅返回属于当前登录用户的消息。

Node 调用 FastAPI 时附带内部服务令牌和 `requestId`，但不转发 Cookie、浏览器 Token 或用户可控的 `user_id`。FastAPI 调用失败时，Node 返回明确的 502/503 错误及 `requestId`，不落库伪造的助手回答。

### 4.3 FastAPI RAG

新增 `POST /api/rag/answer` 内部接口，请求包含 `query`、最近上下文和 `requestId`。处理流程如下：

1. 校验内部服务令牌和输入长度。
2. 懒加载嵌入模型与向量库，避免每次请求重复初始化。
3. 对现有心理健康知识条目执行相似度检索，默认返回前 3 条。
4. 将检索内容和来源作为受限上下文加入提示词。
5. 调用现有 OpenAI-compatible Provider 生成回答。
6. 返回回答、去重后的来源、provider、model、usage 和 `requestId`。

知识条目从 `agent_app/rag/rag_service.py` 迁移为 FastAPI 内部数据模块；迁移后 FastAPI 不反向导入 Streamlit 工程。向量库采用本地持久化目录并通过配置指定，启动时缺少模型或索引时在就绪检查中暴露状态，不能让页面无限等待。

## 5. 数据设计

新增 `knowledge_assistant_messages` 表，字段至少包括：

- `id`
- `user_id`
- `session_id`
- `role`（user/assistant）
- `content`
- `sources_json`（仅助手消息）
- `request_id`
- `provider`
- `model`
- `created_at`

索引包含 `(user_id, session_id, created_at)`。所有查询同时带 `user_id` 和 `session_id`，避免跨用户读取。用户问题与助手回答在同一事务中保存；若 Provider 或 RAG 失败，则不保存不完整消息对。

会话标题在本次 MVP 中由首条用户问题截取生成，不增加重命名功能。

## 6. 错误与安全边界

- 空问题返回 400，超过 1000 字返回 400。
- 未登录返回 401；不接受请求体或查询参数中的用户 ID。
- 非本用户会话统一返回 404，避免泄露会话是否存在。
- RAG 未就绪返回 503；Provider 失败返回 502；响应携带 `requestId` 便于定位。
- `fallbackUsed` 仅在确有显式降级时使用。本次知识助手不使用模板内容伪装 RAG 成功，因此成功响应固定为 `false`。
- 页面和回答明确说明知识内容用于心理健康科普，不构成诊断或治疗建议；紧急危险情形引导联系当地急救、学校心理中心或可信任的人。
- 日志记录请求标识、耗时、检索条数、provider、model 和错误类别，不记录完整提问、Cookie、Token 或密钥。

## 7. 测试与验收

按照测试驱动顺序实施：先写失败测试，再写最小代码使其通过。

### 7.1 自动化测试

- 前端：导航不再调用 `window.open`；内部路由可解析；页面发送成功显示答案与来源；失败时保留问题并允许重试。
- Node：未登录被拒绝；忽略/拒绝用户伪造身份；只读取本人会话；FastAPI 成功后事务保存消息对；FastAPI 失败不保存伪回答。
- FastAPI：内部令牌校验；请求契约；检索返回限定数量和真实来源；Provider 接收检索上下文；初始化或 Provider 失败返回明确状态。
- 数据库：迁移前进/回滚及用户隔离查询。

### 7.2 真实验收

1. 一键启动后只依赖现有 Vue、Node、FastAPI 和基础设施，不要求手动启动 8501。
2. 登录后点击桌面端和移动端“AI 知识助手”，均在当前标签页进入内部路由。
3. 提交一个知识库覆盖的问题，浏览器请求先到 Node，再由 Node 到 FastAPI。
4. 页面显示非空回答和至少一条与检索结果一致的来源。
5. 数据库保存到当前登录用户；刷新页面后可以恢复该会话。
6. 使用第二个用户无法读取第一个用户的会话。
7. 停止 FastAPI 后重新提问，页面显示失败、保留原问题且没有伪造助手消息入库。

## 8. 交付拆分

实施时按小改动分别提交：

1. 路由与导航入口回归测试及站内跳转。
2. FastAPI RAG 合同、检索模块和测试。
3. Node 鉴权代理、持久化迁移和测试。
4. Vue 知识助手页面、API 封装和组件测试。
5. 启动/就绪检查、端到端验证和必要文档更新。

每个提交只包含对应目标文件，不暂存当前工作区中的其他修改。
