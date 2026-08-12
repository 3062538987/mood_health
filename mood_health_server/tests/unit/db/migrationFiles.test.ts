import fs from 'node:fs'
import path from 'node:path'

const migrationsDir = path.resolve(__dirname, '../../../src/db/migrations')
const bootstrapFile = path.resolve(__dirname, '../../../src/db/bootstrap/schema_migrations.sql')

const expectedMigrationFiles = [
  '0010_create_roles.down.sql',
  '0010_create_roles.up.sql',
  '0020_create_permissions.down.sql',
  '0020_create_permissions.up.sql',
  '0030_create_role_permissions.down.sql',
  '0030_create_role_permissions.up.sql',
  '0040_create_users.down.sql',
  '0040_create_users.up.sql',
  '0050_create_audit_logs.down.sql',
  '0050_create_audit_logs.up.sql',
  '0060_create_emotion_types.down.sql',
  '0060_create_emotion_types.up.sql',
  '0070_create_tags.down.sql',
  '0070_create_tags.up.sql',
  '0080_create_moods.down.sql',
  '0080_create_moods.up.sql',
  '0090_create_mood_emotions.down.sql',
  '0090_create_mood_emotions.up.sql',
  '0100_create_mood_tags.down.sql',
  '0100_create_mood_tags.up.sql',
  '0110_create_assessment_instruments.down.sql',
  '0110_create_assessment_instruments.up.sql',
  '0120_create_assessment_versions.down.sql',
  '0120_create_assessment_versions.up.sql',
  '0130_create_assessment_items.down.sql',
  '0130_create_assessment_items.up.sql',
  '0140_create_assessment_sessions.down.sql',
  '0140_create_assessment_sessions.up.sql',
  '0150_create_assessment_answers.down.sql',
  '0150_create_assessment_answers.up.sql',
  '0160_create_cases.down.sql',
  '0160_create_cases.up.sql',
  '0170_create_case_interventions.down.sql',
  '0170_create_case_interventions.up.sql',
  '0180_create_prompt_templates.down.sql',
  '0180_create_prompt_templates.up.sql',
  '0190_create_musics.down.sql',
  '0190_create_musics.up.sql',
  '0200_create_courses.down.sql',
  '0200_create_courses.up.sql',
  '0210_create_relax_records.down.sql',
  '0210_create_relax_records.up.sql',
  '0220_create_activities.down.sql',
  '0220_create_activities.up.sql',
  '0230_create_posts.down.sql',
  '0230_create_posts.up.sql',
  '0240_create_achievements.down.sql',
  '0240_create_achievements.up.sql',
  '0250_fix_emotion_type_codes.down.sql',
  '0250_fix_emotion_type_codes.up.sql',
  '0260_create_ai_analysis_history.down.sql',
  '0260_create_ai_analysis_history.up.sql',
  '0270_create_mood_alerts.down.sql',
  '0270_create_mood_alerts.up.sql',
  '0280_create_ai_feedback.down.sql',
  '0280_create_ai_feedback.up.sql',
  '0290_add_posts_risk_level.down.sql',
  '0290_add_posts_risk_level.up.sql',
  '0300_create_activity_reminders.down.sql',
  '0300_create_activity_reminders.up.sql',
  '0310_create_activity_feedback.down.sql',
  '0310_create_activity_feedback.up.sql',
  '0320_add_moods_include_note.down.sql',
  '0320_add_moods_include_note.up.sql',
  '0330_create_mood_analysis_versions.down.sql',
  '0330_create_mood_analysis_versions.up.sql',
  '0340_create_ai_replies.down.sql',
  '0340_create_ai_replies.up.sql',
  '0350_create_counseling_sessions.down.sql',
  '0350_create_counseling_sessions.up.sql',
  '0360_create_user_ai_profiles.down.sql',
  '0360_create_user_ai_profiles.up.sql',
  '0370_create_counseling_session_metadata.down.sql',
  '0370_create_counseling_session_metadata.up.sql',
  '0380_create_knowledge_assistant_messages.down.sql',
  '0380_create_knowledge_assistant_messages.up.sql',
  '0390_extend_counseling_messages_for_grounding.down.sql',
  '0390_extend_counseling_messages_for_grounding.up.sql',
  '0400_add_counseling_web_search_status.down.sql',
  '0400_add_counseling_web_search_status.up.sql',
  '0410_migrate_legacy_knowledge_messages.down.sql',
  '0410_migrate_legacy_knowledge_messages.up.sql',
  '0420_create_knowledge_resources.down.sql',
  '0420_create_knowledge_resources.up.sql',
  '0430_create_automatic_risk_signals.down.sql',
  '0430_create_automatic_risk_signals.up.sql',
]

