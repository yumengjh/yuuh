import { api, unwrap } from "./client";
import type { RequestConfig } from "./client";
import type { DeepPartial, PreferenceSettings } from "../types/preferences";

type SettingsPayload = {
  settings?: DeepPartial<PreferenceSettings> | null;
};

type EffectiveSettingsPayload = {
  userSettings?: DeepPartial<PreferenceSettings>;
  workspaceSettings?: DeepPartial<PreferenceSettings> | null;
  effectiveSettings?: DeepPartial<PreferenceSettings>;
  sources?: Record<string, unknown>;
};

export type EffectiveSettingSource = "default" | "user" | "workspace";

const extractSettings = (
  payload: unknown
): DeepPartial<PreferenceSettings> | null => {
  if (!payload || typeof payload !== "object") return null;

  const settingsFromRoot =
    "settings" in (payload as Record<string, unknown>)
      ? ((payload as { settings?: unknown }).settings as
          | DeepPartial<PreferenceSettings>
          | undefined)
      : undefined;

  if (settingsFromRoot && typeof settingsFromRoot === "object") {
    return settingsFromRoot;
  }

  if ("reader" in (payload as Record<string, unknown>) || "editor" in (payload as Record<string, unknown>)) {
    return payload as DeepPartial<PreferenceSettings>;
  }

  return null;
};

const extractSources = (
  payload: unknown
): Record<string, EffectiveSettingSource> => {
  if (!payload || typeof payload !== "object") return {};
  const raw = payload as Record<string, unknown>;
  const entries = Object.entries(raw)
    .filter((entry): entry is [string, EffectiveSettingSource] => {
      const value = entry[1];
      return value === "default" || value === "user" || value === "workspace";
    });
  return Object.fromEntries(entries);
};

export const getMySettings = async (config?: RequestConfig) => {
  const data = await unwrap<SettingsPayload | DeepPartial<PreferenceSettings>>(
    api.get("/settings/me", undefined, config)
  );
  return extractSettings(data);
};

export const updateMySettings = async (
  settings: DeepPartial<PreferenceSettings>,
  config?: RequestConfig
) => {
  const data = await unwrap<SettingsPayload | DeepPartial<PreferenceSettings>>(
    api.patch("/settings/me", { settings }, config)
  );
  return extractSettings(data);
};

export const getWorkspaceSettings = async (
  workspaceId: string,
  config?: RequestConfig
) => {
  const data = await unwrap<SettingsPayload | DeepPartial<PreferenceSettings>>(
    api.get(`/workspaces/${workspaceId}/settings`, undefined, config)
  );
  return extractSettings(data);
};

export const updateWorkspaceSettings = async (
  workspaceId: string,
  settings: DeepPartial<PreferenceSettings>,
  config?: RequestConfig
) => {
  const data = await unwrap<SettingsPayload | DeepPartial<PreferenceSettings>>(
    api.patch(`/workspaces/${workspaceId}/settings`, { settings }, config)
  );
  return extractSettings(data);
};

export const clearWorkspaceSettings = async (
  workspaceId: string,
  config?: RequestConfig
) => {
  await unwrap<void>(api.delete(`/workspaces/${workspaceId}/settings`, config));
};

export const getEffectiveSettings = async (
  workspaceId?: string | null,
  config?: RequestConfig
) => {
  const params = workspaceId ? { workspaceId } : undefined;
  const data = await unwrap<EffectiveSettingsPayload>(
    api.get("/settings/effective", params, config)
  );
  return {
    userSettings: extractSettings(data.userSettings),
    workspaceSettings: extractSettings(data.workspaceSettings),
    effectiveSettings: extractSettings(data.effectiveSettings),
    sources: extractSources(data.sources),
  };
};

export const settingsApi = {
  getMySettings,
  updateMySettings,
  getWorkspaceSettings,
  updateWorkspaceSettings,
  clearWorkspaceSettings,
  getEffectiveSettings,
};
