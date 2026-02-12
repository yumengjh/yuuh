import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlock from "@tiptap/extension-code-block";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { Extension, type Editor as TiptapEditor } from "@tiptap/core";
import { Plugin } from "prosemirror-state";
import { DOMParser as ProseMirrorDOMParser, Slice } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import { Input, Spin, message } from "antd";
import { marked } from "marked";
import { useDocumentEngineStore } from "./useDocumentEngineStore";
import {
  createRemoteBlock,
  deleteRemoteBlock,
  updateRemoteBlockContent,
} from "./blockGateway";
import {
  areNormalizedBlocksEqual,
  contentTreeToHtml,
  editorJsonToNormalizedBlocks,
  extractTopLevelBlocksFromContent,
  type RemoteTopLevelBlock,
  type NormalizedDocBlock,
} from "./contentAdapter";
import { useDocumentContext } from "../context/documentContext";
import { useEditContext } from "../context/editContext";
import { apiV1 } from "../api_v1";
import {
  DEFAULT_CODE_LANGUAGE,
  getShikiHighlighter,
  type CodeThemeMode,
  type ShikiHighlighter,
} from "./codeHighlight";
import { createShikiCodeBlockExtension, SHIKI_CODE_BLOCK_PLUGIN_KEY } from "./shikiCodeBlock";
import { registerEditorSyncBridge, unregisterEditorSyncBridge } from "./editorSyncBridge";
import { getRemoteSnapshotCache, setRemoteSnapshotCache } from "./remoteSnapshotCache";
import "./tiptap.css";

type TiptapChain = {
  setMark: (name: string, attrs: Record<string, unknown>) => TiptapChain;
  removeEmptyTextStyle: () => TiptapChain;
  run: () => boolean;
};

type SaveStage = "idle" | "dirty" | "saving" | "committing" | "synced" | "error";

const normalizeSortKey = (sortKey?: string): number => {
  if (!sortKey) return 0;
  const parsed = Number(sortKey);
  return Number.isFinite(parsed) ? parsed : 0;
};

const DEFAULT_SYNC_CONCURRENCY = 8;
const MIN_SYNC_CONCURRENCY = 1;
const MAX_SYNC_CONCURRENCY = 24;
const TITLE_AUTO_SAVE_DEBOUNCE_MS = 700;
const AUTO_BLOCK_SYNC_DEBOUNCE_MS = 900;
const AUTO_BLOCK_SYNC_MAX_WAIT_MS = 8000;
const AUTO_BLOCK_SYNC_OPERATION_THRESHOLD = 20;

const clampSyncConcurrency = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_SYNC_CONCURRENCY;
  return Math.max(MIN_SYNC_CONCURRENCY, Math.min(MAX_SYNC_CONCURRENCY, Math.floor(value)));
};

const parseSyncConcurrencyEnv = (): "auto" | number => {
  const raw = import.meta.env.VITE_BLOCK_SYNC_CONCURRENCY;
  if (!raw || !raw.trim()) return DEFAULT_SYNC_CONCURRENCY;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "auto") return "auto";
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return DEFAULT_SYNC_CONCURRENCY;
  return clampSyncConcurrency(parsed);
};

const resolveAutoSyncConcurrency = (docBlockSize: number): number => {
  if (docBlockSize <= 300) return 4;
  if (docBlockSize <= 1000) return 8;
  if (docBlockSize <= 3000) return 12;
  if (docBlockSize <= 8000) return 16;
  return 20;
};

const resolveSyncConcurrency = (docBlockSize: number): number => {
  const envValue = parseSyncConcurrencyEnv();
  if (envValue === "auto") {
    return clampSyncConcurrency(resolveAutoSyncConcurrency(docBlockSize));
  }
  return clampSyncConcurrency(envValue);
};

const runWithConcurrency = async <T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency = DEFAULT_SYNC_CONCURRENCY
): Promise<R[]> => {
  if (items.length === 0) return [];

  const maxConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runner = async () => {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) return;
      results[current] = await worker(items[current], current);
    }
  };

  await Promise.all(Array.from({ length: maxConcurrency }, () => runner()));
  return results;
};

const buildBlockSignature = (
  block: Pick<NormalizedDocBlock, "type" | "text" | "level" | "ordered" | "checked" | "language">
): string => {
  return JSON.stringify({
    type: block.type,
    text: (block.text || "").trim(),
    level: block.level ?? null,
    ordered: block.ordered ?? null,
    checked: block.checked ?? null,
    language: block.language ?? null,
  });
};

