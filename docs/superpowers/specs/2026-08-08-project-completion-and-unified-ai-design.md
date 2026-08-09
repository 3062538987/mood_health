# 项目完成与统一 AI Agent 设计及实施规格

> **For agentic workers:** 按任务顺序实施。每个任务必须遵守测试先行、最小实现、独立验证、独立提交；禁止 `git add -A`，禁止把任何真实密钥、密码、令牌或用户心理正文写入 Git、日志和测试报告。

**目标：** 在保留现有 Vue → Node/Express → FastAPI → DeepSeek/知识库 → MySQL 架构的前提下，将项目收口为可真实演示、可审计、可用于毕业答辩的系统，并把本地 RAG、DeepSeek 直接问答和逐条授权的网页搜索统一到 `/counseling`。

**架构：** Vue 只调用 Node；Node 负责登录态、边界校验、会话事务和内部签名；FastAPI 通过 LangGraph 编排安全门、本地检索、DeepSeek V4 Flash、可选 Tavily 和证据整理。MySQL 是唯一会话事实源，不建立第二套 Agent 会话库。

**技术栈：** Vue 3、TypeScript、Express 5、MySQL、Redis、FastAPI、Python 3.11、Chroma、LangGraph 1.2.9、LangChain OpenAI 1.4.0、LangChain Tavily 0.2.18、DeepSeek V4 Flash、Tavily Search。

## Global Constraints

- 唯一用户入口是 `/counseling`；RAG 是 DeepSeek 的补充证据，不是独立聊天产品。
- 网页搜索默认关闭，只对当前一条消息授权，发送后立即复位；风险消息禁止联网。
- 不展示模型私有推理；只展示工具状态、降级状态和最终来源。
- Tavily 固定 `basic`、最多 5 条、`include_answer=false`、`include_raw_content=false`、每条消息最多调用一次。
- DeepSeek 模型显式配置为 `deepseek-v4-flash`。
- 心理咨询不得诊断、推荐药物或替代专业人员；危机热线必须来自实施当日可核实的官方来源。
- 个案只能由结构化高风险测评创建；咨询聊天中的风险文本不得自动生成管理个案。
- `super_admin` 查看全部个案并分配；`counselor` 只处理分配给自己的个案；`admin/student` 不读取个案正文。
- 每项小改动独立提交；提交前检查暂存差异、测试结果和敏感信息。

## 当前审查基线（2026-08-08）

### 已验证

- 当前功能分支为 `codex/ai-chain-p0-fixes`，远程默认分支为 `master`。
- 前端 49 个测试文件、205 项测试通过；Node 56 个套件、250 项测试通过；Python 84 项测试通过。
- `npm run typecheck:all` 与 `npm run build:all` 通过，但构建仍有循环分包和大包警告。
- 尚未推送的敏感报告已经从三个本地分支和两个本地标签的历史中移除；旧提交对象不可解析，敏感路径在全部引用历史中为空。
- 当前唯一已挂载的咨询会话 API 是 `/api/counseling/*`，旧知识助手代码和 Streamlit 原型仍留在仓库但不应继续扩展。

### 阻断与待验证

- 本轮数据库、Redis、Node、FastAPI 和前端均未启动；MySQL 3316 当前拒绝连接。
- 真实 DeepSeek、真实 Chroma 检索、真实 Tavily、MySQL 落库、刷新读取和完整浏览器旅程均未验收。
- 本机未安装 gitleaks；在可用 Docker 或安装受控二进制前，不能把 secret scan 标记为通过。
- 已暴露的本地数据库凭据仍须在数据库启动后实际轮换，并同步仅存在于忽略文件中的环境配置。
- HMAC 当前没有覆盖 nonce，Redis 失败时防重放会失效。
- CI 只监听 `main/develop`，与远程默认 `master` 不一致；Ruff/Mypy 当前未成为硬门禁。
- 风险个案前端引用不存在的 `case.manage`，后端角色种子没有分配 `case.*` 权限，咨询师没有可用入口。
- Chroma 仅在集合为空时初始化，知识内容变化不会触发索引重建。

---

### Task 1: W0 保护现场与权威记录

**交付：** 敏感历史不可达、凭据轮换有真实数据库证据、规格文档成为后续实施的唯一决策基线。

- 保留用户已有未跟踪文件，禁止清理、移动或暂存它们。
- 数据库可用后生成新的高强度应用密码，执行数据库用户密码轮换，再更新被 Git 忽略的环境文件；验证旧密码失败、新密码成功。
- 使用 gitleaks 扫描全部 Git 历史；若工具不可用，只能记录阻断，不得用普通文本搜索冒充通过。
- 提交本规格文档，提交信息使用 `docs: record project completion and unified AI design`。

### Task 2: W1 内部安全合同与工程门禁

**接口：** Node 与 FastAPI 的内部签名统一为 `HMAC-SHA256(secret, "v1\n{timestamp}\n{nonce}\n{sha256(body)}")`。

