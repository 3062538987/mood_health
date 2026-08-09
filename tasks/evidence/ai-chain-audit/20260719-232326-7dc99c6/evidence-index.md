# AI 全链路真实性审计证据索引

- 运行编号：`20260719-232326-7dc99c6`
- 审计现场：`D:\桌面\ccooddee`
- Git HEAD：`7dc99c6dd670d7ad669e8d5ba2e6324d1a0dba15`

## 证据文件

- `00-environment.md`：AUD-00 现场冻结、版本、端口、进程、工作区状态。
- `01-command-results.md`：AUD-00 构建、类型检查、Lint、测试和 doctor 结果。
- `02-static-registration-map.md`：AUD-01 AI 功能静态注册地图。
- `03-runtime-config.md`：AUD-02 启动方式、端口和环境变量真实性。
- `04-data-source-map.md`：AUD-03 数据库、汇总生产和用户隔离地图。
- `05-feature-chain-findings.md`：AUD-04 至 AUD-10 逐功能链路、错误、日志和降级证据。
- `06-e2e-acceptance.md`：AUD-11 四条端到端验收证据。

说明：所有证据只记录脱敏摘要、文件路径、接口路径、退出码、字段结构和失败边界；不写入 API Key、Cookie、Token、数据库密码、完整心理日记或完整咨询对话。
