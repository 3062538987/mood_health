ALTER TABLE counseling_sessions
  ADD COLUMN legacy_knowledge_message_id BIGINT UNSIGNED NULL AFTER web_search_status,
  ADD UNIQUE INDEX idx_counseling_legacy_knowledge_message_id (legacy_knowledge_message_id);

INSERT INTO counseling_sessions
  (user_id, session_id, role, content, sources_json, request_id, provider, model,
   grounding_used, fallback_used, web_search_status, created_at,
   legacy_knowledge_message_id)
SELECT legacy.user_id,
       legacy.session_id,
       legacy.role,
       legacy.content,
       legacy.sources_json,
       legacy.request_id,
       legacy.provider,
       legacy.model,
       CASE
         WHEN legacy.role = 'assistant'
          AND JSON_TYPE(legacy.sources_json) = 'ARRAY'
          AND JSON_LENGTH(legacy.sources_json) > 0
         THEN TRUE
         ELSE FALSE
       END,
       FALSE,
       'not_requested',
       legacy.created_at,
       legacy.id
FROM knowledge_assistant_messages AS legacy
ON DUPLICATE KEY UPDATE
  legacy_knowledge_message_id = VALUES(legacy_knowledge_message_id);
