# A4-20 W0 绿色门复核证据

- 时间：2026-07-19T09:57:28.7889035+08:00
- 执行者：Codex 5.5 Medium
- 项目目录：D:\桌面\ccooddee
- 计划文件：D:\桌面\ccooddee\tasks\基于当前代码的ABCD全量优化执行计划.md
- 任务 ID：A4-20 W0 绿色门
- 依赖：A4-01～A4-19 中所有 P0
- 本任务边界：不做功能改动；只执行 W0 门禁并把失败退回对应任务。

## 门禁结果

| 命令 | 结果 | 证据摘要 |
| --- | --- | --- |
| `git status --short` | 未通过前置清洁性 | 仅存在自动化触发记录 `.codex-kimi-finished-triggered` 未跟踪；该文件由 Kimi 完成触发流程创建，不属于业务代码。 |
| `npm run typecheck:all` | 通过 | 前端 `vue-tsc --noEmit` 与后端 `tsc --noEmit` 均退出 0。 |
| `npm run build:all` | 通过但有警告 | 前端 Vite 构建与后端 `tsc` 均退出 0；Vite/Rollup 报 `src/api/moodAnalysis.ts` 经 `src/api/mood.ts` 与 `src/stores/moodRecordStore.ts` 形成循环分块风险，并提示大 chunk。 |
| `npm run test:run` | 失败 | Vitest：42 个测试文件通过、2 个失败；174 项通过、7 项失败。失败集中在 `src/__tests__/views/login-success-feedback.test.ts` 和 `src/__tests__/views/home-onboarding.test.ts`。 |
| `npm --prefix mood_health_server run test:stable` | 通过但有风险 | Jest：45 套通过、218 项通过；结束后提示存在未关闭异步句柄，需要后续用 `--detectOpenHandles` 定位。 |
| `python -m pytest -q`（在 `mood_health_ai_service`） | 失败 | Python 测试收集失败：缺少 `fastapi` 与 `pydantic_settings`，并提示未知 `asyncio_mode` 配置。 |
| `python -m ruff check .`（在 `mood_health_ai_service`） | 失败 | 当前 Python 环境缺少 `ruff` 模块。 |
| `python -m mypy app`（在 `mood_health_ai_service`） | 失败 | 当前 Python 环境缺少 `mypy` 模块。 |
| `npm run doctor:strict` | 失败 | doctor 发现缺少 `start-project.ps1`，并判定 `start-project.ps1/start-project.sh` 启动脚本缺失；前端 3001、Node 3000 未运行为 warning。 |
| `npm run lint:check` | 失败 | ESLint 扫描到 `playwright-report/trace/assets/*.js` 等生成产物，报告 3115 个错误。 |
| `git diff --check` | 通过 | 未发现空白错误。 |

## 失败归属

- 退回 A4-18：`doctor:strict` 缺少启动脚本，且 Python 质量工具和依赖未能按 W0 门安装/复现。
- 退回 A4-20 前置链：Python FastAPI 服务的测试依赖未安装或环境未锁定，导致 `pytest`、`ruff`、`mypy` 门无法通过。
- 退回 B/D 相关前置实现或测试拥有者：登录成功后当前实现跳转 `/guide`，但 `login-success-feedback.test.ts` 期望默认 `/` 或保留安全 redirect；首页首条记录卡实际使用 `.onboarding-card`，测试期望 `.first-record-onboarding`。
- 退回 A4-08 或测试底座维护者：`lint:check` 当前会扫描 Playwright 生成报告目录，导致生成产物触发大量 ESLint 错误。
- 记录 A4-17/A2-10 附近风险：构建虽然通过，但 Rollup circular chunk 警告指出 mood analysis API 与 mood API re-export 存在循环分块风险。

## 放行结论

A4-20 不通过，W0 不能标记绿色。当前类型检查和构建已经恢复，后端单测也通过；但前端单测、Python/FastAPI 质量门、doctor strict、lint check 均未通过。按计划要求，本任务不直接修复这些问题，应退回对应任务或拥有模型处理后再重新运行 A4-20。
