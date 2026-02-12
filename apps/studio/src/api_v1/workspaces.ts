import { api, unwrap } from "./client";
import type { PaginatedResult, PaginationQuery, Workspace, WorkspaceMember } from "./types";
import type { RequestConfig } from "./client";

export interface CreateWorkspacePayload {
  name: string;
  description?: string;
  icon?: string;
}

export interface UpdateWorkspacePayload {
  name?: string;
  description?: string | null;
  icon?: string | null;
  settings?: Record<string, unknown>;
}

export interface InviteMemberPayload {
  userId?: string;
  email?: string;
  role: string;
}

export interface UpdateMemberRolePayload {
  role: string;
}

export const createWorkspace = (payload: CreateWorkspacePayload, config?: RequestConfig) => {
  return unwrap<Workspace>(api.post("/workspaces", payload, config));
};

export const listWorkspaces = (
  query: PaginationQuery = { page: 1, pageSize: 20 },
  config?: RequestConfig
) => {
  return unwrap<PaginatedResult<Workspace>>(api.get("/workspaces", { ...query }, config));
};

export const getWorkspace = (workspaceId: string, config?: RequestConfig) => {
  return unwrap<Workspace>(api.get(`/workspaces/${workspaceId}`, undefined, config));
};

export const updateWorkspace = (
  workspaceId: string,
  payload: UpdateWorkspacePayload,
  config?: RequestConfig
) => {
  return unwrap<Workspace>(api.patch(`/workspaces/${workspaceId}`, payload, config));
};

export const deleteWorkspace = (workspaceId: string, config?: RequestConfig) => {
  return unwrap<void>(api.delete(`/workspaces/${workspaceId}`, config));
};

export const inviteMember = (
  workspaceId: string,
  payload: InviteMemberPayload,
  config?: RequestConfig
) => {
  return unwrap<WorkspaceMember>(api.post(`/workspaces/${workspaceId}/members`, payload, config));
};

export const listMembers = (
  workspaceId: string,
  query: PaginationQuery = { page: 1, pageSize: 20 },
  config?: RequestConfig
) => {
  return unwrap<PaginatedResult<WorkspaceMember>>(
    api.get(`/workspaces/${workspaceId}/members`, { ...query }, config)
  );
};

export const updateMemberRole = (
  workspaceId: string,
  userId: string,
  payload: UpdateMemberRolePayload,
  config?: RequestConfig
) => {
  return unwrap<WorkspaceMember>(
    api.patch(`/workspaces/${workspaceId}/members/${userId}`, payload, config)
  );
};

export const removeMember = (workspaceId: string, userId: string, config?: RequestConfig) => {
  return unwrap<void>(api.delete(`/workspaces/${workspaceId}/members/${userId}`, config));
};

export const workspaceApi = {
  createWorkspace,
  listWorkspaces,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  inviteMember,
  listMembers,
  updateMemberRole,
  removeMember,
};
