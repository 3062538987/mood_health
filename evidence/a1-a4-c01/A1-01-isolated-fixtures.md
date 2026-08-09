# A1-01 建立隔离 Playwright 测试夹具

## 任务信息

- 任务 ID：A1-01
- 提交哈希：`465f3b3`
- 提交信息：`test(A1-01): add isolated browser test harness`

## 改动文件

- `playwright.config.ts`：配置 E2E 前后端 webServer、固定 MySQL 3316 端口、E2E 环境变量
- `tests/e2e/fixtures/isolatedTest.ts`：隔离夹具，含唯一账号、控制台/网络错误收集、预期 401 过滤
- `tests/e2e/fixtures/testAccount.ts`：唯一账号生成、CSRF token 获取、注册与删除
- `tests/e2e/fixtures/isolatedFixture.spec.ts`：夹具自验证测试
- `tests/e2e/scripts/start-backend.bat`：Windows 后端启动包装脚本
- `vite.e2e.config.ts`：E2E 专用 Vite 配置，使用 proxy 访问 `/api`

## 修复前证据

1. 未过滤 `/api/auth/me` 的 401 控制台错误，导致空登录页测试被误判为失败：
   - `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
   - `API Error: AxiosError: Request failed with status code 401`
2. 账号清理偶发 500：`Failed to delete E2E account: 500 {"code":500,"message":"账号注销失败","data":null}`
   - 该错误来自 `mood_health_server/src/controllers/authController.ts` 的 `deleteMe`，属生产缺陷，已记录并退回 A2-02/A2-03 处理，未在 A1-01 范围内修改。

## 修复后验证

命令：

```powershell
npx playwright test tests/e2e/fixtures/isolatedFixture.spec.ts --project=chromium
```

结果：

```
2 passed (9.1s)
```

重跑稳定性：

```powershell
npx playwright test tests/e2e/fixtures/isolatedFixture.spec.ts --project=chromium --repeat-each=2
```

结果：

```
4 passed (11.8s)
```

故意失败测试验证：通过临时 `isolatedFixture.fail.spec.ts` 验证失败时保留 screenshot、video、trace、error-context.md 及 account-cleanup-error 附件。验证后已删除该临时文件。

## 未验证项

- 非 Windows 平台未验证启动脚本
- A4-18、A4-20 尚未完成，E2E 一键启动与 W0 绿色门仍需后续补齐

## 发现的生产缺陷

- `DELETE /api/auth/me` 偶发返回 500（账号注销失败），影响 E2E 账号清理。按 A1 规则仅记录证据，退回对应任务处理，未顺手修改 auth 模块。
