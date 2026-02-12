import { create } from "zustand";
import { apiV1 } from "../api_v1";
import { tokenManager } from "../api";
import type { DocumentMeta, Workspace, Tag, UpdateDocumentPayload } from "../api_v1";

type LoadStatus = "idle" | "loading" | "success" | "error";

export type SessionErrorState = {
  common?: string;
  workspace?: string;
  doc?: string;
  pending?: string;
  publish?: string;
};

export type SessionState = {
  workspaceId: string | null;
  docId: string | null;
  workspaceList: Workspace[];
  currentWorkspace: Workspace | null;
  docList: DocumentMeta[];
  currentDoc: DocumentMeta | null;
  pendingCount: number;
  status: {
    workspaceList: LoadStatus;
    workspaceDetail: LoadStatus;
    docList: LoadStatus;
    docDetail: LoadStatus;
    pending: LoadStatus;
    publish: LoadStatus;
  };
  errors: SessionErrorState;
};

export type SessionHydratePayload = {
  docId?: string | null;
  workspaceId?: string | null;
};

export type SessionActions = {
  reset: () => void;
  clearErrors: () => void;
  setWorkspace: (workspaceId: string | null) => void;
  setDoc: (docId: string | null) => void;
  setWorkspaceList: (workspaceList: Workspace[]) => void;
  setDocList: (docList: DocumentMeta[]) => void;
  setCurrentDoc: (doc: DocumentMeta | null) => void;
  createDoc: (payload: { workspaceId: string; title: string }) => Promise<DocumentMeta | null>;
  renameDoc: (docId: string, title: string) => Promise<DocumentMeta | null>;
  openDoc: (docId: string) => Promise<DocumentMeta | null>;
  commitCurrentDoc: (message?: string, docId?: string) => Promise<boolean>;
  updateDocMeta: (docId: string, payload: UpdateDocumentPayload) => Promise<DocumentMeta | null>;
  loadWorkspaceTags: (workspaceId?: string) => Promise<Tag[]>;
  syncDocMetaLocal: (doc: DocumentMeta) => void;
  hydrateFromRoute: (payload: SessionHydratePayload) => void;
  bootstrapWorkspaceSession: () => Promise<void>;
  loadWorkspaceList: () => Promise<Workspace[]>;
  loadWorkspaceDetail: (workspaceId: string) => Promise<Workspace | null>;
  loadDocListByWorkspace: (workspaceId?: string) => Promise<DocumentMeta[]>;
  loadDocDetail: (docId: string) => Promise<DocumentMeta | null>;
  refreshPendingCount: (docId?: string) => Promise<number>;
  publishDoc: (docId?: string) => Promise<DocumentMeta | null>;
  enterDoc: (docId: string, navigate?: (to: string) => void) => Promise<boolean>;
  upsertDocMeta: (doc: DocumentMeta) => void;
};

const getErrorMessage = (error: unknown): string => {
  if (!error || typeof error !== "object") return "请求失败，请稍后重试";
  const errObj = error as { message?: unknown };
  if (typeof errObj.message === "string" && errObj.message.trim()) return errObj.message;
  if (Array.isArray(errObj.message)) {
    const joined = errObj.message.filter((item) => typeof item === "string").join("；");
    if (joined.trim()) return joined;
  }
  return "请求失败，请稍后重试";
};

const isNoPendingCommitError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;

  const errObj = error as { status?: unknown; code?: unknown; message?: unknown };
  const status = typeof errObj.status === "number" ? errObj.status : undefined;
  const code = typeof errObj.code === "string" ? errObj.code.trim().toUpperCase() : "";
  const message = getErrorMessage(error).toLowerCase();

  const hitCode = code === "NO_PENDING_VERSIONS" || code === "NO_PENDING_VERSION" || code === "NO_PENDING";
  const hitMessage =
    message.includes("没有待创建的版本") ||
    message.includes("无需提交") ||
    message.includes("no pending version") ||
    message.includes("no pending versions") ||
    message.includes("no pending");

  return status === 400 && (hitCode || hitMessage);
};

