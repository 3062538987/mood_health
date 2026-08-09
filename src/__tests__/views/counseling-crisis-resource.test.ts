import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import Counseling from '@/views/counseling/Counseling.vue'

const UNVERIFIED_AVAILABILITY_CLAIM =
  /12356.{0,20}24\s*小时|24\s*小时.{0,20}12356/s
const UNSAFE_AVAILABILITY_FIXTURE = '全国统一心理援助热线：12356（24 小时）'

vi.mock('@/api/counseling', () => ({
  getSessions: vi.fn().mockResolvedValue([]),
  loadSessionMessages: vi.fn().mockResolvedValue([]),
  renameSession: vi.fn(),
  sendSessionCounselingMessage: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
  ElMessageBox: {
    confirm: vi.fn(),
  },
}))

describe('Counseling crisis resource', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('detects an explicit unsafe 12356 availability fixture', () => {
    expect(UNSAFE_AVAILABILITY_FIXTURE).toMatch(UNVERIFIED_AVAILABILITY_CLAIM)
  })

  it('links the official national 12356 line without old or universal 24-hour claims', () => {
    const wrapper = mount(Counseling, {
      global: {
        stubs: {
          ElInput: true,
          ElButton: true,
        },
      },
    })

    const link = wrapper.get('.emergency-number[href="tel:12356"]')
    expect(link.text()).toContain('全国统一心理援助热线：12356')
    expect(wrapper.text()).toContain('110/120')
    expect(wrapper.text()).toContain('信任的人')
    expect(wrapper.text()).not.toMatch(UNVERIFIED_AVAILABILITY_CLAIM)
    expect(wrapper.text()).not.toMatch(/400-161-9995|010-82951332|全国24\s*小时/)
  })
})
