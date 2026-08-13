import dotenv from 'dotenv'
import { RowDataPacket } from 'mysql2'
import bcrypt from 'bcryptjs'
import { closeMysqlPool, getMysqlPool } from '../config/mysql'
import { createUserRepository } from '../repositories/userRepository'
import { comparePassword } from '../utils/password'

dotenv.config()

const run = async () => {
  const connection = await getMysqlPool().getConnection()
  try {
    await connection.query('SET SESSION TRANSACTION READ ONLY')
    const [summary] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS moodCount,
              COUNT(DISTINCT DATE(m.recorded_at)) AS daysCovered,
              MIN(DATE(m.recorded_at)) AS firstDay,
              MAX(DATE(m.recorded_at)) AS lastDay,
              ROUND(AVG(me.intensity), 2) AS averageScore
       FROM moods m
       INNER JOIN users u ON u.id = m.user_id
       INNER JOIN mood_emotions me ON me.mood_id = m.id AND me.is_primary = 1
       WHERE u.username = ?`,
      ['demo_support_admin']
    )
    const [accountRows] = await connection.query<RowDataPacket[]>(
      `SELECT u.password_hash AS passwordHash, u.status, r.code AS role
       FROM users u INNER JOIN roles r ON r.id = u.role_id
       WHERE u.username = ? LIMIT 1`,
      ['demo_support_admin']
    )
    const [lowPeriod] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS lowDays,
              MAX(me.intensity) AS highestScore,
              MIN(DATE(m.recorded_at)) AS firstDay,
              MAX(DATE(m.recorded_at)) AS lastDay
       FROM moods m
       INNER JOIN users u ON u.id = m.user_id
       INNER JOIN mood_emotions me ON me.mood_id = m.id AND me.is_primary = 1
       WHERE u.username = ?
         AND DATE(m.recorded_at) BETWEEN
             DATE_SUB((SELECT MAX(DATE(m2.recorded_at)) FROM moods m2 WHERE m2.user_id = u.id), INTERVAL 48 DAY)
             AND
             DATE_SUB((SELECT MAX(DATE(m3.recorded_at)) FROM moods m3 WHERE m3.user_id = u.id), INTERVAL 42 DAY)`,
      ['demo_support_admin']
    )
    const passwordMatches = accountRows[0]
      ? await bcrypt.compare(process.env.DEMO_PASSWORD ?? '', String(accountRows[0].passwordHash))
      : false
    const repositoryUser = await createUserRepository().findAuthUserByUsername('demo_support_admin')
    const applicationPasswordMatches = repositoryUser
      ? await comparePassword(process.env.DEMO_PASSWORD ?? '', repositoryUser.passwordHash)
      : false
    console.log(
      JSON.stringify(
        {
          account: accountRows[0]
            ? {
                role: accountRows[0].role,
                status: accountRows[0].status,
                passwordMatches,
                repositoryFound: Boolean(repositoryUser),
                applicationPasswordMatches,
              }
            : null,
          summary: summary[0],
          lowPeriod: lowPeriod[0],
        },
        null,
        2
      )
    )
  } finally {
    connection.release()
    await closeMysqlPool()
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