describe('migration SQL files', () => {
  it('matches the approved R0 migration sequence exactly', () => {
    const actualFiles = fs.readdirSync(migrationsDir).sort()

    expect(fs.existsSync(bootstrapFile)).toBe(true)
    expect(actualFiles).toEqual(expectedMigrationFiles)
  })

  it('uses IF NOT EXISTS only in the bootstrap schema_migrations file', () => {
    const migrationFiles = fs.readdirSync(migrationsDir)

    for (const fileName of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, fileName), 'utf8')
      expect(sql).not.toMatch(/IF\s+NOT\s+EXISTS/i)
    }

    expect(fs.readFileSync(bootstrapFile, 'utf8')).toMatch(/IF\s+NOT\s+EXISTS/i)
  })

  it('adds a constrained web search status with a safe default and reversible down migration', () => {
    const upSql = fs.readFileSync(
      path.join(migrationsDir, '0400_add_counseling_web_search_status.up.sql'),
      'utf8'
    )
    const downSql = fs.readFileSync(
      path.join(migrationsDir, '0400_add_counseling_web_search_status.down.sql'),
      'utf8'
    )

    expect(upSql).toMatch(/ALTER\s+TABLE\s+counseling_sessions/i)
    expect(upSql).toMatch(/ADD\s+COLUMN\s+web_search_status/i)
    for (const status of ['not_requested', 'not_needed', 'used', 'failed']) {
      expect(upSql).toContain(`'${status}'`)
    }
    expect(upSql).toMatch(/DEFAULT\s+'not_requested'/i)
    expect(downSql).toMatch(/ALTER\s+TABLE\s+counseling_sessions/i)
    expect(downSql).toMatch(/DROP\s+COLUMN\s+web_search_status/i)
  })

  it('copies legacy knowledge messages once with complete provenance and response metadata', () => {
    const upSql = fs.readFileSync(
      path.join(migrationsDir, '0410_migrate_legacy_knowledge_messages.up.sql'),
      'utf8'
    )

    expect(upSql).toMatch(
      /ADD\s+COLUMN\s+legacy_knowledge_message_id\s+BIGINT\s+UNSIGNED\s+NULL/i
    )
    expect(upSql).toMatch(
      /ADD\s+UNIQUE\s+INDEX\s+idx_counseling_legacy_knowledge_message_id\s*\(legacy_knowledge_message_id\)/i
    )
    expect(upSql).toMatch(/INSERT\s+INTO\s+counseling_sessions/i)
    expect(upSql).toMatch(/FROM\s+knowledge_assistant_messages/i)
    expect(upSql).toMatch(
      /\(\s*user_id\s*,\s*session_id\s*,\s*role\s*,\s*content\s*,\s*sources_json\s*,\s*request_id\s*,\s*provider\s*,\s*model\s*,\s*grounding_used\s*,\s*fallback_used\s*,\s*web_search_status\s*,\s*created_at\s*,\s*legacy_knowledge_message_id\s*\)/i
    )
    expect(upSql).toMatch(
      /SELECT\s+legacy\.user_id\s*,\s*legacy\.session_id\s*,\s*legacy\.role\s*,\s*legacy\.content\s*,\s*legacy\.sources_json\s*,\s*legacy\.request_id\s*,\s*legacy\.provider\s*,\s*legacy\.model/i
    )
    expect(upSql).toMatch(/legacy\.role\s*=\s*'assistant'/i)
    expect(upSql).toMatch(/JSON_TYPE\s*\(legacy\.sources_json\)\s*=\s*'ARRAY'/i)
    expect(upSql).toMatch(/JSON_LENGTH\s*\(legacy\.sources_json\)\s*>\s*0/i)
    expect(upSql).toMatch(/FALSE\s*,\s*'not_requested'\s*,\s*legacy\.created_at\s*,\s*legacy\.id/i)
    expect(upSql).toMatch(/ON\s+DUPLICATE\s+KEY\s+UPDATE\s+legacy_knowledge_message_id/i)
  })

  it('preserves the legacy table and scopes rollback to migrated rows', () => {
    const upSql = fs.readFileSync(
      path.join(migrationsDir, '0410_migrate_legacy_knowledge_messages.up.sql'),
      'utf8'
    )
    const downSql = fs.readFileSync(
      path.join(migrationsDir, '0410_migrate_legacy_knowledge_messages.down.sql'),
      'utf8'
    )

    expect(upSql).not.toMatch(/(?:DROP|DELETE\s+FROM|UPDATE)\s+knowledge_assistant_messages/i)
    expect(downSql).not.toMatch(/(?:DROP|DELETE\s+FROM|UPDATE)\s+knowledge_assistant_messages/i)
    expect(downSql).toMatch(
      /DELETE\s+FROM\s+counseling_sessions\s+WHERE\s+legacy_knowledge_message_id\s+IS\s+NOT\s+NULL/i
    )
    expect(downSql).toMatch(
      /DROP\s+INDEX\s+idx_counseling_legacy_knowledge_message_id/i
    )
    expect(downSql).toMatch(/DROP\s+COLUMN\s+legacy_knowledge_message_id/i)
  })

  it('creates reversible knowledge folders, resources, versions, favorites and ingestion jobs', () => {
    const upSql = fs.readFileSync(
      path.join(migrationsDir, '0420_create_knowledge_resources.up.sql'),
      'utf8'
    )
    const downSql = fs.readFileSync(
      path.join(migrationsDir, '0420_create_knowledge_resources.down.sql'),
      'utf8'
    )

    for (const table of [
      'knowledge_folders',
      'knowledge_resources',
      'knowledge_resource_versions',
      'knowledge_favorites',
      'knowledge_ingestion_jobs',
    ]) {
      expect(upSql).toMatch(new RegExp(`CREATE\\s+TABLE\\s+${table}`, 'i'))
      expect(downSql).toMatch(new RegExp(`DROP\\s+TABLE\\s+${table}`, 'i'))
    }
    expect(upSql).toMatch(/UNIQUE\s+KEY\s+uk_knowledge_folders_slug/i)
    expect(upSql).toMatch(/PRIMARY\s+KEY\s*\(user_id,\s*resource_id\)/i)
    expect(upSql).toMatch(/license_code\s+VARCHAR\(80\)\s+NOT\s+NULL/i)
    expect(upSql).toMatch(/reviewed_at\s+DATE\s+NULL/i)
  })
})
