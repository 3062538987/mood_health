CREATE TABLE assessment_answers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  answer_value_json JSON NOT NULL,
  score DECIMAL(8,2) NULL,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_assessment_answers_session_item (session_id, item_id),
  CONSTRAINT fk_assessment_answers_session FOREIGN KEY (session_id) REFERENCES assessment_sessions (id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_assessment_answers_item FOREIGN KEY (item_id) REFERENCES assessment_items (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
