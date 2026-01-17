# API 使用文档

## 目录

- [基础信息](#基础信息)
- [认证流程](#认证流程)
- [API 接口](#api-接口)
- [错误处理](#错误处理)
- [示例代码](#示例代码)

---

## 基础信息

### 基础 URL

```
开发环境: http://localhost:5200
API 前缀: /api/v1
```

### 完整 API 地址示例

```
http://localhost:5200/api/v1/auth/register
```

### 响应格式

所有 API 响应都遵循统一格式：

**成功响应：**
```json
{
  "success": true,
  "data": {
    // 响应数据
  },
  "meta": {
    // 可选：分页信息等
  }
}
```

**错误响应：**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述信息",
    "details": {}
  }
}
```

### 认证方式

大部分接口需要 JWT Token 认证，在请求头中添加：

```
Authorization: Bearer <your-access-token>
```

---

## 认证流程

### 1. 用户注册

**接口：** `POST /api/v1/auth/register`

**请求体：**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "displayName": "John Doe"
}
```

**字段说明：**
- `username`: 用户名，3-50个字符，只能包含字母、数字和下划线
- `email`: 邮箱地址，必须符合邮箱格式
- `password`: 密码，至少8位，必须包含大小写字母和数字
- `displayName`: 显示名称（可选），最多100个字符

**响应示例：**
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "u_1705123456789_abc123",
      "username": "john_doe",
      "email": "john@example.com",
      "displayName": "John Doe",
      "avatar": null
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. 用户登录

**接口：** `POST /api/v1/auth/login`

**请求体：**
```json
{
  "emailOrUsername": "john@example.com",
  "password": "SecurePass123!"
}
```

**字段说明：**
- `emailOrUsername`: 邮箱或用户名
- `password`: 密码

**响应示例：**
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "u_1705123456789_abc123",
      "username": "john_doe",
      "email": "john@example.com",
      "displayName": "John Doe",
      "avatar": null
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 3. 刷新令牌

当 Access Token 过期时，使用 Refresh Token 获取新的 Access Token。

**接口：** `POST /api/v1/auth/refresh`

**请求体：**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 4. 获取当前用户信息

**接口：** `GET /api/v1/auth/me`

**请求头：**
```
Authorization: Bearer <your-access-token>
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "userId": "u_1705123456789_abc123",
    "username": "john_doe",
    "email": "john@example.com",
    "displayName": "John Doe",
    "avatar": null,
    "bio": null,
    "settings": {},
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 5. 用户登出

**接口：** `POST /api/v1/auth/logout`

**请求头：**
```
Authorization: Bearer <your-access-token>
```

**请求体：**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**响应：**
- 状态码：`204 No Content`
- 无响应体

---

## API 接口

### 认证相关接口

| 方法 | 路径 | 说明 | 需要认证 |
|------|------|------|---------|
| POST | `/auth/register` | 用户注册 | ❌ |
| POST | `/auth/login` | 用户登录 | ❌ |
| POST | `/auth/refresh` | 刷新令牌 | ❌ |
| POST | `/auth/logout` | 用户登出 | ✅ |
| GET | `/auth/me` | 获取当前用户 | ✅ |

### Token 说明

- **Access Token**: 用于访问受保护的接口，默认有效期 24 小时
- **Refresh Token**: 用于刷新 Access Token，默认有效期 7 天
- Token 存储在响应中的 `accessToken` 和 `refreshToken` 字段

---

## 错误处理

### 常见错误码

| 错误码 | HTTP 状态码 | 说明 |
|--------|------------|------|
| `VALIDATION_ERROR` | 400 | 请求参数验证失败 |
| `UNAUTHORIZED` | 401 | 未授权，Token 无效或过期 |
| `AUTH_FAILED` | 401 | 认证失败，用户名或密码错误 |
| `TOKEN_EXPIRED` | 401 | Token 已过期 |
| `TOKEN_INVALID` | 401 | Token 无效 |
| `ACCESS_DENIED` | 403 | 访问被拒绝，权限不足 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `ALREADY_EXISTS` | 409 | 资源已存在（如用户名或邮箱已注册） |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

### 错误响应示例

**验证错误：**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "用户名只能包含字母、数字和下划线; 密码至少8位"
  }
}
```

**认证失败：**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_FAILED",
    "message": "用户名或密码错误"
  }
}
```

**资源已存在：**
```json
{
  "success": false,
  "error": {
    "code": "ALREADY_EXISTS",
    "message": "用户名或邮箱已存在"
  }
}
```

**Token 过期：**
```json
{
  "success": false,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Token 已过期，请使用 Refresh Token 刷新"
  }
}
```

---

## 示例代码

### JavaScript / TypeScript (Fetch API)

#### 注册用户

```typescript
async function register() {
  const response = await fetch('http://localhost:5200/api/v1/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: 'john_doe',
      email: 'john@example.com',
      password: 'SecurePass123!',
      displayName: 'John Doe',
    }),
  });

  const data = await response.json();
  
  if (data.success) {
    // 保存 token
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    console.log('注册成功:', data.data.user);
  } else {
    console.error('注册失败:', data.error);
  }
}
```

#### 用户登录

```typescript
async function login() {
  const response = await fetch('http://localhost:5200/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      emailOrUsername: 'john@example.com',
      password: 'SecurePass123!',
    }),
  });

  const data = await response.json();
  
  if (data.success) {
    // 保存 token
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    console.log('登录成功:', data.data.user);
  } else {
    console.error('登录失败:', data.error);
  }
}
```

#### 获取当前用户信息

```typescript
async function getCurrentUser() {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch('http://localhost:5200/api/v1/auth/me', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('当前用户:', data.data);
  } else {
    console.error('获取失败:', data.error);
  }
}
```

#### 刷新 Token

```typescript
async function refreshToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  
  const response = await fetch('http://localhost:5200/api/v1/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refreshToken: refreshToken,
    }),
  });

  const data = await response.json();
  
  if (data.success) {
    // 更新 token
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    console.log('Token 刷新成功');
  } else {
    console.error('刷新失败:', data.error);
    // Token 无效，需要重新登录
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
}
```

#### 自动处理 Token 过期

```typescript
async function apiRequest(url: string, options: RequestInit = {}) {
  let token = localStorage.getItem('accessToken');
  
  // 添加认证头
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  let response = await fetch(url, {
    ...options,
    headers,
  });

  // 如果 Token 过期，尝试刷新
  if (response.status === 401) {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      const refreshResponse = await fetch('http://localhost:5200/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const refreshData = await refreshResponse.json();
      
      if (refreshData.success) {
        // 更新 token 并重试请求
        localStorage.setItem('accessToken', refreshData.data.accessToken);
        localStorage.setItem('refreshToken', refreshData.data.refreshToken);
        
        headers['Authorization'] = `Bearer ${refreshData.data.accessToken}`;
        response = await fetch(url, {
          ...options,
          headers,
        });
      } else {
        // 刷新失败，需要重新登录
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        throw new Error('请重新登录');
      }
    }
  }

  return response.json();
}

