ALTER TABLE counseling_sessions
  ADD COLUMN web_search_status ENUM('not_requested', 'not_needed', 'used', 'failed')
    NOT NULL DEFAULT 'not_requested' AFTER fallback_used;
