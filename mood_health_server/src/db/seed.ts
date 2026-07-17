import dotenv from 'dotenv'
import { createPool, Pool } from 'mysql2/promise'

import { readMysqlMigratorConfig } from '../config/mysql'
import { SeedDatabase, seedReferenceData } from './seeds/coreSeed'
import { seedDemoData, seedTestData } from './seeds/profileSeed'
import { seedPromptTemplates } from './seeds/promptSeed'
import { seedCourses } from './seeds/courseSeed'

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
      console.log(`Reference seed applied: roles=${result.roles}, permissions=${result.permissions}, rolePermissions=${result.rolePermissions}, emotionTypes=${result.emotionTypes}, systemTags=${result.systemTags}.`)
      return
    }

    if (profile === 'demo') {
      await seedReferenceData(db)
      const result = await seedDemoData(db)
      console.log(`Demo seed applied: accounts=${result.accounts.join(',')}, moods=${result.moods}.`)
      return
    }

    if (profile === 'test') {
      await seedReferenceData(db)
      const result = await seedTestData(db)
      console.log(`Test seed applied: assessment=${result.assessmentCode}.`)
      return
    }

    if (profile === 'all') {
      await seedReferenceData(db)
      const demoResult = await seedDemoData(db)
      const testResult = await seedTestData(db)
      const promptResult = await seedPromptTemplates(db)
      const courseResult = await seedCourses(db)
      console.log(`All seed profiles applied: demoAccounts=${demoResult.accounts.length}, demoMoods=${demoResult.moods}, testAssessment=${testResult.assessmentCode}, prompts=${promptResult.count}, courses=${courseResult.count}.`)
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
