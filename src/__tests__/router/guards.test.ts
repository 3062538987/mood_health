import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { getRouteRedirect, initializeUserState, shouldRedirectToGuide } from '@/router/guards'

const createRoute = (overrides: Partial<RouteLocationNormalized> = {}) =>
  ({
    path: '/',
    matched: [],
    meta: {},
    ...overrides,
  }) as RouteLocationNormalized

const createUserStore = (overrides = {}) => ({
  token: '',
  user: null,
  isLoggedIn: false,
  isAdmin: false,
  fetchUserInfo: vi.fn().mockResolvedValue(true),
  ...overrides,
})

describe('router guards', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('initializeUserState', () => {
    it('在存在 token 且用户信息未加载时拉取用户信息', async () => {
      const userStore = createUserStore({ token: 'token-value' })

      await initializeUserState(userStore as never)

      expect(userStore.fetchUserInfo).toHaveBeenCalledTimes(1)
    })

    it('在没有 token 时不拉取用户信息', async () => {
      const userStore = createUserStore()

      await initializeUserState(userStore as never)

      expect(userStore.fetchUserInfo).not.toHaveBeenCalled()
    })
  })

  describe('shouldRedirectToGuide', () => {
    it('首次进入首页且未完成引导时跳转到引导页', () => {
      const to = createRoute({ path: '/' })
      const from = createRoute({ matched: [] })

      expect(shouldRedirectToGuide(to, from)).toBe(true)
    })

    it('引导已完成时不再跳转', () => {
      localStorage.setItem('guideCompleted', '1')
      const to = createRoute({ path: '/' })
      const from = createRoute({ matched: [] })

      expect(shouldRedirectToGuide(to, from)).toBe(false)
    })

    it('站内正常跳回首页时不跳转', () => {
      const to = createRoute({ path: '/' })
      const from = createRoute({
        matched: [{} as RouteLocationNormalized['matched'][number]],
      })

      expect(shouldRedirectToGuide(to, from)).toBe(false)
    })
  })

  describe('getRouteRedirect', () => {
    it('未登录访问受保护页面时跳转到登录页', () => {
      const to = createRoute({ path: '/mood/archive', meta: {} })

      expect(getRouteRedirect(to, createUserStore() as never)).toBe('/login')
    })

    it('已登录访问仅游客页面时跳转到首页', () => {
      const to = createRoute({
        path: '/login',
        meta: { public: true, guestOnly: true },
      })

      expect(
        getRouteRedirect(to, createUserStore({ isLoggedIn: true, user: { id: 1 } }) as never)
      ).toBe('/')
    })

    it('非管理员访问管理员页面时跳转到首页', () => {
      const to = createRoute({
        path: '/admin',
        meta: { adminOnly: true },
      })

      expect(
        getRouteRedirect(to, createUserStore({ isLoggedIn: true, user: { id: 1 } }) as never)
      ).toBe('/')
    })

    it('管理员访问管理员页面时允许通过', () => {
      const to = createRoute({
        path: '/admin',
        meta: { adminOnly: true },
      })

      expect(
        getRouteRedirect(
          to,
          createUserStore({ isLoggedIn: true, isAdmin: true, user: { id: 1 } }) as never
        )
      ).toBeNull()
    })

    it('已登录用户访问普通公开页面时允许通过', () => {
      const to = createRoute({
        path: '/guide',
        meta: { public: true },
      })

      expect(
        getRouteRedirect(to, createUserStore({ isLoggedIn: true, user: { id: 1 } }) as never)
      ).toBeNull()
    })
  })
})
