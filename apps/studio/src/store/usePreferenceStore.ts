import { create } from "zustand";
import { apiV1 } from "../api_v1";
import type {
  DeepPartial,
  PreferenceSettings,
} from "../types/preferences";
import {
  DEFAULT_PREFERENCE_SETTINGS,
  MAX_CONTENT_WIDTH,
  MIN_CONTENT_WIDTH,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
} from "../types/preferences";

type PreferenceLoadStatus = "idle" | "loading" | "success" | "error";

type PreferenceState = {
  workspaceId: string | null;
  userSettings: PreferenceSettings;
  workspaceSettings: DeepPartial<PreferenceSettings> | null;
  effectiveSettings: PreferenceSettings;
  sources: Record<string, "default" | "user" | "workspace">;
  status: {
    user: PreferenceLoadStatus;
    workspace: PreferenceLoadStatus;
    saveUser: PreferenceLoadStatus;
    saveWorkspace: PreferenceLoadStatus;
  };
  errors: {
    user?: string;
    workspace?: string;
    saveUser?: string;
    saveWorkspace?: string;
  };
};

type PreferenceActions = {
  hydrate: (workspaceId?: string | null) => Promise<void>;
  setWorkspaceContext: (workspaceId?: string | null) => Promise<void>;
  saveUserSettings: (patch: DeepPartial<PreferenceSettings>) => Promise<boolean>;
  saveWorkspaceSettings: (
    patch: DeepPartial<PreferenceSettings>,
    workspaceId?: string | null
  ) => Promise<boolean>;
  clearWorkspaceSettings: (workspaceId?: string | null) => Promise<boolean>;
  resetErrors: () => void;
};

const normalizeErrorMessage = (error: unknown): string => {
  if (!error || typeof error !== "object") return "请求失败，请稍后重试";
  const withMessage = error as { message?: unknown };
  if (typeof withMessage.message === "string" && withMessage.message.trim()) {
    return withMessage.message;
  }
  return "请求失败，请稍后重试";
};

const clampWidth = (value: unknown, fallback: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(MIN_CONTENT_WIDTH, Math.min(MAX_CONTENT_WIDTH, Math.round(value)));
};

const clampFontSize = (value: unknown, fallback: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.round(value)));
};

const normalizeSettings = (
  input?: DeepPartial<PreferenceSettings> | null
): PreferenceSettings => {
  const source = input || {};
  return {
    reader: {
      contentWidth: clampWidth(
        source.reader?.contentWidth,
        DEFAULT_PREFERENCE_SETTINGS.reader.contentWidth
      ),
      fontSize: clampFontSize(
        source.reader?.fontSize,
        DEFAULT_PREFERENCE_SETTINGS.reader.fontSize
      ),
    },
    editor: {
      contentWidth: clampWidth(
        source.editor?.contentWidth,
        DEFAULT_PREFERENCE_SETTINGS.editor.contentWidth
      ),
      fontSize: clampFontSize(
        source.editor?.fontSize,
        DEFAULT_PREFERENCE_SETTINGS.editor.fontSize
      ),
    },
    advanced: {
      compactList:
        typeof source.advanced?.compactList === "boolean"
          ? source.advanced.compactList
          : DEFAULT_PREFERENCE_SETTINGS.advanced.compactList,
      codeFontFamily:
        typeof source.advanced?.codeFontFamily === "string" &&
        source.advanced.codeFontFamily.trim()
          ? source.advanced.codeFontFamily.trim()
          : DEFAULT_PREFERENCE_SETTINGS.advanced.codeFontFamily,
    },
  };
};

const mergeSettings = (
  base: PreferenceSettings,
  patch?: DeepPartial<PreferenceSettings> | null
): PreferenceSettings => {
  if (!patch) return base;
  return normalizeSettings({
    reader: {
      contentWidth:
        patch.reader?.contentWidth ?? base.reader.contentWidth,
      fontSize: patch.reader?.fontSize ?? base.reader.fontSize,
    },
    editor: {
      contentWidth:
        patch.editor?.contentWidth ?? base.editor.contentWidth,
      fontSize: patch.editor?.fontSize ?? base.editor.fontSize,
    },
    advanced: {
      compactList:
        patch.advanced?.compactList ?? base.advanced.compactList,
      codeFontFamily:
        patch.advanced?.codeFontFamily ?? base.advanced.codeFontFamily,
    },
  });
};

