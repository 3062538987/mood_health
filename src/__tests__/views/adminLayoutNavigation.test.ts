import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import AdminLayout from '@/views/admin/AdminLayout.vue'

const adminLayoutSource = readFileSync(
  path.resolve(process.cwd(), 'src/views/admin/AdminLayout.vue'),
  'utf8'
)
const routerSource = readFileSync(path.resolve(process.cwd(), 'src/router/index.ts'), 'utf8')

const navigationState = vi.hoisted(() => ({
  route: {
    path: '/admin/dashboard',
    matched: [
      {
        path: '/admin',
        meta: {
          subNav: [
            { path: '/admin/dashboard', name: '管理首页', icon: 'dashboard-icon' },
            { path: '/admin/users', name: '用户管理', icon: 'users-icon' },
            { path: '/admin/assessments', name: '测评管理', icon: 'assessment-icon' },
            { path: '/admin/cases', name: '风险个案', icon: 'case-icon' },
            { path: '/admin/missing', name: '失效入口', icon: 'missing-icon' },
          ],
        },
      },
    ],
  },
  routes: new Map<string, { name?: string; meta: Record<string, unknown> }>(),
  push: vi.fn(),
  userStore: {
    user: { id: 1, username: 'admin', email: 'admin@example.com', role: 'admin' },
    username: 'admin',
    isLoggedIn: true,
    logoutInProgress: false,
    logout: vi.fn(),
  },
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRoute: () => navigationState.route,
    useRouter: () => ({
      push: navigationState.push,
      resolve: (path: string) => {
        const resolved = navigationState.routes.get(path)
        if (!resolved) {
          return {
            name: 'NotFound',
            path,
            matched: [{ path: '/:pathMatch(.*)*', name: 'NotFound', meta: {} }],
          }
        }
        return {
          name: resolved.name,
          path,
          matched: [
            { path: '/admin', meta: navigationState.route.matched[0].meta },
            { path, meta: resolved.meta },
          ],
        }
      },
    }),
  }
})

vi.mock('@/stores/userStore', () => ({
  useUserStore: () => navigationState.userStore,
}))

describe('AdminLayout navigation', () => {
  beforeEach(() => {
    navigationState.routes = new Map([
      [
        '/admin/dashboard',
        { meta: { roles: ['admin', 'super_admin'], permission: 'user.manage' } },
      ],
      ['/admin/users', { meta: { roles: ['super_admin'], permission: 'user.manage' } }],
      [
        '/admin/assessments',
        { meta: { roles: ['admin', 'super_admin'], permission: 'user.manage' } },
      ],
      [
        '/admin/cases',
        { meta: { roles: ['admin', 'super_admin'], permission: 'case.read_assigned' } },
      ],
    ])
  })

  it('only renders resolvable entries allowed by the current route contract', () => {
    const wrapper = mount(AdminLayout, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a class="nav-item" :href="to"><slot /></a>',
          },
          RouterView: true,
          Transition: false,
        },
      },
    })

    const links = wrapper.findAll('.sidebar-nav .nav-item')
    expect(links.map((link) => link.attributes('href'))).toEqual([
      '/admin/dashboard',
      '/admin/assessments',
      '/admin/cases',
    ])
    expect(wrapper.text()).not.toContain('用户管理')
    expect(wrapper.text()).not.toContain('失效入口')
  })

  it('renders child routes without an out-in page transition', () => {
    expect(adminLayoutSource).toContain('class="admin-route-content"')
    expect(adminLayoutSource).not.toContain('mode="out-in"')
    expect(adminLayoutSource).not.toContain('name="fade-slide"')
  })

  it('does not expose the retired post moderation route', () => {
    expect(routerSource).not.toContain("path: '/admin/posts'")
    expect(routerSource).not.toContain("name: '帖子审核'")
    expect(routerSource).not.toContain("path: 'posts'")
    expect(routerSource).not.toContain("import('@/views/admin/Posts.vue')")
    expect(routerSource).toContain("name: '树洞审核'")
  })
})
