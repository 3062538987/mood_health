import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()
const readSource = (path: string) => readFileSync(resolve(projectRoot, path), 'utf8')

describe('semantic theme color system', () => {
  it('defines global semantic color variables with dark-mode overrides', () => {
    const themeSource = readSource('src/assets/styles/theme.scss')

    expect(themeSource).toContain('--primary:')
    expect(themeSource).toContain('--primary-hover:')
    expect(themeSource).toContain('--surface:')
    expect(themeSource).toContain('--danger:')
    expect(themeSource).toContain('--focus:')
    expect(themeSource).toContain('--muted:')
    expect(themeSource).toContain('--mood-theme-low:')
    expect(themeSource).toContain('--mood-theme-calm:')
    expect(themeSource).toContain('--mood-theme-high:')

    const darkModeSource = themeSource.slice(themeSource.indexOf('@media (prefers-color-scheme: dark)'))
    expect(darkModeSource).toContain('--primary:')
    expect(darkModeSource).toContain('--surface:')
    expect(darkModeSource).toContain('--focus:')
  })

  it('keeps App dynamic mood theme tied to semantic CSS variables instead of raw color literals', () => {
    const appSource = readSource('src/App.vue')

    expect(appSource).toContain("return 'var(--mood-theme-low)'")
    expect(appSource).toContain("return 'var(--mood-theme-calm)'")
    expect(appSource).toContain("return 'var(--mood-theme-high)'")
    expect(appSource).not.toContain("return '#B7A9A1'")
    expect(appSource).not.toContain("return '#A7C7E7'")
    expect(appSource).not.toContain("return '#F9D56E'")
  })
})
