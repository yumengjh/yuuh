import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import type { AuthTokens } from "./types";

/**
 * API 基础配置
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5200";
const API_VERSION = "/api/v1";
const API_TIMEOUT = 30000;

/**
 * 请求/响应类型定义
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
}

export interface ApiErrorShape {
  success: false;
  error: {
    code: string;
    message: string | string[];
  };
}

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  /** 某些接口无需鉴权时可开启 */
  skipAuth?: boolean;
};

/**
 * Token 存取工具
 */
const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

export const tokenManager = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clearTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  },
};

/**
 * 归一化后抛出的错误对象
 */
export type NormalizedApiError = {
  status?: number;
  code?: string;
  message: string;
  raw: unknown;
};

const normalizeError = (error: unknown): NormalizedApiError => {
  // 判断传入的 error 是否为 Axios 抛出的错误对象（AxiosError）
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<ApiErrorShape>;
    const code = axiosErr.response?.data?.error?.code || axiosErr.code;
    const message =
      (Array.isArray(axiosErr.response?.data?.error?.message)
        ? axiosErr.response?.data?.error?.message.join("; ")
        : axiosErr.response?.data?.error?.message) ||
      axiosErr.message ||
      "Network Error";
    return {
      status: axiosErr.response?.status,
      code: code || undefined,
      message,
      raw: error,
    };
  }
  return {
    message: error instanceof Error ? error.message : "Unknown error",
    raw: error,
  };
};

/**
 * 刷新 Token 的单例 Promise，避免并发重复刷新
 */
let refreshPromise: Promise<AuthTokens> | null = null;

const refreshTokens = async (): Promise<AuthTokens> => {
  if (!refreshPromise) {
    const refreshToken = tokenManager.getRefreshToken();
    refreshPromise = axios
      .post<ApiResponse<AuthTokens>>(`${API_BASE_URL}${API_VERSION}/auth/refresh`, {
        refreshToken,
      })
      .then((res) => {
        const tokens = res.data.data;
        tokenManager.setTokens(tokens.accessToken, tokens.refreshToken);
        return tokens;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

/**
 * 创建 axios 实例
 */
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: `${API_BASE_URL}${API_VERSION}`,
    timeout: API_TIMEOUT,
    headers: {
      "Content-Type": "application/json",
    },
  });

  /**
   * 请求拦截：自动附加 AccessToken
   */
  client.interceptors.request.use(
    (config: RetryableRequestConfig) => {
      if (!config.skipAuth) {
        const token = tokenManager.getAccessToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  /**
   * 响应拦截：处理 401 自动刷新 Token，再重放原请求
   */
  client.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error) => {
      const originalRequest = error.config as RetryableRequestConfig;

      if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.skipAuth) {
        originalRequest._retry = true;
        try {
          const tokens = await refreshTokens();
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
          }
          return client(originalRequest);
        } catch (refreshError) {
          tokenManager.clearTokens();
          window.location.href = "/login";
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(normalizeError(error));
    }
  );

  return client;
};

export const apiClient = createApiClient();

/**
 * 通用 API 方法（保持返回 AxiosResponse，方便拿到 meta）
 */
export const api = {
  get: <T = unknown>(
    url: string,
    params?: Record<string, unknown>,
    config?: Partial<RetryableRequestConfig>
  ): Promise<AxiosResponse<ApiResponse<T>>> => {
    return apiClient.get(url, { params, ...config });
  },

  post: <T = unknown>(
    url: string,
    data?: unknown,
    config?: Partial<RetryableRequestConfig>
  ): Promise<AxiosResponse<ApiResponse<T>>> => {
    return apiClient.post(url, data, config);
  },

  put: <T = unknown>(
    url: string,
    data?: unknown,
    config?: Partial<RetryableRequestConfig>
  ): Promise<AxiosResponse<ApiResponse<T>>> => {
    return apiClient.put(url, data, config);
  },

  patch: <T = unknown>(
    url: string,
    data?: unknown,
    config?: Partial<RetryableRequestConfig>
  ): Promise<AxiosResponse<ApiResponse<T>>> => {
    return apiClient.patch(url, data, config);
  },

  delete: <T = unknown>(
    url: string,
    config?: Partial<RetryableRequestConfig>
  ): Promise<AxiosResponse<ApiResponse<T>>> => {
    return apiClient.delete(url, config);
  },

  upload: <T = unknown>(
    url: string,
    file: File,
    additionalData?: Record<string, string | Blob>,
    config?: Partial<RetryableRequestConfig>
  ): Promise<AxiosResponse<ApiResponse<T>>> => {
    const formData = new FormData();
    formData.append("file", file);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    return apiClient.post(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      ...config,
    });
  },
};

/**
 * 辅助：直接拿业务 data，失败抛出规范化错误
 */
export const unwrap = async <T>(p: Promise<AxiosResponse<ApiResponse<T>>>): Promise<T> => {
  try {
    const res = await p;
    return res.data.data;
  } catch (error) {
    throw normalizeError(error);
  }
};

