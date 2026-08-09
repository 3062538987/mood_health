# CI/CD 与配置治理修改方案

> 交付性质：**仅方案文档**。本文件不修改任何仓库源码、不执行 `git commit`、不写 `dist/`。
> 所有改动均为「建议补丁 / 完整配置文件」，由对应负责人复核后落地。
> 范围：CI/CD、部署配置（nginx）、跨系统配置治理、文档治理。AI 相关死代码删除由另一专家负责。

---

## 0. 已核实事实清单（逐条来源）

| 编号 | 问题 | 核实位置 | 现状 |
|------|------|----------|------|
| C1 | 无 CI | `.github/workflows/` 目录为空 | 无任何 workflow 文件 |
| N1 | `/ai/` 公网暴露 | `nginx.conf:78-88`、`:142-152`；`nginx.linux.conf` 无但原始设计含 | `/ai/` 直接代理到 AI 后端 |
| N2/T5 | AI 端口漂移 | `nginx.conf:30` upstream `8000`；`vite.config.ts:82` `8000`；`aiConfig.ts:54` 默认 `8000`；真实 `MOOD_AI_SERVICE_PORT=8001` | 三处默认 8000 ≠ 实际 8001 |
| N3 | 缺安全响应头 | `nginx.conf` 两 server 块、`nginx.linux.conf` server 块 | 均无任何 `add_header` 安全头 |
| N4 | 缺速率限制 | 同上三处 | 无任何 `limit_req_zone` |
| N5 | 生产明文无 TLS | `nginx.linux.conf:32-74` | 仅 `listen 80`、无 TLS、无 80→443 跳转、`server_name` 为公网 IP |
| T2 | `AI_ENABLED` 默认 false | `aiConfig.ts:52` | 默认 `false`（交叉引用安全专家） |
| T4 | MySQL 端口漂移 | 根 `.env:10` `MYSQL_PORT=3316`；`mysql.ts:41` 默认 `3306`；`.env.example:12` `3306`；AI `config.py:20` 默认 `3306` 且 AI `.env` 未设 | AI 连 `3306` ≠ 实际 `3316` |
| T6 | `.env.example` 不同步 / AI 无 example | 根 `.env.example`；根 `.env` 缺 `AI_SERVICE_INTERNAL_TOKEN`；`mood_health_ai_service/` 无 `.env.example` | 模板与真实环境、跨服务不一致 |
| D1 | README 目录树旧结构 | `README.txt:48-113` | 仍描述 `mood_health_server/` 内含 Python，与实际 `mood_health_ai_service/` 矛盾 |
| D2 | README 失效引用 | `README.txt:99-112` 引用 `DEPLOYMENT.md`/`health/`/`start-project.sh`/`requirements.txt` | 仓库根均不存在 |

---

## 一、P1 CI/CD（ci.yml 全文 + 密钥扫描 + 依赖审计）

### 1.1 问题（C1）
`.github/workflows/` 为空，推送/合并无任何质量门禁，密钥与依赖漏洞无法被拦截。

### 1.2 目标
覆盖三子系统构建/类型/测试，并把**密钥扫描**与**依赖审计**设为合并门禁。

### 1.3 触发时机
- `push` 到 `main` / `develop`
- 向 `main` / `develop` 开 `pull_request`

### 1.4 完整文件：`.github/workflows/ci.yml`（新建）

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

# 最小权限原则
permissions:
  contents: read

