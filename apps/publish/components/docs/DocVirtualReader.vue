<template>
  <div class="doc-reader-shell">
    <div v-if="error && items.length > 0" class="doc-reader-top-alert">
      <NAlert type="warning" :show-icon="true" :title="error" />
    </div>

    <div v-if="status === 'loading' && !initialLoaded" class="doc-reader-loading-wrap">
      <NSpin size="large" />
    </div>

    <NEmpty v-else-if="items.length === 0" description="暂无已发布内容" />

    <section v-else ref="virtualHostRef" class="doc-reader-virtual-host">
      <div class="doc-reader-virtual-inner" :style="{ height: `${layout.totalHeight}px` }">
        <DocVirtualRow
          v-for="row in visibleRows"
          :key="row.item.renderKey"
          :block-id="row.item.blockId"
          :depth="row.item.depth"
          :top="row.top"
          :html="row.html"
          :render-key="row.item.renderKey"
          @measured="reportRowHeight"
        />
      </div>
    </section>

    <div v-if="items.length > 0 && showBottomStatus" class="doc-reader-bottom-status">
      <div v-if="status === 'append_loading'" class="doc-reader-bottom-loading">
        <NSpin size="small" />
        <span>正在加载更多内容…</span>
      </div>
      <div v-else-if="hasMore" class="doc-reader-bottom-hint">继续下滑以加载更多内容</div>

      <div class="doc-reader-bottom-meta">已加载 {{ returnedBlocks }} / {{ totalBlocks || returnedBlocks }}</div>

      <NButton
        v-if="error && status !== 'append_loading'"
        size="small"
        tertiary
        type="primary"
        @click="loadNextPage"
      >
        重试加载
      </NButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { NAlert, NButton, NEmpty, NSpin } from "naive-ui";
import DocVirtualRow from "./DocVirtualRow.vue";
import { DOC_READER_PAGE_LIMIT } from "~/constants/docReader";
import {
  getCodeThemeByMode,
  getShikiHighlighter,
  resolveCodeLanguageForShiki,
  type CodeThemeMode,
  type ShikiHighlighter,
} from "~/composables/useCodeHighlight";
import {
  contentTreeToFlatBlocks,
  mergeRenderBlocks,
  resolvePagination,
  toRenderBlocks,
} from "~/composables/useDocsTransform";
import { useDocsApi } from "~/composables/useDocsApi";
import type { RenderBlock, VirtualReaderInitialState } from "~/types/api";

const props = defineProps<{
  docId: string;
  publishedHead: number;
  initialState: VirtualReaderInitialState;
}>();

const emit = defineEmits<{
  "stats-change": [
    stats: {
      totalBlocks: number;
      loadedBlocks: number;
      renderedBlocks: number;
      hasMore: boolean;
      loadedChars: number;
    },
  ];
}>();

type ReadStatus = "idle" | "loading" | "append_loading" | "success" | "error" | "done";

const OVERSCAN_PX = 800;
const MIN_VIEWPORT_HEIGHT = 360;

const { getDocumentContent } = useDocsApi();

const initialLoaded = ref(false);
const status = ref<ReadStatus>("idle");
const error = ref<string>();
const items = ref<RenderBlock[]>([]);
const totalBlocks = ref(0);
const returnedBlocks = ref(0);
const hasMore = ref(false);
const nextStartBlockId = ref<string | null>(null);

const rowSizeMap = reactive<Record<string, number>>({});
const virtualHostRef = ref<HTMLElement | null>(null);
const themeMode = ref<CodeThemeMode>("light");
const shikiHighlighter = ref<ShikiHighlighter | null>(null);
const highlightCache = new Map<string, string>();

const scrollState = reactive({
  relativeTop: 0,
  viewportHeight: MIN_VIEWPORT_HEIGHT,
});

let removeThemeListener: (() => void) | null = null;

