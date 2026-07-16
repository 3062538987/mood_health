import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('student-facing feature entrypoints', () => {
  it('exposes search, upload and download controls required by QA', () => {
    const appSource = fs.readFileSync(path.resolve(process.cwd(), 'src/App.vue'), 'utf8')
    const profileSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/views/user/Profile.vue'),
      'utf8'
    )

    expect(appSource).toContain('aria-label="全站搜索"')
    expect(appSource).toContain('handleGlobalSearch')
    expect(profileSource).toContain('type="file"')
    expect(profileSource).toContain('handleAvatarUpload')
    expect(profileSource).toContain('downloadMoodReport')
  })
})
