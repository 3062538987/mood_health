import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MoodLayout from '@/views/mood/MoodLayout.vue'

const routeState = vi.hoisted(() => ({
  meta: {
    subNav: [] as Array<{ path: string; name: string; icon: string }>,
  },
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
}))

describe('MoodLayout navigation', () => {
  beforeEach(() => {
    routeState.meta.subNav = []
  })

  it('uses typed route sub navigation and keeps the analysis item filtered out', () => {
    routeState.meta.subNav = [
      { path: '/mood/record', name: '记录', icon: 'record-icon' },
      { path: '/mood/analysis', name: '分析', icon: 'analysis-icon' },
      { path: '/mood/archive', name: '档案', icon: 'archive-icon' },
    ]

    const wrapper = mount(MoodLayout, {
      global: {
        stubs: {
          SubNav: {
            props: ['items'],
            template: '<nav><span v-for="item in items" :key="item.path">{{ item.name }}</span></nav>',
          },
          RouterView: true,
        },
      },
    })

    expect(wrapper.text()).toContain('记录')
    expect(wrapper.text()).toContain('档案')
    expect(wrapper.text()).not.toContain('分析')
  })
})
