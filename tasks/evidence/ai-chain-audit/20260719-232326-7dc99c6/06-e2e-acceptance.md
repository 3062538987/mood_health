# AUD-11 四条真实端到端验收

本轮按计划尝试执行真实 E2E，但测试在数据库迁移阶段失败，未进入浏览器 Network 捕获阶段。失败本身作为当前提交证据保留。

## 全局阻断

- 命令：`npx playwright test tests/e2e/mood-record.spec.ts tests/e2e/mood-analysis-navigation.spec.ts tests/e2e/counseling.spec.ts tests/e2e/assessment.spec.ts --reporter=list`
- 退出码：1
- 阻断点：Playwright global setup 的 MySQL migration
- 数据库：`mood_health_e2e`
- MySQL 端口：`3316`
- 错误：`Duplicate migration version: 0350`
- 证据：
  - `mood_health_server/src/db/migrations/0350_create_counseling_sessions.up.sql`
  - `mood_health_server/src/db/migrations/0350_create_user_ai_profiles.up.sql`
  - `mood_health_server/src/db/migrationRunner.ts:78-86`

## 测试一：情绪记录与分析

| 步骤 | 结果 |
| --- | --- |
| 登录测试用户 | 未执行到浏览器阶段 |
| 新建三条不同日期记录 | 未执行到浏览器阶段 |
| 数据库确认记录存在 | 未执行本场景；只读探测显示历史测试库 `moods=9` |
| 调用情绪分析 | 未执行 |
| 确认 Python 收到请求 | 未执行；8000/8001 当前不可达 |
| 确认 DeepSeek 真实调用 | 未验证 |
| 确认分析结果保存 | 当前库 `mood_analysis_versions=0` |
| 刷新读取 | 未执行 |

结论：未通过。阻断边界为迁移冲突和 AI 服务不可达。

## 测试二：汇总报告

| 步骤 | 结果 |
| --- | --- |
| 生成七日周报 | 未执行到浏览器阶段 |
| 核对数据范围 | 未执行 |
| 确认周报保存 | 未发现稳定周报保存表 |
| 重新登录读取 | 未执行 |

结论：未通过。当前静态证据显示统计周报按需计算，AI 报告无持久化链路证据。

## 测试三：心理咨询

| 步骤 | 结果 |
| --- | --- |
| 连续三轮 | 未执行到浏览器阶段 |
| 第三轮包含历史 | 未验证；代码存在历史构造意图 |
| DeepSeek 真实调用 | 未验证 |
| 无模板降级 | 未验证；代码中仍存在固定 fallback 风险 |
| 会话记录保存 | 当前库缺 `counseling_sessions` 表 |

结论：未通过。前端 API 封装编译失败、DB 表缺失、Provider 未验证。

## 测试四：知识助手

| 步骤 | 结果 |
| --- | --- |
| 点击 AI 知识助手 | 静态代码显示会触发 `window.open` |
| 不打开新标签页 | 不满足；当前代码 `_blank` |
| URL 为内部路由 | 不满足；当前目标为 `http://localhost:8501/?user_id=...` |
| 提交知识库问题 | 当前 8501 未监听，无法打开 |
| 前端请求 Node | 不满足；绕过 Node |
| Node 请求 Python/LangChain | 不满足；无 Node 网关链路 |
| 检索知识库内容 | 未验证 |
| 当前页面展示 | 不满足；独立 Streamlit 页面 |

结论：未通过，P0。

