# R0 重构前性能预基线

## 1. 状态

本次已完成可重复脚本和重构前原始采样，但当前 Windows 宿主机未施加完整的 2 核 2G 资源限制，因此状态为“预基线”，不能作为论文中的最终性能提升证据。R0 结束后的正式对比必须在相同资源限制、相同数据规模和相同负载参数下重新执行前后两个测量窗口。

原始数据位于 [`R0-before.json`](performance/R0-before.json)，包含逐请求状态码、TTFB 和总耗时，可重新计算平均值、P50 与 P95；响应正文和密码不写入文件。

## 2. 固定协议

| 参数 | 值 |
|---|---|
| 预热 | 每场景 1 次 |
| 独立运行 | 每场景 3 次 |
| 每轮请求数 | 5 |
| 并发度 | 1 |
| 首页 | `GET /` |
| 登录 | `POST /api/auth/login`，使用固定不存在的技术用户名和固定错误密码，稳定测量 401 路径 |
| 代表性数据库查询 | `GET /health`，执行 SQLite `SELECT 1 + 1`，同时包含 Redis 健康检查 |

## 3. 本次环境与数据规模

- CPU：Intel Core i7-13700H，20 个逻辑处理器。
- 内存：16,788,504,576 bytes。
- Node.js：`v24.13.0`。
- 进程约束：PM2 `max_memory_restart=450M`；宿主机未限制为 2 核 2G。
- 数据库：旧 SQLite，`users=3`、`moods=2`、`questionnaires=0`、`user_assessments=0`；只读取计数，未修改数据。
- Redis：未运行或未配置。

## 4. 采样结果

以下为三轮各自的总响应平均值；每轮完整平均值、P50、P95 和逐请求原始值见 JSON。

| 场景 | HTTP 状态 | Run 1 | Run 2 | Run 3 |
|---|---|---:|---:|---:|
| 首页 | 404 | 0.85 ms | 0.96 ms | 0.87 ms |
| 登录 | 401 | 1.41 ms | 1.25 ms | 1.32 ms |
| 代表性数据库查询 | 200 | 2007.53 ms | 2007.16 ms | 2007.08 ms |

Node.js API 进程在可用的长测量窗口中平均 CPU 为 `0.01%`、峰值为 `0.02%`；平均工作集为 90,761,216 bytes，峰值工作集为 118,665,216 bytes。首页和登录窗口均短于 100ms，Windows 累计 CPU 计时分辨率不足，脚本将其 CPU 值记为不可用，没有用噪声填充结果。SQLite 与 Node.js 同进程运行，不能单独拆分数据库 CPU/内存。

## 5. 限制与结论边界

1. `GET /` 当前是 404 路径，不代表浏览器完整首页首屏加载。
2. 登录使用稳定的 401 失败路径，不代表成功登录和 JWT 生成耗时。
3. `/health` 的约 2 秒主要受 Redis 未连接时的超时检查影响，不能解释为纯 SQLite 查询耗时。
4. 当前数据规模极小，且没有完整 2 核 2G 资源限制。
5. 本阶段不声称性能提升；后续若资源、Seed、接口语义或负载参数不一致，只能分别陈述结果，不能计算“提升比例”。

## 6. 复现命令

先以 PM2 启动待测 API，并通过环境变量提供固定技术账号参数；密码只存在于当前进程环境，不写入 Git：

```powershell
$env:PERF_USERNAME='r0_perf_nonexistent_user'
$env:PERF_PASSWORD='<fixed-invalid-password>'
node scripts/performance-baseline.mjs --pid <api-pid> --sqlite-path mood_health_server/data/mood-health.db --output docs/refactor/performance/R0-before.json --label before
```

正式复测必须继续使用同一脚本、1 次预热、3 次独立运行、每轮 5 请求和并发 1，并把资源限制、数据规模及 Redis 状态调整为前后完全一致。
