import { api, unwrap } from "./client";
import type {
  RegisterRequest,
  LoginRequest,
  RefreshTokenRequest,
  LogoutRequest,
  User,
  AuthTokens,
} from "./types";

/**
 * 认证相关 API 服务
 */
export const authApi = {
  /**
   * 用户注册
   */
  register: async (data: RegisterRequest): Promise<AuthTokens> => {
    return unwrap<AuthTokens>(api.post("/auth/register", data, { skipAuth: true }));
  },

  /**
   * 用户登录
   */
  login: async (data: LoginRequest): Promise<AuthTokens> => {
    return unwrap<AuthTokens>(api.post("/auth/login", data, { skipAuth: true }));
  },

  /**
   * 刷新访问令牌
   */
  refreshToken: async (data: RefreshTokenRequest): Promise<AuthTokens> => {
    return unwrap<AuthTokens>(api.post("/auth/refresh", data, { skipAuth: true }));
  },

  /**
   * 用户退出
   */
  logout: async (data: LogoutRequest): Promise<void> => {
    await unwrap(api.post("/auth/logout", data));
  },

  /**
   * 获取当前用户信息
   */
  getCurrentUser: async (): Promise<User> => {
    return unwrap<User>(api.get("/auth/me"));
  },
};
