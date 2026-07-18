# A1-02 认证黄金流程 E2E

## 任务信息

- 任务 ID：A1-02
- 提交哈希：`720dcfa`
- 提交信息：`test(A1-02): cover the complete auth journey`

## 改动文件

- `tests/e2e/auth.spec.ts`：注册页可访问性、登录后流程、错误凭据可重试。

## 修复前证据

当前生产代码存在两处影响认证流程的缺陷，A1-02 仅记录证据，未修改其他模块：

1. **注册页对访客不可访问**：访问 `/register` 被重定向到 `/login?redirect=/`。
   - 代码位置：`src/router/guards.ts` 的 `getRouteRedirect` 与 `src/utils/request.ts` 的 `handleUnauthorized`。
   - 现象：`await page.goto('/register')` 后 URL 为 `http://127.0.0.1:3101/login?redirect=/`，页面标题为"用户登录"。
   - 根因推测：路由守卫初始化会话时调用 `/api/auth/me` 返回 401，`request.ts` 全局拦截器将页面重定向到 `/login`，即使 `/register` 标记为 `public: true`。

2. **登录后 Cookie 未随请求携带**：登录成功并跳转到 `/guide` 后，访问 `/mood/record` 时 `/api/auth/me` 仍返回 401，导致被重定向到登录页。
   - 代码位置：`src/utils/request.ts` 的 axios 实例未设置 `withCredentials: true`。
   - 现象：`h1` 元素未找到，页面不在 `/mood/record`。

3. **账号注销偶发 500**：与 A1-01 一致，`DELETE /api/auth/me` 偶发返回 500。

## 修复后验证

命令：

```powershell
npx playwright test tests/e2e/auth.spec.ts --project=chromium
```

结果：

```
3 tests
1 passed (invalid credentials can be retried)
2 failed (register page accessibility, login -> protected page journey)
```

通过的测试验证了：
- 错误密码提交后显示 `.error-message`
- 可重试正确密码并登录成功

失败的测试明确对应上述生产缺陷，已记录并退回 A2-02/A2-03 处理。

## 未验证项

- 完整注册表单提交（因注册页被重定向阻塞）
- 登录后访问受保护页、刷新保持登录、退出、后退、再次访问（因 Cookie 未携带阻塞）
- 401 与会话过期场景

## 发现的生产缺陷

1. `/register`  guests 被错误重定向到 `/login`（A2-02）。
2. axios 未启用 `withCredentials: true`，HttpOnly Cookie 不随请求发送（A2-02）。
3. `DELETE /api/auth/me` 偶发 500（A2-02/A2-03）。
