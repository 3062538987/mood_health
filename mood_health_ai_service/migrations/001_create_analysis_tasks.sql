-- 001: 创建 analysis_tasks 表
-- FastAPI 情绪分析任务存储，与 Node 共享同一 MySQL 实例
-- 使用 mood_health 数据库

CREATE TABLE IF NOT EXISTS analysis_tasks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(64) NOT NULL UNIQUE COMMENT 'UUID 任务标识',
    user_id INT NOT NULL COMMENT '用户 ID',
    period VARCHAR(10) NOT NULL COMMENT '分析周期: 7d/1m/3m/6m/1y',
    status ENUM('pending', 'running', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    request_json LONGTEXT COMMENT '原始请求 JSON',
    result_json LONGTEXT COMMENT '分析结果 JSON',
    provider VARCHAR(50) DEFAULT '' COMMENT 'AI provider',
    model VARCHAR(50) DEFAULT '' COMMENT 'AI model',
    prompt_version VARCHAR(20) DEFAULT '' COMMENT 'prompt 版本',
    error_message TEXT COMMENT '错误信息',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='情绪分析任务表';