// 使用示例
async function example() {
  const data = await apiRequest('http://localhost:5200/api/v1/auth/me', {
    method: 'GET',
  });
  console.log(data);
}
```

### cURL 示例

#### 注册用户

```bash
curl -X POST http://localhost:5200/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "SecurePass123!",
    "displayName": "John Doe"
  }'
```

#### 用户登录

```bash
curl -X POST http://localhost:5200/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrUsername": "john@example.com",
    "password": "SecurePass123!"
  }'
```

#### 获取当前用户

```bash
curl -X GET http://localhost:5200/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 刷新 Token

```bash
curl -X POST http://localhost:5200/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

### Axios 示例

```typescript
import axios from 'axios';

// 创建 axios 实例
const api = axios.create({
  baseURL: 'http://localhost:5200/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：添加 Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：处理 Token 过期
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 如果是 401 错误且未重试过
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post(
          'http://localhost:5200/api/v1/auth/refresh',
          { refreshToken }
        );

        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        // 重试原始请求
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // 刷新失败，清除 token 并跳转到登录页
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// 使用示例
async function getCurrentUser() {
  try {
    const response = await api.get('/auth/me');
    console.log('当前用户:', response.data.data);
  } catch (error) {
    console.error('获取失败:', error.response?.data);
  }
}
```

---

## Swagger API 文档

启动应用后，可以访问 Swagger 交互式 API 文档：

```
http://localhost:5200/api/docs
```

在 Swagger 文档中，你可以：
- 查看所有可用的 API 接口
- 查看请求/响应格式
- 直接在浏览器中测试 API
- 查看数据模型定义

---

## 最佳实践

### 1. Token 存储

- **Web 应用**: 使用 `localStorage` 或 `sessionStorage` 存储 Token
- **移动应用**: 使用安全的存储方案（如 Keychain/Keystore）
- **不要**将 Token 存储在 Cookie 中（除非设置了 `httpOnly` 和 `secure` 标志）

### 2. Token 刷新策略

- 在 Access Token 过期前（如剩余 5 分钟）自动刷新
- 实现自动重试机制，当收到 401 错误时自动刷新 Token 并重试请求
- 如果 Refresh Token 也过期，引导用户重新登录

### 3. 错误处理

- 始终检查响应中的 `success` 字段
- 根据 `error.code` 进行不同的错误处理
- 向用户显示友好的错误消息

### 4. 安全性

- 使用 HTTPS 传输（生产环境）
- 不要在日志中记录 Token
- 定期更新密码
- 实现请求频率限制

---

## 常见问题

### Q: Token 过期后怎么办？

A: 使用 Refresh Token 调用 `/auth/refresh` 接口获取新的 Access Token。

### Q: 如何判断 Token 是否过期？

A: 当 API 返回 401 状态码和 `TOKEN_EXPIRED` 错误码时，表示 Token 已过期。

### Q: Refresh Token 也会过期吗？

A: 是的，Refresh Token 默认有效期为 7 天。过期后需要重新登录。

### Q: 可以同时有多个有效的 Token 吗？

A: 可以，系统支持多设备登录，每个设备都有独立的会话。

### Q: 如何登出所有设备？

A: 目前需要逐个设备登出。未来版本可能会添加"登出所有设备"功能。

---

## 更新日志

### v1.0.0 (2024-01-17)
- ✅ 用户注册接口
- ✅ 用户登录接口
- ✅ Token 刷新接口
- ✅ 获取当前用户接口
- ✅ 用户登出接口

---

## 技术支持

如有问题，请查看：
- Swagger 文档: http://localhost:5200/api/docs
- 项目 README: [README.md](./README.md)
- 安装指南: [INSTALL.md](./INSTALL.md)
