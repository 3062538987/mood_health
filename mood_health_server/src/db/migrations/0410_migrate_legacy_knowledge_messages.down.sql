DELETE FROM counseling_sessions
WHERE legacy_knowledge_message_id IS NOT NULL;

ALTER TABLE counseling_sessions
  DROP INDEX idx_counseling_legacy_knowledge_message_id,
  DROP COLUMN legacy_knowledge_message_id;
