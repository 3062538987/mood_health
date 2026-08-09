import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import Register from '@/views/auth/Register.vue'
import { useUserStore } from '@/stores/userStore'

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a><slot /></a>',
  },
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
  },
}))

vi.mock('@/utils/request', () => ({
  default: vi.fn(),
}))

const mountRegister = () =>
  mount(Register, {
    global: {
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a><slot /></a>',
        },
      },
    },
  })

describe('Register error feedback', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows only the field validation error when stale server error also exists', async () => {
    const store = useUserStore()
    store.error = '用户名已存在'
    const wrapper = mountRegister()

    await wrapper.find('#password').setValue('password123')
    await wrapper.find('#confirmPassword').setValue('different')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.find('.form-error-message').exists()).toBe(false)
    expect(wrapper.find('#confirmPassword-error').text()).toBe('两次输入的密码不一致')
  })

  it('clears stale server error when the user edits a field', async () => {
    const store = useUserStore()
    store.error = '用户名已存在'
    const wrapper = mountRegister()

    expect(wrapper.find('.error-message').text()).toBe('用户名已存在')

    await wrapper.find('#username').setValue('new_student')

    expect(store.error).toBe('')
    expect(wrapper.find('.error-message').exists()).toBe(false)
  })
})
