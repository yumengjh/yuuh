import { api, unwrap } from "./client";
import type { Comment, PaginatedResult, PaginationQuery } from "./types";
import type { RequestConfig } from "./client";

export interface CreateCommentPayload {
  docId: string;
  content: string;
  blockId?: string;
  mentions?: string[];
  parentCommentId?: string;
}

export interface UpdateCommentPayload {
  content: string;
}

export interface ListCommentsQuery extends PaginationQuery {
  docId: string;
  blockId?: string;
}

export const createComment = (payload: CreateCommentPayload, config?: RequestConfig) => {
  return unwrap<Comment>(api.post("/comments", payload, config));
};

export const listComments = (query: ListCommentsQuery, config?: RequestConfig) => {
  return unwrap<PaginatedResult<Comment>>(api.get("/comments", { ...query }, config));
};

export const getComment = (commentId: string, config?: RequestConfig) => {
  return unwrap<Comment>(api.get(`/comments/${commentId}`, undefined, config));
};

export const updateComment = (
  commentId: string,
  payload: UpdateCommentPayload,
  config?: RequestConfig
) => {
  return unwrap<Comment>(api.patch(`/comments/${commentId}`, payload, config));
};

export const deleteComment = (commentId: string, config?: RequestConfig) => {
  return unwrap<void>(api.delete(`/comments/${commentId}`, config));
};

export const commentApi = {
  createComment,
  listComments,
  getComment,
  updateComment,
  deleteComment,
};
