# AUD-02 启动、端口和环境变量真实性

## 启动方式与端口矩阵

| 组件 | 代码/脚本约定 | 当前环境读取 | 当前运行状态 | 问题 |
| --- | --- | --- | --- | --- |
| Vue/Vite | 前端 `VITE_API_BASE_URL` 或 Vite proxy | 根 `.env` 指向 `http://localhost:3000` | 3001 有 Node 进程监听，页面服务未做完整浏览器验收 | 前端 dev 环境不一定经过 Vite proxy |
| Node/Express | `mood_health_server/.env` `PORT=3000` | 3000 有 node 进程监听 | `/health` 可达但 degraded | health 不能证明 AI 链路 |
| FastAPI | `scripts/start-all.ps1:25` 约定 8001；`mood_health_ai_service/app/config.py` 默认 8001 | Node `.env` 却配置 `AI_SERVICE_BASE_URL=http://127.0.0.1:8000` | 8000/8001 均未监听 | Node→Python 当前不可达 |
| PM2 | `ecosystem.config.cjs:17` 设置 `FASTAPI_BASE_URL=http://127.0.0.1:8001` | Node AI client 读取 `AI_SERVICE_BASE_URL` | 未作为本轮运行证据 | `FASTAPI_BASE_URL` 与 Node 实际读取变量不一致 |
| Streamlit 知识助手 | `agent_app/.env` 和 `src/App.vue` 指向 8501 | `http://localhost:8501/?user_id=...` | 8501 未监听 | 独立前端、绕过 Node、当前打不开 |

## Node 到 Python 配置冲突

- `scripts/start-all.ps1:33`：设置 `FASTAPI_BASE_URL=http://127.0.0.1:${AiPort}`。
- `ecosystem.config.cjs:17`：设置 `FASTAPI_BASE_URL=http://127.0.0.1:8001`。
- `mood_health_server/src/services/fastApiClient.ts:8-10`：读取 `AI_SERVICE_BASE_URL || http://127.0.0.1:8001`。
- `mood_health_server/src/services/analysisDispatcher.ts:26`：读取 `AI_SERVICE_BASE_URL || http://127.0.0.1:8001`。
- `mood_health_server/src/utils/ai/aiClient.ts:220-221`：读取 `AI_SERVICE_BASE_URL || http://127.0.0.1:8001`。
- `mood_health_server/.env:46`：实际设置 `AI_SERVICE_BASE_URL=http://127.0.0.1:8000`。

结论：同一 FastAPI 服务存在 8000/8001、`FASTAPI_BASE_URL`/`AI_SERVICE_BASE_URL` 两套约定；当前活动 Node 配置指向 8000，但 8000 未启动。

## doctor 覆盖缺口

`npm run doctor:strict` 输出 0 errors、1 warning，但退出码为 1。它确认了 Node/npm/Python/PM2、package 文件、`.env`、dist、3001 和 3000 可达，但没有覆盖：

- FastAPI 8000/8001 是否真的可达。
- Provider Key 是否有效。
- Node→Python 内部 Token/HMAC 是否匹配。
- DeepSeek 或其他 Provider 是否真实调用。
- Streamlit 8501 是否可达。
- 知识助手是否按 Vue 内部路由打开。

