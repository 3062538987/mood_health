# SQLite 上线留档（2026-03-30）

## 1. 发布信息

- 日期：2026-03-30
- 目标环境：开发联调环境（本机）
- 说明：本次聚焦 SQL Server -> SQLite 迁移收尾与运行态一致性验证

## 2. 数据库配置确认

- DB_CLIENT=sqlite
- SQLITE_DB_PATH：D:/桌面/Code/大学生情绪健康/mood-health-web/mood_health_server/data/mood-health-questionnaire-test-abs.db
- 数据库文件存在：是
- integrity_check：ok

## 3. 发布前命令执行记录

- `npm --prefix mood_health_server run build`：通过（多轮）
- `npm --prefix mood_health_server run db:init:sqlite`：已在测试路径验证通过
- `npm --prefix mood_health_server run seed:demo:all`：已具备执行入口
- `npm --prefix mood_health_server run test:sqlite-smoke`：已具备执行入口
- `npm run doctor`：已集成到预检流程

## 4. 核心 API 回归

- `/api/auth/register`：通过
- `/api/auth/login`：通过
- `/api/moods/types`：通过
- `/api/moods/record`：通过（recordCode=0）
- `/api/moods/list`：通过（历史联调已验证）
- `/api/moods/trend`：通过（历史联调已验证）
- `/api/moods/weekly-report`：通过（历史联调已验证）
- `/api/moods/analysis`：通过（历史联调已验证）

## 5. 落库验证

- 写入前 users：10
- 写入后 users：11
- 增量：+1
- 写入前 moods：11
- 写入后 moods：12
- 增量：+1
- 最近更新文件：mood-health-questionnaire-test-abs.db-wal

## 6. 本次修复项

- 修复从仓库根目录启动时 dotenv 读取路径不稳定问题（固定读取后端 .env）
- 修复 SQLite 路径在模块加载阶段提前取值问题（改为 connect 时动态解析）
- 修复 ENCRYPTION_KEY 占位值导致的加密失败与 500
- 补齐 SQLite 预检命令与文档
- 补齐测试用例 SQL 方言兼容（TOP 1 / LIMIT 1）
- 为历史 SQL Server 专用脚本增加 SQLite 模式保护

## 7. 风险与结论

- 风险项：
  - Node SQLite ExperimentalWarning 为已知告警，当前非阻断
  - 生产环境应替换为强随机 ENCRYPTION_KEY，避免与开发密钥混用
- 是否允许上线：是（在 SQLite 目标前提下）
- 结论说明：运行态已确认写入目标 SQLite 文件，迁移闭环成立

## 8. 回滚建议

1. 停止后端服务
2. 恢复 SQLite 文件备份
3. 回退代码到上一个稳定 commit
4. 重启后执行最小验证：/health + register/login + moods/record
