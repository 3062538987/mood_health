CREATE TABLE audit_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT UNSIGNED NULL,
  actor_role_code VARCHAR(32) NOT NULL,
  permission_code VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NULL,
  target_id VARCHAR(64) NULL,
  result VARCHAR(16) NOT NULL,
  summary VARCHAR(1000) NULL,
  ip_address VARCHAR(45) NULL,
  request_id VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL,
  KEY idx_audit_logs_actor_created (actor_user_id, created_at),
  KEY idx_audit_logs_action_created (action, created_at),
  KEY idx_audit_logs_created_at (created_at),
  CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT chk_audit_logs_result CHECK (result IN ('success', 'failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
