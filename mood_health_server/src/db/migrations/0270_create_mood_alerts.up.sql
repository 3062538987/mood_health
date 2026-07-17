CREATE TABLE mood_alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  alert_type VARCHAR(50) NOT NULL COMMENT '提醒类型: continuous_low / high_fluctuation',
  alert_message VARCHAR(500) NOT NULL COMMENT '提醒文案',
  trigger_records JSON NULL COMMENT '触发记录ID列表',
  is_read TINYINT(1) DEFAULT 0 COMMENT '是否已读',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  KEY idx_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='情绪异常提醒记录';