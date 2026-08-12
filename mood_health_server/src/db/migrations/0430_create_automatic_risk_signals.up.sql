CREATE TABLE risk_signal_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  signal_type VARCHAR(40) NOT NULL,
  detected_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_risk_signal_events_user_type_time (user_id, signal_type, detected_at),
  CONSTRAINT fk_risk_signal_events_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT chk_risk_signal_events_type CHECK (signal_type IN ('treehole_high_risk'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE counseling_sessions
  ADD COLUMN risk_level VARCHAR(16) NOT NULL DEFAULT 'low' AFTER web_search_status,
  ADD INDEX idx_counseling_user_risk_created (user_id, risk_level, created_at);

ALTER TABLE cases
  ADD COLUMN origin VARCHAR(32) NULL AFTER source_session_id,
  ADD COLUMN trigger_reasons_json JSON NULL AFTER summary,
  ADD UNIQUE KEY uk_cases_student_origin (student_user_id, origin),
  ADD CONSTRAINT chk_cases_origin CHECK (origin IS NULL OR origin IN ('automatic_risk'));