const toPartialSettings = (
  settings: PreferenceSettings
): DeepPartial<PreferenceSettings> => {
  return {
    reader: {
      contentWidth: settings.reader.contentWidth,
      fontSize: settings.reader.fontSize,
    },
    editor: {
      contentWidth: settings.editor.contentWidth,
      fontSize: settings.editor.fontSize,
    },
    advanced: {
      compactList: settings.advanced.compactList,
      codeFontFamily: settings.advanced.codeFontFamily,
    },
  };
};

const computeEffectiveSettings = (
  userSettings: PreferenceSettings,
  workspaceSettings: DeepPartial<PreferenceSettings> | null
) => {
  if (!workspaceSettings) return userSettings;
  return mergeSettings(userSettings, workspaceSettings);
};

const hasAnySettingValue = (input?: DeepPartial<PreferenceSettings> | null): boolean => {
  if (!input || typeof input !== "object") return false;
  const queue: unknown[] = [input];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    for (const value of Object.values(current as Record<string, unknown>)) {
      if (value === null || value === undefined) continue;
      if (typeof value === "object") {
        queue.push(value);
        continue;
      }
      return true;
    }
  }
  return false;
};

export const usePreferenceStore = create<PreferenceState & PreferenceActions>(
  (set, get) => {
    const syncEffectiveSettings = async (workspaceId: string | null) => {
      const data = await apiV1.settings.getEffectiveSettings(workspaceId);
      const nextUserSettings = normalizeSettings(
        data.userSettings || data.effectiveSettings
      );
      const nextWorkspaceSettings =
        workspaceId && hasAnySettingValue(data.workspaceSettings)
          ? data.workspaceSettings || null
          : null;
      const nextEffectiveSettings = normalizeSettings(
        data.effectiveSettings ||
          computeEffectiveSettings(nextUserSettings, nextWorkspaceSettings)
      );

      set((state) => ({
        ...state,
        workspaceId,
        userSettings: nextUserSettings,
        workspaceSettings: nextWorkspaceSettings,
        effectiveSettings: nextEffectiveSettings,
        sources: data.sources || {},
      }));
    };

    return {
    workspaceId: null,
    userSettings: DEFAULT_PREFERENCE_SETTINGS,
    workspaceSettings: null,
    effectiveSettings: DEFAULT_PREFERENCE_SETTINGS,
    sources: {},
    status: {
      user: "idle",
      workspace: "idle",
      saveUser: "idle",
      saveWorkspace: "idle",
    },
    errors: {},

    hydrate: async (workspaceId) => {
      const nextWorkspaceId = workspaceId ?? null;
      set((state) => ({
        ...state,
        workspaceId: nextWorkspaceId,
        status: {
          ...state.status,
          user: "loading",
          workspace: nextWorkspaceId ? "loading" : "idle",
        },
        errors: {
          ...state.errors,
          user: undefined,
          workspace: undefined,
        },
      }));

      try {
        await syncEffectiveSettings(nextWorkspaceId);
        set((state) => ({
          ...state,
          status: {
            ...state.status,
            user: "success",
            workspace: nextWorkspaceId ? "success" : "idle",
          },
        }));
      } catch (error) {
        const message = normalizeErrorMessage(error);
        set((state) => ({
          ...state,
          workspaceSettings: nextWorkspaceId ? state.workspaceSettings : null,
          status: {
            ...state.status,
            user: "error",
            workspace: nextWorkspaceId ? "error" : "idle",
          },
          errors: {
            ...state.errors,
            user: message,
            workspace: nextWorkspaceId ? message : undefined,
          },
        }));
      }
    },

    setWorkspaceContext: async (workspaceId) => {
      const nextWorkspaceId = workspaceId ?? null;
      if (get().workspaceId === nextWorkspaceId) return;
      await get().hydrate(nextWorkspaceId);
    },

    saveUserSettings: async (patch) => {
      const prevUser = get().userSettings;
      const nextUser = mergeSettings(prevUser, patch);
      set((state) => ({
        ...state,
        userSettings: nextUser,
        effectiveSettings: computeEffectiveSettings(
          nextUser,
          state.workspaceSettings
        ),
        status: {
          ...state.status,
          saveUser: "loading",
        },
        errors: {
          ...state.errors,
          saveUser: undefined,
        },
      }));
      try {
        await apiV1.settings.updateMySettings(
          toPartialSettings(nextUser)
        );
        await syncEffectiveSettings(get().workspaceId);
        set((state) => ({
          ...state,
          status: {
            ...state.status,
            saveUser: "success",
            user: "success",
          },
        }));
        return true;
      } catch (error) {
        const message = normalizeErrorMessage(error);
        set((state) => ({
          ...state,
          userSettings: prevUser,
          effectiveSettings: computeEffectiveSettings(
            prevUser,
            state.workspaceSettings
          ),
          status: {
            ...state.status,
            saveUser: "error",
          },
          errors: {
            ...state.errors,
            saveUser: message,
          },
        }));
        return false;
      }
    },

    saveWorkspaceSettings: async (patch, workspaceId) => {
      const targetWorkspaceId = workspaceId ?? get().workspaceId;
      if (!targetWorkspaceId) {
        set((state) => ({
          ...state,
          status: { ...state.status, saveWorkspace: "error" },
          errors: {
            ...state.errors,
            saveWorkspace: "请先选择工作空间",
          },
        }));
        return false;
      }
      const prevWorkspace = get().workspaceSettings;
      const currentBase = prevWorkspace
        ? mergeSettings(get().userSettings, prevWorkspace)
        : get().userSettings;
      const nextWorkspaceFull = mergeSettings(currentBase, patch);
      const nextWorkspacePartial = toPartialSettings(nextWorkspaceFull);

      set((state) => ({
        ...state,
        workspaceId: targetWorkspaceId,
        workspaceSettings: nextWorkspacePartial,
        effectiveSettings: computeEffectiveSettings(
          state.userSettings,
          nextWorkspacePartial
        ),
        status: {
          ...state.status,
          saveWorkspace: "loading",
        },
        errors: {
          ...state.errors,
          saveWorkspace: undefined,
        },
      }));

      try {
        await apiV1.settings.updateWorkspaceSettings(
          targetWorkspaceId,
          nextWorkspacePartial
        );
        await syncEffectiveSettings(targetWorkspaceId);
        set((state) => ({
          ...state,
          status: {
            ...state.status,
            saveWorkspace: "success",
            workspace: "success",
          },
        }));
        return true;
      } catch (error) {
        const message = normalizeErrorMessage(error);
        set((state) => ({
          ...state,
          workspaceSettings: prevWorkspace,
          effectiveSettings: computeEffectiveSettings(
            state.userSettings,
            prevWorkspace
          ),
          status: {
            ...state.status,
            saveWorkspace: "error",
          },
          errors: {
            ...state.errors,
            saveWorkspace: message,
          },
        }));
        return false;
      }
    },

    clearWorkspaceSettings: async (workspaceId) => {
      const targetWorkspaceId = workspaceId ?? get().workspaceId;
      if (!targetWorkspaceId) return false;

      const prevWorkspace = get().workspaceSettings;
      set((state) => ({
        ...state,
        workspaceSettings: null,
        effectiveSettings: computeEffectiveSettings(state.userSettings, null),
        status: {
          ...state.status,
          saveWorkspace: "loading",
        },
        errors: {
          ...state.errors,
          saveWorkspace: undefined,
        },
      }));
      try {
        await apiV1.settings.clearWorkspaceSettings(targetWorkspaceId);
        await syncEffectiveSettings(targetWorkspaceId);
        set((state) => ({
          ...state,
          status: {
            ...state.status,
            saveWorkspace: "success",
            workspace: "success",
          },
        }));
        return true;
      } catch (error) {
        const message = normalizeErrorMessage(error);
        set((state) => ({
          ...state,
          workspaceSettings: prevWorkspace,
          effectiveSettings: computeEffectiveSettings(
            state.userSettings,
            prevWorkspace
          ),
          status: {
            ...state.status,
            saveWorkspace: "error",
          },
          errors: {
            ...state.errors,
            saveWorkspace: message,
          },
        }));
        return false;
      }
    },

    resetErrors: () => {
      set((state) => ({
        ...state,
        errors: {},
      }));
    },
  };
  }
);
