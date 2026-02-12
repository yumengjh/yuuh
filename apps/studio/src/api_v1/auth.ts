import { api, unwrap, withoutAuth, tokenManager } from "./client";
import type { AuthTokens, User } from "./types";
import type { RequestConfig } from "./client";

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginPayload {
  emailOrUsername: string;
  password: string;
}

export interface LoginResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface UpdateMyProfilePayload {
  displayName?: string | null;
  avatar?: string | null;
  bio?: string | null;
}

export interface UserProfile {
  userId?: string;
  username?: string;
  email?: string;
  displayName?: string;
  avatar?: string | null;
  bio?: string | null;
  status?: string;
  updatedAt?: string;
}

export const register = (payload: RegisterPayload, config?: RequestConfig) => {
  return unwrap<LoginResult>(api.post("/auth/register", payload, withoutAuth(config)));
};

export const login = (payload: LoginPayload, config?: RequestConfig) => {
  return unwrap<LoginResult>(api.post("/auth/login", payload, withoutAuth(config)));
};

export const refresh = (refreshToken?: string, config?: RequestConfig) => {
  const token = refreshToken ?? tokenManager.getRefreshToken();
  return unwrap<AuthTokens>(
    api.post(
      "/auth/refresh",
      { refreshToken: token },
      withoutAuth(config)
    )
  );
};

export const me = (config?: RequestConfig) => {
  return unwrap<User>(api.get("/auth/me", undefined, config));
};

export const updateMyProfile = (payload: UpdateMyProfilePayload, config?: RequestConfig) => {
  return unwrap<User>(api.patch("/auth/me", payload, config));
};

export const getUserById = (userId: string, config?: RequestConfig) => {
  return unwrap<UserProfile>(
    api.get(`/auth/users/${encodeURIComponent(userId)}`, undefined, config)
  );
};

export const logout = (token?: string, config?: RequestConfig) => {
  const fallbackToken = tokenManager.getRefreshToken() ?? tokenManager.getAccessToken();
  return unwrap<void>(api.post("/auth/logout", { token: token ?? fallbackToken }, config));
};

export const authApi = {
  register,
  login,
  refresh,
  me,
  updateMyProfile,
  getUserById,
  logout,
};
