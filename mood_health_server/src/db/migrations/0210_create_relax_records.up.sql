CREATE TABLE relax_records (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  activity_type VARCHAR(64) NOT NULL,
  start_time DATETIME(3) NOT NULL,
  end_time DATETIME(3) NOT NULL,
  metrics JSON NULL,
  mood_tag VARCHAR(32) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_relax_records_user_id (user_id),
  INDEX idx_relax_records_start_time (start_time),
  INDEX idx_relax_records_user_start (user_id, start_time),
  INDEX idx_relax_records_activity_type (activity_type),
  CONSTRAINT fk_relax_records_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci