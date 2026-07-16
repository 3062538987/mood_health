CREATE TABLE prompt_templates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT '模板名称',
  category VARCHAR(50) NOT NULL COMMENT '模板分类: assessment_interpretation/mood_report/counseling/recommendation',
  system_prompt TEXT NOT NULL COMMENT '系统提示词',
  user_prompt_template TEXT NOT NULL COMMENT '用户提示词模板（支持 {{variable}} 占位）',
  variables JSON COMMENT '可用变量列表及说明',
  model VARCHAR(50) DEFAULT 'deepseek-chat' COMMENT '推荐模型',
  temperature DECIMAL(3,2) DEFAULT 0.70 COMMENT '温度参数',
  max_tokens INT UNSIGNED DEFAULT 2048 COMMENT '最大输出 token',
  is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  sort_order INT DEFAULT 0 COMMENT '排序',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_name (name),
  KEY idx_category (category),
  KEY idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI Prompt 模板';