import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('auth pages theme alignment', () => {
  it.each(['src/views/auth/Login.vue', 'src/views/auth/Register.vue'])(
    '%s uses sunset garden warm theme variables instead of legacy purple gradient',
    (path) => {
      const source = readSource(path)

      // 不应残留旧紫色渐变
      expect(source).not.toContain('#667eea')
      expect(source).not.toContain('#764ba2')
      expect(source).not.toContain('linear-gradient(135deg, #667eea 0%, #764ba2 100%)')
      // 应使用暖色主题变量
      expect(source).toContain('var(--bg-color)')
      expect(source).toContain('var(--surface)')
      expect(source).toContain('var(--primary-color)')
      expect(source).toContain('var(--accent-color)')
      expect(source).toContain('var(--text-color)')
      expect(source).toContain('var(--font-display)')
    }
  )
})
