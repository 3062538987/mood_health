/*
  管理员操作审计日志表
  贴合权限清单字段要求：操作人ID、操作人角色、权限编码、操作类型、操作对象ID、操作内容、操作时间、IP地址、操作结果
*/

SET XACT_ABORT ON;
GO

IF OBJECT_ID('dbo.operation_logs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.operation_logs (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    operator_id INT NULL,
    operator_role NVARCHAR(20) NOT NULL,
    permission_code NVARCHAR(100) NOT NULL,
    operation_type NVARCHAR(100) NOT NULL,
    target_id NVARCHAR(100) NULL,
    content NVARCHAR(MAX) NULL,
    operation_time DATETIME2 NOT NULL CONSTRAINT DF_operation_logs_time DEFAULT SYSUTCDATETIME(),
    ip_address NVARCHAR(64) NULL,
    operation_result NVARCHAR(20) NOT NULL,
    CONSTRAINT CK_operation_logs_result CHECK (operation_result IN ('success', 'failed'))
  );
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_operation_logs_time'
    AND object_id = OBJECT_ID('dbo.operation_logs')
)
BEGIN
  CREATE INDEX IX_operation_logs_time ON dbo.operation_logs(operation_time DESC);
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_operation_logs_role_permission'
    AND object_id = OBJECT_ID('dbo.operation_logs')
)
BEGIN
  CREATE INDEX IX_operation_logs_role_permission
    ON dbo.operation_logs(operator_role, permission_code, operation_time DESC);
END;
GO
