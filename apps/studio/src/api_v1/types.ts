export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiErrorShape {
  code?: string;
  message?: string | string[];
}

export interface ApiEnvelope<T = unknown> {
  success?: boolean;
  data?: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
  error?: ApiErrorShape;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
}

export interface User {
  userId: string;
  username?: string;
  email?: string;
  displayName?: string;
  avatar?: string | null;
  bio?: string | null;
  status?: string;
  settings?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface Workspace {
  workspaceId: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  userRole?: string;
  settings?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkspaceMember {
  userId: string;
  role: string;
  displayName?: string;
  avatar?: string | null;
  email?: string;
}

export interface DocumentMeta {
  docId: string;
  workspaceId?: string;
  title?: string;
  icon?: string | null;
  cover?: string | null;
  visibility?: string;
  status?: string;
  parentId?: string | null;
  tags?: string[];
  category?: string | null;
  head?: number;
  publishedHead?: number | null;
  rootBlockId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentContent {
  docId: string;
  docVer?: number;
  title?: string;
  tree?: DocumentContentTreeNode;
  pagination?: DocumentContentPagination;
  totalBlocks?: number;
  returnedBlocks?: number;
  hasMore?: boolean;
  nextStartBlockId?: string | null;
  version?: number;
}

export interface DocumentContentTreeNode {
  blockId: string;
  type: string;
  payload?: unknown;
  parentId?: string;
  sortKey?: string;
  indent?: number;
  collapsed?: boolean;
  children?: DocumentContentTreeNode[];
}

export interface DocumentContentPagination {
  totalBlocks?: number;
  returnedBlocks?: number;
  hasMore?: boolean;
  nextStartBlockId?: string | null;
}

export interface DocumentRevision {
  version: number;
  message?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface DocumentDiff {
  fromVersion: number;
  toVersion: number;
  diff?: unknown;
}

export interface PendingVersions {
  pendingCount?: number;
  hasPending?: boolean;
}

export interface BlockVersion {
  version: number;
  createdAt?: string;
  createdBy?: string;
  payload?: unknown;
}

export interface Tag {
  tagId: string;
  workspaceId: string;
  name: string;
  color?: string;
  createdAt?: string;
}

export interface TagUsage {
  tagId: string;
  usageCount?: number;
}

export interface FavoriteItem {
  docId: string;
  title?: string;
  workspaceId?: string;
  createdAt?: string;
}

export interface Comment {
  commentId: string;
  docId: string;
  content: string;
  blockId?: string;
  parentCommentId?: string;
  mentions?: string[];
  createdAt?: string;
  createdBy?: string;
}

export interface SearchResultItem {
  id: string;
  type: "doc" | "block" | "other" | string;
  title?: string;
  snippet?: string;
  workspaceId?: string;
}

export interface ActivityItem {
  activityId?: string;
  workspaceId: string;
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  createdAt?: string;
}

export interface AssetItem {
  assetId: string;
  workspaceId: string;
  name?: string;
  size?: number;
  mimeType?: string;
  url?: string;
  createdAt?: string;
}

export interface SecurityEvent {
  eventId?: string;
  eventType?: string;
  userId?: string;
  ip?: string;
  createdAt?: string;
  detail?: unknown;
}

export interface AuditLog {
  auditId?: string;
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  createdAt?: string;
  detail?: unknown;
}
