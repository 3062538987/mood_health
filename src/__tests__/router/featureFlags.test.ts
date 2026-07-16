import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { getFeatureFlags } from '@/config/featureFlags'
import { createRoutes } from '@/router'

const findRoute = (routes: readonly RouteRecordRaw[], path: string): RouteRecordRaw | undefined => {
  for (const route of routes) {
    if (route.path === path) {
      return route
    }
    const child = route.children ? findRoute(route.children, path) : undefined
    if (child) {
      return child
    }
  }
  return undefined
}

describe('frontend feature flags', () => {
  it('keeps non-core modules enabled by default', () => {
    expect(getFeatureFlags({})).toEqual({ nonCoreModules: true })
  })

  it.each(['true', '1', 'yes', 'on', ' TRUE '])('ignores the retired enable value %s', (value) => {
    expect(getFeatureFlags({ VITE_FEATURE_NON_CORE_MODULES_ENABLED: value })).toEqual({
      nonCoreModules: true,
    })
  })
})

describe('feature-aware routes', () => {
  it('removes non-core routes and navigation metadata when disabled', () => {
    const routes = createRoutes({ nonCoreModules: false })
    const improveRoute = findRoute(routes, '/improve')
    const adminRoute = findRoute(routes, '/admin')

    expect(findRoute(routes, '/relax')).toBeUndefined()
    expect(findRoute(routes, 'group')).toBeUndefined()
    expect(findRoute(routes, 'group/:id')).toBeUndefined()
    expect(findRoute(routes, 'knowledge')).toBeUndefined()
    expect(findRoute(routes, 'courses')).toBeUndefined()
    expect(findRoute(routes, 'course/:id')).toBeUndefined()
    expect(findRoute(routes, 'posts')).toBeUndefined()
    expect(findRoute(routes, 'music')).toBeUndefined()
    expect(improveRoute?.redirect).toBe('/improve/survey')
    expect(improveRoute?.meta?.subNav).toEqual([
      { path: '/improve/survey', name: '问卷调查', icon: 'fas fa-clipboard-list' },
    ])
    expect((adminRoute?.meta?.subNav as Array<{ path: string }>).map((item) => item.path)).toEqual([
      '/admin/dashboard',
      '/admin/users',
      '/admin/user-moods',
      '/admin/moods',
      '/admin/audit-logs',
      '/admin/cases',
    ])
  })

  it('keeps non-core routes when enabled', () => {
    const routes = createRoutes({ nonCoreModules: true })

    expect(findRoute(routes, '/relax')).toBeDefined()
    expect(findRoute(routes, 'group')).toBeDefined()
    expect(findRoute(routes, 'knowledge')).toBeDefined()
    expect(findRoute(routes, 'courses')).toBeDefined()
    expect(findRoute(routes, 'posts')).toBeDefined()
    expect(findRoute(routes, 'music')).toBeDefined()
  })

  it.each([
    '/relax',
    '/improve/group',
    '/improve/knowledge',
    '/improve/courses',
    '/admin/posts',
    '/admin/music',
  ])(
    'resolves disabled URL %s to the catch-all route without loading its page',
    (path) => {
      const router = createRouter({
        history: createMemoryHistory(),
        routes: createRoutes({ nonCoreModules: false }),
      })

      const matched = router.resolve(path).matched
      expect(matched[matched.length - 1]?.name).toBe('NotFound')
    }
  )

  it.each(['/mood/record', '/improve/survey', '/user/profile', '/admin/users'])(
    'keeps core URL %s available',
    (path) => {
      const router = createRouter({
        history: createMemoryHistory(),
        routes: createRoutes({ nonCoreModules: false }),
      })

      const matched = router.resolve(path).matched
      expect(matched[matched.length - 1]?.name).not.toBe('NotFound')
    }
  )
})