- 先写跨语言固定向量、nonce 篡改、过期和重复请求失败测试，再修改两端实现。
- Redis 不可用时切换到最多 10,000 条、TTL 300 秒的进程内 nonce 缓存；缓存满时先删除过期项，再删除最旧项。
- 为咨询发送、会话读取和重命名补齐 `message/sessionId/allowWebSearch/title` 边界校验。
- 用 Node 22 原生 `fetch` 替代后端 Axios，固定允许的配置来源、禁止重定向、限制响应体、使用 AbortSignal 超时；移除未使用的 Multer。
- 修复 lint 对生成目录的误扫、Ruff、Mypy 和 Vite 循环分包；CI 监听 `master/develop` 并把 Ruff/Mypy 设为硬门禁。
- 依赖审计仅允许记录“无上游修复且已证明不可达/有补偿控制”的具体 advisory，例外必须在 2026-09-08 前复核；任何新高危直接失败。

### Task 3: W2 可版本化 RAG 与 LangGraph Agent

**接口：** 知识记录固定为 `id/title/content/reference/url/reviewedAt`；Agent 状态包含查询、历史、风险、联网授权、本地来源、网页来源、网页状态和最终回答。

- 先写知识清单校验、知识哈希变化重建、索引一致性和低相关度不引用的失败测试。
- 把硬编码知识迁移为可审查清单；只保留可追溯、当前有效、非诊断和非用药建议内容。
- 以规范化知识清单 SHA-256 作为 Chroma 元数据版本；版本或数量不一致时重建集合并验证完成后再切换。
- 固定 LangGraph/LangChain 依赖版本，使用状态图实现安全门、本地检索、模型决策、最多一次 Tavily 和最终证据整理。
- 风险分支不注册网页工具；非风险分支只有在 `allowWebSearch=true` 且模型判断需要时才允许 Tavily。
- Tavily 不可用时设置 `webSearchStatus=failed` 并继续本地 RAG/DeepSeek；不得伪造网页来源。

### Task 4: W3 统一咨询合同、持久化和页面

**公开请求：** `POST /api/counseling/send` 接收 `{ message: string, sessionId?: string, allowWebSearch: boolean }`，其中消息 trim 后 1..1000，sessionId 必须为 UUID，联网默认 false。

**公开响应：** 保留现有回复字段，来源扩展为 `{ sourceType: "local" | "web", title, reference, url? }`，并增加 `webSearchStatus: "not_requested" | "not_needed" | "used" | "failed"`。

- 先写 Node/FastAPI 合同测试、迁移 up/down/up、事务落库和历史兼容读取测试。
- 新迁移为助手消息增加 `web_search_status`，并把旧知识助手消息幂等复制到咨询会话；保留旧表和历史迁移。
- Vue 咨询页增加一次性联网开关、来源类型、可点击网页来源及降级提示；发送后无论成功失败都复位。
- 刷新会话后必须恢复来源和网页状态；历史记录缺少 `sourceType` 时按 `local` 读取。

### Task 5: W4 风险个案角色与状态闭环

**状态：** `open → assigned → in_progress → referred | closed`；非法跨状态返回 409。

- 先写角色权限、跨用户 IDOR、非法状态和未分配咨询师写入失败测试。
- 测评事务是唯一创建入口；移除未使用的公开手工创建和 auto-create 路由。
- `super_admin` 获得读取全部与分配权限；`counselor` 获得读取已分配、干预、转介和结案权限。
- 每个详情与写操作同时校验角色、归属和当前状态；首次干预把 `assigned` 更新为 `in_progress`。
- 提供超级管理员和咨询师都能到达的个案页面；按钮按权限与状态显示。
- 审计日志仅记录操作者、动作、个案 ID 和时间，不包含测评答案、咨询内容或干预正文。

### Task 6: 清理旧实现与同步文档

- 在统一主链和旧数据迁移验证通过后，删除未挂载的知识助手 Vue/API/Node 实现、旧 `/api/rag/answer` 包装、未使用咨询组件和 `agent_app`。
- 保留数据库历史迁移和旧表，不以删除数据换取代码整洁。
- 同步 README、命令清单、系统架构、数据库设计、API 清单和毕业设计说明；文档只记录有测试或运行证据的结果。

### Task 7: 全量质量门与真实答辩验收

- 运行前端 lint/type/Vitest、Node build/type/Jest、Python Ruff/Mypy/Pytest、全量构建、依赖策略、gitleaks 和 `doctor:strict`。
- 使用一键启动真实运行迁移、种子、MySQL、Redis、Node、FastAPI 和前端；固定 Python 3.11。
- 使用真实 DeepSeek、真实 Chroma、真实 Tavily 验证直接回答、本地 RAG、网页搜索、无关检索、Tavily 失败和风险阻断。
- 浏览器旅程一：学生登录 → 普通问答 → 本地 RAG → 逐条授权联网 → 查看来源 → 刷新历史。
- 浏览器旅程二：学生高风险测评 → 自动个案 → 超级管理员分配 → 咨询师干预 → 转介或结案。
- 证据包只保存状态码、请求 ID、工具状态、脱敏日志、截图和测试计数，不保存密钥或心理正文。
- 未执行或失败的验收项必须标为“风险/未验证”，不得表述为通过。

## 完成定义

只有以下条件同时满足，才能声明项目达到毕业答辩交付标准：所有任务都有独立提交与复核；质量门全绿；真实三服务与数据库链路可启动；两条浏览器旅程可重复；DeepSeek、RAG 和 Tavily 均有真实且脱敏的运行证据；仓库和全部可达历史没有敏感凭据。
