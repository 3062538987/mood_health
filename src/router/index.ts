import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import Home from "@/views/Home.vue";
import { useUserStore } from "@/stores/userStore";

const routes: RouteRecordRaw[] = [
  {
    path: "/guide",
    component: () => import("@/views/guide/GuidePage.vue"),
    meta: { public: true },
  },
  { path: "/", component: Home },
  {
    path: "/login",
    component: () => import("@/views/auth/Login.vue"),
    meta: { public: true },
  },
  {
    path: "/register",
    component: () => import("@/views/auth/Register.vue"),
    meta: { public: true },
  },
  {
    path: "/mood",
    component: () => import("@/views/mood/MoodLayout.vue"),
    redirect: "/mood/record",
    meta: {
      subNav: [
        { path: "/mood/record", name: "情绪记录", icon: "fas fa-pencil-alt" },
        { path: "/mood/archive", name: "情绪档案", icon: "fas fa-archive" },
        { path: "/mood/analysis", name: "情绪分析", icon: "fas fa-chart-pie" },
      ],
    },
    children: [
      {
        path: "record",
        component: () => import("@/views/mood/MoodRecord.vue"),
      },
      {
        path: "archive",
        component: () => import("@/views/mood/MoodArchive.vue"),
      },
      {
        path: "analysis",
        component: () => import("@/views/mood/MoodAnalysis.vue"),
      },
    ],
  },
  {
    path: "/relax",
    component: () => import("@/views/relax/RelaxLayout.vue"),
    redirect: "/relax/center",
    meta: {
      subNav: [
        { path: "/relax/center", name: "解压中心", icon: "fas fa-headphones" },
        { path: "/relax/history", name: "放松历史", icon: "fas fa-history" },
        {
          path: "/relax/achievements",
          name: "成就中心",
          icon: "fas fa-trophy",
        },
        { path: "/relax/treehole", name: "树洞", icon: "fas fa-tree" },
        { path: "/relax/music", name: "音乐疗愈", icon: "fas fa-music" },
      ],
    },
    children: [
      {
        path: "center",
        component: () => import("@/views/relax/RelaxCenter.vue"),
      },
      {
        path: "history",
        component: () => import("@/views/relax/RelaxHistory.vue"),
      },
      {
        path: "achievements",
        component: () => import("@/views/achievements/Achievements.vue"),
      },
      {
        path: "treehole",
        name: "TreeHole",
        component: () => import("@/views/relax/TreeHole.vue"),
      },
      {
        path: "treehole/:id",
        name: "TreeHoleDetail",
        component: () => import("@/views/relax/TreeHoleDetail.vue"),
      },
      {
        path: "music",
        component: () => import("@/views/relax/MusicTherapy.vue"),
      },
    ],
  },
  {
    path: "/improve",
    component: () => import("@/views/improve/ImproveLayout.vue"),
    redirect: "/improve/group",
    meta: {
      subNav: [
        { path: "/improve/group", name: "团体辅导", icon: "fas fa-users" },
        { path: "/improve/knowledge", name: "情绪科普", icon: "fas fa-book" },
        {
          path: "/improve/courses",
          name: "成长课程",
          icon: "fas fa-graduation-cap",
        },
        {
          path: "/improve/survey",
          name: "问卷调查",
          icon: "fas fa-clipboard-list",
        },
      ],
    },
    children: [
      {
        path: "group",
        component: () => import("@/views/improve/GroupActivity.vue"),
      },
      {
        path: "group/:id",
        name: "ActivityDetail",
        component: () => import("@/views/improve/ActivityDetail.vue"),
      },
      {
        path: "knowledge",
        component: () => import("@/views/improve/Knowledge.vue"),
      },
      {
        path: "courses",
        component: () => import("@/views/improve/Courses.vue"),
      },
      {
        path: "course/:id",
        component: () => import("@/views/improve/CourseDetail.vue"),
      },
      {
        path: "survey",
        name: "Survey",
        component: () => import("@/views/improve/Survey.vue"),
      },
      {
        path: "questionnaire",
        component: () => import("@/views/improve/QuestionnaireList.vue"),
      },
      {
        path: "questionnaire/:id",
        component: () => import("@/views/improve/Questionnaire.vue"),
      },
      {
        path: "questionnaire/result",
        component: () => import("@/views/improve/QuestionnaireResult.vue"),
      },
      {
        path: "questionnaire/history",
        component: () => import("@/views/improve/QuestionnaireHistory.vue"),
      },
    ],
  },
  {
    path: "/user",
    component: () => import("@/views/user/UserLayout.vue"),
    redirect: "/user/profile",
    meta: {
      subNav: [
        { path: "/user/profile", name: "个人资料", icon: "fas fa-user" },
        { path: "/user/setting", name: "设置", icon: "fas fa-cog" },
      ],
    },
    children: [
      { path: "profile", component: () => import("@/views/user/Profile.vue") },
      { path: "setting", component: () => import("@/views/user/Setting.vue") },
    ],
  },
  {
    path: "/admin",
    component: () => import("@/views/admin/TreeHoleAudit.vue"),
    meta: { adminOnly: true },
  },
  {
    path: "/counseling",
    component: () => import("@/views/counseling/Counseling.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore();

  if (userStore.token && !userStore.user) {
    await userStore.fetchUserInfo();
  }

  // 检查是否首次访问，重定向到引导页
  if (to.path === "/" && !localStorage.getItem("guideCompleted")) {
    next("/guide");
    return;
  }

  // 检查管理员权限
  if (to.meta.adminOnly) {
    if (!userStore.isLoggedIn || !userStore.isAdmin) {
      next("/");
      return;
    }
  }

  if (to.meta.public) {
    if (userStore.isLoggedIn) {
      next("/");
    } else {
      next();
    }
    return;
  }

  if (!userStore.isLoggedIn) {
    next("/login");
  } else {
    next();
  }
});

export default router;
