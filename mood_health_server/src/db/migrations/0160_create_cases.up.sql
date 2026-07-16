CREATE TABLE cases (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_user_id INT UNSIGNED NOT NULL,
  assigned_counselor_id INT UNSIGNED NULL,
  source_session_id INT UNSIGNED NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  risk_level VARCHAR(32) NULL,
  summary TEXT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX idx_cases_student_status (student_user_id, status),
  INDEX idx_cases_counselor_status (assigned_counselor_id, status),
  INDEX idx_cases_status (status),
  CONSTRAINT fk_cases_student FOREIGN KEY (student_user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_cases_counselor FOREIGN KEY (assigned_counselor_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT fk_cases_session FOREIGN KEY (source_session_id) REFERENCES assessment_sessions (id) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT chk_cases_status CHECK (status IN ('open', 'assigned', 'in_progress', 'referred', 'closed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci