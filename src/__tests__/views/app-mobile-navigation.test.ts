import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import App from '@/App.vue'
import { useUserStore } from '@/stores/userStore'

vi.mock('@/api/mood', () => ({
  getMoodRecordList: vi.fn(),
}))

vi.mock('@/utils/request', () => ({
  default: vi.fn(),
}))

const routeState = vi.hoisted(() => ({
  path: '/',
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: {
    name: 'RouterLink',
    props: ['to', 'activeClass', 'end'],
    template: '<a :href="typeof to === `string` ? to : to.path"><slot /></a>',
  },
  RouterView: {
    name: 'RouterView',
    template: '<div />',
  },
}))

vi.mock('@/components/shared/AchievementNotification.vue', () => ({
  default: {
    name: 'AchievementNotification',
    template: '<div />',
  },
}))

vi.mock('@/components/shared/UserNotificationCenter.vue', () => ({
  default: { name: 'UserNotificationCenter', template: '<div />' },
}))

const mountApp = () =>
  mount(App, {
    attachTo: document.body,
    global: {
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a :href="typeof to === `string` ? to : to.path"><slot /></a>',
        },
        RouterView: {
          template: '<div />',
        },
      },
    },
  })

describe('App mobile navigation', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    localStorage.clear()
    routeState.path = '/'
    setActivePinia(createPinia())
  })

  it('shows exactly five primary mobile entries for standard users', () => {
    const wrapper = mountApp()

    const mobileNav = wrapper.get('.mobile-tab-bar')
    const primaryEntries = mobileNav.findAll('.tab-item')

    expect(primaryEntries).toHaveLength(5)
    expect(primaryEntries.map((entry) => entry.text())).toEqual([
      '首页',
      '情绪',
      '放松',
      '提升',
      '更多',
    ])
    expect(mobileNav.text()).not.toContain('管理后台')
  })

  it('keeps profile and admin links inside the accessible more menu', async () => {
    const userStore = useUserStore()
    userStore.user = {
      id: 1,
      username: 'admin',
      role: 'admin',
      email: 'admin@example.com',
    }
    userStore.token = 'token'
    routeState.path = '/admin'

    const wrapper = mountApp()
    const moreButton = wrapper.get<HTMLButtonElement>('.mobile-more-button')

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)

    await moreButton.trigger('click')

    const moreMenu = wrapper.get('[role="menu"]')
    expect(moreButton.attributes('aria-expanded')).toBe('true')
    expect(moreMenu.text()).toContain('我的')
    expect(moreMenu.text()).toContain('管理后台')
  })

  it('closes the more menu with Escape and restores focus to the trigger', async () => {
    const wrapper = mountApp()
    const moreButton = wrapper.get<HTMLButtonElement>('.mobile-more-button')

    await moreButton.trigger('click')
    expect(wrapper.find('[role="menu"]').exists()).toBe(true)

    await moreButton.trigger('keydown', { key: 'Escape' })
    await nextTick()

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(moreButton.element)
  })

  it('closes the more menu when clicking outside it', async () => {
    const wrapper = mountApp()
    const moreButton = wrapper.get<HTMLButtonElement>('.mobile-more-button')

    await moreButton.trigger('click')
    expect(wrapper.find('[role="menu"]').exists()).toBe(true)

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })
})
