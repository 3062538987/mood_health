import type { RouteLocationNormalized } from "vue-router";
import { useUserStore } from "@/stores/userStore";

const GUIDE_COMPLETED_KEY = "guideCompleted";
const HOME_PATH = "/";
const GUIDE_PATH = "/guide";
const LOGIN_PATH = "/login";

type UserStore = ReturnType<typeof useUserStore>;

export const initializeUserState = async (userStore: UserStore) => {
  if (userStore.token && !userStore.user) {
    await userStore.fetchUserInfo();
  }
};

export const shouldRedirectToGuide = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
) => {
  const isFirstAppEntry = from.matched.length === 0;
  const guideCompleted = localStorage.getItem(GUIDE_COMPLETED_KEY);

  return to.path === HOME_PATH && isFirstAppEntry && !guideCompleted;
};

export const getRouteRedirect = (
  to: RouteLocationNormalized,
  userStore: UserStore,
) => {
  if (to.meta.adminOnly && (!userStore.isLoggedIn || !userStore.isAdmin)) {
    return HOME_PATH;
  }

  if (to.meta.guestOnly && userStore.isLoggedIn) {
    return HOME_PATH;
  }

  if (!to.meta.public && !userStore.isLoggedIn) {
    return LOGIN_PATH;
  }

  return null;
};

export const GUIDE_ROUTE_PATH = GUIDE_PATH;
