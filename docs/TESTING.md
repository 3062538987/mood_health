# 测试指南

本文档描述当前仓库的测试入口、执行顺序与常见验证场景。

命令以 `docs/COMMANDS.md` 为统一索引；本文件聚焦测试语义与回归范围。

## 1. 测试分层

- 前端单元测试：Vitest（位于 `src/__tests__`）
- 后端单元测试：Jest（位于 `mood_health_server/tests`）
- 接口与联调冒烟：通过本地启动后手工/脚本验证
- 压力测试：Locust 与 wrk

## 2. 快速命令（根目录）

```bash
# 前端单测（watch）
npm run test

# 前端单测（单次）
npm run test:run

# 前端覆盖率
npm run test:coverage

# 前后端一起跑
npm run test:all
```

`test:all` 等价于：

1. `npm run test:run`
2. `npm --prefix mood_health_server run test`（稳定测试集）

## 3. 前端测试

```bash
npm install
npm run test:run
```

UI 模式：

```bash
npm run test:ui
```

覆盖率报告默认在 `coverage/`。

## 4. 后端测试

```bash
npm --prefix mood_health_server install
npm --prefix mood_health_server run test
```

需要数据库依赖的集成测试：

```bash
npm --prefix mood_health_server run test:integration
```

其他后端测试命令：

```bash
npm --prefix mood_health_server run test:coverage
npm --prefix mood_health_server run test:watch
npm --prefix mood_health_server run test:role-permissions
```

## 5. 联调冒烟建议流程

```bash
npm run doctor
npm run start-all
npm run dev:all
```

建议至少验证：

- 登录注册链路
- 情绪记录与情绪分析
- 活动报名/取消报名
- 树洞发帖与评论
- AI 分析接口响应

## 6. 压力测试

### Locust

```bash
cd mood_health_server
pip install locust
locust -f locustfile.py --host=http://localhost:3000
```

命令行模式示例：

```bash
locust -f locustfile.py --host=http://localhost:3000 --headless -u 50 -r 5 -t 120s --only-summary
locust -f locustfile.py --host=http://localhost:8000 --headless -u 10 -r 2 -t 60s --only-summary AIAnalysisUser
```

### wrk

```bash
cd mood_health_server
chmod +x scripts/stress_test.sh
./scripts/stress_test.sh
```

Windows 无原生 `chmod`，可在 WSL/Git Bash 运行，或直接执行 wrk 单命令。

## 7. 团体辅导最小回归清单

角色：未登录、普通用户、管理员。

列表页 `/improve/group`：

1. 刷新与状态 Tab 切换正常。
2. 未登录点击报名跳转登录。
3. 已登录用户可报名/取消报名，状态同步到“我的活动记录”。
4. 管理员可见创建/编辑/删除，普通用户不可见。

详情页 `/improve/group/:id`：

1. 报名状态展示正确。
2. 取消报名后 UI 状态正确回退。
3. 管理员编辑跳转行为正确。
4. 管理员删除后返回列表页。

接口回归：

- `POST /api/activities/join/:id`
- `POST /api/activities/cancel/:id`
- `GET /api/activities/my-joined`

## 8. 常见问题

1. 后端测试启动失败

- 先执行 `npm --prefix mood_health_server run build`，确认 TypeScript 可编译。

2. `test:all` 在后端阶段失败

- 单独执行 `npm --prefix mood_health_server run test` 查看详细错误。

3. 压测报 401

- 检查 token、鉴权头与测试账号初始化是否完成（可运行 `npm run demo:init:all`）。
