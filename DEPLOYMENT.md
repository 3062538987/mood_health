# 生产环境部署指南

## 概述

本项目包含三个主要服务：
1. **前端**：Vue 3 + Vite
2. **后端 API**：Node.js + Express
3. **AI 服务**：Python + FastAPI + Ollama

## 前置要求

- Node.js 18+
- Python 3.8+
- Redis（可选，用于 AI 服务缓存）
- Nginx（用于反向代理）
- PM2（用于进程管理）
- Let's Encrypt（用于 HTTPS 证书）

## 部署步骤

### 1. 环境变量配置

#### 前端环境变量
复制 `.env.example` 为 `.env` 并修改：

```bash
cd mood-health-web
cp .env.example .env
```

修改 `.env` 中的配置：
- `VITE_AI_API_URL`: AI 服务地址（生产环境改为实际域名）
- `VITE_API_BASE_URL`: 后端 API 地址（生产环境改为实际域名）
- `VITE_BASE_URL`: 应用部署路径（生产环境改为 `/app/`）

#### 后端环境变量
复制 `.env.example` 为 `.env` 并修改：

```bash
cd mood-health-server
cp .env.example .env
```

修改 `.env` 中的配置：
- `NODE_ENV`: 改为 `production`
- `DB_SERVER`: 数据库服务器地址
- `DB_USER`: 数据库用户名
- `DB_PASSWORD`: 数据库密码
- `DB_NAME`: 数据库名称
- `JWT_SECRET`: JWT 密钥（生产环境必须修改）
- `ENCRYPTION_KEY`: 加密密钥（生产环境必须修改）
- `FRONTEND_URL`: 前端 URL（用于 CORS）
- `REDIS_URL`: Redis 连接地址（如果使用缓存）
- `OLLAMA_URL`: Ollama API 地址
- `OLLAMA_MODEL`: 使用的模型名称

### 2. 构建前端

```bash
cd mood-health-web
npm run build
```

构建产物在 `dist/` 目录。

### 3. 构建后端

```bash
cd mood-health-server
npm run build
```

构建产物在 `dist/` 目录。

### 4. 安装依赖

#### 后端依赖
```bash
cd mood-health-server
npm install --production
```

#### AI 服务依赖
```bash
cd mood-health-server
pip install -r requirements.txt
```

### 5. 数据库初始化

执行 SQL 脚本创建必要的表：

```bash
# 在 SQL Server 中执行
sqlcmd -S localhost -U sa -P your_password -i advice_history.sql
```

### 6. 使用 PM2 启动服务

#### 安装 PM2
```bash
npm install -g pm2
```

#### 启动服务
```bash
cd mood-health-server
pm2 start ecosystem.config.js --env production
```

#### 查看服务状态
```bash
pm2 status
pm2 logs mood-ai-server
pm2 logs mood-health-server
```

#### 重启服务
```bash
pm2 restart all
```

### 7. 配置 Nginx

#### 安装 Nginx
```bash
# Ubuntu/Debian
sudo apt-get install nginx

# CentOS/RHEL
sudo yum install nginx
```

#### 配置 Nginx
1. 复制 `nginx.conf` 到 Nginx 配置目录：
```bash
sudo cp nginx.conf /etc/nginx/sites-available/mood
```

2. 修改配置中的域名和路径：
   - `your-domain.com` 改为实际域名
   - `/path/to/mood-health-web/dist/` 改为实际路径

3. 启用配置：
```bash
sudo ln -s /etc/nginx/sites-available/mood /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. 配置 HTTPS（推荐）

#### 使用 Let's Encrypt
```bash
# 安装 Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

## 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 3001 | 开发环境 |
| 后端 API | 3000 | Node.js 服务 |
| AI 服务 | 8000 | FastAPI 服务 |
| Ollama | 11434 | AI 模型服务 |
| Redis | 6379 | 缓存服务 |

## 监控和日志

### PM2 监控
```bash
# 实时监控
pm2 monit

# 查看日志
pm2 logs --lines 100

# 清空日志
pm2 flush
```

### Nginx 日志
```bash
# 访问日志
sudo tail -f /var/log/nginx/access.log

# 错误日志
sudo tail -f /var/log/nginx/error.log
```

### 应用日志
```bash
# 后端日志
tail -f mood-health-server/logs/*.log

# AI 服务日志
tail -f mood-health-server/logs/mood-ai-*.log
```

## 性能优化

### 1. 启用 Gzip 压缩
Nginx 配置已包含 Gzip 压缩，确保以下文件类型被压缩：
- text/plain
- text/css
- text/xml
- text/javascript
- application/json
- application/javascript

### 2. 静态资源缓存
Nginx 配置已包含静态资源缓存，缓存时间为 1 年。

### 3. Redis 缓存
AI 服务使用 Redis 缓存分析结果，缓存时间为 1 小时。

### 4. 限流
AI 服务已配置限流：
- 每个客户端每分钟最多 10 次请求

## 安全建议

1. **修改默认密钥**：生产环境必须修改 `JWT_SECRET` 和 `ENCRYPTION_KEY`
2. **使用 HTTPS**：生产环境必须使用 HTTPS
3. **配置防火墙**：只开放必要的端口（80, 443）
4. **定期更新依赖**：保持依赖包为最新版本
5. **备份配置**：定期备份配置文件和数据库
6. **监控日志**：定期检查异常日志

## 故障排查

### 服务无法启动
1. 检查端口是否被占用：`netstat -tulpn | grep PORT`
2. 检查日志：`pm2 logs`
3. 检查环境变量：确认 `.env` 文件配置正确

### API 请求失败
1. 检查后端服务状态：`pm2 status`
2. 检查数据库连接：确认数据库服务运行正常
3. 检查 CORS 配置：确认 `FRONTEND_URL` 配置正确

### AI 服务无响应
1. 检查 Ollama 服务：确认 Ollama 正在运行
2. 检查 Redis 连接：确认 Redis 服务正常
3. 检查模型加载：确认模型已下载

## 更新部署

### 更新代码
```bash
# 拉取最新代码
git pull

# 重新构建
cd mood-health-web && npm run build
cd mood-health-server && npm run build

# 重启服务
pm2 restart all
```

### 数据库迁移
如果数据库结构有变化，执行迁移脚本：
```bash
sqlcmd -S localhost -U sa -P your_password -i migration.sql
```

## 回滚

如果部署出现问题，可以快速回滚：

```bash
# 回滚代码
git revert <commit-hash>

# 重新构建并重启
cd mood-health-web && npm run build
cd mood-health-server && npm run build
pm2 restart all
```

## 联系支持

如遇到部署问题，请提供以下信息：
1. 操作系统和版本
2. Node.js 和 Python 版本
3. 错误日志
4. 配置文件（隐藏敏感信息）
