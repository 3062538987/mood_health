-- 007_create_mood_analysis_versions.sql
-- 五周期情绪分析版本表 - 支持数据版本化、缓存复用、过期标记

CREATE TABLE IF NOT EXISTS mood_analysis_versions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  period VARCHAR(10) NOT NULL COMMENT '分析周期: 7d/1m/3m/6m/1y',
  data_version VARCHAR(64) NOT NULL COMMENT '数据版本哈希 (record_ids + updatedAt + period)',
  input_hash VARCHAR(64) NOT NULL COMMENT '输入内容哈希 (用于复用判断)',
  record_ids JSON NOT NULL COMMENT '纳入分析的记录 ID 列表',
  record_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '纳入记录数量',
  data_range_start DATE NOT NULL COMMENT '数据范围开始',
  data_range_end DATE NOT NULL COMMENT '数据范围结束',
  status ENUM('pending', 'processing', 'completed', 'failed', 'stale') NOT NULL DEFAULT 'pending',
  analysis_content JSON DEFAULT NULL COMMENT '分析结果 JSON',
  error_message TEXT DEFAULT NULL COMMENT '失败原因',
  is_stale TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已过期 (底层数据已变更)',
  stale_reason VARCHAR(255) DEFAULT NULL COMMENT '过期原因',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_period (user_id, period),
  INDEX idx_user_version (user_id, data_version),
  INDEX idx_status (status),
  UNIQUE KEY uk_user_period_version (user_id, period, data_version),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='五周期情绪分析版本';