# AUD-00 命令执行结果

所有命令均在当前 Git HEAD `7dc99c6dd670d7ad669e8d5ba2e6324d1a0dba15` 下执行。失败结果保留，不修复。

| 命令 | 退出码 | 结果摘要 | 审计结论 |
| --- | ---: | --- | --- |
| `npm run typecheck:all` | 1 | 前端 TypeScript 失败 | AI 相关 API 封装存在真实编译错误 |
| `npm run lint:check` | 0 | Lint 通过 | 只能证明静态风格检查通过 |
| `npm run build:all` | 1 | 前端构建失败，Node 构建未继续 | 当前提交无法完整构建 |
| `npm run test:run` | 1 | 44 个测试文件中 2 个文件失败，183 个测试中 3 个失败 | 前端测试未通过 |
| `npm --prefix mood_health_server run test:stable` | 1 | 45 个测试套件中 2 个失败，218 个测试中 4 个失败，Jest 有 open handle | Node 稳定测试未通过 |
| `python -m pytest -q`（`mood_health_ai_service`） | 0 | 78 passed，1 warning | FastAPI 单元测试通过；不证明 Node→Python 或 Provider 链路 |
| `npm run doctor:strict` | 1 | 输出 0 errors、1 warning，但 strict 模式非零退出 | doctor 未覆盖 FastAPI、Provider Key、内部 Token、8501、知识助手 |

## 关键失败证据

### 前端类型/构建失败

- `src/api/counseling.ts(135,18)`：`request.get` 不存在
- `src/api/counseling.ts(142,18)`：`request.get` 不存在
- `src/api/counseling.ts(149,18)`：`request.post` 不存在
- `src/api/moodAnalysis.ts(176,18)`：`request.post` 不存在
- `src/api/questionnaire.ts(95,18)`：`request.post` 不存在

根因证据：`src/utils/request.ts:264` 默认导出是一个函数调用包装，不是 Axios 实例；因此使用 `request.get/post` 的 AI 相关文件会在编译阶段失败，运行时也会出现 `request.post is not a function` 风险。

### 前端测试失败

- `src/__tests__/views/counseling-send-failure.test.ts`：mock 中缺少 `sendSessionCounselingMessage`
- `src/__tests__/views/mood-layout.test.ts`：断言页面不包含“分析”，但实际渲染包含“记录分析档案”

### Node 测试失败

- `mood_health_server/tests/unit/db/migrationFiles.test.ts`：迁移版本列表未更新，实际新增了 `0340_*`、`0350_*`
- `mood_health_server/tests/unit/db/migrationFiles.test.ts`：`0350_create_counseling_sessions.up.sql` 使用 `CREATE TABLE IF NOT EXISTS`，违反项目迁移规范测试
- `mood_health_server/tests/unit/db/seedCore.test.ts`：角色数量期望 3，实际 4；种子 SQL 参数化检查失败

### E2E 阻断

执行 `npx playwright test tests/e2e/mood-record.spec.ts tests/e2e/mood-analysis-navigation.spec.ts tests/e2e/counseling.spec.ts tests/e2e/assessment.spec.ts --reporter=list` 时，在全局准备阶段失败：

- 测试数据库：`mood_health_e2e`
- MySQL 端口：`3316`
- 失败边界：迁移 runner
- 原始错误：`Duplicate migration version: 0350`
- 证据文件：
  - `mood_health_server/src/db/migrations/0350_create_counseling_sessions.up.sql`
  - `mood_health_server/src/db/migrations/0350_create_user_ai_profiles.up.sql`
  - `mood_health_server/src/db/migrationRunner.ts:42`
  - `mood_health_server/src/db/migrationRunner.ts:78-86`

结论：四条用户要求的真实端到端验收均未能进入浏览器场景，原因不是 UI，而是数据库迁移版本冲突。