const loadedChars = computed(() => {
  return items.value.reduce((sum, item) => sum + item.markdown.length, 0);
});

const estimateRowHeight = (item: RenderBlock | undefined) => {
  if (!item) return 56;
  const textLength = item.markdown.length;
  if (item.normalized.type === "code") {
    return Math.max(120, Math.min(420, 84 + Math.ceil(textLength / 34) * 20));
  }
  if (item.normalized.type === "heading") {
    return Math.max(56, 44 + Math.ceil(textLength / 24) * 14);
  }
  if (item.normalized.type === "list_item" || item.normalized.type === "quote") {
    return Math.max(52, Math.min(220, 36 + Math.ceil(textLength / 28) * 16));
  }
  return Math.max(48, Math.min(240, 30 + Math.ceil(textLength / 30) * 16));
};

const buildLayout = (list: RenderBlock[]) => {
  const offsets = new Array<number>(list.length);
  const heights = new Array<number>(list.length);
  let cursor = 0;
  for (let i = 0; i < list.length; i += 1) {
    const row = list[i];
    const measured = rowSizeMap[row.blockId];
    const height = measured && measured > 0 ? measured : estimateRowHeight(row);
    offsets[i] = cursor;
    heights[i] = height;
    cursor += height;
  }
  return {
    offsets,
    heights,
    totalHeight: cursor,
  };
};

const layout = computed(() => buildLayout(items.value));

