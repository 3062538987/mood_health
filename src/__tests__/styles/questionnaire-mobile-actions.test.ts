import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Questionnaire mobile action bar', () => {
  it('keeps answer actions reachable on small screens without covering content', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/improve/Questionnaire.vue'), 'utf8')

    expect(source).toContain('@media (max-width: 768px)')
    expect(source).toContain('padding-bottom: calc(96px + env(safe-area-inset-bottom))')
    expect(source).toContain('position: sticky')
    expect(source).toContain('bottom: 0')
    expect(source).toContain('z-index: 10')
    expect(source).toContain('padding: 12px 0 calc(12px + env(safe-area-inset-bottom))')
    expect(source).toContain('border-top: 1px solid var(--border-color)')
    expect(source).toContain('background: var(--surface)')
  })
})
