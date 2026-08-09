CREATE TABLE activities (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  start_time DATETIME(3) NOT NULL,
  end_time DATETIME(3) NOT NULL,
  max_participants INT UNSIGNED NOT NULL,
  current_participants INT UNSIGNED NOT NULL DEFAULT 0,
  location VARCHAR(255) NOT NULL,
  image_url VARCHAR(512) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_activities_start_time (start_time),
  INDEX idx_activities_status (start_time, end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE activity_participants (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  activity_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  joined_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_activity_user (activity_id, user_id),
  INDEX idx_ap_user_id (user_id),
  CONSTRAINT fk_ap_activity FOREIGN KEY (activity_id) REFERENCES activities (id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_ap_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci