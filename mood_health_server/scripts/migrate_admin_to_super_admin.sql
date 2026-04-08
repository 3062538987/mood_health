/*
  目标：示例迁移脚本，将指定 admin 账号升级为 super_admin
  使用方式：
  1) 修改 @TargetAdmins 中的用户名
  2) 在 SQL Server 中执行
*/

SET XACT_ABORT ON;
GO

BEGIN TRY
  BEGIN TRAN;

  DECLARE @TargetAdmins TABLE (
    username NVARCHAR(100) PRIMARY KEY
  );

  INSERT INTO @TargetAdmins (username)
  VALUES
    (N'admin_test1'),
    (N'admin_test2');

  UPDATE u
  SET u.role = 'super_admin',
      u.updated_at = GETDATE()
  FROM dbo.users u
  INNER JOIN @TargetAdmins t
    ON t.username = u.username
  WHERE u.role = 'admin';

  PRINT N'已升级为 super_admin 的账号：';
  SELECT u.id, u.username, u.role, u.updated_at
  FROM dbo.users u
  INNER JOIN @TargetAdmins t
    ON t.username = u.username
  WHERE u.role = 'super_admin'
  ORDER BY u.username;

  PRINT N'未命中或角色非 admin 的账号：';
  SELECT t.username
  FROM @TargetAdmins t
  LEFT JOIN dbo.users u
    ON u.username = t.username
   AND u.role = 'super_admin'
  WHERE u.id IS NULL
  ORDER BY t.username;

  COMMIT;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
    ROLLBACK;

  THROW;
END CATCH;
GO
