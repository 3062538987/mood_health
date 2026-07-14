# R0 Checkpoint A 交付报告

## 1. 检查点结论

Phase A 的 Task 1–3 已按独立切片完成并提交：工程基线已冻结，旧 SQLite 主库已有只读离线备份和可复核 SHA-256，版本库不再追踪虚拟环境、数据库运行文件和 Redis dump，PM2 后端进程名已统一为 `mood-health-server`。

Checkpoint A 当前状态为“等待用户确认，性能门禁部分完成”。性能脚本、固定请求协议、三轮预采样和原始 JSON 已交付，但本次 Windows 宿主机没有完整限制为 2 核 2G，因此不能把预采样用于性能提升结论，也不勾选完整的 Task PERF 重构前受限窗口。

## 2. Task 1：工程基线

- `npm run doctor`：退出码 0，0 个错误、2 个端口未运行警告。
- `npm run build:all`：退出码 0，前后端均构建成功；保留 Vite 大 chunk 既有警告。
- `npm run test:all`：退出码 1，前端 40 项中 37 项通过、3 项失败，与重构前首次采集一致；命令因前端失败未继续后端。
- 后端单独基线：47 项中 8 项通过、39 项因 SQLite 外键状态等问题失败，并存在 Jest 未关闭句柄提示。
- 标准启动的重构前现状：命令退出 0 但没有 PM2 后端应用，定位为进程名不一致。

完整复现步骤与错误摘要见 [`R0-baseline.md`](R0-baseline.md)。本阶段没有修改情绪分析规则，没有手工修旧 SQLite 来换取测试通过。

## 3. Task PERF：重构前预采样

- 每场景 1 次预热、3 次独立运行、每轮 5 请求、并发 1。
- 首页 `GET /`：当前稳定返回 404。
- 登录：使用固定不存在的技术用户名和固定错误密码，稳定返回 401，不写入旧库。
- 代表性数据库查询 `/health`：返回 200；因 Redis 未连接，每轮平均约 2007ms，包含约 2 秒 Redis 超时，不代表纯 SQLite 查询。
- Node API 长窗口平均 CPU `0.01%`、峰值 `0.02%`；平均工作集 90,761,216 bytes、峰值 118,665,216 bytes。
- 原始 JSON 保存逐请求状态、TTFB 和总耗时，不保存密码或响应正文，可重新计算指标。

详细协议、三轮结果和限制见 [`R0-performance-baseline.md`](R0-performance-baseline.md) 与 [`R0-before.json`](performance/R0-before.json)。当前数据只证明脚本和预采样可执行，不证明性能改善。

## 4. Task 2：备份与仓库治理

- 源库：`mood_health_server/data/mood-health.db`，229,376 bytes。
- 离线备份：`backups/legacy-sqlite/2026-07-14/mood-health.db`，只读。
- 两者 SHA-256：`4D67AD29A0CEDE2A68FF33DF342543CA577B20FCE49C0B8D3938283F754EE2B0`。
- Git 停止追踪：2,372 个 `venv/`/`venv.backup/` 文件、10 个数据库运行文件、2 个 Redis dump。
- 最终 `git ls-files` 中虚拟环境、数据库运行文件和 Redis dump 数量为 0。
- 磁盘上的旧主库、离线备份、`file/` 用户资料目录均仍存在，未删除或覆盖。

校验与处置规则见 [`legacy-backup-manifest.md`](legacy-backup-manifest.md)。

## 5. Task 3：PM2 启动契约

- ecosystem、PowerShell、Shell 与 npm 统一使用 `mood-health-server`。
- 运维契约测试 3/3 通过，后端 TypeScript 构建通过。
- `npm run start-all:no-ai` 成功启动一个在线 `mood-health-server`。
- 重复启动后 PID 被替换，但进程数量仍为 1，没有重复后端进程。
- `npm run pm2:stop` 删除项目后端；复核项目 PM2 进程数量为 0，仅保留用户已有的 `pm2-logrotate` 模块。

## 6. 提交与回退点

| 提交 | 内容 |
|---|---|
| `2cf1813` | 记录工程基线、性能预基线和迁移方案批准状态 |
| `0ca0c1c` | 建立 SQLite 备份清单并停止追踪运行产物 |
| `9c6f376` | 统一 PM2 后端进程名并增加契约测试 |

三个提交均对应单一逻辑目标，可独立审查与回退。现有权威设计文档、`tasks/plan.md` 和 `file/` 是开始前未跟踪内容，本阶段未将其纳入上述提交，也未改动其内容。

## 7. 进入 Phase B 前的确认项

1. 用户确认接受 Task 1–3 的范围和三个提交。
2. 用户确认性能数据当前仅为未受完整 2 核 2G 限制的预基线；如需把 Task PERF 重构前窗口在 Checkpoint A 即完全闭合，应先提供或指定 2 核 2G 等价受限环境，再按同一脚本补采。
3. 未获确认前，不执行 Task 4，不开始应用边界治理，也不执行任何 MySQL Migration。