# 同一 ref 只保留最新一次运行
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ---------- 前端（Vue 3 + TS + Vite） ----------
  frontend:
    name: Frontend (lint / type / unit)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: .
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - name: Install
        run: npm ci
      - name: Lint
        run: npm run lint:check
      - name: Type check
        run: npx vue-tsc --noEmit
      - name: Unit tests
        run: npx vitest run

  # ---------- 后端（Node + TS + Express） ----------
  backend:
    name: Backend (build / type / jest)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: mood_health_server
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: mood_health_server/package-lock.json
      - name: Install
        # 若 mood_health_server 未提交 package-lock.json，请先执行 npm install 并提交锁文件，
        # 再改用 npm ci；临时回退用 npm install。
        run: npm ci || npm install
      - name: Build (tsc)
        run: npm run build
      - name: Type check
        run: npx tsc --noEmit
      - name: Unit tests
        run: npx jest tests/unit --runInBand

  # ---------- AI 服务（Python + FastAPI） ----------
  ai:
    name: AI Service (ruff / mypy / pytest)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: mood_health_ai_service
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.10'
          cache: 'pip'
          cache-dependency-path: mood_health_ai_service/requirements.txt
      - name: Install runtime + dev deps
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install -e ".[dev]"
      - name: Ruff lint
        run: ruff check app
      - name: Mypy type check
        run: mypy app
      - name: Pytest
        run: pytest

  # ---------- 密钥扫描（门禁） ----------
  secret-scan:
    name: Secret Scan (gitleaks + trufflehog)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # 全量历史供 gitleaks 扫描
      - name: Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITLEAKS_ENABLE_UPLOAD_ARTIFACT: 'true'
          GITLEAKS_CONFIG: ''   # 使用内置规则；如需忽略项可在仓库加 .gitleaks.toml
      - name: TruffleHog
        uses: trufflesecurity/trufflehog@main
        with:
          command: filesystem
          path: ./
          additional_args: --only-verified

  # ---------- 依赖审计（门禁） ----------
  dependency-audit:
    name: Dependency Audit (npm / pip)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - name: Frontend npm audit
        run: npm audit --audit-level=high
      - name: Backend npm audit
        working-directory: mood_health_server
        run: npm audit --audit-level=high || true   # 见下方说明
      - uses: actions/setup-python@v5
        with:
          python-version: '3.10'
      - name: AI pip-audit
        working-directory: mood_health_ai_service
        run: |
          python -m pip install --upgrade pip
          pip install pip-audit
          pip install -r requirements.txt
          pip-audit -r requirements.txt --audit-level=high

  # ---------- 汇总门禁 ----------
  gate:
    name: CI Gate
    needs: [frontend, backend, ai, secret-scan, dependency-audit]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Fail if any job failed
        run: |
          echo "frontend=${{ needs.frontend.result }}"
          echo "backend=${{ needs.backend.result }}"
          echo "ai=${{ needs.ai.result }}"
          echo "secret-scan=${{ needs.secret-scan.result }}"
          echo "dependency-audit=${{ needs.dependency-audit.result }}"
          if [ "${{ needs.frontend.result }}" != "success" ] \
             || [ "${{ needs.backend.result }}" != "success" ] \
             || [ "${{ needs.ai.result }}" != "success" ] \
             || [ "${{ needs.secret-scan.result }}" != "success" ] \
             || [ "${{ needs.dependency-audit.result }}" != "success" ]; then
            echo "::error::One or more CI jobs failed"; exit 1
          fi
```

### 1.5 落地注意
- `backend` 的 `npm ci` 要求 `mood_health_server/package-lock.json` 已提交；当前根目录有锁文件但后端子目录未必有，**需补提交后端锁文件**。
- `secret-scan` 中 gitleaks 命中会直接失败（门禁）。若有已知误报，在仓库加 `.gitleaks.toml` 用 `allowlist` 排除（路径/正则），不要关闭扫描。
- `dependency-audit` 的 backend 行末尾 `|| true` 仅作临时兼容；建议修复后移除 `|| true`，使高危漏洞也能阻断合并。
- 密钥（真实 `.env`、证书）严禁进仓库；CI 如需真实环境，改用 GitHub Actions **Encrypted Secrets / Environment secrets**，不要写进 workflow 明文。

---

## 二、P1/P2 nginx（TLS、安全头、限流、端口统一、/ai/ 暴露）

三份配置关系：`nginx.conf`（开发/Windows 双 server）、`nginx.linux.conf`（生产，仅 80）。下面分别给出片段与完整重写。

### 2.1 安全响应头（N3）—— 两份 conf 的 server 块统一片段

在**每个 `server { }` 块**内（位置尽量靠前，位于 `listen`/`server_name` 之后）加入：

```nginx
    # ---- 安全响应头 ----
    # HSTS：仅 HTTPS 站点生效；明文 80 server 不要加，否则无 TLS 时无效且告警
    # 下列头对所有 location 生效；若某 location 另设 add_header，会覆盖该 location
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    # CSP：Element Plus 与 ECharts 运行时注入 inline style，故 style-src 必须放行 'unsafe-inline'
    # 脚本均为同源打包产物（script-src 'self'），无内联 eval；如启用 SRI 可进一步收紧
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" always;
```

> 说明：`CS`P 对 Element Plus/ECharts 的兼容点是 `style-src 'self' 'unsafe-inline'`——二者通过 JS 动态写 `element.style`，若去掉 `'unsafe-inline'` 会导致组件样式丢失。脚本侧保持 `'self'` 即可（库代码已打包为同源静态文件）。`X-Frame-Options` 用 `SAMEORIGIN` 而非 `DENY`，以便同域内嵌管理后台；如全站禁止被 iframe，改为 `DENY`。
> 对 **443 server** 额外加 `add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;`（HSTS）。
> `always` 参数确保 4xx/5xx 响应也带这些头。

### 2.2 速率限制（N4）—— `http { }` 内 zone 定义 + location 限流

在 `http { }` 顶部（`include mime.types;` 之后）加入 zone：

```nginx
    # ---- 速率限制 ----
    limit_req_zone $binary_remote_addr zone=api_general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=api_auth:10m  rate=2r/s;
    limit_req_status 429;
