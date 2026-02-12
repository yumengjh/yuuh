// API 相关类型定义

// 分页参数
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
  };
}

// 工作空间相关
// 用户认证相关类型
export interface User {
  userId: string;
  username: string;
  email: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  settings?: Record<string, unknown>;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Workspace {
  workspaceId: string;
  name: string;
  description?: string;
  icon?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'archived';
  settings?: Record<string, unknown>;
  userRole?: 'owner' | 'admin' | 'editor' | 'viewer';
}

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  icon?: string;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
  icon?: string;
  status?: 'active' | 'archived';
}

// 工作空间成员
export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  joinedAt: string;
  invitedBy?: string;
  user?: {
    userId: string;
    username: string;
    email: string;
    displayName?: string;
    avatar?: string;
  };
}

export interface InviteMemberRequest {
  userId: string;
  role: 'admin' | 'editor' | 'viewer'; // 不能邀请owner
}

// 文档相关
export interface Document {
  docId: string;
  workspaceId: string;
  title: string;
  icon?: string;
  cover?: string;
  head: number;
  publishedHead?: number;
  rootBlockId: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  status: 'draft' | 'normal' | 'archived' | 'deleted';
  visibility: 'private' | 'workspace' | 'public';
  parentId?: string;
  sortOrder: number;
  viewCount: number;
  favoriteCount: number;
  tags: string[];
  category?: string;
}

export interface CreateDocumentRequest {
  workspaceId: string;
  title: string;
  icon?: string;
  cover?: string;
  visibility?: 'private' | 'workspace' | 'public';
  parentId?: string;
  tags?: string[];
  category?: string;
}

export interface UpdateDocumentRequest {
  title?: string;
  icon?: string;
  cover?: string;
  status?: 'draft' | 'normal' | 'archived' | 'deleted';
  visibility?: 'private' | 'workspace' | 'public';
  parentId?: string;
  sortOrder?: number;
  tags?: string[];
  category?: string;
}

export interface MoveDocumentRequest {
  parentId?: string;
  sortOrder?: number;
}

export type PublishDocumentRequest = Record<string, never>;

export interface DocumentContentParams {
  version?: number; // 默认最新版本
  maxDepth?: number; // 0=仅根，1=根+一层，默认全量
  startBlockId?: string; // 分页起始块ID
  limit?: number; // 默认1000，最大5000
}

// 文档内容响应
export interface DocumentContent {
  docId: string;
  docVer: number;
  title: string;
  tree: RenderNode;
  pagination?: {
    totalBlocks: number;
    returnedBlocks: number;
    hasMore: boolean;
    nextStartBlockId?: string;
  };
}

// 块相关类型（与engine/types.ts保持一致）
export type BlockType = "root" | "paragraph" | "heading" | "listItem" | "code" | "quote" | "image" | `custom:${string}`;

export interface BlockIdentity {
  _id: string;
  docId: string;
  type: BlockType;
  createdAt: number;
  createdBy: string;
  latestVer: number;
  latestAt: number;
  latestBy: string;
  isDeleted: boolean;
  deletedAt?: number;
  deletedBy?: string;
}

export interface BlockVersion {
  versionId: string;
  docId: string;
  blockId: string;
  ver: number;
  createdAt: number;
  createdBy: string;
  parentId: string;
  sortKey: string;
  indent: number;
  collapsed: boolean;
  payload: unknown;
  hash: string;
  plainText?: string;
  refs: unknown[];
}

export interface RenderNode {
  block: BlockIdentity;
  version: BlockVersion;
  children: RenderNode[];
}

// 块操作相关
export interface CreateBlockRequest {
  docId: string;
  type: BlockType;
  payload: unknown;
  parentId?: string;
  sortKey?: string;
  indent?: number;
  collapsed?: boolean;
  createVersion?: boolean; // 默认true
}

export interface UpdateBlockContentRequest {
  payload: unknown;
  plainText?: string;
  createVersion?: boolean; // 默认true
}

export interface MoveBlockRequest {
  parentId: string;
  sortKey?: string;
  indent?: number;
  createVersion?: boolean; // 默认true
}

export interface BatchBlockOperation {
  type: 'create' | 'update' | 'delete' | 'move';
  blockId?: string; // create时不需要
  data?: CreateBlockRequest | UpdateBlockContentRequest | MoveBlockRequest; // delete不需要data
}

export interface BatchBlocksRequest {
  docId: string;
  createVersion?: boolean; // 默认true
  operations: BatchBlockOperation[];
}

// 版本控制相关
export interface DocumentRevision {
  revisionId: string;
  docId: string;
  docVer: number;
  createdAt: number;
  createdBy: string;
  message: string;
  branch: 'draft' | 'published';
  patches: unknown[];
  rootBlockId: string;
  source: 'editor' | 'api' | 'import';
  opSummary?: unknown;
}

export interface CommitVersionRequest {
  message?: string;
}

export interface PendingVersionsResponse {
  pendingCount: number;
  hasPending: boolean;
}

// 标签相关
export interface Tag {
  tagId: string;
  workspaceId: string;
  name: string;
  color?: string;
  createdBy: string;
  createdAt: string;
  usageCount: number;
}

export interface CreateTagRequest {
  workspaceId: string;
  name: string;
  color?: string;
}

export interface UpdateTagRequest {
  name?: string;
  color?: string;
}

// 收藏相关
export interface Favorite {
  userId: string;
  docId: string;
  createdAt: string;
  document?: Document; // 关联的文档信息
}

// 评论相关
export interface Comment {
  commentId: string;
  docId: string;
  blockId?: string;
  userId: string;
  content: string;
  mentions?: string[];
  parentCommentId?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  user?: {
    userId: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
}

export interface CreateCommentRequest {
  docId: string;
  content: string;
  blockId?: string;
  mentions?: string[];
  parentCommentId?: string;
}

// 搜索相关
export interface SearchQuery {
  query: string;
  workspaceId?: string;
  type?: 'doc' | 'block' | 'all';
  page?: number;
  pageSize?: number;
}

export interface AdvancedSearchQuery {
  query: string;
  workspaceId?: string;
  type?: 'doc' | 'block' | 'all';
  tags?: string[];
  startDate?: string;
  endDate?: string;
  createdBy?: string;
  sortBy?: 'rank' | 'updatedAt' | 'createdAt';
  sortOrder?: 'ASC' | 'DESC';
  page?: number;
  pageSize?: number;
}

// 资产相关
export interface Asset {
  assetId: string;
  workspaceId: string;
  uploadedBy: string;
  filename: string;
  mimeType: string;
  size: number;
  storageProvider: string;
  storagePath: string;
  url: string;
  width?: number;
  height?: number;
  thumbnail?: string;
  createdAt: string;
  status: 'active' | 'deleted';
  refCount: number;
  refs: unknown[];
}

// 活动日志相关
export interface Activity {
  activityId: string;
  workspaceId: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  details?: unknown;
  metadata?: unknown;
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
}

// 安全日志相关
export interface SecurityEvent {
  eventType: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  details?: unknown;
  createdAt: string;
}

export interface AuditLog {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: unknown;
  createdAt: string;
  ipAddress?: string;
}

// 认证相关请求
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginRequest {
  emailOrUsername: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  token: string; // access或refresh token
}