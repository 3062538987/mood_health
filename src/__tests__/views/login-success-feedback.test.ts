import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import Login from '@/views/auth/Login.vue'
import request from '@/utils/request'
import { ElMessage } from 'element-plus'

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  routeQuery: {} as Record<string, unknown>,
}))

vi.mock('vue-router', () => ({
  useRouter: () => routerMocks,
  useRoute: () => ({ query: routerMocks.routeQuery }),
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

const requestMock = vi.mocked(request)
const messageSuccessMock = vi.mocked(ElMessage.success)

const mountLogin = () =>
  mount(Login, {
    global: {
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a><slot /></a>',
        },
      },
    },
  })

describe('Login success feedback', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    routerMocks.push.mockReset()
    routerMocks.routeQuery = {}
    requestMock.mockReset()
    messageSuccessMock.mockReset()
    localStorage.clear()
  })

  it('shows one lightweight success message before first-use guide when guide is incomplete', async () => {
    requestMock.mockResolvedValueOnce({
      token: 'jwt-token',
      user: { id: 1, username: 'student_demo', email: 'student@qq.com', role: 'user' },
    })
    const wrapper = mountLogin()

    await wrapper.find('#username').setValue('student_demo')
    await wrapper.find('#password').setValue('password123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(messageSuccessMock).toHaveBeenCalledTimes(1)
    expect(messageSuccessMock).toHaveBeenCalledWith('登录成功')
    expect(routerMocks.push).toHaveBeenCalledWith('/guide')
  })

  it.each([
    ['/mood/archive?range=week&tab=all', '/mood/archive?range=week&tab=all'],
    ['/mood/archive?keyword=%E5%AD%A6%E4%B9%A0&from=401', '/mood/archive?keyword=%E5%AD%A6%E4%B9%A0&from=401'],
    ['/user/profile/security', '/user/profile/security'],
  ])('returns to a safe internal redirect after login: %s', async (redirect, expected) => {
    localStorage.setItem('guideCompleted', 'true')
    routerMocks.routeQuery = { redirect }
    requestMock.mockResolvedValueOnce({
      token: 'jwt-token',
      user: { id: 1, username: 'student_demo', email: 'student@qq.com', role: 'user' },
    })
    const wrapper = mountLogin()

    await wrapper.find('#username').setValue('student_demo')
    await wrapper.find('#password').setValue('password123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(routerMocks.push).toHaveBeenCalledWith(expected)
  })

  it.each(['https://evil.example/mood/archive', '//evil.example/mood/archive'])(
    'rejects unsafe post-login redirect: %s',
    async (redirect) => {
      localStorage.setItem('guideCompleted', 'true')
      routerMocks.routeQuery = { redirect }
      requestMock.mockResolvedValueOnce({
        token: 'jwt-token',
        user: { id: 1, username: 'student_demo', email: 'student@qq.com', role: 'user' },
      })
      const wrapper = mountLogin()

      await wrapper.find('#username').setValue('student_demo')
      await wrapper.find('#password').setValue('password123')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(routerMocks.push).toHaveBeenCalledWith('/')
    }
  )

  it('prevents duplicate login requests while the first login is pending', async () => {
    let resolveLogin!: (value: unknown) => void
    requestMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLogin = resolve
      })
    )
    const wrapper = mountLogin()

    await wrapper.find('#username').setValue('student_demo')
    await wrapper.find('#password').setValue('password123')
    await wrapper.find('form').trigger('submit')
    await wrapper.find('form').trigger('submit')

    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.btn-login').attributes('disabled')).toBeDefined()

    resolveLogin({
      token: 'jwt-token',
      user: { id: 1, username: 'student_demo', email: 'student@qq.com', role: 'user' },
    })
  })
})
