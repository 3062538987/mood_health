# Windows 一键启动器设计

## 目标

用户在项目根目录双击 `启动大学生情绪健康管理平台.bat` 后，无需手动执行 `npm run dev:all`、启动 Docker 容器或运行数据库迁移，即可启动完整演示环境。启动过程保留三个独立日志窗口，分别展示 Vue 前端、Node API 与 FastAPI AI 服务的输出。

## 方案

继续使用现有两层启动结构：BAT 负责双击入口、基础依赖检查、结果提示和打开浏览器；`start-project.ps1` 负责 Docker Desktop、Compose 基础设施、数据库迁移、端口配置与服务进程编排。所有 Docker 资源继续使用 Compose 项目名 `mood-health-ccooddee`，不得操作其他工作树或项目的容器。

## 启动流程

1. BAT 定位项目根目录并检查 `package.json`、Node.js、npm 与 Python。
2. 缺少前端或 Node 后端依赖时，执行对应的 `npm install`。
3. 调用 `start-project.ps1 -WithAi -PrepareInfrastructure`。
4. PowerShell 检查 Docker CLI；Docker daemon 未运行时调用 Docker Desktop 启动命令并等待就绪。
5. 复用本项目已有 MySQL、Redis 发布端口；首次启动时选择可用端口，启动并等待容器健康。
6. 把选定的连接参数同时传递给数据库迁移和 Node 服务，完成迁移后分别启动 FastAPI、Node、Vue 三个窗口。
7. 启动器轮询前端、Node、FastAPI 健康地址。全部就绪后自动打开前端；超时则保留日志窗口并显示未就绪服务及排查入口。

## 错误处理

- 缺少必要工具或依赖安装失败：立即停止并显示可操作的错误信息。
- Docker Desktop 启动失败、容器不健康或迁移失败：不继续启动应用服务。
- 单个应用服务未就绪：不宣称启动成功，不自动把页面可访问等同于完整链路正常。
- 启动窗口保持可见，便于用户查看原始错误；BAT 在结束前等待用户按键。

## 测试与验收

- 扩展 `scripts/one-click-start.test.mjs`，先验证健康轮询与失败提示契约，并确认测试在实现前失败。
- 实现最小脚本改动，使契约测试通过。
- 运行启动器契约测试及相关语法/静态检查。
- 在 Docker 可用环境中执行真实入口，分别验证前端 `3001`、Node `/health` 与 FastAPI `/api/health`；若当前环境无法启动 Docker，应明确报告未完成的运行时验证，不以静态测试代替。

## 范围边界

本次不修改业务代码、认证逻辑、AI 提示词或数据库结构，不重构现有服务架构，也不清理用户工作区中的其他未提交改动。
