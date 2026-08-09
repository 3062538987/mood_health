-- 为放松记录添加客户端 ID 和去重索引
ALTER TABLE relax_records
  ADD COLUMN client_id VARCHAR(36) DEFAULT NULL COMMENT '客户端设备 ID' AFTER activity_type,
  ADD COLUMN client_timestamp BIGINT NOT NULL DEFAULT 0 COMMENT '客户端创建时间戳(ms)' AFTER client_id,
  ADD INDEX idx_client_id (client_id);