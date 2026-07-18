import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import request, { ApiRequestError } from '@/utils/request'

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

const PENDING_LOGOUT_KEY = 'pendingLogout'

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const token = ref<string>('')
  const loading = ref(false)
  const error = ref<string>('')
  const authInitialized = ref(false)
  const pendingLogout = ref(false)
  const logoutInProgress = ref(false)

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

    // 检查是否有待处理的退出
    if (sessionStorage.getItem(PENDING_LOGOUT_KEY) === '1') {
      pendingLogout.value = true
      // 重试退出请求
      try {
        await request.post('/api/auth/logout')
        pendingLogout.value = false
        sessionStorage.removeItem(PENDING_LOGOUT_KEY)
      } catch {
        // 退出仍然失败，不恢复用户状态
        authInitialized.value = true
        return false
      }
      authInitialized.value = true
      return false
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

  const logout = async (): Promise<void> => {
    if (logoutInProgress.value) return
    logoutInProgress.value = true
    loading.value = true
    error.value = ''
    pendingLogout.value = false
    sessionStorage.removeItem(PENDING_LOGOUT_KEY)

    try {
      await request.post('/api/auth/logout')
    } catch {
      // 网络失败时清除本地状态，标记待退出
      clearToken()
      pendingLogout.value = true
      sessionStorage.setItem(PENDING_LOGOUT_KEY, '1')
      error.value = '服务器未响应退出请求，已清除本地登录状态并将在网络恢复后同步退出'
      loading.value = false
      logoutInProgress.value = false
      return
    }

    clearToken()
    loading.value = false
    logoutInProgress.value = false
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
    pendingLogout,
    logoutInProgress,
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
