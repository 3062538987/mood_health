CREATE TABLE knowledge_assistant_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  session_id VARCHAR(36) NOT NULL,
  role ENUM('user', 'assistant') NOT NULL,
  content TEXT NOT NULL,
  sources_json JSON NULL,
  request_id VARCHAR(128) NOT NULL,
  provider VARCHAR(64) NULL,
  model VARCHAR(128) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_knowledge_user_session_created (user_id, session_id, created_at),
  INDEX idx_knowledge_request_id (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
