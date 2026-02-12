import { api, unwrap } from "./client";
import type {
  DocumentContent,
  DocumentDiff,
  DocumentMeta,
  DocumentRevision,
  PaginatedResult,
  PaginationQuery,
  PendingVersions,
} from "./types";
import type { RequestConfig } from "./client";

export interface CreateDocumentPayload {
  workspaceId: string;
  title: string;
  icon?: string;
  cover?: string;
  visibility?: string;
  parentId?: string | null;
  tags?: string[];
  category?: string;
}

export interface UpdateDocumentPayload {
  title?: string;
  icon?: string | null;
  cover?: string | null;
  visibility?: string;
  status?: string;
  parentId?: string | null;
  tags?: string[];
  category?: string | null;
}

export interface ListDocumentsQuery extends PaginationQuery {
  workspaceId?: string;
  status?: string;
  visibility?: string;
  parentId?: string | null;
  tags?: string[];
  category?: string;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
  search?: string;
}

export interface SearchDocumentsQuery extends PaginationQuery {
  query: string;
  workspaceId?: string;
  status?: string;
  tags?: string[];
}

export interface DocumentContentQuery {
  version?: number;
  maxDepth?: number;
  startBlockId?: string;
  limit?: number;
}

export interface MoveDocumentPayload {
  parentId?: string | null;
  sortOrder?: number;
}

export interface RevertDocumentPayload {
  version: number;
}

export interface CommitDocumentPayload {
  message?: string;
}

export const createDocument = (payload: CreateDocumentPayload, config?: RequestConfig) => {
  return unwrap<DocumentMeta>(api.post("/documents", payload, config));
};

export const listDocuments = (query: ListDocumentsQuery = {}, config?: RequestConfig) => {
  return unwrap<PaginatedResult<DocumentMeta>>(api.get("/documents", { ...query }, config));
};

export const searchDocuments = (query: SearchDocumentsQuery, config?: RequestConfig) => {
  return unwrap<PaginatedResult<DocumentMeta>>(api.get("/documents/search", { ...query }, config));
};

export const getDocument = (docId: string, config?: RequestConfig) => {
  return unwrap<DocumentMeta>(api.get(`/documents/${docId}`, undefined, config));
};

export const getDocumentContent = (
  docId: string,
  query: DocumentContentQuery = {},
  config?: RequestConfig
) => {
  return unwrap<DocumentContent>(api.get(`/documents/${docId}/content`, { ...query }, config));
};

export const updateDocument = (
  docId: string,
  payload: UpdateDocumentPayload,
  config?: RequestConfig
) => {
  return unwrap<DocumentMeta>(api.patch(`/documents/${docId}`, payload, config));
};

export const publishDocument = (docId: string, config?: RequestConfig) => {
  return unwrap<DocumentMeta>(api.post(`/documents/${docId}/publish`, undefined, config));
};

export const moveDocument = (
  docId: string,
  payload: MoveDocumentPayload,
  config?: RequestConfig
) => {
  return unwrap<void>(api.post(`/documents/${docId}/move`, payload, config));
};

export const deleteDocument = (docId: string, config?: RequestConfig) => {
  return unwrap<void>(api.delete(`/documents/${docId}`, config));
};

export const getRevisions = (
  docId: string,
  query: PaginationQuery = { page: 1, pageSize: 20 },
  config?: RequestConfig
) => {
  return unwrap<PaginatedResult<DocumentRevision>>(api.get(`/documents/${docId}/revisions`, { ...query }, config));
};

export const getDiff = (
  docId: string,
  params: { fromVer: number; toVer: number },
  config?: RequestConfig
) => {
  return unwrap<DocumentDiff>(api.get(`/documents/${docId}/diff`, { ...params }, config));
};

export const revertDocument = (
  docId: string,
  payload: RevertDocumentPayload,
  config?: RequestConfig
) => {
  return unwrap<void>(api.post(`/documents/${docId}/revert`, payload, config));
};

export const createSnapshot = (docId: string, config?: RequestConfig) => {
  return unwrap<void>(api.post(`/documents/${docId}/snapshots`, undefined, config));
};

export const commitDocument = (
  docId: string,
  payload: CommitDocumentPayload = {},
  config?: RequestConfig
) => {
  return unwrap<void>(api.post(`/documents/${docId}/commit`, payload, config));
};

export const getPendingVersions = (docId: string, config?: RequestConfig) => {
  return unwrap<PendingVersions>(api.get(`/documents/${docId}/pending-versions`, undefined, config));
};

export const documentApi = {
  createDocument,
  listDocuments,
  searchDocuments,
  getDocument,
  getDocumentContent,
  updateDocument,
  publishDocument,
  moveDocument,
  deleteDocument,
  getRevisions,
  getDiff,
  revertDocument,
  createSnapshot,
  commitDocument,
  getPendingVersions,
};
