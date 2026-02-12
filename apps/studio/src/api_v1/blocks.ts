import { api, unwrap } from "./client";
import type { BlockVersion, PaginatedResult, PaginationQuery } from "./types";
import type { RequestConfig } from "./client";

export interface CreateBlockPayload {
  docId: string;
  type: string;
  payload: unknown;
  parentId?: string;
  sortKey?: string;
  indent?: number;
  collapsed?: boolean;
  createVersion?: boolean;
}

export interface UpdateBlockContentPayload {
  payload: unknown;
  plainText?: string;
  createVersion?: boolean;
}

export interface MoveBlockPayload {
  parentId: string;
  sortKey: string;
  indent?: number;
  createVersion?: boolean;
}

export interface BatchOperation {
  type: "create" | "update" | "delete" | "move";
  blockId?: string;
  payload?: unknown;
  parentId?: string;
  sortKey?: string;
  indent?: number;
}

export interface BatchBlocksPayload {
  docId: string;
  operations: BatchOperation[];
  createVersion?: boolean;
}

export const createBlock = (payload: CreateBlockPayload, config?: RequestConfig) => {
  return unwrap<{ blockId: string; docId: string }>(api.post("/blocks", payload, config));
};

export const updateBlockContent = (
  blockId: string,
  payload: UpdateBlockContentPayload,
  config?: RequestConfig
) => {
  return unwrap<void>(api.patch(`/blocks/${blockId}/content`, payload, config));
};

export const moveBlock = (
  blockId: string,
  payload: MoveBlockPayload,
  config?: RequestConfig
) => {
  return unwrap<void>(api.post(`/blocks/${blockId}/move`, payload, config));
};

export const deleteBlock = (blockId: string, config?: RequestConfig) => {
  return unwrap<void>(api.delete(`/blocks/${blockId}`, config));
};

export const getBlockVersions = (
  blockId: string,
  query: PaginationQuery = { page: 1, pageSize: 20 },
  config?: RequestConfig
) => {
  return unwrap<PaginatedResult<BlockVersion>>(api.get(`/blocks/${blockId}/versions`, { ...query }, config));
};

export const batchBlocks = (payload: BatchBlocksPayload, config?: RequestConfig) => {
  return unwrap<void>(api.post("/blocks/batch", payload, config));
};

export const blockApi = {
  createBlock,
  updateBlockContent,
  moveBlock,
  deleteBlock,
  getBlockVersions,
  batchBlocks,
};
