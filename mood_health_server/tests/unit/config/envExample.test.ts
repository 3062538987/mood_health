import fs from 'node:fs'
import path from 'node:path'

describe('.env.example', () => {
  it('documents the Redis variables read by the runtime client', () => {
    const envExample = fs.readFileSync(path.resolve(__dirname, '../../../.env.example'), 'utf8')

    expect(envExample).toContain('REDIS_URL=')
    expect(envExample).toContain('REDIS_PASSWORD=')
  })
})
