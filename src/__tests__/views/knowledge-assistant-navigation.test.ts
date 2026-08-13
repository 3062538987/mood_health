import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import App from '@/App.vue'
import { createRoutes } from '@/router'
import { useUserStore } from '@/stores/userStore'

vi.mock('@/api/mood', () => ({
  getMoodRecordList: vi.fn().mockResolvedValue({ list: [], total: 0 }),
}))

vi.mock('@/components/shared/AchievementNotification.vue', () => ({
  default: { template: '<div />' },
}))

vi.mock('@/components/shared/UserNotificationCenter.vue', () => ({
  default: { name: 'UserNotificationCenter', template: '<div />' },
}))

describe('unified AI psychological assistant navigation', () => {
  it('exposes one assistant entry that opens the counseling window', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/counseling', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    await router.isReady()

    const pinia = createPinia()
    const userStore = useUserStore(pinia)
    userStore.user = {
      id: 7,
      username: 'student',
      role: 'student',
      email: 'student@example.com',
    }
    userStore.token = 'session-token'
    const wrapper = mount(App, { global: { plugins: [pinia, router] } })

    expect(wrapper.findAll('.nav-assistant-link')).toHaveLength(1)
    expect(wrapper.text()).toContain('AI 心理助手')

    await wrapper.get('.nav-assistant-link').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/counseling')
  })

  it('revives the knowledge assistant route as a standalone page', () => {
    const route = createRoutes().find((item) => item.path === '/ai/knowledge-assistant')

    expect(route).toBeDefined()
    expect(route?.name).toBe('KnowledgeAssistant')
    // 不再重定向到咨询页：知识助手是独立可达的页面
    expect(route?.beforeEnter).toBeUndefined()
    // 组件为懒加载函数（指向 KnowledgeAssistant.vue）
    expect(typeof route?.component).toBe('function')
  })
})
