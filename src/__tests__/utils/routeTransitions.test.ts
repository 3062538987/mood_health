import { describe, expect, it } from 'vitest'
import { shouldAnimateRoute } from '@/utils/routeTransitions'

describe('routeTransitions', () => {
  it('does not animate switches inside the admin console', () => {
    expect(shouldAnimateRoute('/admin/dashboard')).toBe(false)
    expect(shouldAnimateRoute('/admin/knowledge')).toBe(false)
  })

  it('keeps normal transitions outside the admin console', () => {
    expect(shouldAnimateRoute('/mood/record')).toBe(true)
  })
})
