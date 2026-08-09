-- 分析任务表：在同一事务中与情绪记录一起创建
-- 由 dispatcher 定期拉取并调用 FastAPI 处理
CREATE TABLE IF NOT EXISTS analysis_jobs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  mood_record_id BIGINT NOT NULL,
  period VARCHAR(20) NOT NULL DEFAULT '7d',
  include_note TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否包含日记原文用于 AI 分析',
  status ENUM('pending','processing','succeeded','retryable_failed','failed_final','superseded') NOT NULL DEFAULT 'pending',
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  lease_id VARCHAR(36) DEFAULT NULL COMMENT '租约 ID，防止重复处理',
  lease_expires_at DATETIME(3) DEFAULT NULL,
  result_json JSON DEFAULT NULL COMMENT 'FastAPI 返回的分析结果',
  error_message TEXT DEFAULT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_user_period (user_id, period),
  INDEX idx_status (status),
  INDEX idx_lease (lease_id, lease_expires_at),
  INDEX idx_mood_record (mood_record_id),
  FOREIGN KEY (mood_record_id) REFERENCES moods(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 为 moods 表添加 include_note 字段
ALTER TABLE moods ADD COLUMN include_note TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否允许本次日记用于 AI 分析' AFTER trigger_ciphertext;