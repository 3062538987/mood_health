-- 为评估量表添加批准状态和版本追踪
-- 将 'active' 重命名为 'approved'，确保只有批准的量表对用户可见

ALTER TABLE assessment_instruments
  ADD COLUMN approved_by INT UNSIGNED NULL COMMENT '批准人(admin user id)',
  ADD COLUMN approved_at DATETIME(3) NULL COMMENT '批准时间',
  ADD COLUMN instrument_version VARCHAR(32) NOT NULL DEFAULT '1.0.0' COMMENT '量表版本号' AFTER description,
  ADD COLUMN source VARCHAR(128) NULL COMMENT '量表来源' AFTER instrument_version,
  ADD COLUMN source_url VARCHAR(512) NULL COMMENT '来源链接' AFTER source,
  ADD CONSTRAINT fk_assessment_instruments_approved_by FOREIGN KEY (approved_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE RESTRICT;

-- 修改 status 约束，添加 'approved' 值
ALTER TABLE assessment_instruments
  DROP CHECK chk_assessment_instruments_status,
  ADD CONSTRAINT chk_assessment_instruments_status CHECK (status IN ('draft', 'active', 'approved', 'retired'));

-- 为 assessment_versions 添加评分规则版本追踪
ALTER TABLE assessment_versions
  ADD COLUMN scoring_rule_version VARCHAR(32) NOT NULL DEFAULT '1.0.0' COMMENT '评分规则版本号' AFTER version_label;

-- 为 cases 表添加唯一索引防重复
ALTER TABLE cases
  ADD INDEX idx_cases_session_unique (source_session_id, student_user_id);