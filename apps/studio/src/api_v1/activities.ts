import { api, unwrap } from "./client";
import type { ActivityItem, PaginatedResult, PaginationQuery } from "./types";
import type { RequestConfig } from "./client";

export interface ListActivitiesQuery extends PaginationQuery {
  workspaceId: string;
  userId?: string;
  action?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
}

export const listActivities = (query: ListActivitiesQuery, config?: RequestConfig) => {
  return unwrap<PaginatedResult<ActivityItem>>(api.get("/activities", { ...query }, config));
};

export const activityApi = {
  listActivities,
};
