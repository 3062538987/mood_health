import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import Home from '@/views/Home.vue'
import { useUserStore } from '@/stores/userStore'
import { featureFlags, type FrontendFeatureFlags } from '@/config/featureFlags'
import {
  getRouteRedirect,
  GUIDE_ROUTE_PATH,
  initializeUserState,
  shouldRedirectToGuide,
} from '@/router/guards'

const baseRoutes: RouteRecordRaw[] = [
  {
    path: '/guide',
    component: () => import('@/views/guide/GuidePage.vue'),
    meta: { public: true },
  },
  { path: '/', component: Home },
  {
    path: '/login',
    component: () => import('@/views/auth/Login.vue'),
    meta: { public: true, guestOnly: true },
  },
  {
    path: '/register',
    component: () => import('@/views/auth/Register.vue'),
    meta: { public: true, guestOnly: true },
  },
  {
    path: '/mood',
    component: () => import('@/views/mood/MoodLayout.vue'),
    redirect: '/mood/record',
    meta: {
      subNav: [
        { path: '/mood/record', name: '情绪记录', icon: 'fas fa-pencil-alt' },
        { path: '/mood/archive', name: '情绪档案', icon: 'fas fa-archive' },
        { path: '/mood/insight', name: '情绪洞察', icon: 'fas fa-lightbulb' },
        { path: '/mood/analysis', name: '情绪分析', icon: 'fas fa-chart-pie' },
      ],
    },
    children: [
      {
        path: 'record',
        component: () => import('@/views/mood/MoodRecord.vue'),
      },
      {
        path: 'archive',
        component: () => import('@/views/mood/MoodArchive.vue'),
      },
      {
        path: 'insight',
        name: 'MoodInsight',
        component: () => import('@/views/mood/InsightPage.vue'),
        meta: { title: '情绪洞察', requiresAuth: true },
      },
      {
        path: 'analysis',
        component: () => import('@/views/mood/MoodAnalysis.vue'),
      },
    ],
  },
  {
    path: '/relax',
    component: () => import('@/views/relax/RelaxLayout.vue'),
    redirect: '/relax/center',
    meta: {
      feature: 'nonCore',
      subNav: [
        { path: '/relax/center', name: '解压中心', icon: 'fas fa-headphones' },
        { path: '/relax/history', name: '放松历史', icon: 'fas fa-history' },
        {
          path: '/relax/achievements',
          name: '成就中心',
          icon: 'fas fa-trophy',
        },
        { path: '/relax/treehole', name: '树洞', icon: 'fas fa-tree' },
        { path: '/relax/music', name: '音乐疗愈', icon: 'fas fa-music' },
      ],
    },
    children: [
      {
        path: 'center',
        component: () => import('@/views/relax/RelaxCenter.vue'),
      },
      {
        path: 'history',
        component: () => import('@/views/relax/RelaxHistory.vue'),
      },
      {
        path: 'achievements',
        component: () => import('@/views/achievements/Achievements.vue'),
      },
      {
        path: 'treehole',
        name: 'TreeHole',
        component: () => import('@/views/relax/TreeHole.vue'),
      },
      {
        path: 'treehole/:id',
        name: 'TreeHoleDetail',
        component: () => import('@/views/relax/TreeHoleDetail.vue'),
      },
      {
        path: 'music',
        component: () => import('@/views/relax/MusicTherapy.vue'),
      },
    ],
  },
  {
    path: '/improve',
    component: () => import('@/views/improve/ImproveLayout.vue'),
    redirect: '/improve/group',
    meta: {
      disabledRedirect: '/improve/survey',
      nonCoreSubNavPaths: ['/improve/group', '/improve/knowledge', '/improve/courses'],
      subNav: [
        {
          path: '/improve/group',
          name: '团体辅导',
          icon: 'fas fa-users',
        },
        { path: '/improve/knowledge', name: '情绪科普', icon: 'fas fa-book' },
        {
          path: '/improve/courses',
          name: '成长课程',
          icon: 'fas fa-graduation-cap',
        },
        {
          path: '/improve/survey',
          name: '问卷调查',
          icon: 'fas fa-clipboard-list',
        },
      ],
    },
    children: [
      {
        path: 'group',
        component: () => import('@/views/improve/GroupActivity.vue'),
        meta: { feature: 'nonCore' },
      },
      {
        path: 'group/:id',
        name: 'ActivityDetail',
        component: () => import('@/views/improve/ActivityDetail.vue'),
        meta: { feature: 'nonCore' },
      },
      {
        path: 'knowledge',
        component: () => import('@/views/improve/Knowledge.vue'),
        meta: { feature: 'nonCore' },
      },
      {
        path: 'courses',
        component: () => import('@/views/improve/Courses.vue'),
        meta: { feature: 'nonCore' },
      },
      {
        path: 'course/:id',
        component: () => import('@/views/improve/CourseDetail.vue'),
        meta: { feature: 'nonCore' },
      },
      {
        path: 'survey',
        name: 'Survey',
        component: () => import('@/views/improve/Survey.vue'),
      },
      {
        path: 'questionnaire',
        component: () => import('@/views/improve/QuestionnaireList.vue'),
      },
      {
        path: 'questionnaire/:id',
        component: () => import('@/views/improve/Questionnaire.vue'),
      },
      {
        path: 'questionnaire/result',
        component: () => import('@/views/improve/QuestionnaireResult.vue'),
      },
      {
        path: 'questionnaire/history',
        component: () => import('@/views/improve/QuestionnaireHistory.vue'),
      },
    ],
  },
  {
    path: '/user',
    component: () => import('@/views/user/UserLayout.vue'),
    redirect: '/user/profile',
    meta: {
      subNav: [
        { path: '/user/profile', name: '个人资料', icon: 'fas fa-user' },
        { path: '/user/setting', name: '设置', icon: 'fas fa-cog' },
      ],
    },
    children: [
      { path: 'profile', component: () => import('@/views/user/Profile.vue') },
      { path: 'setting', component: () => import('@/views/user/Setting.vue') },
    ],
  },
  {
    path: '/admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    redirect: '/admin/dashboard',
    meta: {
      adminOnly: true,
      roles: ['admin', 'super_admin'],
      permission: 'user.manage',
      nonCoreSubNavPaths: ['/admin/posts', '/admin/treehole', '/admin/courses', '/admin/music'],
      subNav: [
        { path: '/admin/dashboard', name: '管理首页', icon: 'fas fa-gauge-high' },
        { path: '/admin/users', name: '用户管理', icon: 'fas fa-users-cog' },
        { path: '/admin/user-moods', name: '用户情绪数据', icon: 'fas fa-chart-line' },
        { path: '/admin/moods', name: '情绪记录', icon: 'fas fa-face-smile' },
        {
          path: '/admin/posts',
          name: '帖子审核',
          icon: 'fas fa-clipboard-check',
        },
        {
          path: '/admin/treehole',
          name: '树洞审核',
          icon: 'fas fa-tree',
        },
        {
          path: '/admin/cases',
          name: '风险个案',
          icon: 'fas fa-heart-circle-exclamation',
        },
        {
          path: '/admin/courses',
          name: '课程管理',
          icon: 'fas fa-book-medical',
        },
        {
          path: '/admin/music',
          name: '音乐管理',
          icon: 'fas fa-music',
        },
        { path: '/admin/audit-logs', name: '审计日志', icon: 'fas fa-file-shield' },
        { path: '/admin/activity-stats', name: '活动统计', icon: 'fas fa-chart-bar' },
      ],
    },
    children: [
      {
        path: 'dashboard',
        component: () => import('@/views/admin/AdminDashboard.vue'),
        meta: {
          adminOnly: true,
          roles: ['admin', 'super_admin'],
          permission: 'user.manage',
        },
      },
      {
        path: 'users',
        component: () => import('@/views/admin/Users.vue'),
        meta: {
          adminOnly: true,
          roles: ['super_admin'],
          permission: 'user.manage',
        },
      },
      {
        path: 'posts',
        component: () => import('@/views/admin/Posts.vue'),
        meta: {
          feature: 'nonCore',
          adminOnly: true,
          roles: ['admin', 'super_admin'],
          permission: 'post.audit',
        },
      },
      {
        path: 'user-moods',
        component: () => import('@/views/admin/UserMoods.vue'),
        meta: {
          adminOnly: true,
          roles: ['admin', 'super_admin'],
          permission: 'mood.record.read',
        },
      },
      {
        path: 'moods',
        component: () => import('@/views/admin/Moods.vue'),
        meta: {
          adminOnly: true,
          roles: ['admin', 'super_admin'],
          permission: 'mood.record.read',
        },
      },
      {
        path: 'courses',
        component: () => import('@/views/admin/Courses.vue'),
        meta: {
          feature: 'nonCore',
          adminOnly: true,
          roles: ['admin', 'super_admin'],
          permission: 'course.manage',
        },
      },
      {
        path: 'music',
        component: () => import('@/views/admin/Music.vue'),
        meta: {
          feature: 'nonCore',
          adminOnly: true,
          roles: ['admin', 'super_admin'],
          permission: 'music.manage',
        },
      },
      {
        path: 'audit-logs',
        component: () => import('@/views/admin/AuditLogs.vue'),
        meta: {
          adminOnly: true,
          roles: ['super_admin'],
          permission: 'audit.record.view_all',
        },
      },
      {
        path: 'activity-stats',
        component: () => import('@/views/admin/ActivityStats.vue'),
        meta: {
          adminOnly: true,
          roles: ['admin', 'super_admin'],
          permission: 'activity.manage',
        },
      },
      {
        path: 'treehole',
        component: () => import('@/views/admin/TreeHoleAudit.vue'),
        meta: {
          feature: 'nonCore',
          adminOnly: true,
          roles: ['admin', 'super_admin'],
          permission: 'post.audit',
        },
      },
      {
        path: 'cases',
        component: () => import('@/views/admin/Cases.vue'),
        meta: {
          adminOnly: true,
          roles: ['admin', 'super_admin'],
          permission: 'case.manage',
        },
      },
      {
        path: 'cases/:id',
        component: () => import('@/views/admin/CaseDetail.vue'),
        meta: {
          adminOnly: true,
          roles: ['admin', 'super_admin'],
          permission: 'case.manage',
        },
      },
    ],
  },
  {
    path: '/counseling',
    component: () => import('@/views/counseling/Counseling.vue'),
  },
  {
    path: '/ai-history',
    component: () => import('@/views/counseling/AiHistory.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: { public: true },
  },
]

const filterRoutes = (
  routes: readonly RouteRecordRaw[],
  flags: FrontendFeatureFlags
): RouteRecordRaw[] =>
  routes.flatMap((route) => {
    const meta = route.meta ? { ...route.meta } : undefined
    const routeFeature = meta?.feature

    if (!flags.nonCoreModules && routeFeature === 'nonCore') {
      return []
    }

    const filteredRoute: RouteRecordRaw = { ...route }

    if (meta) {
      const subNav = meta.subNav
      if (Array.isArray(subNav)) {
        const nonCoreSubNavPaths = new Set(meta.nonCoreSubNavPaths || [])
        meta.subNav = subNav.filter(
          (item) => flags.nonCoreModules || !nonCoreSubNavPaths.has(item.path)
        )
      }

      if (!flags.nonCoreModules && typeof meta.disabledRedirect === 'string') {
        filteredRoute.redirect = meta.disabledRedirect
      }

      delete meta.feature
      delete meta.disabledRedirect
      delete meta.nonCoreSubNavPaths
      filteredRoute.meta = meta
    }

    if (route.children) {
      filteredRoute.children = filterRoutes(route.children, flags)
    }

    return [filteredRoute]
  })

export const createRoutes = (_flags: FrontendFeatureFlags = featureFlags): RouteRecordRaw[] =>
  filterRoutes(baseRoutes, _flags)

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: createRoutes(),
})

router.onError((error) => {
  const message = String(error?.message || '')
  const isChunkLoadError =
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('Loading chunk')

  if (!isChunkLoadError) {
    return
  }

  const hasRetried = sessionStorage.getItem('router-chunk-reload') === '1'
  if (hasRetried) {
    sessionStorage.removeItem('router-chunk-reload')
    return
  }

  sessionStorage.setItem('router-chunk-reload', '1')
  window.location.reload()
})

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()

  await initializeUserState(userStore)

  if (shouldRedirectToGuide(to, from)) {
    next(GUIDE_ROUTE_PATH)
    return
  }

  const redirectPath = getRouteRedirect(to, userStore)

  if (!redirectPath) {
    next()
    return
  }

  next(redirectPath)
})

export default router