```

在 `/api/` 的 `location` 块内加入通用限流；登录/注册等鉴权接口用更严的 `api_auth`。由于本项目路由均为 `/api/...`，建议在 `/api/` 统一限流，并对具体鉴权路径用 `limit_req` 叠加（Nginx 单 location 只能挂一个 zone，故用更严格的 `api_auth` 覆盖全 `/api/`，再单独把高频只读接口放宽——此处给出**全局更严 + 单 location 限流**的稳妥写法）：

```nginx
        # 通用 API 限流（10 r/s，突发 20）
        location /api/ {
            limit_req zone=api_general burst=20 nodelay;
            proxy_pass http://node_backend;
            # ... 其余 proxy_* 保持不变 ...
        }

        # 登录/注册等敏感接口更严（2 r/s，突发 5）
        location = /api/auth/login {
            limit_req zone=api_auth burst=5 nodelay;
            proxy_pass http://node_backend;
            # ... 其余 proxy_* ...
        }
        location = /api/auth/register {
            limit_req zone=api_auth burst=5 nodelay;
            proxy_pass http://node_backend;
            # ... 其余 proxy_* ...
        }
```

> 若不想为每个鉴权路由写独立 `location`，可统一在 `/api/` 用 `api_auth`（2 r/s）作为最严基线，再按压测结果放宽。核心是**登录/注册必须显著严于普通接口**。

### 2.3 生产 TLS 重写（N5）—— `nginx.linux.conf` 完整 server 块

现状问题：`listen 80` 明文、`server_name` 公网 IP、无 TLS、无 80→443 跳转。完整重写如下（证书路径占位，上线前替换为真实路径）：

```nginx
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    server_tokens off;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml+rss image/svg+xml;

    upstream node_backend {
        server 127.0.0.1:3000;
        keepalive 32;
    }

    upstream ai_backend {
        server 127.0.0.1:8001;   # N2/T5：统一为 8001
        keepalive 16;
    }

    map $http_upgrade $connection_upgrade {
        default upgrade;
        ''      close;
    }

    # ---- 速率限制 ----
    limit_req_zone $binary_remote_addr zone=api_general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=api_auth:10m  rate=2r/s;
    limit_req_status 429;

    # ---- HTTP 80：仅做 80→443 强制跳转 ----
    server {
        listen 80;
        server_name 47.94.91.72;   # 建议改为真实域名；IP 仅作回退
        # 健康检查/ACME 校验如需走 80，可在此放行，否则全部跳转
        location / {
            return 301 https://$host$request_uri;
        }
    }

    # ---- HTTPS 443：对外服务 ----
    server {
        listen 443 ssl http2;
        server_name 47.94.91.72;   # 建议改为真实域名

        ssl_certificate     /etc/nginx/certs/fullchain.pem;   # 占位：替换为真实证书
        ssl_certificate_key /etc/nginx/certs/privkey.pem;      # 占位：替换为真实私钥
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        root /opt/mood_health_v2/dist;
        index index.html;

        # ---- 安全响应头 ----
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" always;

        location = /health {
            proxy_pass http://node_backend/health;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 5s;
            proxy_send_timeout 5s;
            proxy_read_timeout 5s;
        }

        # 普通 API 限流
        location /api/ {
            limit_req zone=api_general burst=20 nodelay;
            proxy_pass http://node_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_connect_timeout 15s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # 登录/注册更严限流
        location = /api/auth/login {
            limit_req zone=api_auth burst=5 nodelay;
            proxy_pass http://node_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 15s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
        location = /api/auth/register {
            limit_req zone=api_auth burst=5 nodelay;
            proxy_pass http://node_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 15s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # N1：生产 /ai/ 仅允许内网/特定来源；如 AI 服务不对外，建议直接删除该 location
        location /ai/ {
            # 仅允许本机与内网网段，其余 403（按需修改为你方管理网段）
            allow 127.0.0.1;
            allow 10.0.0.0/8;
            deny all;
            proxy_pass http://ai_backend/;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 15s;
            proxy_send_timeout 120s;
            proxy_read_timeout 120s;
        }

        location ~* \.(?:js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 7d;
            add_header Cache-Control "public";
            try_files $uri =404;
        }

        location / {
            try_files $uri $uri/ /index.html;
        }
    }
}
```

### 2.4 AI 端口统一（N2/T5）—— 三处改动

| 文件 | 原值 | 改为 | 位置 |
|------|------|------|------|
| `nginx.conf` | `upstream ai_backend { server 127.0.0.1:8000; }` | `server 127.0.0.1:8001;` | `:30` |
| `vite.config.ts` | `target: 'http://localhost:8000'` | `target: 'http://localhost:8001'` | `:82` |
| `mood_health_server/src/config/aiConfig.ts` | `getEnv('AI_API_BASE_URL', 'http://localhost:8000/api')` | `'http://localhost:8001/api'` | `:54` |
| `.env.example` | `MOOD_AI_SERVICE_PORT=8001`（已正确） | 保持不变 | `:31` |

**`nginx.conf` 改动（开发配置同步）：**
```nginx
    upstream ai_backend {
        server 127.0.0.1:8001;   # N2/T5：与 MOOD_AI_SERVICE_PORT=8001 对齐
        keepalive 16;
    }
```
并给 `nginx.conf` 两个 server 块补 §2.1 安全头、§2.2 限流、`/ai/` 按 §2.3 内网白名单（开发可放宽，但生产必须限制）。

**`vite.config.ts` 改动（仅 dev 代理，:82）：**
```ts
        '/ai': {
          target: 'http://localhost:8001',   // N2/T5：统一为 8001
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ai/, '/api'),
        },
```

**`aiConfig.ts` 改动（:54）：**
```ts
  apiBaseUrl: getEnv('AI_API_BASE_URL', 'http://localhost:8001/api'),  // N2/T5：默认 8001
```

> 统一原则：**AI 服务固定监听 8001**（由 `MOOD_AI_SERVICE_PORT` 与 `config.py:15` 决定），所有上游/代理/默认回退全部指向 8001，消除「谁默认 8000」的不确定性。

### 2.5 `/ai/` 暴露处理（N1）

- **开发（`nginx.conf`）**：可保留但加内网白名单（同 §2.3 的 `allow/deny`），避免误把 AI 接口暴露到公网。
- **生产（`nginx.linux.conf`）**：见 §2.3，已加 `allow 127.0.0.1; allow 10.0.0.0/8; deny all;`。**若 AI 服务完全不对外，直接删除 `/ai/` 的 `location` 块**，前端通过 `FASTAPI_BASE_URL` 直连或经 Node 后端 `/api/` 转发。
- 配合 §三 的 `AI_SERVICE_INTERNAL_TOKEN`：Node→AI 的调用应携带内部令牌（由安全专家在网关/中间件实现），nginx 层再叠加来源限制形成纵深防御。

---

## 三、P2 配置治理（.env.example 同步、端口/MySQL 漂移、AI_ENABLED）

### 3.1 MySQL 端口漂移（T4）

**根因**：根 `.env` 与运行中的 MySQL 在 `3316`，但 `mysql.ts:41`、`.env.example:12`、AI `config.py:20` 默认 `3306`，且 AI `.env` 未显式设置 → AI 服务连到错误端口。

**处置 A（推荐，保留 3316）**：让全仓显式声明 `3316`，杜绝默认漂移。
- 根 `.env.example`（见 §3.2 全文）`MYSQL_PORT=3316`
- AI 服务 `.env` 追加：
  ```ini
  MYSQL_HOST=127.0.0.1
  MYSQL_PORT=3316
  MYSQL_USER=root
  MYSQL_PASSWORD=<与根 .env 一致>
  MYSQL_DATABASE=mood_health
  ```

**处置 B（若统一回 3306）**：把根 `.env` 的 `MYSQL_PORT` 改回 `3306` 并同步 compose/实际实例。改动面更大，**不推荐**。

> 无论 A/B，关键是「默认值」与「真实环境」必须一致，且根与 AI 两份配置必须同源。

### 3.2 `.env.example` 同步（T6）—— 根 `.env.example` 全文（修订）

替换现有根 `.env.example` 内容（含强随机占位、AI 连接、MySQL 3316）：

```ini
# ============================================
# Mood Health 环境变量模板
# 复制为 .env 并填写实际值；所有 *-placeholder 项上线前用 openssl rand 重生成
# ============================================

# ---- 通用 ----
NODE_ENV=development
VITE_API_BASE_URL=

# ---- MySQL（统一 3316，与运行实例一致） ----
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3316
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=mood_health
MYSQL_APP_USER=mood_app
MYSQL_APP_PASSWORD=
MYSQL_MIGRATOR_USER=root
MYSQL_MIGRATOR_PASSWORD=

# ---- Redis ----
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# ---- AI Provider（云端，可选） ----
AI_API_KEY=your-deepseek-api-key
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat

# ---- AI 开关（安全专家主导；默认关闭，避免未配置时意外启用） ----
# T2 交叉引用：默认 false；需要 AI 时在 .env 显式置 true
AI_ENABLED=false

# ---- 内部服务认证 (Node ↔ FastAPI) ----
# 强随机占位（示例值，上线前务必重生成：openssl rand -hex 32）
AI_SERVICE_INTERNAL_TOKEN=cd49aa01880c7459151ec0ed07d9001ef8943981a2e1c56baf4aca2f83b3a710

# ---- FastAPI 服务 ----
MOOD_AI_SERVICE_PORT=8001

# ---- Node 服务 ----
PORT=3000
FASTAPI_BASE_URL=http://127.0.0.1:8001

# ---- 加密（32 字节十六进制；上线前重生成：openssl rand -hex 32） ----
ENCRYPTION_KEY=c6eac403f34318b48d63ee281d451aab9d53e4f2230b5b8f18ec365afd6a50c5

# ---- 日志 ----
LOG_LEVEL=INFO
```

> 关键修正：根真实 `.env` **缺失 `AI_SERVICE_INTERNAL_TOKEN`** → 补该变量；模板中 `MYSQL_PORT` 由 `3306` 改为 `3316`（与真实环境对齐）；新增 `MYSQL_APP_USER/PASSWORD`、`MYSQL_MIGRATOR_*` 以匹配 `mysql.ts` 的 `required()` 字段，避免启动报错。

### 3.3 AI 服务 `.env.example`（新建 `mood_health_ai_service/.env.example`）

AI 服务当前无 `.env.example`，导致变量来源不明、易漂移。新建：

```ini
# ============================================
# Mood Health AI 服务环境变量模板
# 复制为 .env 并填写；与根 .env 保持同源（端口/令牌/MySQL）
# ============================================

# ---- 服务监听 ----
MOOD_AI_SERVICE_PORT=8001

# ---- 云端 AI Provider（按需；本地模型可留空） ----
AI_API_KEY=your-deepseek-api-key
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat

# ---- 内部服务认证（须与根 .env 的 AI_SERVICE_INTERNAL_TOKEN 完全一致） ----
AI_SERVICE_INTERNAL_TOKEN=cd49aa01880c7459151ec0ed07d9001ef8943981a2e1c56baf4aca2f83b3a710

# ---- MySQL（必须与根 .env 同源；显式声明 3316，避免默认 3306 漂移 T4） ----
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3316
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=mood_health

# ---- Redis ----
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# ---- 加密/日志 ----
ENCRYPTION_KEY=c6eac403f34318b48d63ee281d451aab9d53e4f2230b5b8f18ec365afd6a50c5
LOG_LEVEL=INFO
```

### 3.4 从 example 全量复制填充的操作步骤

```bash
# 1) 根环境
cp .env.example .env
#    编辑 .env：生成强随机令牌并替换占位
#    AI_SERVICE_INTERNAL_TOKEN=$(openssl rand -hex 32)
#    ENCRYPTION_KEY=$(openssl rand -hex 32)
#    填入真实 MYSQL_PASSWORD / REDIS_PASSWORD / AI_API_KEY

# 2) AI 服务环境（与根 .env 同源，令牌/端口/MySQL 必须一致）
cp mood_health_ai_service/.env.example mood_health_ai_service/.env
#    确认 AI_SERVICE_INTERNAL_TOKEN 与根 .env 完全相同
#    确认 MYSQL_PORT=3316 与根 .env / 运行实例一致

# 3) 校验（见第五节自检脚本思路）
```

> **铁律**：真实 `.env`、证书、私钥**永不入库**（`.gitignore` 已含 `.env`？若未含需补）。CI 用 GitHub Encrypted Secrets 注入，不落文件。

### 3.5 `AI_ENABLED` 默认（T2）—— 交叉引用

`aiConfig.ts:52` 默认 `false`。本专家**不改动该默认**（由安全专家主导）：保持默认关闭，需在 `.env` 显式 `AI_ENABLED=true` 才启用，避免未配置密钥时 AI 链路意外开启。仅在此交叉引用，确保 §3.2 模板中已带 `AI_ENABLED=false` 占位。

---

## 四、P2 文档治理（README 目录树重写、失效引用修正）

### 4.1 README 目录树重写（D1）

`README.txt:48-113` 的目录树把 Python 代码放在 `mood_health_server/` 内，与实际 `mood_health_ai_service/` 矛盾。替换为以下**三件套**结构（与实际仓库一致；`agent_app` 为原型目录）：

```text
mood-health-web/
├── src/                                # 前端 Vue 3 源码（views/components/stores/router/utils ...）
├── mood_health_server/                 # 后端 Node (Express + TS)
│   ├── src/
│   │   ├── config/                     # 含 aiConfig.ts / mysql.ts
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── db/                         # 迁移/种子脚本
│   │   ├── scripts/
│   │   ├── types/
│   │   └── utils/
│   ├── tests/unit/                     # 后端单测（jest）
│   ├── dist/                           # tsc 构建产物
│   ├── package.json
│   └── ecosystem.config.cjs            # PM2 编排
├── mood_health_ai_service/             # AI 服务 (FastAPI + Python) —— 独立目录
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py                   # 含 MYSQL_PORT/MOOD_AI_SERVICE_PORT 等
│   │   ├── routers/
│   │   ├── providers/                  # 云端/本地模型
│   │   ├── rag/                        # 知识库
│   │   ├── repositories/
│   │   ├── models/
│   │   ├── auth.py                     # 内部令牌校验
│   │   └── db/
│   ├── tests/
│   ├── migrations/
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── .env / .env.example
├── agent_app/                          # 原型/智能体应用（Prototype）
├── scripts/                            # 根级运维与联调脚本
│   ├── doctor.mjs
│   ├── dev-all.mjs
│   ├── demo-init.mjs
│   └── first-deploy-linux.sh
├── docs/                               # 文档中心（API.md/COMMANDS.md/TESTING.md ...）
├── public/                             # 静态入口（index.html / audio）
├── assets/
├── nginx.conf                          # 开发/Windows 双 server 配置
├── nginx.linux.conf                    # 生产 Linux 配置
├── compose.yaml
├── package.json                        # 前端
├── README.txt
└── .env.example
```

> 同时把 `README.txt:115-122` 端口表与本文对齐：AI API = **8001**（非旧文档可能残留的 8000）；MySQL 实际 **3316**（文档应注明与默认 3306 不同，避免读者按默认踩坑）。

### 4.2 失效引用修正（D2）

`README.txt:99-112` 引用了仓库根不存在的 `DEPLOYMENT.md`、`health/`、`start-project.sh`、`requirements.txt`。两种修法择一：

**修法 A（推荐，补文件/修正引用）**：
1. 删除 `README` 中 `health/README.md` 引用（仓库无 `health/`），或补建 `health/README.md` 健康检查说明。
2. `requirements.txt` 在根不存在——根依赖由前端 `package.json` + 后端 `mood_health_server/package.json` + AI `mood_health_ai_service/requirements.txt` 构成。删除根 `requirements.txt` 引用，改指 `mood_health_ai_service/requirements.txt`。
3. `start-project.sh` 缺失，但 `package.json` 的 `start-all:linux` 等脚本调用 `bash ./start-project.sh`。二选一：
   - **补建** `start-project.sh`（与现有 `start-project.ps1` 对齐的 Linux 版），或
   - **修正** `package.json` 的 `start-all:linux*` 指向已存在的 `scripts/first-deploy-linux.sh` / 等效脚本（修改 package.json 由对应负责人处理，本文仅指出不一致）。
4. **补建** `DEPLOYMENT.md`，至少覆盖：环境要求、三服务启动顺序（MySQL/Redis → Node → AI）、nginx 配置与 TLS 证书放置、`.env` 初始化（见 §3.4）、端口与防火墙说明。最小可用 `DEPLOYMENT.md` 骨架：

   ```markdown
   # 部署指南 (DEPLOYMENT.md)

   ## 1. 前置条件
   - Node >= 22、Python >= 3.10、MySQL(3316)、Redis(6379)
   - 证书放置：生产 `/etc/nginx/certs/{fullchain.pem,privkey.pem}`

   ## 2. 初始化配置
   cp .env.example .env && cp mood_health_ai_service/.env.example mood_health_ai_service/.env
   # 生成 AI_SERVICE_INTERNAL_TOKEN / ENCRYPTION_KEY（openssl rand -hex 32）

   ## 3. 启动顺序
   1) docker compose up -d mysql redis
   2) cd mood_health_ai_service && uvicorn app.main:app --port 8001
   3) cd mood_health_server && npm run build && npm start
   4) 前端 npm run build，由 nginx 托管 dist

   ## 4. 反向代理
   见 nginx.linux.conf（443+TLS，80→443 跳转，/ai/ 内网白名单）

   ## 5. 验证
   curl -f https://<host>/health ; curl -f http://127.0.0.1:8001/health
   ```

**修法 B（最小改动）**：仅删除 README 中四处失效引用，待后续补文档。

> 本文建议**修法 A**，既能消引用又能补齐部署知识；具体文件名/路径以实际落地为准，本文件不改仓库。

---

## 五、验证清单

### 5.1 CI 手动触发预期
```bash
# 本地触发（需 gh CLI）
gh workflow run ci.yml
gh run watch          # 观察 5 个 job：frontend/backend/ai/secret-scan/dependency-audit
```
预期：
- 三子系统 job 全绿；任一测试/类型错误即红。
- `secret-scan` 红 = 仓库存在疑似密钥（如真实 `.env`、硬编码 token）→ 立即清理并轮换。
- `dependency-audit` 红 = 存在 `high` 级以上漏洞（npm/pip）→ 升级依赖或加豁免说明。
- PR 页面显示「Required checks」通过方可合并（在分支保护规则中把本 workflow 设为 required）。

### 5.2 nginx 配置校验
```bash
# 开发配置
nginx -t -c /path/to/nginx.conf
# 生产配置
nginx -t -c /path/to/nginx.linux.conf
```
预期：`configuration file ... syntax is ok` / `test is successful`。
逐项核对：
- [ ] 两个 server 块均出现 `X-Content-Type-Options`/`X-Frame-Options`/`Referrer-Policy`/`Content-Security-Policy`。
- [ ] 443 server 额外有 `Strict-Transport-Security`。
- [ ] `limit_req_zone` 已定义，`/api/` 与 `/api/auth/login|register` 挂载了 `limit_req`。
- [ ] 生产 `listen 80` 仅 `return 301 https://`；`listen 443 ssl` 已配证书。
- [ ] `upstream ai_backend` 指向 `8001`。
- [ ] 生产 `/ai/` 带 `allow/deny` 或已移除。

