// API 服务统一对外出口

// 基础客户端和工具
export { apiClient, api, tokenManager, unwrap } from "./client";
export type { ApiResponse, ApiErrorShape, NormalizedApiError } from "./client";

// 类型定义
export type * from "./types";

// 服务模块
export * from "./auth";
// export * from './workspaces';
// export * from './documents';
// export * from './blocks';
// export * from './tags';
// export * from './favorites';
// export * from './comments';
// export * from './search';
// export * from './assets';
// export * from './activities';

// 测试模块（仅开发环境）
export * from "./test";
