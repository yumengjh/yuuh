import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Empty, Spin } from "antd";
import type { CSSProperties } from "react";
import LoadingState from "../component/Loading/LoadingState";
import { useDocumentReadStore, type FlatRenderBlock } from "../store";
import {
  getCodeThemeByMode,
  getShikiHighlighter,
  resolveCodeLanguageForShiki,
  type CodeThemeMode,
  type ShikiHighlighter,
} from "../editor/codeHighlight";
import "./DocumentVirtualReader.css";

type DocumentVirtualReaderProps = {
  docId: string;
};

const OVERSCAN_PX = 800;
const MIN_VIEWPORT_HEIGHT = 320;

const clampDepth = (depth: number): number => {
  if (!Number.isFinite(depth)) return 0;
  return Math.max(0, Math.min(6, Math.floor(depth)));
};

const estimateRowHeight = (item: FlatRenderBlock | undefined): number => {
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

type LayoutInfo = {
  offsets: number[];
  heights: number[];
  totalHeight: number;
};

const buildLayout = (
  items: FlatRenderBlock[],
  sizeMap: Record<string, number>
): LayoutInfo => {
  const offsets = new Array<number>(items.length);
  const heights = new Array<number>(items.length);
  let cursor = 0;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const measured = sizeMap[item.blockId];
    const height = measured && measured > 0 ? measured : estimateRowHeight(item);
    offsets[i] = cursor;
    heights[i] = height;
    cursor += height;
  }
  return { offsets, heights, totalHeight: cursor };
};

