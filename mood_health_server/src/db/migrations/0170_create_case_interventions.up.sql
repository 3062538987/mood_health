CREATE TABLE case_interventions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  case_id INT UNSIGNED NOT NULL,
  counselor_user_id INT UNSIGNED NOT NULL,
  intervention_type VARCHAR(32) NOT NULL,
  content TEXT NOT NULL,
  referral_target VARCHAR(255) NULL,
  referral_reason TEXT NULL,
  closure_summary TEXT NULL,
  created_at DATETIME(3) NOT NULL,
  INDEX idx_case_interventions_case (case_id),
  CONSTRAINT fk_case_interventions_case FOREIGN KEY (case_id) REFERENCES cases (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_case_interventions_user FOREIGN KEY (counselor_user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_case_interventions_type CHECK (intervention_type IN ('note', 'interview', 'referral', 'closure'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci