// API 模块测试文件
import { apiClient, tokenManager, authApi } from "./index";

// 测试token管理
export const testTokenManager = () => {
  console.log('Testing Token Manager...');

  // 测试初始状态
  console.log('Initial state:', {
    accessToken: !!tokenManager.getAccessToken(),
    refreshToken: !!tokenManager.getRefreshToken(),
    isAuthenticated: tokenManager.isAuthenticated(),
  });

  // 测试设置token
  tokenManager.setTokens('test_access_token', 'test_refresh_token');
  console.log('After setting tokens:', {
    accessToken: !!tokenManager.getAccessToken(),
    refreshToken: !!tokenManager.getRefreshToken(),
    isAuthenticated: tokenManager.isAuthenticated(),
  });

  // 测试清除token
  tokenManager.clearTokens();
  console.log('After clearing tokens:', {
    accessToken: !!tokenManager.getAccessToken(),
    refreshToken: !!tokenManager.getRefreshToken(),
    isAuthenticated: tokenManager.isAuthenticated(),
  });
};

// 测试API客户端（注意：这只是测试客户端配置，不会实际调用API）
export const testApiClient = () => {
  console.log("Testing API Client...");
  const requestHandlers = (apiClient.interceptors.request as unknown as { handlers?: unknown[] }).handlers;
  const responseHandlers = (apiClient.interceptors.response as unknown as { handlers?: unknown[] }).handlers;

  console.log("API Client created:", !!apiClient);
  console.log("Interceptors configured:", Array.isArray(requestHandlers) ? requestHandlers.length > 0 : "unknown");
  console.log("Response interceptors configured:", Array.isArray(responseHandlers) ? responseHandlers.length > 0 : "unknown");
};

// 测试认证API方法（不会实际调用）
export const testAuthApi = () => {
  console.log('Testing Auth API methods...');
  console.log('register method:', typeof authApi.register);
  console.log('login method:', typeof authApi.login);
  console.log('refreshToken method:', typeof authApi.refreshToken);
  console.log('logout method:', typeof authApi.logout);
  console.log('getCurrentUser method:', typeof authApi.getCurrentUser);
};

// 运行所有测试
export const runAllTests = () => {
  console.log('🚀 Starting API Module Tests...\n');

  testTokenManager();
  console.log('');

  testApiClient();
  console.log('');

  testAuthApi();
  console.log('');

  console.log('✅ All API module tests completed!');
};

// 在浏览器控制台中运行：
// import('./api/test').then(m => m.runAllTests())
