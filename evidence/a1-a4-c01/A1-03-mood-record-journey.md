# A1-03 情绪记录黄金流程 E2E

## 任务信息

- 任务 ID：A1-03
- 状态：阻塞（生产缺陷，退回 A2-02）

## 改动文件

- `tests/e2e/mood-record.spec.ts`：登录 -> 进入记录页 -> 选择情绪/强度/触发因素/描述 -> 保存 -> 归档查看 -> 刷新仍可见 -> 退出并重新登录后仍可见。

## 修复前证据

当前生产代码存在影响情绪记录黄金流程的前置缺陷，A1-03 仅记录证据，未修改其他模块：

1. **登录后 Cookie 未随请求携带**：与 A1-02 一致，`src/utils/request.ts` 的 axios 实例未设置 `withCredentials: true`。
   - 代码位置：`src/utils/request.ts` 第 127-133 行 axios 实例配置。
   - 现象：登录成功跳转到 `/guide` 后，访问 `/mood/record` 时路由守卫调用 `/api/auth/me` 返回 401，页面被重定向到 `/login`。
   - 截图：`test-results/e2e-artifacts/mood-record-mood-record-pe-f5546-d-survives-refresh-re-login-chromium/test-failed-1.png` 显示页面为"用户登录"。

2. **账号注销偶发 500**：测试清理阶段 `DELETE /api/auth/me` 偶发返回 500，与 A1-01/A1-02 一致。

## 修复后验证

命令：

```powershell
npx playwright test tests/e2e/mood-record.spec.ts --project=chromium
```

结果：

```
1 test
1 failed
```

失败点：
- `await expect(page.locator('h1').first()).toContainText('把今天的情绪', { timeout: 10_000 })` 超时，页面实际在 `/login`。

该失败明确对应 A2-02 的 Cookie 会话缺陷，不属于 A1-03 的测试替身或测试逻辑问题。

## 未验证项

- 情绪类型选择、强度选择、描述输入、触发因素添加、保存成功提示。
- 归档页查看记录、数据一致性、刷新/重新登录后记录仍可见。
- 重复点击不重复写入、AI 不可用时核心保存仍成功。

## 发现的生产缺陷

1. axios 未启用 `withCredentials: true`，HttpOnly Cookie 不随请求发送（A2-02）。
2. `DELETE /api/auth/me` 偶发 500（A2-02/A2-03）。

## 阻塞说明

A1-03 依赖 A1-01（隔离夹具，已完成）和 A2-05（情绪记录与 7d 任务原子创建）。当前无法进入记录页的根本原因 A2-02 的会话缺陷，因此 A1-03 测试已提交但标记为阻塞，待 A2-02 修复后重新运行验证。
