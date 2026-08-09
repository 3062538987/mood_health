-- 005_add_ai_history_fields.sql
-- 为 ai_analysis_history 添加场景、模型来源、提示词版本、安全状态字段

ALTER TABLE ai_analysis_history
  ADD COLUMN scene VARCHAR(50) DEFAULT NULL COMMENT 'AI 使用场景 (mood_analysis/counseling/suggestion)',
  ADD COLUMN model_source VARCHAR(50) DEFAULT NULL COMMENT '模型来源 (deepseek/rule_based/local)',
  ADD COLUMN prompt_version VARCHAR(20) DEFAULT NULL COMMENT '提示词模板版本',
  ADD COLUMN security_status VARCHAR(20) DEFAULT 'passed' COMMENT '安全审查状态 (passed/flagged/blocked)',
  ADD INDEX idx_ai_history_scene (scene),
  ADD INDEX idx_ai_history_security (security_status);

-- 为 ai_feedback 添加管理员审阅字段
ALTER TABLE ai_feedback
  ADD COLUMN reviewed TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已被管理员审阅',
  ADD COLUMN reviewed_by INT UNSIGNED DEFAULT NULL COMMENT '审阅管理员 ID',
  ADD COLUMN reviewed_at TIMESTAMP NULL DEFAULT NULL COMMENT '审阅时间',
  ADD COLUMN review_note VARCHAR(500) DEFAULT NULL COMMENT '审阅备注';