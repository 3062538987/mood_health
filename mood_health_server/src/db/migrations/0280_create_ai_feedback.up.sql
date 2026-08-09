CREATE TABLE ai_feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  analysis_history_id INT NOT NULL,
  feedback_type ENUM('helpful', 'not_helpful') NOT NULL COMMENT '反馈类型',
  comment VARCHAR(500) NULL COMMENT '补充说明',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY uq_user_analysis (user_id, analysis_history_id) COMMENT '防止重复提交'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI建议效果反馈';