const WORKSPACE_STORAGE_KEY = "kb_current_workspace_id";
let bootstrapWorkspacePromise: Promise<void> | null = null;

const readPersistedWorkspaceId = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const id = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    return typeof id === "string" && id.trim() ? id : null;
  } catch {
    return null;
  }
};

const persistWorkspaceId = (workspaceId: string | null): void => {
  if (typeof window === "undefined") return;
  try {
    if (workspaceId) {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
      return;
    }
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    // noop
  }
};

const createInitialState = (): SessionState => {
  return {
    workspaceId: readPersistedWorkspaceId(),
    docId: null,
    workspaceList: [],
    currentWorkspace: null,
    docList: [],
    currentDoc: null,
    pendingCount: 0,
    status: {
      workspaceList: "idle",
      workspaceDetail: "idle",
      docList: "idle",
      docDetail: "idle",
      pending: "idle",
      publish: "idle",
    },
    errors: {},
  };
};

export const useSessionStore = create<SessionState & SessionActions>((set, get) => ({
  ...createInitialState(),

  reset: () => {
    persistWorkspaceId(null);
    set({ ...createInitialState(), workspaceId: null });
  },

  clearErrors: () => {
    set((state) => ({ ...state, errors: {} }));
  },

  setWorkspace: (workspaceId) => {
    persistWorkspaceId(workspaceId);
    set((state) => ({
      ...state,
      workspaceId,
      docId: workspaceId ? state.docId : null,
      currentWorkspace: workspaceId
        ? state.workspaceList.find((item) => item.workspaceId === workspaceId) ||
          (state.currentWorkspace?.workspaceId === workspaceId ? state.currentWorkspace : null)
        : null,
      docList: workspaceId ? state.docList : [],
      currentDoc: workspaceId ? state.currentDoc : null,
      pendingCount: workspaceId ? state.pendingCount : 0,
    }));
  },

  setDoc: (docId) => {
    set((state) => ({
      ...state,
      docId,
      currentDoc: docId
        ? state.docList.find((item) => item.docId === docId) ||
          (state.currentDoc?.docId === docId ? state.currentDoc : null)
        : null,
      pendingCount: docId ? state.pendingCount : 0,
    }));
  },

  setWorkspaceList: (workspaceList) => {
    set((state) => ({
      ...state,
      workspaceList,
      currentWorkspace: state.workspaceId
        ? workspaceList.find((item) => item.workspaceId === state.workspaceId) || state.currentWorkspace
        : null,
    }));
  },

  setDocList: (docList) => {
    set((state) => ({
      ...state,
      docList,
      currentDoc: state.docId
        ? docList.find((item) => item.docId === state.docId) ||
          (state.currentDoc?.docId === state.docId ? state.currentDoc : null)
        : state.currentDoc,
    }));
  },

  setCurrentDoc: (currentDoc) => {
    set((state) => ({ ...state, currentDoc }));
  },

  createDoc: async ({ workspaceId, title }) => {
    if (!workspaceId) {
      set((state) => ({
        ...state,
        errors: { ...state.errors, doc: "请先选择工作空间后再创建文档" },
      }));
      return null;
    }

    set((state) => ({
      ...state,
      status: { ...state.status, docDetail: "loading" },
      errors: { ...state.errors, doc: undefined },
    }));
    try {
      const doc = await apiV1.documents.createDocument({
        workspaceId,
        title: title.trim() || "未命名文档",
      });
      persistWorkspaceId(workspaceId);
      set((state) => {
        const nextDocList = [...state.docList];
        const idx = nextDocList.findIndex((item) => item.docId === doc.docId);
        if (idx === -1) {
          nextDocList.unshift(doc);
        } else {
          nextDocList[idx] = { ...nextDocList[idx], ...doc };
        }
        return {
          ...state,
          workspaceId,
          docId: doc.docId,
          currentDoc: doc,
          docList: nextDocList,
          status: { ...state.status, docDetail: "success" },
        };
      });
      return doc;
    } catch (error) {
      const msg = getErrorMessage(error);
      set((state) => ({
        ...state,
        status: { ...state.status, docDetail: "error" },
        errors: { ...state.errors, doc: msg },
      }));
      return null;
    }
  },

  renameDoc: async (docId, title) => {
    if (!docId) return null;
    set((state) => ({
      ...state,
      status: { ...state.status, docDetail: "loading" },
      errors: { ...state.errors, doc: undefined },
    }));
    try {
      const updated = await apiV1.documents.updateDocument(docId, {
        title,
      });
      set((state) => {
        const nextDocList = [...state.docList];
        const idx = nextDocList.findIndex((item) => item.docId === updated.docId);
        if (idx === -1) {
          nextDocList.unshift(updated);
        } else {
          nextDocList[idx] = { ...nextDocList[idx], ...updated };
        }
        return {
          ...state,
          docList: nextDocList,
          currentDoc:
            state.currentDoc?.docId === updated.docId
              ? { ...state.currentDoc, ...updated }
              : state.currentDoc,
          status: { ...state.status, docDetail: "success" },
        };
      });
      return updated;
    } catch (error) {
      const msg = getErrorMessage(error);
      set((state) => ({
        ...state,
        status: { ...state.status, docDetail: "error" },
        errors: { ...state.errors, doc: msg },
      }));
      return null;
    }
  },

  openDoc: async (docId) => {
    const doc = await get().loadDocDetail(docId);
    if (!doc) return null;
    const targetWorkspaceId = doc.workspaceId || get().workspaceId;
    if (targetWorkspaceId) {
      const currentWorkspace = get().currentWorkspace;
      if (!currentWorkspace || currentWorkspace.workspaceId !== targetWorkspaceId) {
        void get().loadWorkspaceDetail(targetWorkspaceId);
      }
      if (get().docList.length === 0) {
        void get().loadDocListByWorkspace(targetWorkspaceId);
      }
    }
    await get().refreshPendingCount(docId);
    set((state) => ({ ...state, docId }));
    return doc;
  },

  commitCurrentDoc: async (message = "auto-commit on leave", docId) => {
    const targetDocId = docId || get().docId;
    if (!targetDocId) return false;
    try {
      await apiV1.documents.commitDocument(targetDocId, { message });
      if (get().docId === targetDocId) {
        await get().refreshPendingCount(targetDocId);
      }
      return true;
    } catch (error) {
      if (isNoPendingCommitError(error)) {
        set((state) => ({
          ...state,
          pendingCount: state.docId === targetDocId ? 0 : state.pendingCount,
          status: { ...state.status, pending: "success" },
          errors: { ...state.errors, pending: undefined },
        }));
        return true;
      }
      const msg = getErrorMessage(error);
      set((state) => ({
        ...state,
        errors: { ...state.errors, pending: msg },
      }));
      return false;
    }
  },

  updateDocMeta: async (docId, payload) => {
    if (!docId) return null;
    set((state) => ({
      ...state,
      errors: { ...state.errors, doc: undefined },
    }));
    try {
      const updated = await apiV1.documents.updateDocument(docId, payload);
      get().syncDocMetaLocal(updated);
      return updated;
    } catch (error) {
      const msg = getErrorMessage(error);
      set((state) => ({
        ...state,
        errors: { ...state.errors, doc: msg },
      }));
      return null;
    }
  },

  loadWorkspaceTags: async (workspaceId) => {
    const targetWorkspaceId = workspaceId || get().workspaceId;
    if (!targetWorkspaceId) return [];
    try {
      const result = await apiV1.tags.listTags({
        workspaceId: targetWorkspaceId,
        page: 1,
        pageSize: 200,
      });
      return Array.isArray(result?.items) ? result.items : [];
    } catch {
      return [];
    }
  },

  syncDocMetaLocal: (doc) => {
    get().upsertDocMeta(doc);
    set((state) => ({
      ...state,
      currentDoc:
        state.currentDoc?.docId === doc.docId
          ? { ...state.currentDoc, ...doc }
          : state.currentDoc,
    }));
  },

  hydrateFromRoute: ({ docId, workspaceId }) => {
    if (workspaceId !== undefined) {
      persistWorkspaceId(workspaceId ?? null);
    }
    set((state) => ({
      ...state,
      workspaceId: workspaceId ?? state.workspaceId,
      docId: docId ?? state.docId,
    }));
  },

  bootstrapWorkspaceSession: async () => {
    if (bootstrapWorkspacePromise) {
      return bootstrapWorkspacePromise;
    }

    bootstrapWorkspacePromise = (async () => {
      if (!tokenManager.isAuthenticated()) return;

      const workspaceList = await get().loadWorkspaceList();
      const workspaceListStatus = get().status.workspaceList;
      if (workspaceListStatus === "error") return;

      if (!workspaceList.length) {
        get().setWorkspace(null);
        return;
      }

      const persistedWorkspaceId = get().workspaceId;
      const matchedWorkspace = persistedWorkspaceId
        ? workspaceList.find((item) => item.workspaceId === persistedWorkspaceId)
        : null;
      const targetWorkspaceId = matchedWorkspace?.workspaceId || workspaceList[0]?.workspaceId || null;

      if (!targetWorkspaceId) {
        get().setWorkspace(null);
        return;
      }

      if (get().workspaceId !== targetWorkspaceId) {
        get().setWorkspace(targetWorkspaceId);
      }

      await get().loadWorkspaceDetail(targetWorkspaceId);
      await get().loadDocListByWorkspace(targetWorkspaceId);
    })().finally(() => {
      bootstrapWorkspacePromise = null;
    });

    return bootstrapWorkspacePromise;
  },

  loadWorkspaceList: async () => {
    set((state) => ({
      ...state,
      status: { ...state.status, workspaceList: "loading" },
      errors: { ...state.errors, workspace: undefined },
    }));
    try {
      const res = await apiV1.workspaces.listWorkspaces({ page: 1, pageSize: 50 });
      const list = Array.isArray(res?.items) ? res.items : [];
      set((state) => ({
        ...state,
        workspaceList: list,
        currentWorkspace: state.workspaceId
          ? list.find((item) => item.workspaceId === state.workspaceId) || state.currentWorkspace
          : state.currentWorkspace,
        status: { ...state.status, workspaceList: "success" },
      }));
      return list;
    } catch (error) {
      const msg = getErrorMessage(error);
      set((state) => ({
        ...state,
        status: { ...state.status, workspaceList: "error" },
        errors: { ...state.errors, workspace: msg },
      }));
      return [];
    }
  },

  loadWorkspaceDetail: async (workspaceId) => {
    set((state) => ({
      ...state,
      status: { ...state.status, workspaceDetail: "loading" },
      errors: { ...state.errors, workspace: undefined },
    }));
    try {
      const workspace = await apiV1.workspaces.getWorkspace(workspaceId);
      persistWorkspaceId(workspaceId);
      set((state) => ({
        ...state,
        workspaceId,
        currentWorkspace: workspace,
        status: { ...state.status, workspaceDetail: "success" },
      }));
      return workspace;
    } catch (error) {
      const msg = getErrorMessage(error);
      set((state) => ({
        ...state,
        status: { ...state.status, workspaceDetail: "error" },
        errors: { ...state.errors, workspace: msg },
      }));
      return null;
    }
  },

  loadDocListByWorkspace: async (workspaceId) => {
    const targetWorkspaceId = workspaceId || get().workspaceId;
    if (!targetWorkspaceId) {
      set((state) => ({
        ...state,
        docList: [],
        status: { ...state.status, docList: "error" },
        errors: { ...state.errors, doc: "请先选择工作空间" },
      }));
      return [];
    }

    set((state) => ({
      ...state,
      workspaceId: targetWorkspaceId,
      status: { ...state.status, docList: "loading" },
      errors: { ...state.errors, doc: undefined },
    }));
    persistWorkspaceId(targetWorkspaceId);
    try {
      const res = await apiV1.documents.listDocuments({
        workspaceId: targetWorkspaceId,
        page: 1,
        pageSize: 50,
      });
      const list = Array.isArray(res?.items) ? res.items : [];
      set((state) => ({
        ...state,
        docList: list,
        status: { ...state.status, docList: "success" },
      }));
      return list;
    } catch (error) {
      const msg = getErrorMessage(error);
      set((state) => ({
        ...state,
        status: { ...state.status, docList: "error" },
        errors: { ...state.errors, doc: msg },
      }));
      return [];
    }
  },

  loadDocDetail: async (docId) => {
    set((state) => ({
      ...state,
      docId,
      status: { ...state.status, docDetail: "loading" },
      errors: { ...state.errors, doc: undefined },
    }));
    try {
      const doc = await apiV1.documents.getDocument(docId);
      const nextWorkspaceId = doc.workspaceId || get().workspaceId;
      if (nextWorkspaceId) {
        persistWorkspaceId(nextWorkspaceId);
      }
      set((state) => ({
        ...state,
        workspaceId: nextWorkspaceId || state.workspaceId,
        currentDoc: doc,
        status: { ...state.status, docDetail: "success" },
      }));
      get().upsertDocMeta(doc);
      return doc;
    } catch (error) {
      const msg = getErrorMessage(error);
      set((state) => ({
        ...state,
        status: { ...state.status, docDetail: "error" },
        errors: { ...state.errors, doc: msg },
      }));
      return null;
    }
  },

  publishDoc: async (docId) => {
    const targetDocId = docId || get().docId;
    if (!targetDocId) {
      set((state) => ({
        ...state,
        status: { ...state.status, publish: "idle" },
        errors: { ...state.errors, publish: "请先进入文档再发布" },
      }));
      return null;
    }

    set((state) => ({
      ...state,
      status: { ...state.status, publish: "loading" },
      errors: { ...state.errors, publish: undefined },
    }));

    try {
      const published = await apiV1.documents.publishDocument(targetDocId);
      const latestDoc =
        published?.docId && published.docId === targetDocId
          ? published
          : await get().loadDocDetail(targetDocId);
      if (latestDoc) {
        get().upsertDocMeta(latestDoc);
      }
      set((state) => ({
        ...state,
        currentDoc:
          latestDoc && state.currentDoc?.docId === latestDoc.docId
            ? { ...state.currentDoc, ...latestDoc }
            : state.currentDoc,
        status: { ...state.status, publish: "success" },
      }));
      return latestDoc || published || null;
    } catch (error) {
      const msg = getErrorMessage(error);
      set((state) => ({
        ...state,
        status: { ...state.status, publish: "error" },
        errors: { ...state.errors, publish: msg },
      }));
      return null;
    }
  },

  refreshPendingCount: async (docId) => {
    const targetDocId = docId || get().docId;
    if (!targetDocId) {
      set((state) => ({
        ...state,
        pendingCount: 0,
        status: { ...state.status, pending: "idle" },
      }));
      return 0;
    }

    set((state) => ({
      ...state,
      status: { ...state.status, pending: "loading" },
      errors: { ...state.errors, pending: undefined },
    }));
    try {
      const res = await apiV1.documents.getPendingVersions(targetDocId);
      const pendingCount = typeof res?.pendingCount === "number" ? res.pendingCount : 0;
      set((state) => ({
        ...state,
        pendingCount,
        status: { ...state.status, pending: "success" },
      }));
      return pendingCount;
    } catch (error) {
      const msg = getErrorMessage(error);
      set((state) => ({
        ...state,
        status: { ...state.status, pending: "error" },
        errors: { ...state.errors, pending: msg },
      }));
      return 0;
    }
  },

  enterDoc: async (docId, navigate) => {
    const doc = await get().openDoc(docId);
    if (!doc) return false;

    if (navigate) {
      navigate(`/doc/${docId}`);
    }
    return true;
  },

  upsertDocMeta: (doc) => {
    set((state) => {
      const docList = [...state.docList];
      const idx = docList.findIndex((item) => item.docId === doc.docId);
      if (idx === -1) {
        docList.unshift(doc);
      } else {
        docList[idx] = { ...docList[idx], ...doc };
      }
      return { ...state, docList };
    });
  },
}));

// 对外暴露非 React 场景下可用的 store API（例如路由守卫、工具函数）
export const sessionStoreApi = {
  getState: useSessionStore.getState,
  setState: useSessionStore.setState,
  subscribe: useSessionStore.subscribe,
};
