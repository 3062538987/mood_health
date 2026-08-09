interface Environment {
  [key: string]: string | undefined
}

export const readE2eDatabaseName = (env: Environment = process.env): string =>
  env.E2E_MYSQL_DATABASE?.trim() || 'mood_health_e2e'
