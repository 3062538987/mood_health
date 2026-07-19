# A4-01 新鲜基线（A1/A4/C01 测试底座任务）

> 时间：2026-07-18（当前任务启动时）
> 代码目录：`D:\桌面\ccooddee`
> 计划要求：工作区干净或只含与当前任务无关的文件时先记录基线；本文件不含敏感内容。

## 环境快照

- Node: `v22.16.0`
- npm: `10.9.4`
- Python: `3.10.11`（doctor 检测）
- 当前提交：`fc23b20e83d5375848ff3ec108930850fec20095`
- 最近提交：`fc23b20 docs: 添加数据流程图与ETL流程图设计文档`

## 工作区状态

```
 M .design/colors_and_type.css
 D .design/flow-diagrams.design
 M .design/pages/page-flow.html
 M .design/pages/state-machines.html
 M mood-health-prototype/mood-health-prototype.design
 M mood-health-prototype/pages/improve.html
 M mood-health-prototype/pages/profile.html
 M mood-health-prototype/pages/relax.html
 M mood-health-prototype/pages/treehole.html
?? .design/.design
?? .design/pages/interaction-flow.html
?? .design/validation-report.json
```

说明：以上为 `.design/` 与原型目录中的设计/原型文件，**不属于本次 A1/A4/C01 代码任务**，保持未暂存状态，后续提交只涉及本任务文件。

## 端口与进程

- 监听端口：仅 MySQL `3306/33060` 处于 LISTENING 状态（PID 8216）。
- `3000/3001/8000/6379` 未监听。
- Docker：`mood-health-e2e-fullreview-mysql-1`（3316→3306，Up 10h）和 `mood-health8410-mysql-1`（3306，Up 10h）在运行。
- PM2：本地未安装全局 `pm2` 命令，但 `node_modules/pm2` 存在（doctor 显示 5.4.3）。

## 基线命令结果

| 命令 | 退出码 | 结果摘要 |
| --- | --- | --- |
| `git status --short` | 0 | 工作区含设计文件变更，业务代码未改动 |
| `npx vue-tsc --noEmit` | 0 | 前端类型检查通过 |
| `npm run typecheck:all` | 1 | 因后端缺少 `typecheck` 脚本而失败 |
| `npm run test:run` | 1 | 44 个测试文件，174 通过，7 失败 |
| `npm --prefix mood_health_server run build` | 0 | 后端 TypeScript 编译通过 |
| `npm --prefix mood_health_server run test:stable` | 1 | 45 个套件，40 通过，5 失败（172 个测试通过） |
| `npm run doctor` | 1 | 缺少 `start-project.ps1`，3000/3001 未运行 |

## 关键失败/异常定位

### 前端测试失败（`npm run test:run`）

1. `src/__tests__/views/home-onboarding.test.ts`
   - 期望获取 `.first-record-onboarding`，当前 Home.vue 输出的是 `.onboarding-card` 等结构。
2. `src/__tests__/views/login-success-feedback.test.ts`（6 项）
   - 登录成功后路由目标由 `/` 或回跳地址变为 `/guide`；测试断言未同步。

> 这些失败属于 B/D 线交互/引导变更后的测试漂移，不在本次 A4-02 指定修复范围（`src/__tests__/api/{achievements,advice,relax}.test.ts`）内，将记录为待对应任务处理。

### 后端测试失败（`npm --prefix mood_health_server run test:stable`）

| 失败套件 | 原因 |
| --- | --- |
| `tests/unit/repositories/moodRepository.test.ts` | `CreateMoodInput` / `UpdateMoodInput` 新增必填 `includeNote`，测试对象缺失该字段 |
| `tests/unit/services/moodService.test.ts` | mock repository 缺少 `createOrGetTagsBatch`；`RecordMoodInput` / `UpdateMoodServiceInput` 需要 `includeNote`；`createMood` 返回由 `number` 变为 `{ moodId; jobId }` |
| `tests/unit/services/assessmentService.test.ts` | mock repository 缺少 `createSubmittedSessionWithCase`、`getInstrumentById` |
| `tests/unit/services/managementService.test.ts` | mock repository 缺少 `getAiUsageStats` |
| `tests/unit/controllers/moodControllerContract.test.ts` | 加载 controller 时因缺少 MySQL 环境变量 `MYSQL_HOST` 抛错（controller 顶层实例化） |

> 以上失败对应 A4-07「修复后端测试替身与依赖注入漂移」与 A4-08「恢复根级静态检查/环境合同」任务范围。

## 未验证项

- 后端 `typecheck` 脚本尚未存在，无法运行后端独立类型检查。
- `start-project.ps1` 缺失，doctor 严格门未跑。
- Playwright 隔离夹具尚未建立，未运行 `test:e2e`。
- Python FastAPI 服务目录尚未创建，无法运行 Python 测试。

## 后续任务对应关系

- A4-01：本基线文件已建立，无代码提交。
- A4-02：修复 `src/__tests__/api/achievements.test.ts`、`advice.test.ts`、`relax.test.ts` 的类型漂移。
- A4-07：修复 mood/assessment/management 测试替身与 controller 依赖注入。
- A4-08：新增后端 `typecheck`、恢复根级 `typecheck:all`/`build:all`/`test:all`/`doctor:strict` 等验证脚本。
- C-01：建立 `mood_health_ai_service/tests/fixtures/ai_evaluation/` 评测集。
- A1-01 ~ A1-10：在基线之上建立 Playwright 隔离夹具与端到端流程。