### 5.3 端口/配置一致性自检脚本思路（建议在 `scripts/` 增加 `config-doctor.mjs` 或 shell）
自检项：
1. **AI 端口一致**：`nginx.conf` / `vite.config.ts` / `aiConfig.ts` 默认 / `.env MOOD_AI_SERVICE_PORT` 全部 == `8001`。
2. **MySQL 端口一致**：根 `.env`、`.env.example`、`AI/.env`、`AI/.env.example`、`mysql.ts` 默认值、AI `config.py` 默认值 全部 == 实际运行端口（建议统一 3316，或统一 3306 但需改运行实例）。
3. **令牌存在**：根 `.env` 与 AI `.env` 均含 `AI_SERVICE_INTERNAL_TOKEN`，且值相同、非 `change-me*`。
4. **密钥不外泄**：`.env` 不在 git 跟踪（`git ls-files | grep -E '\.env$' | grep -v example` 应为空）。
5. **CSP 兼容**：Element Plus/ECharts 相关 `style-src` 含 `'unsafe-inline'`。

伪代码：
```bash
check_eq() { # 名称 期望值 实际值
  [ "$2" = "$3" ] && echo "OK  $1" || echo "FAIL $1: want=$2 got=$3"
}
# 端口
check_eq "nginx.ai_backend" 8001 "$(grep -oP 'ai_backend.*?:\K\d+' nginx.conf | head -1)"
check_eq "vite.ai" 8001 "$(grep -oP "localhost:\K\d+" vite.config.ts | head -1)"
check_eq "aiConfig.default" 8001 "$(grep -oP "localhost:\K\d+" mood_health_server/src/config/aiConfig.ts | head -1)"
# MySQL
check_eq "root.env.MYSQL_PORT" 3316 "$(grep '^MYSQL_PORT=' .env | cut -d= -f2)"
check_eq "ai.env.MYSQL_PORT" 3316 "$(grep '^MYSQL_PORT=' mood_health_ai_service/.env | cut -d= -f2)"
# 令牌
[ -n "$(grep '^AI_SERVICE_INTERNAL_TOKEN=' .env)" ] && echo "OK token in root .env" || echo "FAIL token missing in root .env"
```

