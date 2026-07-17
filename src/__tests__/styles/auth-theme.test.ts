import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('auth pages theme alignment', () => {
  it.each(['src/views/auth/Login.vue', 'src/views/auth/Register.vue'])(
    '%s uses global semantic theme variables instead of legacy purple gradient',
    (path) => {
      const source = readSource(path)

      expect(source).not.toContain('#667eea')
      expect(source).not.toContain('#764ba2')
      expect(source).not.toContain('linear-gradient(135deg, #667eea 0%, #764ba2 100%)')
      expect(source).toContain('background: var(--bg-color)')
      expect(source).toContain('background: var(--surface)')
      expect(source).toContain('border-color: var(--focus)')
      expect(source).toContain('background: var(--primary-color)')
      expect(source).toContain('color: var(--primary-color)')
      expect(source).toContain('color: var(--danger)')
    }
  )
})
