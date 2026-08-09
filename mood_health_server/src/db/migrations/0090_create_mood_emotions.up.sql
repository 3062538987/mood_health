CREATE TABLE mood_emotions (
  mood_id INT UNSIGNED NOT NULL,
  emotion_type_id SMALLINT UNSIGNED NOT NULL,
  intensity TINYINT UNSIGNED NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (mood_id, emotion_type_id),
  CONSTRAINT fk_mood_emotions_mood FOREIGN KEY (mood_id) REFERENCES moods (id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_mood_emotions_type FOREIGN KEY (emotion_type_id) REFERENCES emotion_types (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_mood_emotions_intensity CHECK (intensity BETWEEN 1 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
