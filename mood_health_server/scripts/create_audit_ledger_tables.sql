/*
  极简台账表：修复清单 + 反馈闭环记录
*/

SET XACT_ABORT ON;
GO

IF OBJECT_ID('dbo.incident_fix_list', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.incident_fix_list (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    fixer_id INT NULL,
    fixer_role NVARCHAR(20) NOT NULL,
    fixed_at DATETIME2 NOT NULL CONSTRAINT DF_incident_fix_list_fixed_at DEFAULT SYSUTCDATETIME(),
    issue_description NVARCHAR(MAX) NOT NULL,
    fix_content NVARCHAR(MAX) NOT NULL,
    result NVARCHAR(20) NOT NULL,
    CONSTRAINT CK_incident_fix_list_result CHECK (result IN ('success', 'failed'))
  );
END;
GO

IF OBJECT_ID('dbo.feedback_close_list', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.feedback_close_list (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    handler_id INT NULL,
    handler_role NVARCHAR(20) NOT NULL,
    handled_at DATETIME2 NOT NULL CONSTRAINT DF_feedback_close_list_handled_at DEFAULT SYSUTCDATETIME(),
    feedback_id NVARCHAR(100) NOT NULL,
    handle_content NVARCHAR(MAX) NOT NULL,
    close_status NVARCHAR(20) NOT NULL,
    CONSTRAINT CK_feedback_close_list_status CHECK (close_status IN ('closed', 'pending'))
  );
END;
GO
