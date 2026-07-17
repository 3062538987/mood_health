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
})