const findStartIndex = (targetTop: number) => {
  const offsets = layout.value.offsets;
  const heights = layout.value.heights;
  if (offsets.length === 0) return 0;
  let left = 0;
  let right = offsets.length - 1;
  let answer = offsets.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const bottom = offsets[mid] + heights[mid];
    if (bottom >= targetTop) {
      answer = mid;
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  return answer;
};

const findEndIndex = (targetBottom: number) => {
  const offsets = layout.value.offsets;
  if (offsets.length === 0) return 0;
  let left = 0;
  let right = offsets.length - 1;
  let answer = 0;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const top = offsets[mid];
    if (top <= targetBottom) {
      answer = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return answer;
};

const visibleRange = computed(() => {
  if (items.value.length === 0) return { start: 0, end: -1 };
  const start = Math.max(0, findStartIndex(scrollState.relativeTop - OVERSCAN_PX));
  const end = Math.min(
    items.value.length - 1,
    findEndIndex(scrollState.relativeTop + scrollState.viewportHeight + OVERSCAN_PX),
  );
  return { start, end };
});

const renderItemHtml = (item: RenderBlock) => {
  if (!shikiHighlighter.value || item.normalized.type !== "code") return item.html;
  const cacheKey = `${item.renderKey}:${themeMode.value}`;
  const cached = highlightCache.get(cacheKey);
  if (cached) return cached;
  try {
    const lang = resolveCodeLanguageForShiki(shikiHighlighter.value, item.normalized.language);
    const highlighted = shikiHighlighter.value.codeToHtml(item.normalized.text || "", {
      lang,
      theme: getCodeThemeByMode(themeMode.value),
    });
    highlightCache.set(cacheKey, highlighted);
    return highlighted;
  } catch {
    return item.html;
  }
};

const visibleRows = computed(() => {
  if (visibleRange.value.end < visibleRange.value.start) return [];
  const rows: Array<{ item: RenderBlock; top: number; html: string }> = [];
  for (let index = visibleRange.value.start; index <= visibleRange.value.end; index += 1) {
    const item = items.value[index];
    rows.push({
      item,
      top: layout.value.offsets[index],
      html: renderItemHtml(item),
    });
  }
  return rows;
});

const showBottomStatus = computed(() => {
  return (
    status.value === "append_loading" ||
    hasMore.value ||
    Boolean(error.value && status.value !== "append_loading")
  );
});

const normalizeErrorMessage = (input: unknown): string => {
  if (!input || typeof input !== "object") return "加载文档失败";
  const withMessage = input as { message?: unknown };
  if (typeof withMessage.message === "string" && withMessage.message.trim())
    return withMessage.message;
  return "加载文档失败";
};

const emitStats = () => {
  emit("stats-change", {
    totalBlocks: totalBlocks.value,
    loadedBlocks: returnedBlocks.value,
    renderedBlocks: visibleRows.value.length,
    hasMore: hasMore.value,
    loadedChars: loadedChars.value,
  });
};

const applyInitialState = (state: VirtualReaderInitialState) => {
  items.value = [...(state.items || [])];
  totalBlocks.value = state.totalBlocks || state.items.length || 0;
  returnedBlocks.value = state.returnedBlocks || state.items.length || 0;
  hasMore.value = Boolean(state.hasMore);
  nextStartBlockId.value = state.nextStartBlockId || null;
  status.value = hasMore.value ? "success" : "done";
  error.value = undefined;
  initialLoaded.value = true;
  Object.keys(rowSizeMap).forEach((key) => {
    delete rowSizeMap[key];
  });
  emitStats();
};

const loadNextPage = async () => {
  if (!props.docId || !hasMore.value || !nextStartBlockId.value) return false;
  if (status.value === "append_loading" || status.value === "loading") return false;

  status.value = "append_loading";
  error.value = undefined;
  emitStats();

  try {
    const content = await getDocumentContent(props.docId, {
      version: props.publishedHead,
      startBlockId: nextStartBlockId.value,
      limit: DOC_READER_PAGE_LIMIT,
    });
    const incoming = toRenderBlocks(contentTreeToFlatBlocks(content));
    const mergedItems = mergeRenderBlocks(items.value, incoming);
    const previousCount = items.value.length;
    const currentCount = mergedItems.length;
    const progressed = currentCount > previousCount;
    const pagination = resolvePagination(
      content.pagination,
      {
        totalBlocks: content.totalBlocks,
        hasMore: content.hasMore,
        nextStartBlockId: content.nextStartBlockId,
      },
      currentCount,
      totalBlocks.value,
    );
    const fallbackNextStartBlockId =
      incoming.length > 0 ? incoming[incoming.length - 1]?.blockId : nextStartBlockId.value;
    const nextBlockId =
      pagination.responseNextStartBlockId ||
      ((pagination.responseHasMore || pagination.inferredHasMore) && progressed
        ? fallbackNextStartBlockId
        : null);
    const nextHasMore = Boolean(
      (pagination.responseHasMore || pagination.inferredHasMore) && progressed && nextBlockId,
    );

    items.value = mergedItems;
    totalBlocks.value = pagination.totalBlocks;
    returnedBlocks.value = currentCount;
    hasMore.value = nextHasMore;
    nextStartBlockId.value = nextBlockId || null;
    status.value = nextHasMore ? "success" : "done";
    error.value = undefined;
    emitStats();
    return true;
  } catch (err) {
    status.value = "error";
    error.value = normalizeErrorMessage(err);
    emitStats();
    return false;
  }
};

const syncScrollMetrics = () => {
  if (typeof window === "undefined") return;
  const host = virtualHostRef.value;
  if (!host) return;
  const absoluteTop = host.getBoundingClientRect().top + window.scrollY;
  scrollState.relativeTop = window.scrollY - absoluteTop;
  scrollState.viewportHeight = Math.max(
    MIN_VIEWPORT_HEIGHT,
    window.innerHeight || MIN_VIEWPORT_HEIGHT,
  );
};

const reportRowHeight = (blockId: string, height: number) => {
  if (!Number.isFinite(height) || height <= 0) return;
  const oldHeight = rowSizeMap[blockId];
  if (oldHeight && Math.abs(oldHeight - height) <= 1) return;
  rowSizeMap[blockId] = height;
};

const handleWindowScroll = () => {
  syncScrollMetrics();
};

const handleWindowResize = () => {
  syncScrollMetrics();
};

watch(
  () => [props.docId, props.publishedHead, props.initialState] as const,
  () => {
    applyInitialState(props.initialState);
    nextTick(() => {
      syncScrollMetrics();
      emitStats();
    });
  },
  { immediate: true },
);

watch(
  () => [items.value.length, layout.value.totalHeight],
  () => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      syncScrollMetrics();
      emitStats();
    });
  },
);

