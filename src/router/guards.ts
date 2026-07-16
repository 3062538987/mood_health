import type { RouteLocationNormalized } from 'vue-router'
import { useUserStore } from '@/stores/userStore'

const GUIDE_COMPLETED_KEY = 'guideCompleted'
const HOME_PATH = '/'
const GUIDE_PATH = '/guide'
const LOGIN_PATH = '/login'

type UserStore = ReturnType<typeof useUserStore>
type UserRole = 'student' | 'super_admin' | 'counselor'

const rolePermissions: Record<UserRole, readonly string[]> = {
  super_admin: [
    'auth.profile.read',
    'report.aggregate.read',
    'user.manage',
    'user.role.assign',
    'audit.log.read',
    'case.read_assigned',
    'case.read_own',
    'case.create',
    'case.assign',
    'case.refer',
    'case.close',
    'user.delete',
    'prompt.manage',
  ],
  counselor: [
    'auth.profile.read',
    'report.aggregate.read',
    'case.read_assigned',
    'case.read_own',
    'case.create',
    'case.intervene',
    'case.refer',
    'case.close',
  ],
  student: [
    'auth.profile.read',
    'mood.record.create',
    'mood.record.read_own',
    'mood.record.update_own',
    'mood.record.delete_own',
    'assessment.instrument.read',
    'assessment.submit',
    'assessment.history.read_own',
    'case.read_own',
  ],
}

const normalizeRole = (role: string | undefined): UserRole => {
  if (role === 'counselor' || role === 'super_admin') {
    return role
  }
  return 'student'
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
  if (userStore.token && !userStore.user) {
    await userStore.fetchUserInfo()
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
    const currentRole = userStore.user?.role || 'student'
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
