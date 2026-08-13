import dotenv from 'dotenv'
import { createPool, Pool } from 'mysql2/promise'

import { readMysqlMigratorConfig } from '../config/mysql'
import { SeedDatabase, seedReferenceData } from './seeds/coreSeed'
import { seedDemoData, seedTestData } from './seeds/profileSeed'
import { seedPromptTemplates } from './seeds/promptSeed'
import { seedCourses } from './seeds/courseSeed'
import { seedAiAnalysisData } from './seeds/seedAiAnalysisData'
import { seedKnowledgeResources } from './seeds/knowledgeResourceSeed'
import { seedSupportAdminYearData } from './seeds/seedSupportAdminYearData'

dotenv.config()

class MysqlSeedDatabase implements SeedDatabase {
  constructor(private readonly pool: Pool) {}

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await this.pool.query(sql, params)
    return Array.isArray(rows) ? (rows as T[]) : []
  }
}

const createSeedPool = (): Pool => {
  const config = readMysqlMigratorConfig()
  return createPool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    charset: 'utf8mb4',
    timezone: 'Z',
    waitForConnections: true,
    connectionLimit: 1,
    maxIdle: 1,
    idleTimeout: 30000,
    queueLimit: 0,
    connectTimeout: config.connectTimeoutMs,
  })
}

export const runSeedCommand = async (profile = process.argv[2] ?? 'reference'): Promise<void> => {
  const pool = createSeedPool()
  const db = new MysqlSeedDatabase(pool)

  try {
    if (profile === 'reference') {
      const result = await seedReferenceData(db)
      const knowledgeResult = await seedKnowledgeResources(db)
      console.log(`Reference seed applied: roles=${result.roles}, permissions=${result.permissions}, rolePermissions=${result.rolePermissions}, emotionTypes=${result.emotionTypes}, systemTags=${result.systemTags}, knowledgeResources=${knowledgeResult.count}.`)
      return
    }

    if (profile === 'demo') {
      await seedReferenceData(db)
      await seedKnowledgeResources(db)
      const result = await seedDemoData(db)
      const supportResult = await seedSupportAdminYearData(db)
      console.log(`Demo seed applied: accounts=${result.accounts.join(',')}, moods=${result.moods}, supportAdminMoods=${supportResult.moodCount}.`)
      return
    }

    if (profile === 'test') {
      await seedReferenceData(db)
      await seedKnowledgeResources(db)
      const result = await seedTestData(db)
      console.log(`Test seed applied: assessment=${result.assessmentCode}.`)
      return
    }

    if (profile === 'all') {
      await seedReferenceData(db)
      const knowledgeResult = await seedKnowledgeResources(db)
      const demoResult = await seedDemoData(db)
      const supportResult = await seedSupportAdminYearData(db)
      const testResult = await seedTestData(db)
      const promptResult = await seedPromptTemplates(db)
      const courseResult = await seedCourses(db)
      console.log(`All seed profiles applied: demoAccounts=${demoResult.accounts.length + 1}, demoMoods=${demoResult.moods + supportResult.moodCount}, testAssessment=${testResult.assessmentCode}, prompts=${promptResult.count}, courses=${courseResult.count}, knowledgeResources=${knowledgeResult.count}.`)
      return
    }

    if (profile === 'prompts') {
      await seedReferenceData(db)
      const result = await seedPromptTemplates(db)
      console.log(`Prompt seed applied: ${result.count} templates.`)
      return
    }

    if (profile === 'courses') {
      await seedReferenceData(db)
      const result = await seedCourses(db)
      console.log(`Course seed applied: ${result.count} courses.`)
      return
    }

    if (profile === 'ai-analysis') {
      await seedReferenceData(db)
      await seedDemoData(db)
      const result = await seedAiAnalysisData(db)
      console.log(`AI analysis seed applied: moods=${result.moods}.`)
      return
    }

    if (profile === 'support-admin-year') {
      await seedReferenceData(db)
      const result = await seedSupportAdminYearData(db)
      console.log(`Support admin year seed applied: userId=${result.userId}, days=${result.daysCovered}, moods=${result.moodCount}.`)
      return
    }

    throw new Error(`Unknown seed profile: ${profile}`)
  } finally {
    await pool.end()
  }
}

if (require.main === module) {
  runSeedCommand().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
