CREATE TABLE assessment_sessions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  assessment_version_id INT UNSIGNED NOT NULL,
  raw_score DECIMAL(8,2) NULL,
  screening_level VARCHAR(32) NULL,
  result_summary_json JSON NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'started',
  started_at DATETIME(3) NOT NULL,
  submitted_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY idx_assessment_sessions_user_created (user_id, created_at),
  KEY idx_assessment_sessions_version (assessment_version_id),
  CONSTRAINT fk_assessment_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_assessment_sessions_version FOREIGN KEY (assessment_version_id) REFERENCES assessment_versions (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_assessment_sessions_status CHECK (status IN ('started', 'submitted', 'voided'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
