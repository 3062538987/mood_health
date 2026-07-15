import { readMysqlConfig, readMysqlMigratorConfig } from '../../../src/config/mysql'

const validEnv = {
  MYSQL_HOST: '127.0.0.1',
  MYSQL_PORT: '3306',
  MYSQL_DATABASE: 'mood_health',
  MYSQL_APP_USER: 'mood_app',
  MYSQL_APP_PASSWORD: 'test-password',
}

describe('MySQL configuration', () => {
  it('reads the required settings and applies conservative pool defaults', () => {
    expect(readMysqlConfig(validEnv)).toEqual({
      host: '127.0.0.1',
      port: 3306,
      database: 'mood_health',
      user: 'mood_app',
      password: 'test-password',
      connectionLimit: 10,
      connectTimeoutMs: 5000,
      queryTimeoutMs: 5000,
    })
  })

  it.each(['MYSQL_HOST', 'MYSQL_DATABASE', 'MYSQL_APP_USER', 'MYSQL_APP_PASSWORD'])(
    'rejects a missing %s setting',
    (key) => {
      expect(() => readMysqlConfig({ ...validEnv, [key]: '' })).toThrow(
        `缺少必要的 MySQL 环境变量: ${key}`
      )
    }
  )

  it('rejects invalid numeric settings', () => {
    expect(() => readMysqlConfig({ ...validEnv, MYSQL_PORT: '70000' })).toThrow(
      'MYSQL_PORT 必须是 1-65535 的整数'
    )
    expect(() => readMysqlConfig({ ...validEnv, MYSQL_POOL_LIMIT: '31' })).toThrow(
      'MYSQL_POOL_LIMIT 必须是 1-30 的整数'
    )
  })

  it('uses dedicated migrator credentials for schema changes', () => {
    expect(
      readMysqlMigratorConfig({
        ...validEnv,
        MYSQL_MIGRATOR_USER: 'mood_migrator',
        MYSQL_MIGRATOR_PASSWORD: 'migrator-password',
      })
    ).toMatchObject({
      user: 'mood_migrator',
      password: 'migrator-password',
    })
  })
})
