CREATE TABLE tags (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NULL,
  owner_user_id INT UNSIGNED NULL,
  name VARCHAR(50) NOT NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_tags_code (code),
  UNIQUE KEY uk_tags_owner_name (owner_user_id, name),
  KEY idx_tags_system_name (is_system, name),
  CONSTRAINT fk_tags_owner FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
