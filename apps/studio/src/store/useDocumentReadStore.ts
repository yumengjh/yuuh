import { create } from "zustand";
import { apiV1 } from "../api_v1";
import {
  contentTreeToFlatBlocks,
  markdownToHtml,
  type FlatContentBlock,
} from "../editor/contentAdapter";

type ReadStatus = "idle" | "loading" | "append_loading" | "success" | "error" | "done";

export type FlatRenderBlock = FlatContentBlock & {
  html: string;
  renderKey: string;
};

type DocumentReadState = {
  docId: string | null;
  version: number | null;
  items: FlatRenderBlock[];
  totalBlocks: number;
  returnedBlocks: number;
  hasMore: boolean;
  nextStartBlockId: string | null;
  status: ReadStatus;
  error?: string;
  initialLoaded: boolean;
};

type DocumentReadActions = {
  resetReadState: () => void;
  initRead: (docId: string, force?: boolean) => Promise<void>;
  loadFirstPage: (docId: string, force?: boolean) => Promise<void>;
  loadNextPage: () => Promise<boolean>;
};

const initialState: DocumentReadState = {
  docId: null,
  version: null,
  items: [],
  totalBlocks: 0,
  returnedBlocks: 0,
  hasMore: false,
  nextStartBlockId: null,
  status: "idle",
  error: undefined,
  initialLoaded: false,
};

const DEFAULT_LIMIT = 200;

const normalizeErrorMessage = (error: unknown): string => {
  if (!error || typeof error !== "object") return "加载文档失败";
  const withMessage = error as { message?: unknown };
  if (typeof withMessage.message === "string" && withMessage.message.trim()) {
    return withMessage.message;
  }
  return "加载文档失败";
};

const toRenderItems = (blocks: FlatContentBlock[]): FlatRenderBlock[] => {
  return blocks.map((block) => {
    const html = markdownToHtml(block.markdown || "");
    return {
      ...block,
      html,
      renderKey: `${block.blockId}:${block.markdown}:${block.depth}`,
    };
  });
};

const mergeByBlockId = (
  existing: FlatRenderBlock[],
  incoming: FlatRenderBlock[]
): FlatRenderBlock[] => {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((item) => item.blockId));
  const merged = [...existing];
  incoming.forEach((item) => {
    if (seen.has(item.blockId)) return;
    seen.add(item.blockId);
    merged.push(item);
  });
  return merged;
};

const toSafeNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
};

export const useDocumentReadStore = create<DocumentReadState & DocumentReadActions>((set, get) => ({
  ...initialState,

  resetReadState: () => {
    set({ ...initialState });
  },

  initRead: async (docId, force = false) => {
    await get().loadFirstPage(docId, force);
  },

  loadFirstPage: async (docId, force = false) => {
    if (!docId) return;
    const current = get();
    if (!force && current.docId === docId && current.initialLoaded) return;

    set({
      ...initialState,
      docId,
      status: "loading",
      error: undefined,
    });

    try {
      const docMeta = await apiV1.documents.getDocument(docId);
      const version = typeof docMeta?.head === "number" ? docMeta.head : null;
      const content = await apiV1.documents.getDocumentContent(docId, {
        limit: DEFAULT_LIMIT,
        ...(typeof version === "number" ? { version } : {}),
      });
      const flatBlocks = contentTreeToFlatBlocks(content);
      const items = toRenderItems(flatBlocks);
      const responseTotal =
        toSafeNumber(content.pagination?.totalBlocks) ??
        toSafeNumber(content.totalBlocks);
      const totalBlocks = Math.max(responseTotal ?? 0, items.length);
      const responseHasMore =
        content.pagination?.hasMore ??
        content.hasMore ??
        false;
      const inferredHasMore = totalBlocks > 0 ? items.length < totalBlocks : false;
      const responseNextStartBlockId =
        content.pagination?.nextStartBlockId ??
        content.nextStartBlockId ??
        null;
      const fallbackNextStartBlockId = items.length > 0 ? items[items.length - 1]?.blockId : null;
      const nextStartBlockId =
        responseNextStartBlockId ||
        ((responseHasMore || inferredHasMore) ? fallbackNextStartBlockId : null);
      const hasMore = Boolean((responseHasMore || inferredHasMore) && nextStartBlockId);

      set({
        docId,
        version,
        items,
        totalBlocks,
        returnedBlocks: items.length,
        hasMore,
        nextStartBlockId: nextStartBlockId || null,
        status: hasMore ? "success" : "done",
        error: undefined,
        initialLoaded: true,
      });
    } catch (error) {
      set((state) => ({
        ...state,
        status: "error",
        error: normalizeErrorMessage(error),
        initialLoaded: true,
      }));
    }
  },

  loadNextPage: async () => {
    const state = get();
    if (!state.docId || !state.hasMore || !state.nextStartBlockId) return false;
    if (state.status === "append_loading" || state.status === "loading") return false;

    set((prev) => ({
      ...prev,
      status: "append_loading",
      error: undefined,
    }));

    try {
      const content = await apiV1.documents.getDocumentContent(state.docId, {
        limit: DEFAULT_LIMIT,
        startBlockId: state.nextStartBlockId,
        ...(typeof state.version === "number" ? { version: state.version } : {}),
      });
      const incoming = toRenderItems(contentTreeToFlatBlocks(content));
      const mergedItems = mergeByBlockId(get().items, incoming);
      const prevReturned = state.items.length;
      const responseTotal =
        toSafeNumber(content.pagination?.totalBlocks) ??
        toSafeNumber(content.totalBlocks);
      const totalBlocks = Math.max(
        state.totalBlocks || 0,
        responseTotal ?? 0,
        mergedItems.length
      );
      const responseHasMore =
        content.pagination?.hasMore ??
        content.hasMore ??
        false;
      const inferredHasMore = totalBlocks > 0 ? mergedItems.length < totalBlocks : false;
      const progressed = mergedItems.length > prevReturned;
      const responseNextStartBlockId =
        content.pagination?.nextStartBlockId ??
        content.nextStartBlockId ??
        null;
      const fallbackNextStartBlockId =
        incoming.length > 0 ? incoming[incoming.length - 1]?.blockId : state.nextStartBlockId;
      const nextStartBlockId =
        responseNextStartBlockId ||
        ((responseHasMore || inferredHasMore) && progressed ? fallbackNextStartBlockId : null);
      const hasMore = Boolean((responseHasMore || inferredHasMore) && progressed && nextStartBlockId);

      set((prev) => ({
        ...prev,
        items: mergedItems,
        totalBlocks,
        returnedBlocks: mergedItems.length,
        hasMore,
        nextStartBlockId: nextStartBlockId || null,
        status: hasMore ? "success" : "done",
        error: undefined,
      }));
      return true;
    } catch (error) {
      set((prev) => ({
        ...prev,
        status: "error",
        error: normalizeErrorMessage(error),
      }));
      return false;
    }
  },
}));
