import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import type { ApiEnvelope, ApiErrorShape, AuthTokens } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5200";
const API_VERSION = "/api/v1";
const API_TIMEOUT = 30000;

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  skipAuth?: boolean;
};

const isEmptyValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value as Record<string, unknown>).length === 0;
  }
  return false;
};

const cleanObject = <T extends Record<string, unknown> | undefined>(obj: T): T => {
  if (!obj || typeof obj !== "object") return obj;
  const result: Record<string, unknown> = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (isEmptyValue(value)) return;
    if (typeof value === "object" && !Array.isArray(value) && value !== null) {
      const nested = cleanObject(value as Record<string, unknown>);
      if (!isEmptyValue(nested)) {
        result[key] = nested;
      }
      return;
    }
    result[key] = value;
  });
  return result as T;
};

export type RequestConfig = Partial<RetryableRequestConfig>;

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

export type NormalizedApiError = {
  status?: number;
  code?: string;
  message: string;
  raw: unknown;
};

const normalizeError = (error: unknown): NormalizedApiError => {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<ApiEnvelope<unknown>>;
    const code = axiosErr.response?.data?.error?.code || axiosErr.code;
    const rawMessage = axiosErr.response?.data?.error?.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join("; ")
      : rawMessage || axiosErr.message || "Network Error";

    // 调试日志：便于前端确认实际返回结构
    // eslint-disable-next-line no-console
    console.debug("[api_v1] axios error", {
      status: axiosErr.response?.status,
      code,
      message,
      data: axiosErr.response?.data,
    });

    return {
      status: axiosErr.response?.status,
      code: code || undefined,
      message,
      raw: error,
    };
  }
  // eslint-disable-next-line no-console
  console.debug("[api_v1] non-axios error", error);
  return {
    message: error instanceof Error ? error.message : "Unknown error",
    raw: error,
  };
};

let refreshPromise: Promise<AuthTokens> | null = null;

const refreshTokens = async (): Promise<AuthTokens> => {
  if (!refreshPromise) {
    const refreshToken = tokenManager.getRefreshToken();
    refreshPromise = axios
      .post<ApiEnvelope<AuthTokens>>(`${API_BASE_URL}${API_VERSION}/auth/refresh`, {
        refreshToken,
      })
      .then((res) => {
        const tokens = (res.data as ApiEnvelope<AuthTokens>).data;
        if (tokens) {
          tokenManager.setTokens(tokens.accessToken, tokens.refreshToken);
        }
        return tokens as AuthTokens;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

const pickData = <T>(res: AxiosResponse<ApiEnvelope<T> | T>): T => {
  const payload = res.data as ApiEnvelope<T> | T;

  if (payload && typeof payload === "object" && "success" in payload) {
    const envelope = payload as ApiEnvelope<T>;
    if (envelope.success === false || envelope.error) {
      const err: ApiErrorShape | undefined = envelope.error;
      throw {
        status: res.status,
        code: err?.code,
        message: Array.isArray(err?.message)
          ? err?.message.join("; ")
          : err?.message || "Request failed",
        raw: envelope,
      } satisfies NormalizedApiError;
    }
    if (envelope.data !== undefined) {
      return envelope.data;
    }
  }

  if (payload && typeof payload === "object" && "data" in (payload as Record<string, unknown>)) {
    const envelope = payload as { data?: T };
    if (envelope.data !== undefined) {
      return envelope.data;
    }
  }

  return payload as T;
};

const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: `${API_BASE_URL}${API_VERSION}`,
    timeout: API_TIMEOUT,
    headers: {
      "Content-Type": "application/json",
    },
  });

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

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config as RetryableRequestConfig;

      if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.skipAuth) {
        originalRequest._retry = true;
        try {
          const tokens = await refreshTokens();
          if (tokens && originalRequest.headers) {
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

export const api = {
  get: <T = unknown>(
    url: string,
    params?: Record<string, unknown>,
    config?: RequestConfig
  ): Promise<AxiosResponse<ApiEnvelope<T>>> => {
    return apiClient.get(url, { params: cleanObject(params), ...config });
  },

  post: <T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<AxiosResponse<ApiEnvelope<T>>> => {
    const body = typeof data === "object" && data !== null ? cleanObject(data as Record<string, unknown>) : data;
    return apiClient.post(url, body, config);
  },

  put: <T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<AxiosResponse<ApiEnvelope<T>>> => {
    const body = typeof data === "object" && data !== null ? cleanObject(data as Record<string, unknown>) : data;
    return apiClient.put(url, body, config);
  },

  patch: <T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<AxiosResponse<ApiEnvelope<T>>> => {
    const body = typeof data === "object" && data !== null ? cleanObject(data as Record<string, unknown>) : data;
    return apiClient.patch(url, body, config);
  },

  delete: <T = unknown>(
    url: string,
    config?: RequestConfig
  ): Promise<AxiosResponse<ApiEnvelope<T>>> => {
    return apiClient.delete(url, config);
  },

  upload: <T = unknown>(
    url: string,
    file: File,
    additionalData?: Record<string, string | Blob>,
    config?: RequestConfig
  ): Promise<AxiosResponse<ApiEnvelope<T>>> => {
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

export const unwrap = async <T>(p: Promise<AxiosResponse<ApiEnvelope<T> | T>>): Promise<T> => {
  try {
    const res = await p;
    return pickData(res);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.debug("[api_v1] unwrap error", error);
    throw normalizeError(error);
  }
};

export const withAuth = (config?: RequestConfig): RequestConfig => ({
  ...config,
  skipAuth: false,
});

export const withoutAuth = (config?: RequestConfig): RequestConfig => ({
  ...config,
  skipAuth: true,
});
