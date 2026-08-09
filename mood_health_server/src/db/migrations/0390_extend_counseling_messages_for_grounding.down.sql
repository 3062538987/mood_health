ALTER TABLE counseling_sessions
  DROP INDEX idx_counseling_request_id,
  DROP COLUMN fallback_used,
  DROP COLUMN grounding_used,
  DROP COLUMN model,
  DROP COLUMN provider,
  DROP COLUMN request_id,
  DROP COLUMN sources_json;
