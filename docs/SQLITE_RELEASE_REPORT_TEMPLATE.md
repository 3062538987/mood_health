# SQLite 上线留档模板

## 1. 发布信息

- 日期：YYYY-MM-DD
- 发布人：
- 目标环境：dev / staging / prod
- 后端版本（commit）：

## 2. 数据库配置确认

- DB_CLIENT=sqlite
- SQLITE_DB_PATH（绝对路径）：
- 数据库文件存在：是 / 否
- integrity_check：ok / fail

## 3. 发布前命令执行记录

- `npm --prefix mood_health_server run build`：通过 / 失败
- `npm --prefix mood_health_server run db:init:sqlite`：通过 / 失败
- `npm --prefix mood_health_server run seed:demo:all`：通过 / 跳过 / 失败
- `npm --prefix mood_health_server run test:sqlite-smoke`：通过 / 跳过 / 失败
- `npm run doctor`：通过 / 失败

## 4. 核心 API 回归

- `/api/auth/register`：通过 / 失败
- `/api/auth/login`：通过 / 失败
- `/api/moods/types`：通过 / 失败
- `/api/moods/record`：通过 / 失败
- `/api/moods/list`：通过 / 失败
- `/api/moods/trend`：通过 / 失败
- `/api/moods/weekly-report`：通过 / 失败
- `/api/moods/analysis`：通过 / 失败

## 5. 落库验证

- 写入前 users：
- 写入后 users：
- 增量：
- 写入前 moods：
- 写入后 moods：
- 增量：
- 最近更新文件（db/db-wal）：

## 6. 风险与结论

- 风险项：
- 是否允许上线：是 / 否
- 结论说明：

## 7. 回滚记录

- 回滚触发条件：
- 回滚步骤：

1. 停止服务
2. 还原 SQLite 文件备份
3. 回退代码版本
4. 重启服务并执行最小 API 验证

- 回滚结果：
