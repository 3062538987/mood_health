import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('student-facing feature entrypoints', () => {
  it('exposes user profile and settings controls required by QA', () => {
    const appSource = fs.readFileSync(path.resolve(process.cwd(), 'src/App.vue'), 'utf8')
    const profileSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/views/user/Profile.vue'),
      'utf8'
    )

    expect(appSource).toContain('nav-links')
    expect(profileSource).toContain('displayUsername')
    expect(profileSource).toContain('goToSetting')
    expect(profileSource).toContain('emotionScore')
  })
})
