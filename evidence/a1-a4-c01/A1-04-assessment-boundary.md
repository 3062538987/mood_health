# A1-04 测评受控流程 E2E

## 任务信息

- 任务 ID：A1-04
- 状态：阻塞（生产缺陷，退回 A2-02/A2-07）

## 改动文件

- `tests/e2e/assessment.spec.ts`：登录 -> 进入测评页 -> 查看量表列表/空状态 -> 选择量表 -> 缺答校验 -> 提交 -> 查看历史。

## 修复前证据

当前生产代码存在影响测评流程的前置缺陷，A1-04 仅记录证据，未修改其他模块：

1. **登录后 Cookie 未随请求携带**：与 A1-02/A1-03 一致，`src/utils/request.ts` 的 axios 实例未设置 `withCredentials: true`。
   - 代码位置：`src/utils/request.ts` 第 127-133 行 axios 实例配置。
   - 现象：登录成功跳转到 `/guide` 后，访问 `/improve/survey` 时路由守卫调用 `/api/auth/me` 返回 401，页面被重定向到 `/login`。
   - 失败断言：`await expect(page.locator('h1').first()).toContainText('情绪筛查问卷', { timeout: 10_000 })` 超时。

2. **账号注销偶发 500**：测试清理阶段 `DELETE /api/auth/me` 偶发返回 500，与 A1-01/A1-02/A1-03 一致。

## 修复后验证

命令：

```powershell
npx playwright test tests/e2e/assessment.spec.ts --project=chromium
```

结果：

```
1 test
1 failed
```

失败点：
- 登录后访问 `/improve/survey` 被重定向到 `/login`，`h1` 未找到。

该失败对应 A2-02 的 Cookie 会话缺陷，不属于 A1-04 的测试替身或测试逻辑问题。

## 未验证项

- 量表列表渲染、已批准量表边界、未批准量表入口关闭。
- 说明/同意流程、作答、缺答校验、提交、结果展示。
- 历史记录查看、刷新/重新登录后历史仍存在。
- 前端答案不可篡改评分/风险结论、高风险联动策略。

## 发现的生产缺陷

1. axios 未启用 `withCredentials: true`，HttpOnly Cookie 不随请求发送（A2-02）。
2. `DELETE /api/auth/me` 偶发 500（A2-02/A2-03）。

## 阻塞说明

A1-04 依赖 A2-07（守住测评批准边界）。当前无法进入测评页的根本原因是 A2-02 的会话缺陷，因此 A1-04 测试已提交但标记为阻塞，待 A2-02 修复后继续验证；量表批准边界相关断言待 A2-07 完成后补充。