const buildLcsPairs = (
  remoteSignatures: string[],
  localSignatures: string[]
): Array<{ remoteIndex: number; localIndex: number }> => {
  const m = remoteSignatures.length;
  const n = localSignatures.length;

  if (m === 0 || n === 0) return [];

  if (m * n > 250000) {
    const pairs: Array<{ remoteIndex: number; localIndex: number }> = [];
    let remoteStart = 0;
    let localStart = 0;
    while (
      remoteStart < m &&
      localStart < n &&
      remoteSignatures[remoteStart] === localSignatures[localStart]
    ) {
      pairs.push({ remoteIndex: remoteStart, localIndex: localStart });
      remoteStart += 1;
      localStart += 1;
    }

    let remoteEnd = m - 1;
    let localEnd = n - 1;
    const suffix: Array<{ remoteIndex: number; localIndex: number }> = [];
    while (
      remoteEnd >= remoteStart &&
      localEnd >= localStart &&
      remoteSignatures[remoteEnd] === localSignatures[localEnd]
    ) {
      suffix.push({ remoteIndex: remoteEnd, localIndex: localEnd });
      remoteEnd -= 1;
      localEnd -= 1;
    }

    return [...pairs, ...suffix.reverse()];
  }

  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      if (remoteSignatures[i - 1] === localSignatures[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const pairs: Array<{ remoteIndex: number; localIndex: number }> = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (remoteSignatures[i - 1] === localSignatures[j - 1]) {
      pairs.push({ remoteIndex: i - 1, localIndex: j - 1 });
      i -= 1;
      j -= 1;
      continue;
    }
    if (dp[i - 1][j] >= dp[i][j - 1]) {
      i -= 1;
    } else {
      j -= 1;
    }
  }

  return pairs.reverse();
};

const formatSortKey = (value: number): string | undefined => {
  if (!Number.isFinite(value)) return undefined;
  return String(Number(value.toFixed(6)));
};

const calcSortKeyForCreate = (
  localIndex: number,
  placementSortKeys: Array<number | undefined>
): string | undefined => {
  let prev: number | undefined;
  for (let i = localIndex - 1; i >= 0; i -= 1) {
    const key = placementSortKeys[i];
    if (typeof key === "number" && Number.isFinite(key)) {
      prev = key;
      break;
    }
  }

  let next: number | undefined;
  for (let i = localIndex + 1; i < placementSortKeys.length; i += 1) {
    const key = placementSortKeys[i];
    if (typeof key === "number" && Number.isFinite(key)) {
      next = key;
      break;
    }
  }

  if (typeof prev === "number" && typeof next === "number") {
    if (next === prev) {
      return formatSortKey(prev + 0.000001);
    }
    return formatSortKey((prev + next) / 2);
  }
  if (typeof prev === "number") {
    return formatSortKey(prev + 100000);
  }
  if (typeof next === "number") {
    return formatSortKey(next - 100000);
  }
  return formatSortKey((localIndex + 1) * 100000);
};

const sortRemoteBlocks = (blocks: RemoteTopLevelBlock[]): RemoteTopLevelBlock[] => {
  return [...blocks].sort((a, b) => normalizeSortKey(a.sortKey) - normalizeSortKey(b.sortKey));
};

export default function TiptapNotionEditor() {
  const { currentDocument, updateDocumentTitle } = useDocumentContext();
  const { isEditing } = useEditContext();
  const {
    docId,
    blockId,
    markdown,
    docVer,
    initialized,
    setMarkdown,
    setEditor,
    switchDocument,
  } = useDocumentEngineStore();

  const isUpdatingFromStore = useRef(false);
  const initializingDocId = useRef<string | null>(null);
  const isEditingTitle = useRef(false);
  const lastSyncedDocId = useRef<string | null>(null);
  const persistInFlightRef = useRef<Promise<void> | null>(null);
  const autoBlockSyncTimerRef = useRef<number | null>(null);
  const autoBlockSyncMaxWaitTimerRef = useRef<number | null>(null);
  const scheduleAutoBlockSyncRef = useRef<() => void>(() => undefined);
  const flushAutoBlockSyncRef = useRef<() => Promise<void>>(async () => undefined);
  const blockDirtyRef = useRef(false);
  const blockChangeVersionRef = useRef(0);
  const blockBufferedOpsRef = useRef(0);
  const titleAutoSaveTimerRef = useRef<number | null>(null);
  const titleSavingPromiseRef = useRef<Promise<void> | null>(null);
  const lastSavedTitleRef = useRef<string>("");
  const latestTitleValueRef = useRef<string>("");
  const remoteSnapshotByDocRef = useRef(new Map<string, RemoteTopLevelBlock[]>());
  const rootBlockIdByDocRef = useRef(new Map<string, string>());
  const remoteSnapshotLoadingRef = useRef(new Map<string, Promise<void>>());
  const prevEditingRef = useRef(isEditing);
  const themeModeRef = useRef<CodeThemeMode>("light");
  const latestDocStateRef = useRef({
    initialized: false,
    docId: null as string | null,
    blockId: null as string | null,
    markdown: "",
    currentDocument: null as typeof currentDocument,
  });
  const [themeMode, setThemeMode] = useState<CodeThemeMode>("light");
  const [shikiHighlighter, setShikiHighlighter] = useState<ShikiHighlighter | null>(null);
  const [shikiReady, setShikiReady] = useState(false);
  const [title, setTitle] = useState<string>("");
  const [saveStage, setSaveStage] = useState<SaveStage>("idle");
  const editorRef = useRef<TiptapEditor | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = (matches: boolean) => {
      const nextMode: CodeThemeMode = matches ? "dark" : "light";
      themeModeRef.current = nextMode;
      setThemeMode(nextMode);
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
        setShikiReady(true);
      })
      .catch((error) => {
        if (!active) return;
        setShikiReady(true);
        const msg = error instanceof Error ? error.message : "Shiki 初始化失败";
        message.warning(`代码高亮初始化失败，将回退基础代码块：${msg}`);
      });

    return () => {
      active = false;
    };
  }, []);

  const codeBlockExtension = useMemo(() => {
    if (shikiHighlighter) {
      return createShikiCodeBlockExtension({
        highlighter: shikiHighlighter,
        getThemeMode: () => themeModeRef.current,
        defaultLanguage: DEFAULT_CODE_LANGUAGE,
      });
    }

    return CodeBlock.configure({
      defaultLanguage: DEFAULT_CODE_LANGUAGE,
      languageClassPrefix: "language-",
    });
  }, [shikiHighlighter]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      codeBlockExtension,
      Placeholder.configure({
        placeholder: "像在 Notion / Typora 一样开始记录你的知识吧…",
      }),
      Underline,
      TaskList.configure({
        HTMLAttributes: {
          class: "task-list",
        },
      }),
      TaskItem.configure({
        nested: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "tiptap-link",
        },
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      // 粘贴处理扩展（支持 HTML 和 Markdown）
      Extension.create({
        name: "pasteHandler",
        addProseMirrorPlugins() {
          // 清理粘贴的 HTML 内容
          const cleanPastedHTML = (html: string): string => {
            // 创建一个临时 DOM 来解析和清理 HTML
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = html;
            
            // 移除不需要的标签和属性
            const unwantedTags = ["script", "style", "meta", "link", "iframe", "object", "embed"];
            unwantedTags.forEach(tag => {
              const elements = tempDiv.querySelectorAll(tag);
              elements.forEach(el => el.remove());
            });
            
            // 清理链接，确保链接有效
            const links = tempDiv.querySelectorAll("a");
            links.forEach(link => {
              const href = link.getAttribute("href");
              if (!href || href.startsWith("javascript:") || href.startsWith("data:")) {
                // 移除危险的链接
                const parent = link.parentNode;
                if (parent) {
                  while (link.firstChild) {
                    parent.insertBefore(link.firstChild, link);
                  }
                  parent.removeChild(link);
                }
              }
            });
            
            // 移除空的段落和只有尾随换行符的段落
            const paragraphs = tempDiv.querySelectorAll("p");
            paragraphs.forEach(p => {
              // 检查段落是否只包含 br 标签（特别是 ProseMirror-trailingBreak）
              const brs = p.querySelectorAll("br");
              const hasOnlyBr = brs.length > 0 && p.textContent?.trim() === "";
              const hasTrailingBreak = Array.from(brs).some(br => 
                br.classList.contains("ProseMirror-trailingBreak")
              );
              
              if (hasOnlyBr || hasTrailingBreak) {
                p.remove();
              }
            });
            
            // 移除所有 ProseMirror-trailingBreak 的 br 标签
            const trailingBreaks = tempDiv.querySelectorAll("br.ProseMirror-trailingBreak");
            trailingBreaks.forEach(br => br.remove());
            
            // 清理开头和结尾的空段落
            let cleanedHtml = tempDiv.innerHTML;
            
            // 移除开头的空段落
            cleanedHtml = cleanedHtml.replace(/^<p>\s*<br[^>]*>\s*<\/p>/i, "");
            cleanedHtml = cleanedHtml.replace(/^<p>\s*<\/p>/i, "");
            
            // 移除结尾的空段落
            cleanedHtml = cleanedHtml.replace(/<p>\s*<br[^>]*>\s*<\/p>$/i, "");
            cleanedHtml = cleanedHtml.replace(/<p>\s*<\/p>$/i, "");
            
            return cleanedHtml;
          };
          
          return [
            new Plugin({
              props: {
                handlePaste: (view: EditorView, event: ClipboardEvent) => {
                  // 优先获取 HTML 内容（从网站复制的内容）
                  const html = event.clipboardData?.getData("text/html");
                  const text = event.clipboardData?.getData("text/plain");
                  
                  if (!html && !text) return false;

                  // 如果有 HTML 内容，直接使用（从网站复制的内容）
                  if (html && html.trim()) {
                    // 检查是否是有效的 HTML
                    const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(html);
                    
                    if (hasHtmlTags) {
                      event.preventDefault();
                      
                      try {
                        // 清理 HTML（移除不需要的标签和属性）
                        const cleanHtml = cleanPastedHTML(html);
                        
                        // 使用编辑器实例插入内容
                        const editorInstance = this.editor;
                        if (editorInstance) {
                          // 插入内容
                          editorInstance.commands.insertContent(cleanHtml, {
                            parseOptions: {
                              preserveWhitespace: false,
                            },
                          });
                          
                          // 插入后立即清理：使用 requestAnimationFrame 确保 DOM 更新完成
                          requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                              const html = editorInstance.getHTML();
                              
                              // 如果包含 ProseMirror-trailingBreak，清理它
                              if (html.includes('ProseMirror-trailingBreak')) {
                                // 使用正则表达式移除所有包含 ProseMirror-trailingBreak 的段落
                                const cleaned = html
                                  // 移除开头的空段落（包含 ProseMirror-trailingBreak）
                                  .replace(/^<p[^>]*>\s*<br[^>]*class="ProseMirror-trailingBreak"[^>]*>\s*<\/p>/i, "")
                                  // 移除所有包含 ProseMirror-trailingBreak 的段落
                                  .replace(/<p[^>]*>[\s\S]*?<br[^>]*class="ProseMirror-trailingBreak"[^>]*>[\s\S]*?<\/p>/gi, "")
                                  // 移除所有单独的 ProseMirror-trailingBreak br 标签
                                  .replace(/<br[^>]*class="ProseMirror-trailingBreak"[^>]*>/gi, "")
                                  // 移除开头的空段落（不包含 class 的）
                                  .replace(/^<p>\s*<br[^>]*>\s*<\/p>/i, "")
                                  .replace(/^<p>\s*<\/p>/i, "");
                                
                                // 如果清理后的内容不同，更新编辑器
                                if (cleaned !== html && cleaned.trim() !== "") {
                                  // 保存当前光标位置
                                  const { from } = editorInstance.state.selection;
                                  
                                  // 设置清理后的内容
                                  editorInstance.commands.setContent(cleaned, { emitUpdate: false });
                                  
                                  // 恢复光标位置（如果可能）
                                  setTimeout(() => {
                                    try {
                                      const newDoc = editorInstance.state.doc;
                                      const newFrom = Math.min(from, newDoc.content.size);
                                      editorInstance.commands.setTextSelection(newFrom);
                                    } catch {
                                      // 忽略光标位置错误
                                    }
                                  }, 0);
                                }
                              }
                            });
                          });
                          
                          return true;
                        } else {
                          // 备用方案：使用 ProseMirror 的方式直接插入
                          const parser = ProseMirrorDOMParser.fromSchema(view.state.schema);
                          const dom = new DOMParser().parseFromString(cleanHtml, "text/html");
                          const fragment = parser.parse(dom.body);
                          const { from, to } = view.state.selection;
                          const slice = new Slice(fragment.content, 0, 0);
                          const transaction = view.state.tr.replace(from, to, slice);
                          view.dispatch(transaction);
                          return true;
                        }
                      } catch {
                        return false;
                      }
                    }
                  }

                  // 如果没有 HTML 或 HTML 无效，检查是否是 Markdown 格式的纯文本
                  if (text) {
                    // 检测是否是 Markdown 格式
                    const looksLikeMarkdown = /(^#{1,6}\s)|(\*\*.*\*\*)|(\*.*\*)|(^-\s)|(^\*\s)|(^\d+\.\s)|(^>\s)|(\[.*\]\(.*\))|(```)/m.test(text);

                    if (looksLikeMarkdown) {
                      event.preventDefault();
                      
                      try {
                        // 使用 marked.parse 同步解析 Markdown 为 HTML
                        const parsedHtml = marked.parse(text, {
                          breaks: true,
                          gfm: true,
                        }) as string;

                        // 使用编辑器实例插入内容
                        const editorInstance = this.editor;
                        if (editorInstance) {
                          editorInstance.commands.insertContent(parsedHtml);
                          return true;
                        } else {
                          // 备用方案：使用 ProseMirror 的方式直接插入
                          const parser = ProseMirrorDOMParser.fromSchema(view.state.schema);
                          const dom = new DOMParser().parseFromString(parsedHtml, "text/html");
                          const fragment = parser.parse(dom.body);
                          const { from, to } = view.state.selection;
                          const slice = new Slice(fragment.content, 0, 0);
                          const transaction = view.state.tr.replace(from, to, slice);
                          view.dispatch(transaction);
                          return true;
                        }
                      } catch {
                        return false;
                      }
                    }
                  }
                  
                  // 其他情况交给默认处理
                  return false;
                },
              },
            }),
          ];
        },
      }),
      // 自定义字号扩展
      Extension.create({
        name: "fontSize",
        addOptions() {
          return {
            types: ["textStyle"],
          };
        },
        addGlobalAttributes() {
          return [
            {
              types: this.options.types,
              attributes: {
                fontSize: {
                  default: null,
                  parseHTML: (element) => {
                    const fontSize = element.style.fontSize;
                    if (fontSize) {
                      return fontSize.replace("px", "");
                    }
                    return null;
                  },
                  renderHTML: (attributes) => {
                    if (!attributes.fontSize) {
                      return {};
                    }
                    return {
                      style: `font-size: ${attributes.fontSize}px`,
                    };
                  },
                },
              },
            },
          ];
        },
        addCommands() {
          return {
            setFontSize:
              (fontSize: string) =>
              ({ chain }: { chain: () => TiptapChain }) => {
                return chain()
                  .setMark("textStyle", { fontSize })
                  .run();
              },
            unsetFontSize:
              () =>
              ({ chain }: { chain: () => TiptapChain }) => {
                return chain()
                  .setMark("textStyle", { fontSize: null })
                  .removeEmptyTextStyle()
                  .run();
              },
          };
        },
      }),
    ],
    content: markdown || "<p></p>",
    autofocus: "end",
    editable: isEditing,
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
    },
    onBlur: () => {
      void flushAutoBlockSyncRef.current();
    },
    onUpdate: ({ editor }) => {
      // 如果是从 store 更新内容，不触发 markdown 更新
      if (isUpdatingFromStore.current) {
        isUpdatingFromStore.current = false;
        return;
      }
      const html = editor.getHTML();
      const normalized = html === "<p></p>" ? "" : html;
      blockDirtyRef.current = true;
      blockChangeVersionRef.current += 1;
      blockBufferedOpsRef.current += 1;
      setSaveStage("dirty");
      setMarkdown(normalized);
      scheduleAutoBlockSyncRef.current();
    },
  }, [codeBlockExtension]);

  // 保存编辑器实例到 ref，供粘贴插件使用
  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
    }
  }, [editor]);

  useEffect(() => {
    themeModeRef.current = themeMode;
    if (!editor || !shikiHighlighter) return;
    const tr = editor.state.tr.setMeta(SHIKI_CODE_BLOCK_PLUGIN_KEY, true);
    editor.view.dispatch(tr);
  }, [editor, shikiHighlighter, themeMode]);

  useEffect(() => {
    latestDocStateRef.current = {
      initialized,
      docId,
      blockId,
      markdown,
      currentDocument,
    };
  }, [blockId, currentDocument, docId, initialized, markdown]);

  const setRemoteSnapshot = useCallback(
    (targetDocId: string, rootBlockId: string | null, blocks: RemoteTopLevelBlock[]) => {
      const sortedBlocks = sortRemoteBlocks(blocks);
      remoteSnapshotByDocRef.current.set(targetDocId, sortedBlocks);
      if (rootBlockId) {
        rootBlockIdByDocRef.current.set(targetDocId, rootBlockId);
      } else {
        rootBlockIdByDocRef.current.delete(targetDocId);
      }
      setRemoteSnapshotCache(targetDocId, { rootBlockId, blocks: sortedBlocks });
    },
    []
  );

  const loadRemoteSnapshot = useCallback(
    async (targetDocId: string, force = false) => {
      if (!targetDocId) return;
      if (!force && remoteSnapshotByDocRef.current.has(targetDocId)) {
        return;
      }

      if (!force) {
        const cached = getRemoteSnapshotCache(targetDocId);
        if (cached) {
          setRemoteSnapshot(targetDocId, cached.rootBlockId, cached.blocks);
          return;
        }
      }

      const loading = remoteSnapshotLoadingRef.current.get(targetDocId);
      if (loading) {
        await loading;
        return;
      }

      const task = (async () => {
        const contentRes = await apiV1.documents.getDocumentContent(targetDocId, { limit: 10000 });
        const { rootBlockId, blocks } = extractTopLevelBlocksFromContent(contentRes);
        setRemoteSnapshot(targetDocId, rootBlockId, blocks);
      })();

      remoteSnapshotLoadingRef.current.set(targetDocId, task);
      try {
        await task;
      } finally {
        remoteSnapshotLoadingRef.current.delete(targetDocId);
      }
    },
    [setRemoteSnapshot]
  );

  const clearTitleAutoSaveTimer = useCallback(() => {
    if (titleAutoSaveTimerRef.current !== null) {
      window.clearTimeout(titleAutoSaveTimerRef.current);
      titleAutoSaveTimerRef.current = null;
    }
  }, []);

  const saveTitleIfNeeded = useCallback(
    async (nextRawTitle: string, withFeedback = false) => {
      const targetDocId = latestDocStateRef.current.docId;
      if (!targetDocId) return false;

      const normalizedTitle = nextRawTitle.trim();
      if (normalizedTitle === lastSavedTitleRef.current) return false;

      setSaveStage("saving");

      const run = async () => {
        await updateDocumentTitle(targetDocId, normalizedTitle);
        lastSavedTitleRef.current = normalizedTitle;
        setSaveStage("synced");
        if (withFeedback) {
          message.success("标题已自动保存");
        }
      };

      const chained = (titleSavingPromiseRef.current || Promise.resolve())
        .catch(() => undefined)
        .then(run);

      titleSavingPromiseRef.current = chained.then(() => undefined).catch(() => undefined);

      try {
        await chained;
        return true;
      } catch (error) {
        setSaveStage("error");
        const msg = error instanceof Error ? error.message : "标题保存失败";
        message.error(msg);
        return false;
      }
    },
    [updateDocumentTitle]
  );

  const scheduleTitleAutoSave = useCallback(() => {
    clearTitleAutoSaveTimer();
    titleAutoSaveTimerRef.current = window.setTimeout(() => {
      titleAutoSaveTimerRef.current = null;
      void saveTitleIfNeeded(latestTitleValueRef.current);
    }, TITLE_AUTO_SAVE_DEBOUNCE_MS);
  }, [clearTitleAutoSaveTimer, saveTitleIfNeeded]);

  const flushTitleAutoSave = useCallback(async () => {
    clearTitleAutoSaveTimer();
    await saveTitleIfNeeded(latestTitleValueRef.current);
  }, [clearTitleAutoSaveTimer, saveTitleIfNeeded]);

  const clearAutoBlockSyncTimer = useCallback(() => {
    if (autoBlockSyncTimerRef.current !== null) {
      window.clearTimeout(autoBlockSyncTimerRef.current);
      autoBlockSyncTimerRef.current = null;
    }
  }, []);

  const clearAutoBlockSyncMaxWaitTimer = useCallback(() => {
    if (autoBlockSyncMaxWaitTimerRef.current !== null) {
      window.clearTimeout(autoBlockSyncMaxWaitTimerRef.current);
      autoBlockSyncMaxWaitTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!currentDocument?.docId) return;
    blockDirtyRef.current = false;
    blockChangeVersionRef.current = 0;
    blockBufferedOpsRef.current = 0;
    clearAutoBlockSyncTimer();
    clearAutoBlockSyncMaxWaitTimer();
    setSaveStage("idle");
  }, [clearAutoBlockSyncMaxWaitTimer, clearAutoBlockSyncTimer, currentDocument?.docId]);

  useEffect(() => {
    if (!isEditing || !currentDocument?.docId) return;
    void loadRemoteSnapshot(currentDocument.docId);
  }, [currentDocument?.docId, isEditing, loadRemoteSnapshot]);

  const persistNow = useCallback(async () => {
    if (persistInFlightRef.current) {
      await persistInFlightRef.current;
    }

    if (!blockDirtyRef.current) return null;

    const state = latestDocStateRef.current;
    if (!state.initialized || !state.currentDocument || !state.docId) return null;

    const targetDocId = state.docId;
    const editorJson = editor?.getJSON();
    const targetBlocks = editorJsonToNormalizedBlocks(editorJson);
    const syncStartVersion = blockChangeVersionRef.current;

    setSaveStage("saving");
    const persistJob = (async () => {
      await loadRemoteSnapshot(targetDocId);
      const remoteSortedBlocks = sortRemoteBlocks(
        remoteSnapshotByDocRef.current.get(targetDocId) || []
      );
      const rootParentId = rootBlockIdByDocRef.current.get(targetDocId) || undefined;
      const docBlockSize = Math.max(targetBlocks.length, remoteSortedBlocks.length);
      const syncConcurrency = resolveSyncConcurrency(docBlockSize);
      const remoteSignatures = remoteSortedBlocks.map((item) => buildBlockSignature(item.normalized));
      const localSignatures = targetBlocks.map((item) => buildBlockSignature(item));
      const stablePairs = buildLcsPairs(remoteSignatures, localSignatures);

      let created = 0;
      let updated = 0;
      let deleted = 0;
      let replaced = 0;
      const mappedPairs: Array<{ remoteIndex: number; localIndex: number }> = [];
      const updates: Array<{
        remoteIndex: number;
        localIndex: number;
        blockId: string;
        localBlock: NormalizedDocBlock;
      }> = [];
      const deleteOps: Array<{ remoteIndex: number; blockId: string }> = [];
      const createOps: Array<{ localIndex: number; localBlock: NormalizedDocBlock }> = [];

      let remoteCursor = 0;
      let localCursor = 0;
      const anchors = [
        ...stablePairs,
        { remoteIndex: remoteSortedBlocks.length, localIndex: targetBlocks.length },
      ];

      anchors.forEach((anchor, anchorIdx) => {
        const remoteSegmentEnd = anchor.remoteIndex;
        const localSegmentEnd = anchor.localIndex;
        const remoteSegmentLen = remoteSegmentEnd - remoteCursor;
        const localSegmentLen = localSegmentEnd - localCursor;
        const pairCount = Math.min(remoteSegmentLen, localSegmentLen);

        for (let offset = 0; offset < pairCount; offset += 1) {
          const remoteIndex = remoteCursor + offset;
          const localIndex = localCursor + offset;
          const remoteBlock = remoteSortedBlocks[remoteIndex];
          const localBlock = targetBlocks[localIndex];
          if (!remoteBlock || !localBlock) continue;

          if (remoteBlock.normalized.type === localBlock.type) {
            mappedPairs.push({ remoteIndex, localIndex });
            if (!areNormalizedBlocksEqual(localBlock, remoteBlock.normalized)) {
              updates.push({
                remoteIndex,
                localIndex,
                blockId: remoteBlock.blockId,
                localBlock,
              });
            }
            continue;
          }

          deleteOps.push({ remoteIndex, blockId: remoteBlock.blockId });
          createOps.push({ localIndex, localBlock });
          replaced += 1;
        }

        for (let remoteIndex = remoteCursor + pairCount; remoteIndex < remoteSegmentEnd; remoteIndex += 1) {
          const remoteBlock = remoteSortedBlocks[remoteIndex];
          if (!remoteBlock) continue;
          deleteOps.push({ remoteIndex, blockId: remoteBlock.blockId });
        }

        for (let localIndex = localCursor + pairCount; localIndex < localSegmentEnd; localIndex += 1) {
          const localBlock = targetBlocks[localIndex];
          if (!localBlock) continue;
          createOps.push({ localIndex, localBlock });
        }

        if (anchorIdx < stablePairs.length) {
          mappedPairs.push({
            remoteIndex: anchor.remoteIndex,
            localIndex: anchor.localIndex,
          });
          remoteCursor = anchor.remoteIndex + 1;
          localCursor = anchor.localIndex + 1;
        }
      });

      const updatesSorted = [...updates].sort((a, b) => a.remoteIndex - b.remoteIndex);
      if (updatesSorted.length > 0) {
        await runWithConcurrency(
          updatesSorted,
          async (item) => updateRemoteBlockContent(item.blockId, item.localBlock),
          syncConcurrency
        );
        updated = updatesSorted.length;
      }

      const deletesSorted = [...deleteOps].sort((a, b) => b.remoteIndex - a.remoteIndex);
      if (deletesSorted.length > 0) {
        // 后端 DELETE 当前会触发版本递增，串行执行可规避并发唯一键冲突
        await runWithConcurrency(
          deletesSorted,
          async (item) => deleteRemoteBlock(item.blockId),
          1
        );
        deleted = deletesSorted.length;
      }

      const localPlacementSortKeys = new Array<number | undefined>(targetBlocks.length).fill(undefined);
      mappedPairs.forEach((pair) => {
        const remoteBlock = remoteSortedBlocks[pair.remoteIndex];
        if (!remoteBlock) return;
        const sortKey = normalizeSortKey(remoteBlock.sortKey);
        if (Number.isFinite(sortKey)) {
          localPlacementSortKeys[pair.localIndex] = sortKey;
        }
      });

      const createdBlockIdByLocalIndex = new Map<number, string>();
      const createSortKeyByLocalIndex = new Map<number, string | undefined>();
      const createsSorted = [...createOps].sort((a, b) => a.localIndex - b.localIndex);
      const createPlans = createsSorted.map((item) => {
        const sortKey = calcSortKeyForCreate(item.localIndex, localPlacementSortKeys);
        if (sortKey) {
          const parsedSortKey = Number(sortKey);
          if (Number.isFinite(parsedSortKey)) {
          localPlacementSortKeys[item.localIndex] = parsedSortKey;
          }
        }
        createSortKeyByLocalIndex.set(item.localIndex, sortKey);
        return {
          ...item,
          sortKey,
        };
      });

      const createResults = await runWithConcurrency(
        createPlans,
        async (item) => {
          const blockId = await createRemoteBlock(targetDocId, item.localBlock, {
            parentId: rootParentId,
            sortKey: item.sortKey,
          });
          return {
            localIndex: item.localIndex,
            blockId,
          };
        },
        syncConcurrency
      );

      const createsOrderedByLocalIndex = [...createResults].sort((a, b) => a.localIndex - b.localIndex);
      for (const item of createsOrderedByLocalIndex) {
        createdBlockIdByLocalIndex.set(item.localIndex, item.blockId);
      }
      if (createsOrderedByLocalIndex.length > 0) {
        created = createsOrderedByLocalIndex.length;
      }

      const remoteBlockByLocalIndex = new Map<number, RemoteTopLevelBlock>();
      mappedPairs.forEach((pair) => {
        const remoteBlock = remoteSortedBlocks[pair.remoteIndex];
        if (!remoteBlock) return;
        remoteBlockByLocalIndex.set(pair.localIndex, remoteBlock);
      });

      const nextRemoteBlocks = targetBlocks.map((localBlock, localIndex) => {
        const createdBlockId = createdBlockIdByLocalIndex.get(localIndex);
        if (createdBlockId) {
          return {
            blockId: createdBlockId,
            type: "paragraph",
            normalized: localBlock,
            parentId: rootParentId,
            sortKey: createSortKeyByLocalIndex.get(localIndex),
            indent: 0,
          } as RemoteTopLevelBlock;
        }

        const mappedRemoteBlock = remoteBlockByLocalIndex.get(localIndex);
        if (!mappedRemoteBlock) {
          throw new Error(`块同步失败：未找到本地块(${localIndex})的远端映射`);
        }

        return {
          ...mappedRemoteBlock,
          normalized: localBlock,
        };
      });

      setRemoteSnapshot(targetDocId, rootParentId || null, nextRemoteBlocks);

      if (
        updatesSorted.length === 0 &&
        deletesSorted.length === 0 &&
        createsOrderedByLocalIndex.length === 0
      ) {
        blockDirtyRef.current = false;
        blockBufferedOpsRef.current = 0;
        setSaveStage("synced");
        return { created: 0, updated: 0, deleted: 0, replaced: 0, total: targetBlocks.length };
      }

      if (blockChangeVersionRef.current === syncStartVersion) {
        blockDirtyRef.current = false;
        blockBufferedOpsRef.current = 0;
        setSaveStage("synced");
      } else {
        blockDirtyRef.current = true;
        blockBufferedOpsRef.current = Math.max(
          1,
          blockChangeVersionRef.current - syncStartVersion
        );
        setSaveStage("dirty");
        scheduleAutoBlockSyncRef.current();
      }
      return { created, updated, deleted, replaced, total: targetBlocks.length };
    })().catch((error) => {
      setSaveStage("error");
      throw error;
    });

    persistInFlightRef.current = persistJob.then(() => undefined).catch(() => undefined);
    return persistJob;
  }, [editor, loadRemoteSnapshot, setRemoteSnapshot]);

  const flushAutoBlockSync = useCallback(async () => {
    clearAutoBlockSyncTimer();
    clearAutoBlockSyncMaxWaitTimer();
    if (persistInFlightRef.current) {
      await persistInFlightRef.current;
    }
    if (!blockDirtyRef.current) return;
    try {
      await persistNow();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "同步失败，请稍后重试";
      message.error(msg);
    }
  }, [clearAutoBlockSyncMaxWaitTimer, clearAutoBlockSyncTimer, persistNow]);

  useEffect(() => {
    flushAutoBlockSyncRef.current = async () => {
      await flushAutoBlockSync();
    };
  }, [flushAutoBlockSync]);

  const scheduleAutoBlockSync = useCallback(() => {
    if (!isEditing) return;

    if (blockBufferedOpsRef.current >= AUTO_BLOCK_SYNC_OPERATION_THRESHOLD) {
      clearAutoBlockSyncTimer();
      clearAutoBlockSyncMaxWaitTimer();
      void flushAutoBlockSync();
      return;
    }

    clearAutoBlockSyncTimer();
    autoBlockSyncTimerRef.current = window.setTimeout(() => {
      autoBlockSyncTimerRef.current = null;
      clearAutoBlockSyncMaxWaitTimer();
      void flushAutoBlockSync();
    }, AUTO_BLOCK_SYNC_DEBOUNCE_MS);

    if (autoBlockSyncMaxWaitTimerRef.current === null) {
      autoBlockSyncMaxWaitTimerRef.current = window.setTimeout(() => {
        autoBlockSyncMaxWaitTimerRef.current = null;
        clearAutoBlockSyncTimer();
        void flushAutoBlockSync();
      }, AUTO_BLOCK_SYNC_MAX_WAIT_MS);
    }
  }, [
    clearAutoBlockSyncMaxWaitTimer,
    clearAutoBlockSyncTimer,
    flushAutoBlockSync,
    isEditing,
  ]);

  useEffect(() => {
    scheduleAutoBlockSyncRef.current = () => {
      scheduleAutoBlockSync();
    };
  }, [scheduleAutoBlockSync]);

  const flushEditorAutoSync = useCallback(async () => {
    await flushTitleAutoSave();
    await flushAutoBlockSync();
    if (persistInFlightRef.current) {
      await persistInFlightRef.current;
    }
  }, [flushAutoBlockSync, flushTitleAutoSave]);

  useEffect(() => {
    registerEditorSyncBridge({
      flushAutoSync: flushEditorAutoSync,
    });
    return () => {
      unregisterEditorSyncBridge();
    };
  }, [flushEditorAutoSync]);

  const reloadFromServer = useCallback(
    async (withFeedback = true) => {
      const state = latestDocStateRef.current;
      if (!state.docId) return;

      try {
        const docMeta = await apiV1.documents.getDocument(state.docId);
        const targetVersion = typeof docMeta?.head === "number" ? docMeta.head : undefined;
        const res = await apiV1.documents.getDocumentContent(state.docId, {
          limit: 10000,
          ...(typeof targetVersion === "number" ? { version: targetVersion } : {}),
        });
        const html = contentTreeToHtml(res);
        const { rootBlockId, blocks } = extractTopLevelBlocksFromContent(res);
        setRemoteSnapshot(state.docId, rootBlockId, blocks);

        setMarkdown(html);
        if (editor) {
          isUpdatingFromStore.current = true;
          editor.commands.setContent(html || "<p></p>", { emitUpdate: false });
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              isUpdatingFromStore.current = false;
            });
          });
        }
        blockDirtyRef.current = false;
        setSaveStage("synced");
        if (withFeedback) {
          message.success("已加载最新已提交版本内容");
        }
      } catch (error) {
        setSaveStage("error");
        if (withFeedback) {
          const msg = error instanceof Error ? error.message : "加载文档内容失败";
          message.error(msg);
        }
      }
    },
    [editor, setMarkdown, setRemoteSnapshot]
  );

  // 初始化文档或切换文档
  useEffect(() => {
    if (!currentDocument) return;
    
    const engine = currentDocument.engine;
    const newDocId = currentDocument.docId;

    // 如果已经在初始化这个文档，或者已经初始化完成，跳过
    if (initializingDocId.current === newDocId || (initialized && docId === newDocId)) {
      return;
    }
    
    // 标记正在初始化
    initializingDocId.current = newDocId;
    
    // 切换文档时，如果 docId 不同，先清空编辑器内容
    if (editor && newDocId !== docId) {
      isUpdatingFromStore.current = true;
      editor.commands.setContent("<p></p>", { emitUpdate: false });
      // 重置标志
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isUpdatingFromStore.current = false;
        });
      });
    }
    
    // 切换文档时重新初始化
    switchDocument(newDocId, engine).finally(() => {
      // 初始化完成后清除标记
      if (initializingDocId.current === newDocId) {
        initializingDocId.current = null;
      }
    });
  }, [currentDocument, docId, initialized, editor, switchDocument]);

  // 当 markdown 或 docId 变化时，更新编辑器内容
  useEffect(() => {
    if (!editor) return;

    // 如果文档未初始化，等待初始化完成
    if (!initialized) {
      // 清空编辑器内容，等待新文档加载
      const currentHtml = editor.getHTML();
      if (currentHtml !== "<p></p>") {
        isUpdatingFromStore.current = true;
        editor.commands.setContent("<p></p>", { emitUpdate: false });
        // 重置标志
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            isUpdatingFromStore.current = false;
          });
        });
      }
      return;
    }
    
    // 如果 docId 不匹配，不更新（可能是旧的状态）
    if (docId !== currentDocument?.docId) {
      return;
    }
    
    const current = editor.getHTML();
    const normalizedCurrent = current === "<p></p>" ? "" : current;
    const normalizedMarkdown = markdown || "";

    // 如果内容相同，不更新（避免循环更新）
    if (normalizedCurrent === normalizedMarkdown) {
      return;
    }

    // 标记正在从 store 更新，避免触发 onUpdate
    isUpdatingFromStore.current = true;
    // 更新编辑器内容，但不触发 onUpdate 事件
    editor.commands.setContent(markdown || "<p></p>", { emitUpdate: false });
    
    // 立即在下一个事件循环中重置标志，确保用户输入不会被阻止
    // 使用 requestAnimationFrame 确保在浏览器渲染后重置
    requestAnimationFrame(() => {
      // 再延迟一帧，确保 onUpdate 事件（如果有）已经处理完
      requestAnimationFrame(() => {
        isUpdatingFromStore.current = false;
      });
    });
  }, [markdown, editor, initialized, docId, currentDocument?.docId]);

  // 编辑态切换时自动拉取后端内容：仅在退出编辑时刷新展示态，避免进入编辑时空内容闪烁
  useEffect(() => {
    const wasEditing = prevEditingRef.current;
    if (wasEditing && !isEditing) {
      void reloadFromServer(true);
    }
    prevEditingRef.current = isEditing;
  }, [isEditing, reloadFromServer]);

  // 将 Tiptap 实例暴露给全局 store，供 Toolbar 使用
  useEffect(() => {
    if (!editor) return;
    setEditor(editor);
    return () => {
      setEditor(null);
    };
  }, [editor, setEditor]);

  // 初始化时或文档切换时，同步标题到本地状态
  useEffect(() => {
    // 只在文档切换时（docId 变化）同步标题
    if (currentDocument?.docId && !isEditingTitle.current) {
      // 如果文档切换了，才同步
      if (lastSyncedDocId.current !== currentDocument.docId) {
        const nextTitle = currentDocument.title || "";
        clearTitleAutoSaveTimer();
        setTitle(nextTitle);
        latestTitleValueRef.current = nextTitle;
        lastSavedTitleRef.current = nextTitle.trim();
        lastSyncedDocId.current = currentDocument.docId;
      }
    }
  }, [clearTitleAutoSaveTimer, currentDocument?.docId, currentDocument?.title]);

  useEffect(() => {
    latestTitleValueRef.current = title;
  }, [title]);

  useEffect(() => {
    return () => {
      clearTitleAutoSaveTimer();
      clearAutoBlockSyncTimer();
      clearAutoBlockSyncMaxWaitTimer();
    };
  }, [clearAutoBlockSyncMaxWaitTimer, clearAutoBlockSyncTimer, clearTitleAutoSaveTimer]);

  useEffect(() => {
    if (!isEditing) {
      clearAutoBlockSyncTimer();
      clearAutoBlockSyncMaxWaitTimer();
    }
  }, [clearAutoBlockSyncMaxWaitTimer, clearAutoBlockSyncTimer, isEditing]);

  // 处理标题本地编辑（失焦 + 防抖自动保存）
  const handleTitleChange = (newTitle: string) => {
    isEditingTitle.current = true;
    setTitle(newTitle);
    setSaveStage("dirty");
    void scheduleTitleAutoSave();
  };

  // 根据编辑状态更新编辑器
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);
    }
  }, [editor, isEditing]);

  if (!editor || !shikiReady) {
    return (
      <div className="tiptap-shell">
        <div className="tiptap-card">正在初始化编辑器与代码高亮…</div>
      </div>
    );
  }

  const saveStatusTextMap: Record<SaveStage, string> = {
    idle: "就绪",
    dirty: "有未同步修改",
    saving: "保存中…",
    committing: "提交中…",
    synced: "已同步",
    error: "保存失败",
  };

  return (
    <div className="tiptap-shell">
      <div className="tiptap-card" data-code-theme={themeMode}>
        <header className="tiptap-header">
          <div className="tiptap-header-main">
            <div className="tiptap-title-wrapper">
              {isEditing ? (
                <>
                  <Input
                    value={title}
                    onChange={(e) => {
                      // 直接更新，允许空字符串
                      const newValue = e.target.value;
                      handleTitleChange(newValue);
                    }}
                    onFocus={() => {
                      isEditingTitle.current = true;
                    }}
                    onBlur={async () => {
                      await flushTitleAutoSave();
                      isEditingTitle.current = false;
                    }}
                    className="tiptap-title-input"
                    placeholder=""
                    bordered={false}
                  />
                  {!title && (
                    <span className="tiptap-title-placeholder">未命名文档</span>
                  )}
                </>
              ) : (
                <div className="tiptap-title-display">
                  {title || currentDocument?.title || "未命名文档"}
                </div>
              )}
            </div>
            <p className="tiptap-subtitle">
              {/* 支持标题、列表、代码块、引用等常用结构，所见即所得书写体验。 */}
            </p>
          </div>
          <div className="tiptap-header-meta">
            <span className="tiptap-meta-pill">文档版本 {docVer}</span>
            <span className="tiptap-meta-dot">·</span>
            <span className="tiptap-meta-text">
              {(saveStage === "saving" || saveStage === "committing") && <Spin size="small" style={{ marginRight: 6 }} />}
              {saveStatusTextMap[saveStage]}
            </span>
          </div>
        </header>

        <div className="tiptap-editor-wrapper">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

