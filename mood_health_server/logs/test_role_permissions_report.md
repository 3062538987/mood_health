# 角色权限冒烟测试报告

- 生成时间: 2026-03-18T04:12:03.104Z
- 后端地址: http://localhost:3000
- 总场景: 6
- 通过场景: 2
- 失败场景: 4

| 测试场景 | 预期结果 | 实际结果 | 是否通过 |
|---|---|---|---|
| 场景1：admin 访问 /api/roles（role.manage） | 403 错误 | status=403, path=/api/roles/manage | 通过 |
| 场景2：super_admin 调用 /api/users/update-role（user.manage） | 操作成功并记录日志 | status=200, path=/api/users/manage, logRecorded=false | 失败 |
| 场景3：admin 调用 /api/posts/audit（post.audit） | 操作成功并记录审核日志 | pendingStatus=200, pendingId=20, auditStatus=200, path=/api/posts/admin/audit/20, logRecorded=false | 失败 |
| 场景4：user 尝试访问 /api/activities/delete（activity.manage） | 403 错误 | status=403, path=/api/activities/delete/1, activityId=1 | 通过 |
| 场景5：super_admin 查看 /api/audit/all；admin 访问同接口 | super_admin 返回数据，admin 返回 403 | superStatus=500, superPath=/api/audit/all, adminStatus=403, adminPath=/api/audit/all | 失败 |
| 场景6：admin 调用 /api/music/create（music.manage） | 操作成功 | status=500, path=/api/music | 失败 |