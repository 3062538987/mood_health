import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('App logout navigation', () => {
  it('replaces history with the login route after logout', () => {
    const appSource = fs.readFileSync(path.resolve(process.cwd(), 'src/App.vue'), 'utf8')

    expect(appSource).toContain("router.push('/login')")
  })
})
