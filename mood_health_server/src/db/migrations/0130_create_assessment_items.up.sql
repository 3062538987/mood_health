CREATE TABLE assessment_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  assessment_version_id INT UNSIGNED NOT NULL,
  item_order SMALLINT UNSIGNED NOT NULL,
  item_text TEXT NOT NULL,
  item_type VARCHAR(32) NOT NULL DEFAULT 'single_choice',
  options_json JSON NULL,
  reverse_scored TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_assessment_items_order (assessment_version_id, item_order),
  CONSTRAINT fk_assessment_items_version FOREIGN KEY (assessment_version_id) REFERENCES assessment_versions (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_assessment_items_type CHECK (item_type IN ('single_choice', 'multiple_choice', 'text'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