watch(
  () =>
    [
      visibleRows.value.length,
      returnedBlocks.value,
      totalBlocks.value,
      hasMore.value,
      status.value,
    ] as const,
  () => {
    emitStats();
  },
);

watch(
  () => [visibleRange.value.end, hasMore.value, status.value, items.value.length] as const,
  ([end, nextHasMore, nextStatus, length]) => {
    if (!nextHasMore) return;
    if (nextStatus === "loading" || nextStatus === "append_loading") return;
    if (length === 0) return;
    if (end >= length - 8) {
      void loadNextPage();
    }
  },
);

onMounted(() => {
  if (typeof window !== "undefined") {
    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    window.addEventListener("resize", handleWindowResize);
    syncScrollMetrics();
  }

  if (typeof window !== "undefined") {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = (isDark: boolean) => {
      themeMode.value = isDark ? "dark" : "light";
    };
    applyTheme(media.matches);
    const onThemeChange = (event: MediaQueryListEvent) => {
      applyTheme(event.matches);
      highlightCache.clear();
    };
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onThemeChange);
      removeThemeListener = () => media.removeEventListener("change", onThemeChange);
    } else {
      media.addListener(onThemeChange);
      removeThemeListener = () => media.removeListener(onThemeChange);
    }
  }

  void getShikiHighlighter()
    .then((instance) => {
      shikiHighlighter.value = instance;
    })
    .catch(() => {});

  emitStats();
});

onBeforeUnmount(() => {
  if (typeof window === "undefined") return;
  window.removeEventListener("scroll", handleWindowScroll);
  window.removeEventListener("resize", handleWindowResize);
  removeThemeListener?.();
  removeThemeListener = null;
});
</script>

<style scoped>
.doc-reader-shell {
  width: 100%;
  background: #ffffff;
}

.doc-reader-top-alert {
  margin: 6px 0 14px;
}

.doc-reader-loading-wrap {
  width: 100%;
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.doc-reader-virtual-host {
  position: relative;
  width: 100%;
}

.doc-reader-virtual-inner {
  position: relative;
  width: 100%;
}

.doc-reader-bottom-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: 14px 0 6px;
  min-height: 30px;
  color: #64748b;
  font-size: 12px;
}

.doc-reader-bottom-loading {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #2563eb;
}

.doc-reader-bottom-hint {
  color: #64748b;
}

.doc-reader-bottom-meta {
  color: #94a3b8;
  white-space: nowrap;
}

:deep(.doc-reader-row) {
  position: absolute;
  top: var(--row-top);
  left: 0;
  right: 0;
  width: 100%;
  box-sizing: border-box;
  border-radius: 8px;
  /* padding: 8px 8px; */
  transition: background-color 0.15s ease;
  transform: translateZ(0);
}

:deep(.doc-reader-row:hover) {
  background: #f8fbff;
}

:deep(.doc-reader-row.depth-1) {
  padding-left: 20px;
}

:deep(.doc-reader-row.depth-2) {
  padding-left: 32px;
}

:deep(.doc-reader-row.depth-3),
:deep(.doc-reader-row.depth-4),
:deep(.doc-reader-row.depth-5),
:deep(.doc-reader-row.depth-6) {
  padding-left: 40px;
}

:deep(.doc-reader-row-content > :first-child) {
  margin-top: 0;
}

:deep(.doc-reader-row-content > :last-child) {
  margin-bottom: 0;
}
</style>
