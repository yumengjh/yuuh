import { api, unwrap } from "./client";
import type { AuditLog, PaginatedResult, PaginationQuery, SecurityEvent } from "./types";
import type { RequestConfig } from "./client";

export interface SecurityEventsQuery extends PaginationQuery {
  eventType?: string;
  userId?: string;
  ip?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditLogsQuery extends PaginationQuery {
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
}

export const getSecurityEvents = (query: SecurityEventsQuery, config?: RequestConfig) => {
  return unwrap<PaginatedResult<SecurityEvent>>(api.get("/security/events", { ...query }, config));
};

export const getAuditLogs = (query: AuditLogsQuery, config?: RequestConfig) => {
  return unwrap<PaginatedResult<AuditLog>>(api.get("/security/audit", { ...query }, config));
};

export const securityApi = {
  getSecurityEvents,
  getAuditLogs,
};
