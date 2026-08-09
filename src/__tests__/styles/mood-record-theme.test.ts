import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('MoodRecord semantic theme alignment', () => {
  it('uses semantic variables for page chrome, controls, focus, and borders', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/mood/MoodRecord.vue'), 'utf8')

    expect(source).not.toContain('#8b9dc3')
    expect(source).not.toContain('#c49a6c')
    expect(source).not.toContain('#fdf8f2')
    expect(source).not.toContain('#e8e2d8')
    expect(source).not.toContain('rgba(196, 154, 108')
    expect(source).toContain('background: var(--bg-color)')
    expect(source).toContain('border: 1px solid var(--border-color)')
    expect(source).toContain('border-color: var(--focus)')
    expect(source).toContain('background: var(--primary-color)')
    expect(source).toContain('accent-color: var(--primary-color)')
  })
})
