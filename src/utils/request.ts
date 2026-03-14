import axios, {
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
  AxiosError,
} from "axios";
import { ElMessage, ElLoading } from "element-plus";
import router from "@/router";

interface ErrorResponse {
  message?: string;
  code?: number;
}

interface AxiosErrorResponse {
  response?: {
    status?: number;
    data?: ErrorResponse;
  };
  request?: unknown;
  message?: string;
}

// 全局loading计数器
let loadingCount = 0;
let loadingInstance: ReturnType<typeof ElLoading.service> | null = null;

// 开启loading
const startLoading = () => {
  if (loadingCount === 0) {
    loadingInstance = ElLoading.service({
      lock: true,
      text: "加载中...",
      background: "rgba(0, 0, 0, 0.7)",
    });
  }
  loadingCount++;
};

// 关闭loading
const endLoading = () => {
  if (loadingCount > 0) {
    loadingCount--;
  }
  if (loadingCount === 0 && loadingInstance) {
    loadingInstance.close();
    loadingInstance = null;
  }
};

// 创建 axios 实例
const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 请求拦截器
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    startLoading();

    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => {
    endLoading();
    ElMessage.error("请求发送失败");
    return Promise.reject(error);
  },
);

// 响应拦截器
service.interceptors.response.use(
  (response: AxiosResponse) => {
    endLoading();

    const res = response.data;

    if (res.code === undefined) {
      return res;
    }

    if (res.code === 0 || res.code === 200) {
      return res.data;
    } else {
      const errorMessage = res.message || "请求失败";
      ElMessage.error(errorMessage);
      return Promise.reject(new Error(errorMessage));
    }
  },
  (error: AxiosError<ErrorResponse>) => {
    endLoading();

    console.error("API Error:", error);

    const axiosError = error as AxiosErrorResponse;

    if (axiosError.response) {
      const status = axiosError.response.status;
      const errorMessage = axiosError.response.data?.message;

      switch (status) {
        case 401:
          ElMessage.error("登录已过期，请重新登录");
          localStorage.removeItem("token");
          router.push("/login");
          break;
        case 403:
          ElMessage.error("没有权限访问该资源");
          break;
        case 404:
          ElMessage.error("请求的资源不存在");
          break;
        case 500:
          ElMessage.error(errorMessage || "服务器内部错误");
          break;
        default:
          ElMessage.error(errorMessage || `请求失败 (${status})`);
      }
    } else if (axiosError.request) {
      ElMessage.error("网络连接失败，请检查网络");
    } else {
      ElMessage.error("请求配置错误");
    }

    return Promise.reject(error);
  },
);

const request = <T = unknown>(config: AxiosRequestConfig): Promise<T> => {
  return service.request(config) as Promise<T>;
};

export default request;
