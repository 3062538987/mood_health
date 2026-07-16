# R0 重构前后性能对比

## 1. 状态

本次已完成可重复脚本、重构前原始采样和重构后原始采样，但前后两次测量在不同物理主机上执行，且均未施加完整的 2 核 2G 资源限制，因此不能作为论文中的最终性能提升证据。

原始数据位于：
- 重构前：[`R0-before.json`](performance/R0-before.json)
- 重构后：[`R0-after.json`](performance/R0-after.json)

两份文件均包含逐请求状态码、TTFB 和总耗时，可重新计算平均值、P50 与 P95；响应正文和密码不写入文件。

## 2. 固定协议

| 参数 | 值 |
|---|---|
| 预热 | 每场景 1 次 |
| 独立运行 | 每场景 3 次 |
| 每轮请求数 | 5 |
| 并发度 | 1 |
| 首页 | `GET /` |
| 登录 | `POST /api/auth/login`，使用固定不存在的技术用户名和固定错误密码，稳定测量 401 路径 |
| 代表性数据库查询 | `GET /health` |

## 3. 重构前环境 (2026-07-14)

- CPU：Intel Core i7-13700H，20 个逻辑处理器。
- 内存：16,788,504,576 bytes。
- Node.js：`v24.13.0`。
- 进程约束：PM2 `max_memory_restart=450M`；宿主机未限制为 2 核 2G。
- 数据库：旧 SQLite，`users=3`、`moods=2`、`questionnaires=0`、`user_assessments=0`。
- Redis：未运行或未配置。

## 4. 重构后环境 (2026-07-16)

- CPU：Intel Core i5-13500，20 个逻辑处理器。
- 内存：34,029,092,864 bytes。
- Node.js：`v26.5.0`。
- 进程约束：宿主机未限制为 2 核 2G。
- 数据库：MySQL 8.4.10（Docker 容器），Reference Seed 已执行。
- Redis：7-alpine（Docker 容器），运行中。

## 5. 采样结果对比

以下为三轮各自的总响应平均值；每轮完整平均值、P50、P95 和逐请求原始值见 JSON。

### 5.1 首页 `GET /`（HTTP 404）

| 窗口 | Run 1 | Run 2 | Run 3 |
|---|---:|---:|---:|
| 重构前 | 0.85 ms | 0.96 ms | 0.87 ms |
| 重构后 | 1.13 ms | 1.11 ms | 1.32 ms |

### 5.2 登录 `POST /api/auth/login`（HTTP 401）

| 窗口 | Run 1 | Run 2 | Run 3 |
|---|---:|---:|---:|
| 重构前 | 1.41 ms | 1.25 ms | 1.32 ms |
| 重构后 | 3.65 ms | 3.34 ms | 2.94 ms |

### 5.3 代表性数据库查询 `GET /health`（HTTP 200）

| 窗口 | Run 1 | Run 2 | Run 3 |
|---|---:|---:|---:|
| 重构前 | 2007.53 ms | 2007.16 ms | 2007.08 ms |
| 重构后 | 2.05 ms | 1.66 ms | 1.56 ms |

### 5.4 进程内存

| 指标 | 重构前 | 重构后 |
|---|---|---|
| 平均工作集 | 90,761,216 bytes (~87 MB) | ~285,000,000 bytes (~272 MB) |
| 峰值工作集 | 118,665,216 bytes (~113 MB) | 361,250,816 bytes (~345 MB) |

## 6. 分析说明

1. **首页**：前后差异在亚毫秒级，均属 404 快速路径，无显著变化。
2. **登录**：重构后略有增加（~1.3ms → ~3.3ms），符合预期——MySQL 认证路径需要网络往返和 bcrypt 校验，而 SQLite 是本地文件访问。
3. **代表性数据库查询**：重构后大幅降低（~2007ms → ~1.8ms），但这是环境变化而非性能改善。重构前 Redis 未运行，`/health` 端点受 Redis 连接超时（约 2 秒）影响；重构后 Redis 正常运行，健康检查快速返回。此差异不能解释为数据库查询性能提升。
4. **内存**：重构后工作集显著增加（~87MB → ~272MB），主要因为 `mysql2` 连接池、`ioredis` 客户端和新增的 Repository/Service 模块占用。

## 7. 限制与结论边界

1. 前后测量在**不同物理主机**上执行（i7-13700H / 16GB vs i5-13500 / 32GB），不能直接对比。
2. Node.js 版本不同（v24.13.0 vs v26.5.0），可能影响运行时性能。
3. `GET /` 当前是 404 路径，不代表浏览器完整首页首屏加载。
4. 登录使用稳定的 401 失败路径，不代表成功登录和 JWT 生成耗时。
5. `/health` 重构前受 Redis 未连接的超时影响，与重构后不可直接比较。
6. 当前数据规模极小，且没有完整 2 核 2G 资源限制。
7. **本报告不声称性能提升。** 前后结果因环境差异不可比，仅分别记录两个测量窗口的原始数据。

## 8. 复现命令

```powershell
# 设置环境变量
$env:PERF_USERNAME='r0_perf_nonexistent_user'
$env:PERF_PASSWORD='<fixed-invalid-password>'

# 重构前（已执行）
node scripts/performance-baseline.mjs --pid <api-pid> --sqlite-path mood_health_server/data/mood-health.db --output docs/refactor/performance/R0-before.json --label before

# 重构后（已执行）
node scripts/performance-baseline.mjs --pid <api-pid> --output docs/refactor/performance/R0-after.json --label after --resource-profile "Windows host; no enforced 2-core/2G host cap"
```

正式复测必须继续使用同一脚本、1 次预热、3 次独立运行、每轮 5 请求和并发 1，并把资源限制、数据规模、硬件、Node.js 版本及 Redis 状态调整为前后完全一致。