import { api, unwrap } from "./client";
import type { PaginatedResult, PaginationQuery, Tag, TagUsage } from "./types";
import type { RequestConfig } from "./client";

export interface CreateTagPayload {
  workspaceId: string;
  name: string;
  color?: string;
}

export interface UpdateTagPayload {
  name?: string;
  color?: string;
}

export const createTag = (payload: CreateTagPayload, config?: RequestConfig) => {
  return unwrap<Tag>(api.post("/tags", payload, config));
};

export const listTags = (
  query: PaginationQuery & { workspaceId: string },
  config?: RequestConfig
) => {
  return unwrap<PaginatedResult<Tag>>(api.get("/tags", { ...query }, config));
};

export const getTag = (tagId: string, config?: RequestConfig) => {
  return unwrap<Tag>(api.get(`/tags/${tagId}`, undefined, config));
};

export const getTagUsage = (tagId: string, config?: RequestConfig) => {
  return unwrap<TagUsage>(api.get(`/tags/${tagId}/usage`, undefined, config));
};

export const updateTag = (tagId: string, payload: UpdateTagPayload, config?: RequestConfig) => {
  return unwrap<Tag>(api.patch(`/tags/${tagId}`, payload, config));
};

export const deleteTag = (tagId: string, config?: RequestConfig) => {
  return unwrap<void>(api.delete(`/tags/${tagId}`, config));
};

export const tagApi = {
  createTag,
  listTags,
  getTag,
  getTagUsage,
  updateTag,
  deleteTag,
};
