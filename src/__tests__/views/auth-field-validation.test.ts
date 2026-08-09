import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import Login from '@/views/auth/Login.vue'
import Register from '@/views/auth/Register.vue'

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => routerMocks,
  useRoute: () => ({ query: {} }),
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a><slot /></a>',
  },
}))

vi.mock('@/utils/request', () => ({
  default: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
  },
}))

const mountAuth = (component: typeof Login | typeof Register) =>
  mount(component, {
    global: {
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a><slot /></a>',
        },
      },
    },
  })

describe('auth field validation accessibility', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    routerMocks.push.mockReset()
  })

  it('shows and clears accessible login field errors after blur and correction', async () => {
    const wrapper = mountAuth(Login)

    await wrapper.find('#username').trigger('blur')
    expect(wrapper.find('#username-error').text()).toBe(
      '用户名需为3-20位，可包含中文、字母、数字或下划线'
    )
    expect(wrapper.find('#username').attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('#username').attributes('aria-describedby')).toBe('username-error')

    await wrapper.find('#username').setValue('student_demo')
    expect(wrapper.find('#username-error').exists()).toBe(false)
    expect(wrapper.find('#username').attributes('aria-invalid')).toBe('false')

    await wrapper.find('#password').trigger('blur')
    expect(wrapper.find('#password-error').text()).toBe('密码长度至少6位')
    await wrapper.find('#password').setValue('password123')
    expect(wrapper.find('#password-error').exists()).toBe(false)
  })

  it('uses the same register validators on blur and submit', async () => {
    const wrapper = mountAuth(Register)

    await wrapper.find('#email').setValue('not-qq@example.com')
    await wrapper.find('#email').trigger('blur')
    expect(wrapper.find('#email-error').text()).toBe('请输入正确的QQ邮箱（例如：123456789@qq.com）')
    expect(wrapper.find('#email').attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('#email').attributes('aria-describedby')).toBe('email-error')

    await wrapper.find('#email').setValue('123456@qq.com')
    expect(wrapper.find('#email-error').exists()).toBe(false)

    await wrapper.find('#password').setValue('password123')
    await wrapper.find('#confirmPassword').setValue('different')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.find('#confirmPassword-error').text()).toBe('两次输入的密码不一致')
  })
})
