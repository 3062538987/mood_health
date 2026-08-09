# 部署指南 (DEPLOYMENT.md)

> 本文档为「大学生情绪健康管理平台」的部署说明，与 `README.txt` 保持一致。
> 关键端口：**前端 3001（dev）/ 由 nginx 托管 dist**，**后端 3000**，**AI 服务 8001**，**MySQL 3316**，**Redis 6379**。

## 1. 前置条件

- Node.js >= 22（后端 / 前端构建）
- Python >= 3.10（AI 服务）
- MySQL（实例端口 **3316**）、Redis（6379）
- Docker（推荐用 `compose.yaml` 起 MySQL/Redis）
- 生产环境证书：`/etc/nginx/certs/{fullchain.pem,privkey.pem}`（见 `nginx.linux.conf`）

## 2. 环境变量初始化

```bash
# 1) 根环境（前端 + 后端共用）
cp .env.example .env
#    生成强随机令牌并替换占位（上线前务必重生成）：
#      AI_SERVICE_INTERNAL_TOKEN=$(openssl rand -hex 32)
#      ENCRYPTION_KEY=$(openssl rand -hex 32)
#    填入真实 MYSQL_PASSWORD / REDIS_PASSWORD / AI_API_KEY
#    确认 MYSQL_PORT=3316（与运行实例一致）

# 2) AI 服务环境（与根 .env 同源：令牌/端口/MySQL 必须一致）
cp mood_health_ai_service/.env.example mood_health_ai_service/.env
#    确认 AI_SERVICE_INTERNAL_TOKEN 与根 .env 完全相同
#    确认 MYSQL_PORT=3316
```

> **铁律**：真实 `.env`、证书、私钥**永不入库**（`.gitignore` 已含 `.env`）。
> CI 中敏感值通过 GitHub Actions Encrypted Secrets 注入，不落文件。

## 3. 启动顺序

```bash
# 1) 基础设施
docker compose up -d mysql redis

# 2) 数据库迁移与种子
cd mood_health_server && npm run db:migrate && npm run db:seed:demo

# 3) AI 服务（端口 8001）
cd mood_health_ai_service && uvicorn app.main:app --port 8001
#    AI 服务在启动时会校验 AI_SERVICE_INTERNAL_TOKEN 非空（空令牌直接拒绝启动）

# 4) 后端（端口 3000）
cd mood_health_server && npm run build && npm start

# 5) 前端构建，由 nginx 托管 dist
npm run build
```

## 4. 反向代理（nginx）

- 开发：`nginx.conf`（Windows 双 server，含安全头与限流；`/ai/` 限本机）
- 生产：`nginx.linux.conf`（**仅 80→443 跳转 + 443 TLS/HSTS**，`ai_backend` 指向 8001，`/ai/` 内网白名单）

验证配置：

```bash
nginx -t -c /path/to/nginx.linux.conf
```

## 5. 验证

```bash
curl -f https://<host>/health            # 后端健康（应见安全响应头 / HSTS）
curl -f http://127.0.0.1:8001/health     # AI 服务健康（仅内网可达）
curl -i https://<host>/api/auth/login -X POST   # 高频请求应出现 429（限流生效）
```

## 6. 安全注意事项

- AI 服务 `analyze`/`chat` 路由要求 HMAC 内部鉴权；后端 `fastApiClient` / `aiClient` 已自动签名，需两端 `AI_SERVICE_INTERNAL_TOKEN` 配置一致。
- 生产 `AI_ENABLED` 默认 `false`，需要 AI 时在 `.env` 显式置 `true`。
- 泄露的密钥（DeepSeek Key、DB 口令）须立即轮换并迁入密钥管理，AI 不自动处理真实凭证。
