# 旧 SQLite 离线备份清单

## 备份记录

| 字段 | 值 |
|---|---|
| 备份日期 | 2026-07-14 |
| 源文件 | `mood_health_server/data/mood-health.db` |
| 离线备份 | `backups/legacy-sqlite/2026-07-14/mood-health.db` |
| 文件大小 | 229,376 bytes |
| SHA-256 | `4D67AD29A0CEDE2A68FF33DF342543CA577B20FCE49C0B8D3938283F754EE2B0` |
| 备份属性 | 只读 |
| 数据处置 | 仅历史留存，不迁移到 MySQL，不参与启动、测试或演示初始化 |

备份前已停止本次诊断启动的 PM2 后端进程。源库与备份文件的 SHA-256 和字节数一致；未读取或修改旧库业务正文。数据库二进制文件由 `.gitignore` 排除，Git 只保存本清单。

## 校验命令

```powershell
Get-FileHash mood_health_server/data/mood-health.db -Algorithm SHA256
Get-FileHash backups/legacy-sqlite/2026-07-14/mood-health.db -Algorithm SHA256
(Get-Item backups/legacy-sqlite/2026-07-14/mood-health.db).IsReadOnly
```

两个哈希必须均为 `4D67AD29A0CEDE2A68FF33DF342543CA577B20FCE49C0B8D3938283F754EE2B0`，只读属性必须为 `True`。若任一条件不满足，应停止后续破坏性清理并重新核对备份来源；不得用该备份覆盖当前活动库。
