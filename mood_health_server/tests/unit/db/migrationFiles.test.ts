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
