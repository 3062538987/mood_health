import { defineStore } from "pinia";
import { ref, computed } from "vue";
import request from "@/utils/request";

export interface User {
  id: number;
  username: string;
  email: string;
  role?: string;
  avatar?: string;
  created_at?: string;
}

export const useUserStore = defineStore("user", () => {
  const user = ref<User | null>(null);
  const token = ref<string>(localStorage.getItem("token") || "");
  const loading = ref(false);
  const error = ref<string>("");

  const isLoggedIn = computed(() => !!token.value && !!user.value);
  const username = computed(() => user.value?.username || "");
  const isAdmin = computed(() => user.value?.role === "admin");

  const setToken = (newToken: string) => {
    token.value = newToken;
    localStorage.setItem("token", newToken);
  };

  const clearToken = () => {
    token.value = "";
    user.value = null;
    localStorage.removeItem("token");
  };

  const register = async (
    username: string,
    password: string,
    email: string,
  ): Promise<boolean> => {
    loading.value = true;
    error.value = "";
    try {
      await request({
        url: "/api/auth/register",
        method: "post",
        data: { username, password, email },
      });
      return true;
    } catch (err: unknown) {
      const errorResponse = err as { response?: { data?: { message?: string } } };
      error.value = errorResponse.response?.data?.message || "注册失败";
      return false;
    } finally {
      loading.value = false;
    }
  };

  const login = async (
    username: string,
    password: string,
  ): Promise<boolean> => {
    loading.value = true;
    error.value = "";
    try {
      const response = await request<{
        token: string;
        user: User;
      }>({
        url: "/api/auth/login",
        method: "post",
        data: { username, password },
      });
      const { token: newToken, user: userData } = response;
      setToken(newToken);
      user.value = userData;
      return true;
    } catch (err: unknown) {
      const errorResponse = err as { response?: { data?: { message?: string } } };
      error.value = errorResponse.response?.data?.message || "登录失败";
      return false;
    } finally {
      loading.value = false;
    }
  };

  const fetchUserInfo = async (): Promise<boolean> => {
    if (!token.value) return false;
    try {
      const response = await request<{ code: number; data: { user: User } }>({
        url: "/api/auth/me",
        method: "get",
      });
      user.value = response.data.user;
      return true;
    } catch (err) {
      clearToken();
      return false;
    }
  };

  const logout = () => {
    clearToken();
  };

  const init = async () => {
    if (token.value) {
      await fetchUserInfo();
    }
  };

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
  };
});
