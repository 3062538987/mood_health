# A1-05 AI 咨询流程 E2E

## 任务信息

- 任务 ID：A1-05
- 状态：阻塞（生产缺陷，退回 A2-02/A3-03/B-09/C-02~C-08）

## 改动文件

- `tests/e2e/counseling.spec.ts`：登录 -> 进入咨询页 -> 发送普通消息 -> 接收回复 -> 发送中不可重复发送 -> 消息唯一性校验。

## 修复前证据

当前生产代码存在影响 AI 咨询流程的前置缺陷，A1-05 仅记录证据，未修改其他模块：

1. **登录后 Cookie 未随请求携带**：与 A1-02~A1-04 一致，`src/utils/request.ts` 的 axios 实例未设置 `withCredentials: true`。
   - 代码位置：`src/utils/request.ts` 第 127-133 行 axios 实例配置。
   - 现象：登录成功跳转到 `/guide` 后，访问 `/counseling` 时路由守卫调用 `/api/auth/me` 返回 401，页面被重定向到 `/login`。
   - 失败断言：`await expect(page.locator('h1').first()).toContainText('心理咨询陪伴', { timeout: 10_000 })` 超时。

2. **账号注销偶发 500**：测试清理阶段 `DELETE /api/auth/me` 偶发返回 500，与 A1-01~A1-04 一致。

## 修复后验证

命令：

```powershell
npx playwright test tests/e2e/counseling.spec.ts --project=chromium
```

结果：

```
1 test
1 failed
```

失败点：
- 登录后访问 `/counseling` 被重定向到 `/login`，`h1` 未找到。

该失败对应 A2-02 的 Cookie 会话缺陷，不属于 A1-05 的测试替身或测试逻辑问题。

## 未验证项

- 首次进入咨询页欢迎语、普通消息发送与回复。
- 连续追问上下文窗口、发送中按钮禁用避免重复。
- 失败重试机制、高风险表达立即给出安全资源。
- 退出再进入后历史是否保留。

## 发现的生产缺陷

1. axios 未启用 `withCredentials: true`，HttpOnly Cookie 不随请求发送（A2-02）。
2. `DELETE /api/auth/me` 偶发 500（A2-02/A2-03）。

## 阻塞说明

A1-05 依赖 A3-03（标记 AI 降级来源）、C-02~C-08（AI 边界/prompt/质量/安全/可解释审核/隐私/关闭策略）、B-09（AI 咨询界面）。当前无法进入咨询页的根本原因是 A2-02 的会话缺陷，因此 A1-05 测试已提交但标记为阻塞，待 A2-02 修复后继续验证；AI 质量与安全相关断言待 A3-03/C-02~C-08/B-09 完成后补充。
