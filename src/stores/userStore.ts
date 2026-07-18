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

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const token = ref<string>('')
  const loading = ref(false)
  const error = ref<string>('')
  const authInitialized = ref(false)

  const isLoggedIn = computed(() => !!user.value)
  const username = computed(() => user.value?.username || '')
  const isAdmin = computed(() => user.value?.role === 'admin' || user.value?.role === 'super_admin')

  const setToken = (newToken: string) => {
    token.value = newToken
  }

  const clearToken = () => {
    token.value = ''
    user.value = null
  }

  const clearError = () => {
    error.value = ''
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
    if (!token.value) return false
    try {
      const response = await request<{ user: User }>({
        url: '/api/auth/me',
        method: 'get',
      })
      user.value = response.user
      return true
    } catch (err) {
      clearToken()
      return false
    }
  }

  const trySessionRestore = async (): Promise<boolean> => {
    // 如果已有 token 且用户信息已加载，无需恢复
    if (token.value && user.value) {
      authInitialized.value = true
      return true
    }
    try {
      const response = await request<{ user: User }>({
        url: '/api/auth/me',
        method: 'get',
      })
      user.value = response.user
      // 从 cookie 恢复会话时，token 可能为空，但后端已认证
      // 使用一个占位 token 让 isLoggedIn 生效
      if (!token.value) {
        token.value = ''
      }
      authInitialized.value = true
      return true
    } catch (err) {
      authInitialized.value = true
      return false
    }
  }

  const logout = () => {
    clearToken()
  }

  const init = async () => {
    if (token.value) {
      await fetchUserInfo()
    }
  }

  return {
    user,
    token,
    loading,
    error,
    authInitialized,
    isLoggedIn,
    username,
    isAdmin,
    clearError,
    register,
    login,
    logout,
    fetchUserInfo,
    trySessionRestore,
    init,
  }
})
