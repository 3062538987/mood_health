ALTER TABLE counseling_sessions
  ADD COLUMN sources_json JSON NULL AFTER content,
  ADD COLUMN request_id VARCHAR(128) NULL AFTER sources_json,
  ADD COLUMN provider VARCHAR(64) NULL AFTER request_id,
  ADD COLUMN model VARCHAR(128) NULL AFTER provider,
  ADD COLUMN grounding_used TINYINT(1) NOT NULL DEFAULT 0 AFTER model,
  ADD COLUMN fallback_used TINYINT(1) NOT NULL DEFAULT 0 AFTER grounding_used,
  ADD INDEX idx_counseling_request_id (request_id);
