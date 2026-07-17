import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import request from '@/utils/request'
import { useUserStore } from '@/stores/userStore'

vi.mock('@/utils/request', () => ({
  default: vi.fn(),
}))

const requestMock = vi.mocked(request)
const user = {
  id: 1,
  username: 'student_demo',
  email: 'student@example.com',
  role: 'user',
}

describe('userStore authentication contract', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    requestMock.mockReset()
  })

  it('stores the token and user returned by the unwrapped login DTO', async () => {
    requestMock.mockResolvedValueOnce({ token: 'jwt-token', user })
    const store = useUserStore()

    await expect(store.login('student_demo', 'password123')).resolves.toBe(true)

    expect(store.token).toBe('jwt-token')
    expect(store.user).toEqual(user)
    expect(localStorage.getItem('token')).toBe('jwt-token')
  })

  it('restores the current user directly from the unwrapped /me DTO', async () => {
    localStorage.setItem('token', 'persisted-token')
    requestMock.mockResolvedValueOnce({ user })
    const store = useUserStore()

    await expect(store.fetchUserInfo()).resolves.toBe(true)

    expect(store.user).toEqual(user)
    expect(store.isLoggedIn).toBe(true)
  })

  it('clears an invalid persisted login when /me fails', async () => {
    localStorage.setItem('token', 'expired-token')
    requestMock.mockRejectedValueOnce(new Error('登录已过期，请重新登录'))
    const store = useUserStore()

    await expect(store.fetchUserInfo()).resolves.toBe(false)

    expect(store.token).toBe('')
    expect(store.user).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('shows the normalized request error message on login failure', async () => {
    requestMock.mockRejectedValueOnce(new Error('用户名或密码错误'))
    const store = useUserStore()

    await expect(store.login('student_demo', 'wrong-password')).resolves.toBe(false)

    expect(store.error).toBe('用户名或密码错误')
  })

  it('clears stale auth errors on demand', async () => {
    requestMock.mockRejectedValueOnce(new Error('用户名已存在'))
    const store = useUserStore()

    await expect(store.register('student_demo', 'password123', 'student@qq.com')).resolves.toBe(
      false
    )
    expect(store.error).toBe('用户名已存在')

    store.clearError()

    expect(store.error).toBe('')
  })
})