const findStartIndex = (layout: LayoutInfo, targetTop: number): number => {
  const { offsets, heights } = layout;
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

const findEndIndex = (layout: LayoutInfo, targetBottom: number): number => {
  const { offsets } = layout;
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

type ReaderRowProps = {
  item: FlatRenderBlock;
  top: number;
  html: string;
  onMeasured: (blockId: string, height: number) => void;
};

function ReaderRow({ item, top, html, onMeasured }: ReaderRowProps) {
  const rowRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const height = rowRef.current?.getBoundingClientRect().height;
    if (!height || Number.isNaN(height)) return;
    onMeasured(item.blockId, Math.ceil(height) + 8);
  }, [item.blockId, item.renderKey, onMeasured]);

  return (
    <article
      ref={rowRef}
      className={`doc-reader-row depth-${clampDepth(item.depth)}`}
      style={{ "--row-top": `${top}px` } as CSSProperties}
    >
      <div className="doc-reader-row-content" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}

const renderItemHtml = (
  item: FlatRenderBlock,
  highlighter: ShikiHighlighter | null,
  themeMode: CodeThemeMode
): string => {
  if (!highlighter || item.normalized.type !== "code") {
    return item.html;
  }
  try {
    const lang = resolveCodeLanguageForShiki(highlighter, item.normalized.language);
    return highlighter.codeToHtml(item.normalized.text || "", {
      lang,
      theme: getCodeThemeByMode(themeMode),
    });
  } catch {
    return item.html;
  }
};

export default function DocumentVirtualReader({ docId }: DocumentVirtualReaderProps) {
  const items = useDocumentReadStore((state) => state.items);
  const totalBlocks = useDocumentReadStore((state) => state.totalBlocks);
  const returnedBlocks = useDocumentReadStore((state) => state.returnedBlocks);
  const hasMore = useDocumentReadStore((state) => state.hasMore);
  const status = useDocumentReadStore((state) => state.status);
  const error = useDocumentReadStore((state) => state.error);
  const initialLoaded = useDocumentReadStore((state) => state.initialLoaded);
  const initRead = useDocumentReadStore((state) => state.initRead);
  const loadNextPage = useDocumentReadStore((state) => state.loadNextPage);

  const virtualHostRef = useRef<HTMLDivElement | null>(null);
  const [rowSizeMap, setRowSizeMap] = useState<Record<string, number>>({});
  const [themeMode, setThemeMode] = useState<CodeThemeMode>("light");
  const [shikiHighlighter, setShikiHighlighter] = useState<ShikiHighlighter | null>(null);
  const [scrollState, setScrollState] = useState({
    relativeTop: 0,
    viewportHeight: MIN_VIEWPORT_HEIGHT,
  });

  useEffect(() => {
    if (!docId) return;
    void initRead(docId, true);
  }, [docId, initRead]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = (matches: boolean) => {
      setThemeMode(matches ? "dark" : "light");
    };
    applyTheme(media.matches);
    const onThemeChange = (event: MediaQueryListEvent) => {
      applyTheme(event.matches);
    };
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onThemeChange);
      return () => media.removeEventListener("change", onThemeChange);
    }
    media.addListener(onThemeChange);
    return () => media.removeListener(onThemeChange);
  }, []);

  useEffect(() => {
    let active = true;
    void getShikiHighlighter()
      .then((highlighter) => {
        if (!active) return;
        setShikiHighlighter(highlighter);
      })
      .catch(() => {
        if (!active) return;
      });
    return () => {
      active = false;
    };
  }, []);

  const reportRowHeight = useCallback((blockId: string, height: number) => {
    if (!Number.isFinite(height) || height <= 0) return;
    setRowSizeMap((prev) => {
      const old = prev[blockId];
      if (old && Math.abs(old - height) <= 1) return prev;
      return {
        ...prev,
        [blockId]: height,
      };
    });
  }, []);

  const layout = useMemo(() => {
    return buildLayout(items, rowSizeMap);
  }, [items, rowSizeMap]);

  const syncScrollMetrics = useCallback(() => {
    const host = virtualHostRef.current;
    if (!host) return;
    const root = host.closest(".dashboard-content") as HTMLElement | null;
    if (!root) {
      const absoluteTop = host.getBoundingClientRect().top + window.scrollY;
      const nextRelativeTop = window.scrollY - absoluteTop;
      const nextViewportHeight = window.innerHeight || MIN_VIEWPORT_HEIGHT;
      setScrollState({
        relativeTop: nextRelativeTop,
        viewportHeight: Math.max(MIN_VIEWPORT_HEIGHT, nextViewportHeight),
      });
      return;
    }

    const rootRect = root.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const hostTopInRoot = root.scrollTop + (hostRect.top - rootRect.top);
    const nextRelativeTop = root.scrollTop - hostTopInRoot;
    const nextViewportHeight = root.clientHeight || MIN_VIEWPORT_HEIGHT;
    setScrollState({
      relativeTop: nextRelativeTop,
      viewportHeight: Math.max(MIN_VIEWPORT_HEIGHT, nextViewportHeight),
    });
  }, []);

  useEffect(() => {
    const host = virtualHostRef.current;
    if (!host) return;
    const root = host.closest(".dashboard-content") as HTMLElement | null;
    const scrollTarget: EventTarget = root || window;

    const onScroll = () => {
      syncScrollMetrics();
    };
    const onResize = () => {
      syncScrollMetrics();
    };

    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    requestAnimationFrame(() => {
      syncScrollMetrics();
    });

    return () => {
      scrollTarget.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [syncScrollMetrics, items.length]);

  useEffect(() => {
    requestAnimationFrame(() => {
      syncScrollMetrics();
    });
  }, [items.length, layout.totalHeight, syncScrollMetrics]);

  const visibleRange = useMemo(() => {
    if (items.length === 0) {
      return {
        start: 0,
        end: -1,
      };
    }

    const startTarget = scrollState.relativeTop - OVERSCAN_PX;
    const endTarget = scrollState.relativeTop + scrollState.viewportHeight + OVERSCAN_PX;
    const start = Math.max(0, findStartIndex(layout, startTarget));
    const end = Math.min(items.length - 1, findEndIndex(layout, endTarget));
    return { start, end };
  }, [items.length, layout, scrollState.relativeTop, scrollState.viewportHeight]);

  const visibleItems = useMemo(() => {
    if (visibleRange.end < visibleRange.start) return [];
    const rows: Array<{ item: FlatRenderBlock; top: number; html: string }> = [];
    for (let i = visibleRange.start; i <= visibleRange.end; i += 1) {
      const item = items[i];
      rows.push({
        item,
        top: layout.offsets[i],
        html: renderItemHtml(item, shikiHighlighter, themeMode),
      });
    }
    return rows;
  }, [items, layout.offsets, shikiHighlighter, themeMode, visibleRange.end, visibleRange.start]);

  const showBottomStatus = status === "append_loading" || hasMore || Boolean(error);

  useEffect(() => {
    if (!hasMore) return;
    if (status === "loading" || status === "append_loading") return;
    if (items.length === 0) return;
    if (visibleRange.end >= items.length - 8) {
      void loadNextPage();
    }
  }, [hasMore, items.length, loadNextPage, status, visibleRange.end]);

  if (!initialLoaded && status === "loading") {
    return <LoadingState tip="正在加载文档内容..." minHeight={320} />;
  }

  if (error && items.length === 0) {
    return (
      <div className="doc-reader-error-wrap">
        <Alert
          type="error"
          showIcon
          message="文档加载失败"
          description={error}
          action={
            <Button
              size="small"
              onClick={() => {
                void initRead(docId, true);
              }}
            >
              重试
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="doc-reader-shell">
      {error && items.length > 0 && (
        <div className="doc-reader-top-alert">
          <Alert type="warning" showIcon message={error} />
        </div>
      )}

      {items.length === 0 ? (
        <Empty description="暂无已提交内容" />
      ) : (
        <div ref={virtualHostRef} className="doc-reader-virtual-host">
          <div className="doc-reader-virtual-inner" style={{ height: layout.totalHeight }}>
            {visibleItems.map(({ item, top, html }) => (
              <ReaderRow
                key={item.renderKey}
                item={item}
                top={top}
                html={html}
                onMeasured={reportRowHeight}
              />
            ))}
          </div>
        </div>
      )}

      {items.length > 0 && showBottomStatus && (
        <footer className="doc-reader-bottom-status">
          {status === "append_loading" ? (
            <span className="doc-reader-bottom-loading">
              <Spin size="small" />
              <span>正在加载更多内容…</span>
            </span>
          ) : hasMore ? (
            <span className="doc-reader-bottom-hint">继续下滑以加载更多内容</span>
          ) : null}

          <span className="doc-reader-bottom-meta">
            已加载 {returnedBlocks} / {totalBlocks || returnedBlocks}
          </span>

          {error && status !== "append_loading" && (
            <Button
              size="small"
              onClick={() => {
                void loadNextPage();
              }}
            >
              重试加载
            </Button>
          )}
        </footer>
      )}
    </div>
  );
}
