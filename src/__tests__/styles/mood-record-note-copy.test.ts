import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('MoodRecord note placeholder copy', () => {
  it('uses the shortened guidance and keeps small-screen placeholder styling', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/mood/MoodRecord.vue'), 'utf8')

    expect(source).toContain('placeholder="从一件小事开始：今天什么时候开始觉得不舒服？"')
    expect(source).not.toContain('可以从一件小事开始：今天什么时候开始觉得不舒服，或哪一刻突然轻松了？')
    expect(source).toContain('textarea::placeholder')
    expect(source).toContain('@media (max-width: 768px)')
  })
})
