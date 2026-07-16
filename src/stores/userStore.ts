import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import request from '@/utils/request'

export interface User {
  id: number
  username: string
  email: string
  role?: string
  avatar?: string
  created_at?: string
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback

// 安全: Token 通过 HttpOnly Cookie 存储，Pinia 中仅保留内存副本用于 UI 状态判断 (VUE-AUTH-001)
export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const token = ref<string>('')
  const loading = ref(false)
  const error = ref<string>('')

  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const username = computed(() => user.value?.username || '')
  const isAdmin = computed(() => {
    const role = user.value?.role
    return role === 'admin' || role === 'super_admin' || role === 'counselor'
  })

  const setToken = (newToken: string) => {
    token.value = newToken
  }

  const clearToken = () => {
    token.value = ''
    user.value = null
  }

  const register = async (username: string, password: string, email: string): Promise<boolean> => {
    loading.value = true
    error.value = ''
    try {
      await request({
        url: '/api/auth/register',
        method: 'post',
        data: { username, password, email },
      })
      return true
    } catch (err: unknown) {
      error.value = getErrorMessage(err, '注册失败')
      return false
    } finally {
      loading.value = false
    }
  }

  const login = async (username: string, password: string): Promise<boolean> => {
    loading.value = true
    error.value = ''
    try {
      const response = await request<{
        token: string
        user: User
      }>({
        url: '/api/auth/login',
        method: 'post',
        data: { username, password },
      })
      const { token: newToken, user: userData } = response
      setToken(newToken)
      user.value = userData
      return true
    } catch (err: unknown) {
      error.value = getErrorMessage(err, '登录失败')
      return false
    } finally {
      loading.value = false
    }
  }

  const fetchUserInfo = async (): Promise<boolean> => {
    try {
      const response = await request<{ user: User }>({
        url: '/api/auth/me',
        method: 'get',
      })
      user.value = response.user
      // 安全: Cookie 中的 Token 对前端不可见，用占位值标记已登录状态
      token.value = 'httpOnly'
      return true
    } catch (err) {
      clearToken()
      return false
    }
  }

  const logout = async () => {
    try {
      await request({ url: '/api/auth/logout', method: 'post' })
    } catch {
      // 即使清除 Cookie 失败也清除本地状态
    }
    clearToken()
  }

  // 安全: 页面刷新后通过 /api/auth/me 恢复登录状态（Cookie 自动发送）(VUE-AUTH-001)
  const init = async () => {
    await fetchUserInfo()
  }

  return {
    user,
    token,
    loading,
    error,
    isLoggedIn,
    username,
    isAdmin,
    register,
    login,
    logout,
    fetchUserInfo,
    init,
  }
})
