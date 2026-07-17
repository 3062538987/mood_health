# 代码与 UI 全量评审整改证据报告

来源报告：`D:\桌面\ccooddee\docs\tasks\评审报告_代码与UI全量评审.md`  
执行分支：`codex/full-review-remediation`  
执行 worktree：`D:\桌面\Code\大学生情绪健康\mood-health-web\.worktrees\codex-full-review-remediation`  
基线分支：`codex/r0-phase-d`  
完成日期：2026-07-17

## 1. 执行边界

- 本轮未启用未审核量表，问卷提交仍保持 `503 + FEATURE_DISABLED` 的冻结边界。
- 问卷提交契约保持 `answers: number[]`，未改成对象数组。
- 未接入 AI、未恢复自创 SDS/SAS 计分、未重新开放被冻结的非核心能力。
- 每个代码任务均采用小范围修改、定向验证、通过后提交；失败门禁回到当前任务修复。
- 未推送远端、未创建 PR。

## 2. 报告项关闭映射

| 报告项 | 关闭状态 | 证据提交 |
| --- | --- | --- |
| P0-1 情绪档案删除未持久化 | 已修复 | `5afd5b4 fix(mood): persist archive record deletion` |
| P0-2 问卷契约与冻结边界 | 已由现有实现满足 | 验证现有 `answers: number[]` 与 `FEATURE_DISABLED`，无空提交 |
| P0-3 参数校验失败契约不统一 | 已修复 | `e76adb3 fix(api): normalize validation error responses` |
| P0-4 当前账号注销后端能力缺失 | 已修复 | `59f1d3a feat(auth): add authenticated account deletion` |
| P0-4 设置页注销流程虚假文案/未接真实接口 | 已修复 | `dace390 fix(settings): connect account deletion flow` |
| P0-5 情绪类型与标签错误契约覆盖不足 | 已补测试关闭 | `c64ecd2 test(api): cover mood support-data error contracts` |
| P0-6 MoodLayout TypeScript 类型缺失 | 已修复 | `d7475e2 fix(mood): type mood layout navigation` |
| P1-1 问卷列表加载、错误、空状态不足 | 已修复 | `659f687 fix(questionnaire): add list loading and recovery states` |
| P1-2 问卷提交失败丢失作答 | 已修复 | `5f0a021 fix(questionnaire): preserve answers after submit failure` |
| P1-3 注册页错误反馈重复/过期 | 已修复 | `274d2db fix(auth): unify registration error feedback` |
| P1-4 登录成功无明确反馈 | 已修复 | `b7d9a7f fix(auth): confirm successful login` |
| P1-5 情绪记录提交条件过松 | 已修复 | `39912d4 fix(mood): enforce record form prerequisites` |
| P1-6 设置保存无反馈/异常处理不足 | 已修复 | `1a99744 fix(settings): report preference save results` |
| P1-7 咨询发送失败提示不持久 | 已修复 | `3fd04cf fix(counseling): clarify message send failures` |
| P2-1 登录与注册字段级实时校验 | 已修复 | `2124e50 feat(auth): add accessible field validation` |
| P2-2 问卷选项键盘操作不足 | 已修复 | `387db4d fix(questionnaire): make answer options keyboard accessible` |
| P2-3 未登录仍可能请求情绪数据 | 已补回归关闭 | `ded94c4 test(app): prevent mood fetch without valid session` |
| P2-4 移动端底栏入口不符合五入口标准 | 已修复 | `39a5b7c feat(navigation): expand accessible mobile navigation` |
| P2-5 删除按钮危险含义不清晰 | 已修复 | `e1a2433 fix(mood): strengthen archive delete affordance` |
| P2-6 首页新用户引导缺失 | 已修复 | `f8746ce feat(home): add first-record onboarding` |
| P2-7 全局语义色彩与页面主题不统一 | 已修复 | `3440eae`, `a1d5312`, `aa2c472`, `c3b2657` |
| P2-8 401 跳转与登录后返回原页面不安全/不完整 | 已修复 | `b3bc16e fix(auth): retain destination after session expiry`, `8ff0fec fix(auth): restore safe post-login redirect` |
| P2-9 问卷移动端操作栏不可达 | 已修复 | `77435a1 style(questionnaire): keep mobile actions reachable` |
| P2-10 情绪备注 placeholder 过长 | 已修复 | `2b313ce copy(mood): shorten record note guidance` |

