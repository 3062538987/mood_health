CREATE TABLE IF NOT EXISTS activity_feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  activity_id INT NOT NULL,
  user_id INT NOT NULL,
  rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5) COMMENT '评分 1-5',
  comment TEXT COMMENT '反馈文字',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_activity_user (activity_id, user_id),
  CONSTRAINT fk_feedback_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;