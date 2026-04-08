/*
  目标：统一 users.role 的允许值为 super_admin/admin/user
  说明：
  1) 保留历史数据兼容性，先将非法或空角色回填为 user
  2) 重新建立默认约束和检查约束
*/

SET XACT_ABORT ON;
GO

BEGIN TRY
  BEGIN TRAN;

  IF COL_LENGTH('dbo.users', 'role') IS NULL
  BEGIN
    ALTER TABLE dbo.users
      ADD role NVARCHAR(20) NOT NULL
      CONSTRAINT DF_users_role DEFAULT 'user';
  END;

  UPDATE dbo.users
  SET role = 'user'
  WHERE role IS NULL
    OR LTRIM(RTRIM(role)) = ''
    OR role NOT IN ('super_admin', 'admin', 'user');

  DECLARE @dropDefaultSql NVARCHAR(MAX) = N'';
  SELECT @dropDefaultSql = @dropDefaultSql +
    N'ALTER TABLE dbo.users DROP CONSTRAINT [' + dc.name + N'];'
  FROM sys.default_constraints dc
  INNER JOIN sys.columns c
    ON c.object_id = dc.parent_object_id
   AND c.column_id = dc.parent_column_id
  WHERE dc.parent_object_id = OBJECT_ID(N'dbo.users')
    AND c.name = N'role';

  IF @dropDefaultSql <> N''
  BEGIN
    EXEC sp_executesql @dropDefaultSql;
  END;

  ALTER TABLE dbo.users
    ADD CONSTRAINT DF_users_role DEFAULT 'user' FOR role;

  DECLARE @dropCheckSql NVARCHAR(MAX) = N'';
  SELECT @dropCheckSql = @dropCheckSql +
    N'ALTER TABLE dbo.users DROP CONSTRAINT [' + cc.name + N'];'
  FROM sys.check_constraints cc
  WHERE cc.parent_object_id = OBJECT_ID(N'dbo.users')
    AND cc.definition LIKE N'%[[]role[]]%';

  IF @dropCheckSql <> N''
  BEGIN
    EXEC sp_executesql @dropCheckSql;
  END;

  ALTER TABLE dbo.users WITH CHECK
    ADD CONSTRAINT CK_users_role_allowed
    CHECK (role IN ('super_admin', 'admin', 'user'));

  COMMIT;
  PRINT N'✅ users.role 约束已更新，允许 super_admin/admin/user';
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
    ROLLBACK;

  THROW;
END CATCH;
GO
