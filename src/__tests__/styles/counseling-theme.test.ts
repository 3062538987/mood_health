import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Counseling page semantic theme alignment', () => {
  it('uses global semantic colors for chat chrome, bubbles, errors, and focus', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/counseling/Counseling.vue'), 'utf8')

    expect(source).not.toContain('--primary: #b996d8')
    expect(source).not.toContain('--primary-strong: #a57dca')
    expect(source).not.toContain('#f0ddff')
    expect(source).not.toContain('#dcc2f1')
    expect(source).not.toContain('rgba(185, 150, 216')
    expect(source).not.toContain('linear-gradient(120deg, var(--primary), var(--primary-strong))')
    expect(source).toContain('--chat-user-bubble: var(--primary-soft-bg)')
    expect(source).toContain('background: var(--bg-color)')
    expect(source).toContain('background: var(--surface)')
    expect(source).toContain('border: 1px solid var(--border-color)')
    expect(source).toContain('background: var(--primary-color)')
    expect(source).toContain('border-color: var(--focus)')
    expect(source).toContain('color: var(--danger)')
  })
})
