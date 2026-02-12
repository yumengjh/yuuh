import { api, unwrap } from "./client";
import type { PaginatedResult, PaginationQuery, SearchResultItem } from "./types";
import type { RequestConfig } from "./client";

export interface GlobalSearchQuery extends PaginationQuery {
  query: string;
  workspaceId?: string;
  type?: "doc" | "block" | "all" | string;
}

export interface AdvancedSearchPayload extends PaginationQuery {
  query: string;
  workspaceId?: string;
  type?: string;
  tags?: string[];
  startDate?: string;
  endDate?: string;
  createdBy?: string;
  sortBy?: string;
  sortOrder?: string;
}

export const globalSearch = (query: GlobalSearchQuery, config?: RequestConfig) => {
  return unwrap<PaginatedResult<SearchResultItem>>(api.get("/search", { ...query }, config));
};

export const advancedSearch = (payload: AdvancedSearchPayload, config?: RequestConfig) => {
  return unwrap<PaginatedResult<SearchResultItem>>(api.post("/search/advanced", payload, config));
};

export const searchApi = {
  globalSearch,
  advancedSearch,
};