### 5.4 落地后冒烟
```bash
curl -I https://<host>/        # 应见 Strict-Transport-Security / Content-Security-Policy 等头
curl -i https://<host>/api/auth/login -X POST   # 高频请求应出现 429
curl -f http://127.0.0.1:8001/health   # AI 服务健康（仅内网可达）
```

---

## 附：改动文件一览（均为建议，未修改仓库）

| 文件 | 动作 | 对应发现 |
|------|------|----------|
| `.github/workflows/ci.yml` | 新建 | C1 |
| `nginx.conf` | 改（安全头+限流+ai_backend 8001+/ai/ 白名单） | N1/N2/N3/N4 |
| `nginx.linux.conf` | 重写（443+TLS+跳转+HSTS+限流+8001+/ai/ 白名单） | N1/N2/N3/N4/N5 |
| `vite.config.ts` | 改 `:82` target 8001 | N2/T5 |
| `mood_health_server/src/config/aiConfig.ts` | 改 `:54` 默认 8001 | N2/T5 |
| `.env.example`（根） | 重写（MYSQL_PORT=3316、补令牌/字段） | T4/T6 |
| `mood_health_ai_service/.env.example` | 新建 | T6 |
| `mood_health_ai_service/.env` | 增补 `MYSQL_PORT=3316` 等 | T4 |
| `README.txt` | 改目录树 + 修失效引用 | D1/D2 |
| `scripts/config-doctor.*` | 新建（自检脚本） | 五.3 |
