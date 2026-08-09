# AUD-00 现场冻结与环境证据

- 审计目录：`D:\桌面\ccooddee`
- Run ID：`20260719-232326-7dc99c6`
- Git HEAD：`7dc99c6dd670d7ad669e8d5ba2e6324d1a0dba15`
- 分支：`master`
- 当前日期：`2026-07-19`

## 工作区状态

审计开始时已存在未提交变更，本轮按要求保留，不覆盖、不暂存、不清理。原有变更包括：

- `mood_health_server/package.json`
- `mood_health_server/src/middleware/csrf.ts`
- `tasks/evidence/test3-browser-performance-final.json`
- 根目录若干历史报告文件删除状态
- `docs/` 下若干未跟踪文档
- `tasks/AI_V3_预计修改执行Plan_基于当前代码.md`
- `tasks/测试3.0.md`

本轮新增审计交付物：

- `tasks/AI全链路真实性审计执行Plan.md`
- `tasks/AI全链路真实性审计报告.md`
- `tasks/evidence/ai-chain-audit/20260719-232326-7dc99c6/`

## 版本与进程

| 项目 | 证据 |
| --- | --- |
| Node.js | `v24.13.0` |
| npm | `11.6.2` |
| Python | `3.11.9` |
| Git | `2.55.0.windows.2` |
| 3000 | listening，node pid `11232` |
| 3001 | listening，node pid `28100` |
| 3316 | listening，Docker backend |
| 8000 | 未监听 |
| 8001 | 未监听 |
| 8501 | 未监听 |

## 健康探测

| 地址 | 结果 | 结论 |
| --- | --- | --- |
| `http://127.0.0.1:3000/health` | HTTP 200，`mysql=connected`，`redis=disconnected`，状态 degraded | 只能证明 Node 基础进程可达，不能证明 AI 链路可用 |
| `http://127.0.0.1:3000/api/health` | HTTP 401 | 受鉴权保护，不作为功能证据 |
| `http://127.0.0.1:8000/api/health` | 连接失败 | FastAPI 8000 未启动 |
| `http://127.0.0.1:8001/api/health` | 连接失败 | FastAPI 8001 未启动 |
| `http://127.0.0.1:8501/` | 连接失败 | Streamlit 知识助手未启动 |

## 环境变量与配置读取

只记录非敏感地址与是否配置，不输出密码、Token、Cookie、真实日记或完整对话。

| 来源 | 配置 | 证据/结论 |
| --- | --- | --- |
| Shell | `HTTP_PROXY=http://127.0.0.1:7897`，`HTTPS_PROXY=http://127.0.0.1:7897`，`NO_PROXY` 未设置 | 本机请求可能走代理；内部服务访问缺少 NO_PROXY 风险 |
| Shell | `AI_SERVICE_BASE_URL` 未设置，`FASTAPI_BASE_URL` 未设置，`AI_SERVICE_INTERNAL_TOKEN` 未设置，`AI_API_KEY` 未设置 | 当前终端本身不具备 AI 服务地址/Key 证据 |
| 根 `.env` | `VITE_API_BASE_URL=http://localhost:3000` | 前端开发环境直接指向 Node，不依赖 Vite `/api` proxy |
| `mood_health_server/.env` | `PORT=3000`，MySQL `127.0.0.1:3316`，DB `mood_health_e2e`，`AI_ENABLED=true`，`AI_SERVICE_BASE_URL=http://127.0.0.1:8000` | Node 配置指向 8000，但 8000 未启动 |
| `mood_health_ai_service/.env` | 文件不存在 | FastAPI 无本地 `.env` 证据 |
| `agent_app/.env` | DeepSeek Key 为占位符，Streamlit 8501，MySQL 3306 | 知识助手独立应用配置不符合统一网关要求 |

