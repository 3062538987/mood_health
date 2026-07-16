CREATE TABLE achievement_definitions (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description VARCHAR(512) NOT NULL,
  type VARCHAR(64) NOT NULL,
  threshold INT UNSIGNED NOT NULL,
  icon VARCHAR(16) NOT NULL,
  level VARCHAR(16) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_achievement_level CHECK (level IN ('bronze', 'silver', 'gold'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_achievements (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  achievement_id VARCHAR(64) NOT NULL,
  unlocked_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_user_achievement (user_id, achievement_id),
  INDEX idx_ua_user_id (user_id),
  CONSTRAINT fk_ua_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_ua_achievement FOREIGN KEY (achievement_id) REFERENCES achievement_definitions (id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Seed achievement definitions
INSERT INTO achievement_definitions (id, name, description, type, threshold, icon, level, sort_order) VALUES
('first-mood', '初次记录', '完成 1 次心情记录。', 'mood_records', 1, '📝', 'bronze', 1),
('relax-starter', '放松起步', '完成 1 次放松活动。', 'relax_sessions', 1, '🌿', 'bronze', 2),
('treehole-voice', '勇敢表达', '发布 1 篇树洞帖子。', 'posts', 1, '💬', 'silver', 3),
('relax-keeper', '稳定练习', '累计完成 5 次放松活动。', 'relax_sessions', 5, '🎵', 'gold', 4)