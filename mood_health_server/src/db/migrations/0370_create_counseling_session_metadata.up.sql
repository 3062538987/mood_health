CREATE TABLE counseling_session_metadata (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  session_id VARCHAR(36) NOT NULL,
  title VARCHAR(30) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_counseling_session_metadata_user_session (user_id, session_id),
  INDEX idx_counseling_session_metadata_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
