# R0 架构稳定验收报告

## 1. 状态

- 状态：待用户确认
- 日期：2026-07-16
- 分支：`codex/r0-phase-f`
- 上游计划：[R0 代码重构实施计划](../../tasks/plan.md)
- 数据库迁移方案：[R0 MySQL 数据库迁移方案](R0-mysql-migration-plan%20.md)

## 2. 验收概要

R0 阶段 F 及全部前置任务已完成。所有自动化测试、构建和类型检查通过。MySQL 是活动运行时唯一业务数据库，核心领域全部通过 Repository 访问。SQL Server 依赖已清退，SQLite 活动运行路径为零。非核心功能保持关闭。

## 3. 检查点 F 验收清单

### 3.1 所有任务验收条件

| 任务 | 状态 | 证据 |
|---|---|---|
| Task 1 基线记录 | 通过 | [R0-baseline.md](R0-baseline.md) |
| Task 2 SQLite 备份与仓库治理 | 通过 | 已提交 |
| Task 3 统一启动入口 | 通过 | `pm2-contract.test.mjs` 通过 |
| Task 4 拆分应用创建与启动 | 通过 | `appFactory.test.ts` 通过 |
| Task 5 统一 API 响应工具 | 通过 | `apiContract.test.ts` 通过 |
| Task 6 后端停用非核心路由 | 通过 | `featureRoutes.test.ts` 通过 |
| Task 7 前端停用非核心入口 | 通过 | `featureFlags.test.ts` 通过 |
| Task 8 固定 request.ts 契约 | 通过 | `request.test.ts` 6/6 通过 |
| Task 9 认证契约修复 | 通过 | `authController.test.ts` + `userStore.test.ts` 通过 |
| Task 10 情绪接口契约 | 通过 | `moodControllerContract.test.ts` 通过 |
| Task 11 测评接口契约 | 通过 | `questionnaireController.test.ts` 通过 |
| Task 12 管理/审计契约 | 通过 | `managementController.test.ts` + `auditController.test.ts` 通过 |
| Task 13 Docker Compose | 通过 | `docker compose config` 通过；MySQL + Redis 健康 |
| Task 14 MySQL 连接池 | 通过 | `mysql.test.ts` 通过 |
| Task 15 Migration 执行器 | 通过 | `migrationRunner.test.ts` + `migrationFiles.test.ts` 通过 |
| Task 16 确定性 Seed | 通过 | `seedCore.test.ts` + `seedProfiles.test.ts` 通过 |
| Task 17 用户认证领域 | 通过 | `userRepository.test.ts` + `authService.test.ts` 通过 |
| Task 18 RBAC 与审计 | 通过 | `accessRepository.test.ts` + `auditRepository.test.ts` + `authRoles.test.ts` 通过 |
| Task 19 情绪记录领域 | 通过 | `moodRepository.test.ts` + `moodService.test.ts` 通过 |
| Task 20 测评存储领域 | 通过 | `assessmentRepository.test.ts` + `assessmentService.test.ts` 通过 |
| Task 21 管理聚合 | 通过 | `managementRepository.test.ts` + `managementService.test.ts` 通过 |
| Task 22 核心 SQL Server 清退 | 通过 | `noSqlServerRuntime.test.ts` 通过 |
| Task 23 活动/社区 SQL Server 清退 | 通过 | `legacySqliteModels.test.ts` 通过 |
| Task 24 资源类 SQL Server 清退 | 通过 | 已提交 |
| Task 25 删除 SQL Server 依赖 | 通过 | `rg "mssql"` 核心源码零命中 |
| Task 26 SQLite 活动路径零访问 | 通过 | `noSqliteActivePath.test.ts` 通过 |
| Task 27 前端旧响应兼容删除 | 通过 | 见 3.4 |

### 3.2 性能基线

| 项目 | 状态 |
|---|---|
| 重构前数据 | [R0-before.json](performance/R0-before.json) 已采集 |
| 重构后数据 | 待 Task PERF 采集 |
| 对比报告 | 待 Task PERF 完成后更新 |

### 3.3 自动化测试结果

| 套件 | 文件数 | 测试数 | 结果 |
|---|---|---|---|
| 前端 (vitest) | 9 | 64 | 全部通过 |
| 后端 (jest) | 33 | 142 | 全部通过 |
| **合计** | **42** | **206** | **全部通过** |

### 3.4 前端契约验收

- `request.ts` 只接受 `code === 0`，`code === 200` 和无 `code` 均被拒绝并抛出 `ApiRequestError`。
- `rg "code === 200" src/utils/request.ts` → 零命中。
- `rg "\.data\.data|\.data\.code|\.data\.message" src/api/ src/stores/ src/views/` → 零命中，页面层无二次解包。

### 3.5 旧数据库清退验收

| 检查项 | 结果 |
|---|---|
| `rg "mssql"` 核心源码 | 零命中 |
| `rg "SQL Server"` 核心源码 | 零命中 |
| SQLite 活动运行路径 | `noSqliteActivePath.test.ts` 通过 |
| SQLite 遗留引用 | 仅存在于停用模块（activity/comment/post/course/music/relax/achievement/advice） |

### 3.6 基础设施验收

- Docker Compose 配置通过：`docker compose config --quiet` 退出 0。
- MySQL 8.4.10 容器健康运行。
- Redis 7-alpine 容器健康运行。
- 构建通过：`npm run build:all` 退出 0。

## 4. 已知限制

1. 性能测试在无 2 核 2G 资源限制的主机上运行，不能作为论文最终性能改善证据。
2. Node.js 版本从 v24.13.0（基线）升级到 v26.5.0（当前），新增了 `vitest` 的 `localStorage` polyfill（`src/__tests__/setup.ts`）。
3. 前端首页 `GET /` 返回 404（无独立首页业务 API），性能基线记录的是 TTFB 而非完整首屏。
4. 登录性能基线使用 401 失败路径（固定技术账号），不代表成功登录和 JWT 生成耗时。

## 5. 未在 R0 实现

- 风险个案、转介、结案等 P0 新功能。
- 具体心理量表选型和评分规则确认。
- AI 分析、AI 建议、AI 报告。
- 社区、活动、课程、音乐、放松和成就的 MySQL 迁移与重新启用。
- UI 视觉重做、微服务、消息队列、Kubernetes。