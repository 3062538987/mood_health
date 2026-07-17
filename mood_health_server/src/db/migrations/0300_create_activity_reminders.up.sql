CREATE TABLE activity_reminders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  activity_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  remind_at DATETIME(3) NOT NULL COMMENT '提醒时间',
  is_sent TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已发送',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_activity_user (activity_id, user_id),
  CONSTRAINT fk_reminder_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
  CONSTRAINT fk_reminder_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;