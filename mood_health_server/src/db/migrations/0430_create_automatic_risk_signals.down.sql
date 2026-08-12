ALTER TABLE cases
  DROP CHECK chk_cases_origin,
  DROP INDEX uk_cases_student_origin,
  DROP COLUMN trigger_reasons_json,
  DROP COLUMN origin;

ALTER TABLE counseling_sessions
  DROP INDEX idx_counseling_user_risk_created,
  DROP COLUMN risk_level;

DROP TABLE risk_signal_events;
