# R0 重构前工程基线

## 1. 基线信息

- 采集日期：2026-07-14
- 采集分支：`codex/r0-phase-a`
- 基准提交：`d211ee74b22dbf770f1073d65fb07eb9fce05a83`
- 操作系统：Windows 10.0.26200
- Node.js：`v24.13.0`
- npm：`11.6.2`
- Git：`2.55.0.windows.2`
- 隔离说明：开始时位于普通 `master` 检出目录，且权威文档、`file/` 和数据库 WAL/SHM 为未跟踪内容。为避免新工作树丢失这些上下文或移动用户文件，本阶段在原目录创建短期分支，未暂存、移动或覆盖既有未跟踪内容。

## 2. 依赖基线

前端已安装的关键依赖包括 Vue `3.5.25`、Vue Router `4.6.3`、Pinia `2.3.1`、Vite `5.4.21`、TypeScript `5.9.3`、Vitest `2.1.9` 和 PM2 `5.4.3`。

后端已安装的关键依赖包括 Express `5.2.1`、TypeScript `5.9.3`、Jest `30.2.0`、`mssql` `12.2.0` 和 `ioredis` `5.10.0`。当前后端仍保留 SQL Server 与 SQLite 运行路径，符合 R0 开始前的已知现状。

## 3. 命令结果

| 检查项 | 复现命令 | 退出码 | 结果 |
|---|---|---:|---|
| 环境诊断 | `npm run doctor` | 0 | 0 个错误、2 个警告；前端 3001 与 API 3000 端口均不可达 |
| 前后端构建 | `npm run build:all` | 0 | Vue/Vite 与后端 TypeScript 构建成功；Vite 报告大于 500 kB 的 chunk 警告 |
| 全量测试入口 | `npm run test:all` | 1 | 前端阶段失败后停止，后端未由该命令继续执行 |
| 前端测试 | `npm run test:run` | 1 | 4 个文件中 2 个失败；40 项中 37 项通过、3 项失败 |
| 后端测试补采 | `npm --prefix mood_health_server run test` | 1 | 2 个套件均失败；47 项中 8 项通过、39 项失败；Jest 报告未退出的异步句柄 |
| 标准无 AI 启动 | `npm run start-all:no-ai` | 0 | 命令退出 0，但 PM2 应用列表为空，不能判定为启动成功 |

## 4. 失败摘要

### 4.1 前端测试

失败集中在本地情绪分析结果与测试断言不一致：

- `src/__tests__/api/mood.test.ts`：期望“开心”，实际“平静”。
- `src/__tests__/api/moodAnalysis.test.ts`：两项分别出现“开心/平静”和“兴奋/开心”不一致。

Phase A 不修改情绪分析规则或心理结论，因此这些失败只作为基线记录，未修复。

### 4.2 后端测试

`moodController.test.ts` 与 `moodModel.test.ts` 大量失败的共同错误为 SQLite `FOREIGN KEY constraint failed`。测试仍依赖旧数据库状态和固定测试数据；结束后 Jest 还提示存在未关闭的异步操作。Phase A 不手工修改旧 SQLite 来使测试通过。

### 4.3 启动契约

`start-project.ps1` 请求 PM2 启动 `mood-health-server`，但 `mood_health_server/ecosystem.config.js` 定义的是 `mood_health_server`。PM2 未创建后端应用，却返回退出码 0。使用旧名称进行诊断时应用可以启动，因此当前失败定位为进程名契约不一致，而不是构建产物缺失。

## 5. 基线使用规则

后续切片只能与本文件记录的命令和结果比较。既有失败不等于新改动失败；但若失败数量增加、构建由成功变为失败，或启动出现新的错误，应视为回归。任何测试修复都必须进入后续明确任务，不得通过修改旧 SQLite 数据掩盖问题。
