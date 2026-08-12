CREATE TABLE user_notification_preferences (
  user_id INT UNSIGNED NOT NULL PRIMARY KEY,
  reminder_time TIME NOT NULL DEFAULT '20:00:00',
  weekly_report_enabled TINYINT(1) NOT NULL DEFAULT 1,
  game_sound_enabled TINYINT(1) NOT NULL DEFAULT 1,
  emotion_reminder_enabled TINYINT(1) NOT NULL DEFAULT 1,
  weekly_report_notification_enabled TINYINT(1) NOT NULL DEFAULT 1,
  group_activity_enabled TINYINT(1) NOT NULL DEFAULT 1,
  treehole_reply_enabled TINYINT(1) NOT NULL DEFAULT 1,
  feature_update_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_notification_preferences_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  notification_type VARCHAR(40) NOT NULL,
  title VARCHAR(120) NOT NULL,
  message VARCHAR(500) NOT NULL,
  action_path VARCHAR(255) NULL,
  dedupe_key VARCHAR(120) NOT NULL,
  scheduled_for DATETIME(3) NOT NULL,
  read_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_user_notifications_dedupe (user_id, dedupe_key),
  KEY idx_user_notifications_user_created (user_id, created_at),
  CONSTRAINT fk_user_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT chk_user_notifications_type CHECK (notification_type IN ('emotion_reminder', 'weekly_report', 'test'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
