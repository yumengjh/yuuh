# API 模块使用说明

## 模块概览
- `client.ts`：统一的 Axios 实例，自动带上 Bearer Token，401 时单例刷新 token 并重放请求，提供 `api`（通用请求方法）、`unwrap`（直接取 data）、`tokenManager`（本地 token 存取）等工具。
- `auth.ts`：认证相关调用，登录/注册/刷新/退出/获取当前用户，登录相关接口默认跳过鉴权（`skipAuth`）。
- `types.ts`：请求与业务类型定义。
- `test.ts`：开发环境下的轻量自检脚本。

## 快速开始
```ts
// 入口统一从 @/api 引入
import { api, authApi, tokenManager, unwrap } from "@/api";
```

### 1) 登录/注册流程
```ts
// 登录（自动保存 token，可结合全局状态管理）
const tokens = await authApi.login({
  emailOrUsername: "john@example.com",
  password: "SecurePass123!",
});

// 注册
await authApi.register({
  username: "john_doe",
  email: "john@example.com",
  password: "SecurePass123!",
  displayName: "John Doe",
});
```

### 2) 认证态调用
```ts
// 获取当前用户
const me = await authApi.getCurrentUser();

// 退出登录
await authApi.logout({ refreshToken: tokenManager.getRefreshToken() || "" });
```

### 3) 通用请求示例
```ts
// 返回 AxiosResponse，包含 meta
const res = await api.get<YourType>("/documents", { page: 1 });
console.log(res.data.data, res.data.meta);

// 只要业务数据，使用 unwrap
const list = await unwrap(api.get<YourType[]>("/documents"));
```

### 4) 无需鉴权的请求
```ts
await api.get("/public/ping", {}, { skipAuth: true });
```

### 5) 文件上传
```ts
await api.upload("/assets", file, { folder: "docs" });
```

## 错误处理
- 所有异常经过 `normalizeError` 归一化，`unwrap` 会抛出 `{ status?, code?, message, raw }`，可直接用于全局提示或埋点。

## 环境配置
在根目录 `.env` 或 `.env.local` 配置：
```
VITE_API_BASE_URL=http://localhost:5200
```
默认请求前缀为 `/api/v1`，超时 30s。

## 开发辅助
浏览器控制台手动运行（仅开发环境）：
```ts
import("./api/test").then(m => m.runAllTests());
```

## 待实现模块
- workspaces.ts / documents.ts / blocks.ts / tags.ts / favorites.ts / comments.ts / search.ts / assets.ts / activities.ts