补充基建提交：

- `c96b95b chore(qa): add non-mutating quality gates`
- `9294f84 test(e2e): add isolated real-stack browser harness`
- `bf85f70 test(e2e): share configured service urls with specs`

## 3. 最终验收命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run lint:check` | 通过 |
| `npm run typecheck:all` | 通过 |
| `npm run test:run` | 通过，31 个测试文件，121 项测试 |
| `npm --prefix mood_health_server run test:stable` | 通过，34 个测试套件，153 项测试 |
| `npm run build:all` | 通过；Vite 仅输出既有 chunk size warning |
| `npm run test:e2e` | 通过，4 项 Playwright 真实栈测试 |
| `git diff --check` | 通过；仅出现 Windows LF/CRLF 工作区提示时退出码仍为 0 |

E2E 环境变量：

```powershell
$env:CI='1'
$env:E2E_BACKEND_PORT='3200'
$env:E2E_FRONTEND_PORT='3201'
$env:MYSQL_HOST='127.0.0.1'
$env:MYSQL_PORT='3316'
$env:MYSQL_DATABASE='mood_health_e2e'
$env:MYSQL_APP_USER='root'
$env:MYSQL_APP_PASSWORD='e2e_root_password'
$env:MYSQL_MIGRATOR_USER='root'
$env:MYSQL_MIGRATOR_PASSWORD='e2e_root_password'
$env:MYSQL_ROOT_PASSWORD='e2e_root_password'
$env:REDIS_PASSWORD='e2e_redis_password'
npm run test:e2e
```

E2E 运行证据：

- E2E 数据库：`mood_health_e2e`
- 重建结果：`Reset E2E database: mood_health_e2e`
- Migration：`Applied 15 migration(s), skipped 0.`
- Demo Seed：`accounts=demo_student,demo_counselor,demo_super_admin, moods=5.`
- Playwright：4 passed
  - 注册、登录、首页、退出真实栈冒烟
  - 情绪记录创建、归档删除、刷新后仍不存在
  - 当前账号 API 注销并验证外键级联数据
  - 设置页临时账号注销完整链路

## 4. 关键自检结论

- 参数校验失败统一为 HTTP 400、业务码 `1001`，`data.errors` 不回传密码等原始敏感值。
- 账号注销为真实 `DELETE /api/auth/me`，成功后清理会话，失败保留会话和确认弹窗。
- 情绪归档删除改为先请求后端，成功后再更新前端列表与总数；失败和取消均不破坏本地状态。
- 401 会携带站内 `redirect` 跳登录页，并发 401 只触发一次跳转和一次提示。
- 登录页只接受单 `/` 开头的同源站内路径，拒绝外部 URL 与 `//host`。
- 问卷失败保留答案，不写心理答题到 `localStorage`。
- 移动端导航、问卷操作栏、登录/注册字段、问卷 radio、咨询发送失败提示均补充了可访问性约束。
- 主题已迁移到蓝绿色全局语义变量，危险动作使用 danger 语义色，焦点使用 focus 语义色。

## 5. 剩余风险

- `build:all` 仍有 Vite 大 chunk warning，属于既有打包体积提示，不影响本轮整改验收。
- 单元测试中部分失败分支会主动打印 `console.error`，对应测试断言已通过；不是未处理异常。
- E2E 依赖本机 Docker/MySQL 3316 可用。若本机已有残留 3100/3101 开发服务，不影响当前配置；Playwright 已改为把计算出的 3200/3201 URL 注入测试进程。
