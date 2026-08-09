import type { RouteLocationNormalized } from 'vue-router'
import { useUserStore } from '@/stores/userStore'

const GUIDE_COMPLETED_KEY = 'guideCompleted'
const HOME_PATH = '/'
const GUIDE_PATH = '/guide'
const LOGIN_PATH = '/login'

type UserStore = ReturnType<typeof useUserStore>
type UserRole = 'user' | 'admin' | 'super_admin'

const rolePermissions: Record<UserRole, readonly string[]> = {
  super_admin: [
    'user.manage',
    'role.manage',
    'system.config',
    'incident.fix',
    'audit.record.view_all',
    'post.audit',
    'post.audit.pending.read',
    'activity.manage',
    'course.manage',
    'music.manage',
    'report.view',
    'feedback.handle',
    'mood.record.read',
    'questionnaire.submit',
    'auth.profile.read',
  ],
  admin: [
    'user.manage',
    'post.audit',
    'post.audit.pending.read',
    'activity.manage',
    'course.manage',
    'music.manage',
    'report.view',
    'feedback.handle',
    'audit.record.view_all',
    'mood.record.read',
    'questionnaire.submit',
    'auth.profile.read',
  ],
  user: [],
}

const normalizeRole = (role: string | undefined): UserRole => {
  if (role === 'admin' || role === 'super_admin') {
    return role
  }
  if (role === 'student' || role === 'counselor') {
    return 'user'
  }
  return 'user'
}

export const requirePermission = (userStore: UserStore, permission?: string): boolean => {
  if (!permission) {
    return true
  }

  if (!userStore.isLoggedIn) {
    return false
  }

  const role = normalizeRole(userStore.user?.role)
  return rolePermissions[role].includes(permission)
}

export const initializeUserState = async (userStore: UserStore) => {
  if (!userStore.authInitialized) {
    await userStore.trySessionRestore()
  }
}

export const shouldRedirectToGuide = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized
) => {
  const isFirstAppEntry = from.matched.length === 0
  const guideCompleted = localStorage.getItem(GUIDE_COMPLETED_KEY)

  return to.path === HOME_PATH && isFirstAppEntry && !guideCompleted
}

export const getRouteRedirect = (to: RouteLocationNormalized, userStore: UserStore) => {
  if (to.meta.adminOnly && (!userStore.isLoggedIn || !userStore.isAdmin)) {
    return HOME_PATH
  }

  if (to.meta.roles && to.meta.roles.length > 0) {
    const currentRole = userStore.user?.role || 'user'
    if (!userStore.isLoggedIn || !to.meta.roles.includes(currentRole)) {
      return HOME_PATH
    }
  }

  if (to.meta.guestOnly && userStore.isLoggedIn) {
    return HOME_PATH
  }

  if (!to.meta.public && !userStore.isLoggedIn) {
    return LOGIN_PATH
  }

  if (to.meta.permission && !requirePermission(userStore, to.meta.permission)) {
    return HOME_PATH
  }

  return null
}

export const GUIDE_ROUTE_PATH = GUIDE_PATH
