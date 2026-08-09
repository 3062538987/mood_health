import { readE2eDatabaseName } from '../../../src/db/e2eDatabaseBootstrap'

describe('E2E database bootstrap', () => {
  it('does not let the development database override the isolated E2E database', () => {
    expect(readE2eDatabaseName({ MYSQL_DATABASE: 'mood_health' })).toBe('mood_health_e2e')
    expect(readE2eDatabaseName({ E2E_MYSQL_DATABASE: 'mood_health_e2e_custom' })).toBe(
      'mood_health_e2e_custom'
    )
  })

})
