import { marked } from "marked";
import type { DocumentContent, DocumentContentTreeNode } from "../api_v1";

export type NormalizedBlockType = "paragraph" | "heading" | "quote" | "list_item" | "code";

export type NormalizedDocBlock = {
  type: NormalizedBlockType;
  text: string;
  level?: number;
  ordered?: boolean;
  checked?: boolean;
  language?: string;
  payload: Record<string, unknown>;
};

export type RemoteTopLevelBlock = {
  blockId: string;
  type: string;
  normalized: NormalizedDocBlock;
  parentId?: string;
  sortKey?: string;
  indent?: number;
  rawPayload?: unknown;
};

export type FlatContentBlock = {
  blockId: string;
  type: string;
  depth: number;
  sortKey?: string;
  indent?: number;
  markdown: string;
  normalized: NormalizedDocBlock;
};

type EditorJsonNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{
    type?: string;
    attrs?: Record<string, unknown>;
  }>;
  content?: EditorJsonNode[];
};

const looksLikeHtml = (value: string): boolean => {
  return /<\/?[a-z][\s\S]*>/i.test(value);
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const toLineHtml = (value: string): string => {
  return escapeHtml(value).replace(/\n/g, "<br />");
};

const clampHeadingLevel = (level: number): number => {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.min(6, Math.floor(level)));
};

const normalizeCodeLanguage = (language?: string): string => {
  const raw = (language || "").trim().toLowerCase();
  if (!raw) return "text";
  if (raw === "plaintext" || raw === "plain") return "text";
  if (raw === "sh") return "bash";
  if (raw === "yml") return "yaml";
  return raw;
};

const parseMarkdownHeuristic = (input: string): NormalizedDocBlock => {
  const text = input.trim();
  if (!text) {
    return {
      type: "paragraph",
      text: "",
      payload: { text: "" },
    };
  }

  const fenced = text.match(/^```([a-zA-Z0-9_-]+)?\n([\s\S]*?)\n```$/);
  if (fenced) {
    const language = normalizeCodeLanguage(fenced[1] || "text");
    const code = fenced[2] || "";
    return {
      type: "code",
      text: code,
      language,
      payload: {
        code,
        language,
      },
    };
  }

  const heading = text.match(/^(#{1,6})\s+(.+)$/);
  if (heading) {
    const level = clampHeadingLevel(heading[1].length);
    const content = heading[2].trim();
    return {
      type: "heading",
      text: content,
      level,
      payload: {
        text: content,
        level,
      },
    };
  }

  const ordered = text.match(/^(\d+)\.\s+(.+)$/);
  if (ordered) {
    const content = ordered[2].trim();
    return {
      type: "list_item",
      text: content,
      ordered: true,
      level: 0,
      payload: {
        text: content,
        ordered: true,
        level: 0,
      },
    };
  }

  const task = text.match(/^[-*+]\s+\[([xX\s])\]\s+(.+)$/);
  if (task) {
    const checked = task[1].toLowerCase() === "x";
    const content = task[2].trim();
    return {
      type: "list_item",
      text: content,
      ordered: false,
      level: 0,
      checked,
      payload: {
        text: content,
        ordered: false,
        level: 0,
        checked,
      },
    };
  }

  const bullet = text.match(/^[-*+]\s+(.+)$/);
  if (bullet) {
    const content = bullet[1].trim();
    return {
      type: "list_item",
      text: content,
      ordered: false,
      level: 0,
      payload: {
        text: content,
        ordered: false,
        level: 0,
      },
    };
  }

  const quote = text.match(/^>\s+(.+)$/);
  if (quote) {
    const content = quote[1].trim();
    return {
      type: "quote",
      text: content,
      payload: {
        text: content,
      },
    };
  }

  return {
    type: "paragraph",
    text,
    payload: {
      text,
    },
  };
};

const payloadToText = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") return "";
  const data = payload as {
    text?: unknown;
    code?: unknown;
    body?: { text?: unknown; richText?: { source?: unknown } };
  };

  if (typeof data.text === "string") return data.text;
  if (typeof data.code === "string") return data.code;
  if (typeof data.body?.text === "string") return data.body.text;
  if (typeof data.body?.richText?.source === "string") {
    const source = data.body.richText.source;
    return looksLikeHtml(source) ? htmlToMarkdownSimple(source) : source;
  }
  return "";
};

const payloadToCodeLanguage = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") return "text";
  const data = payload as { language?: unknown; lang?: unknown };
  if (typeof data.language === "string") return normalizeCodeLanguage(data.language);
  if (typeof data.lang === "string") return normalizeCodeLanguage(data.lang);
  return "text";
};

const payloadToHeadingLevel = (payload: unknown, fallbackText: string): number => {
  if (payload && typeof payload === "object") {
    const data = payload as { level?: unknown };
    if (typeof data.level === "number") return clampHeadingLevel(data.level);
    if (typeof data.level === "string" && data.level.trim()) {
      return clampHeadingLevel(Number(data.level));
    }
  }

  const match = fallbackText.match(/^(#{1,6})\s+/);
  if (match) return clampHeadingLevel(match[1].length);
  return 1;
};

const payloadToListMeta = (payload: unknown, fallbackText: string): { ordered: boolean; level: number; checked?: boolean } => {
  let ordered = false;
  let level = 0;
  let checked: boolean | undefined;

  if (payload && typeof payload === "object") {
    const data = payload as { ordered?: unknown; level?: unknown; indent?: unknown; checked?: unknown };
    if (typeof data.ordered === "boolean") ordered = data.ordered;
    if (typeof data.level === "number") level = Math.max(0, Math.floor(data.level));
    if (typeof data.indent === "number") level = Math.max(0, Math.floor(data.indent));
    if (typeof data.checked === "boolean") checked = data.checked;
  }

  if (!ordered && /^\d+\.\s+/.test(fallbackText.trim())) {
    ordered = true;
  }

  return { ordered, level, checked };
};

const normalizeRemoteBlock = (node: DocumentContentTreeNode): NormalizedDocBlock => {
  const typeRaw = (node.type || "").toLowerCase();
  const text = payloadToText(node.payload).trim();

  if (typeRaw === "code" || typeRaw === "code_block" || typeRaw === "codeblock") {
    const language = payloadToCodeLanguage(node.payload);
    return {
      type: "code",
      text,
      language,
      payload: {
        code: text,
        language,
      },
    };
  }

  if (typeRaw === "heading") {
    const level = payloadToHeadingLevel(node.payload, text);
    const headingText = text.replace(/^#{1,6}\s+/, "").trim();
    return {
      type: "heading",
      text: headingText,
      level,
      payload: {
        text: headingText,
        level,
      },
    };
  }

  if (typeRaw === "quote" || typeRaw === "blockquote") {
    const quoteText = text.replace(/^>\s+/, "").trim();
    return {
      type: "quote",
      text: quoteText,
      payload: {
        text: quoteText,
      },
    };
  }

  if (typeRaw === "list_item" || typeRaw === "list" || typeRaw === "task_item") {
    const { ordered, level, checked } = payloadToListMeta(node.payload, text);
    const content = text.replace(/^([-*+]|\d+\.)\s+/, "").trim();
    return {
      type: "list_item",
      text: content,
      ordered,
      level,
      checked,
      payload: {
        text: content,
        ordered,
        level,
        checked,
      },
    };
  }

  if (typeRaw === "paragraph") {
    return parseMarkdownHeuristic(text);
  }

  return {
    type: "paragraph",
    text,
    payload: {
      text,
    },
  };
};

const extractInlineText = (node: EditorJsonNode | undefined): string => {
  if (!node) return "";
  if (node.type === "text") return node.text || "";
  if (node.type === "hardBreak") return "\n";
  const children = Array.isArray(node.content) ? node.content : [];
  return children.map((child) => extractInlineText(child)).join("");
};

const getBacktickFence = (text: string): string => {
  const matches = text.match(/`+/g);
  const maxLength = matches?.reduce((max, item) => Math.max(max, item.length), 0) || 0;
  return "`".repeat(maxLength + 1);
};

const applyInlineMarks = (
  rawText: string,
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>
): string => {
  let text = rawText.replace(/\u00a0/g, " ");
  if (!marks?.length) return text;

  const normalizedMarks = marks.filter((mark) => typeof mark?.type === "string" && mark.type?.trim());
  if (normalizedMarks.length === 0) return text;

  const codeMark = normalizedMarks.find((mark) => mark.type === "code");
  if (codeMark) {
    const fence = getBacktickFence(text);
    return `${fence}${text}${fence}`;
  }

  normalizedMarks.forEach((mark) => {
    const type = mark.type;
    if (type === "bold" || type === "strong") {
      text = `**${text}**`;
      return;
    }
    if (type === "italic" || type === "em") {
      text = `*${text}*`;
      return;
    }
    if (type === "strike") {
      text = `~~${text}~~`;
      return;
    }
    if (type === "link") {
      const href = typeof mark.attrs?.href === "string" ? mark.attrs.href.trim() : "";
      if (href) {
        text = `[${text}](${href})`;
      }
      return;
    }
    if (type === "underline") {
      text = `<u>${text}</u>`;
    }
  });

  return text;
};

const extractInlineMarkdown = (node: EditorJsonNode | undefined): string => {
  if (!node) return "";
  if (node.type === "text") {
    return applyInlineMarks(node.text || "", node.marks);
  }
  if (node.type === "hardBreak") return "\n";
  const children = Array.isArray(node.content) ? node.content : [];
  return children.map((child) => extractInlineMarkdown(child)).join("");
};

const normalizeParagraphText = (node: EditorJsonNode): string => {
  return extractInlineMarkdown(node).trim();
};

const parseListNode = (
  node: EditorJsonNode,
  ordered: boolean,
  level: number
): NormalizedDocBlock[] => {
  const result: NormalizedDocBlock[] = [];
  const listItems = Array.isArray(node.content) ? node.content : [];

  listItems.forEach((item) => {
    if (!item || (item.type !== "listItem" && item.type !== "taskItem")) return;

    const children = Array.isArray(item.content) ? item.content : [];
    const paragraphTexts: string[] = [];

    children.forEach((child) => {
      if (child.type === "paragraph") {
        const text = normalizeParagraphText(child);
        if (text) paragraphTexts.push(text);
      }
      if (child.type === "heading") {
        const text = normalizeParagraphText(child);
        if (text) paragraphTexts.push(text);
      }
    });

    const text = paragraphTexts.join("\n").trim();
    if (text) {
      const checked =
        item.type === "taskItem" && typeof item.attrs?.checked === "boolean"
          ? Boolean(item.attrs.checked)
          : undefined;
      result.push({
        type: "list_item",
        text,
        ordered,
        level,
        checked,
        payload: {
          text,
          ordered,
          level,
          checked,
        },
      });
    }

    children.forEach((child) => {
      if (child.type === "bulletList") {
        result.push(...parseListNode(child, false, level + 1));
      } else if (child.type === "orderedList") {
        result.push(...parseListNode(child, true, level + 1));
      } else if (child.type === "taskList") {
        result.push(...parseListNode(child, false, level + 1));
      }
    });
  });

  return result;
};

const parseTopLevelNode = (node: EditorJsonNode): NormalizedDocBlock[] => {
  if (!node || typeof node !== "object") return [];

  if (node.type === "paragraph") {
    const text = normalizeParagraphText(node);
    if (!text) return [];
    return [
      {
        type: "paragraph",
        text,
        payload: {
          text,
        },
      },
    ];
  }

  if (node.type === "heading") {
    const text = normalizeParagraphText(node);
    if (!text) return [];
    const level = clampHeadingLevel(Number(node.attrs?.level ?? 1));
    return [
      {
        type: "heading",
        text,
        level,
        payload: {
          text,
          level,
        },
      },
    ];
  }

  if (node.type === "blockquote") {
    const children = Array.isArray(node.content) ? node.content : [];
    const parts = children
      .map((child) => normalizeParagraphText(child))
      .filter((item) => item.trim().length > 0);
    const text = parts.join("\n").trim();
    if (!text) return [];
    return [
      {
        type: "quote",
        text,
        payload: {
          text,
        },
      },
    ];
  }

  if (node.type === "codeBlock") {
    const text = extractInlineText(node);
    const language = normalizeCodeLanguage(
      typeof node.attrs?.language === "string" ? node.attrs.language : "text"
    );
    return [
      {
        type: "code",
        text,
        language,
        payload: {
          code: text,
          language,
        },
      },
    ];
  }

  if (node.type === "bulletList") {
    return parseListNode(node, false, 0);
  }

  if (node.type === "orderedList") {
    return parseListNode(node, true, 0);
  }

  if (node.type === "taskList") {
    return parseListNode(node, false, 0);
  }

  const fallback = normalizeParagraphText(node);
  if (!fallback) return [];
  return [
    {
      type: "paragraph",
      text: fallback,
      payload: {
        text: fallback,
      },
    },
  ];
};

export const normalizedBlockToMarkdown = (block: NormalizedDocBlock): string => {
  if (block.type === "heading") {
    const level = clampHeadingLevel(block.level ?? 1);
    return `${"#".repeat(level)} ${block.text}`.trim();
  }

  if (block.type === "quote") {
    return block.text
      .split(/\r?\n/)
      .map((line) => `> ${line}`)
      .join("\n");
  }

  if (block.type === "list_item") {
    if (block.ordered) {
      return `1. ${block.text}`;
    }
    const task = typeof block.checked === "boolean" ? `[${block.checked ? "x" : " "}] ` : "";
    return `- ${task}${block.text}`;
  }

  if (block.type === "code") {
    const language = normalizeCodeLanguage(block.language);
    return `\`\`\`${language}\n${block.text}\n\`\`\``;
  }

  return block.text;
};

const normalizedBlocksToHtml = (blocks: NormalizedDocBlock[]): string => {
  if (!blocks.length) return "<p></p>";
  const html: string[] = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];

    if (block.type === "list_item") {
      const ordered = Boolean(block.ordered);
      const level = Math.max(0, Math.floor(block.level ?? 0));
      const tag = ordered ? "ol" : "ul";
      const indentStyle = level > 0 ? ` style="margin-left:${level * 20}px"` : "";
      const items: string[] = [];

      while (index < blocks.length) {
        const current = blocks[index];
        if (current.type !== "list_item") break;
        if (Boolean(current.ordered) !== ordered) break;
        if (Math.max(0, Math.floor(current.level ?? 0)) !== level) break;
        items.push(`<li>${toLineHtml(current.text)}</li>`);
        index += 1;
      }

      html.push(`<${tag}${indentStyle}>${items.join("")}</${tag}>`);
      continue;
    }

    if (block.type === "heading") {
      const level = clampHeadingLevel(block.level ?? 1);
      html.push(`<h${level}>${toLineHtml(block.text)}</h${level}>`);
      index += 1;
      continue;
    }

    if (block.type === "quote") {
      html.push(`<blockquote><p>${toLineHtml(block.text)}</p></blockquote>`);
      index += 1;
      continue;
    }

    if (block.type === "code") {
      const language = normalizeCodeLanguage(block.language);
      html.push(
        `<pre><code class="language-${escapeHtml(language)}">${escapeHtml(block.text)}</code></pre>`
      );
      index += 1;
      continue;
    }

    html.push(String(marked.parse(block.text, { gfm: true, breaks: true })));
    index += 1;
  }

  return html.join("");
};

export const areNormalizedBlocksEqual = (
  localBlock: NormalizedDocBlock,
  remoteBlock: NormalizedDocBlock
): boolean => {
  if (localBlock.type !== remoteBlock.type) return false;
  if ((localBlock.text || "").trim() !== (remoteBlock.text || "").trim()) return false;

  if (localBlock.type === "heading") {
    return clampHeadingLevel(localBlock.level ?? 1) === clampHeadingLevel(remoteBlock.level ?? 1);
  }

  if (localBlock.type === "list_item") {
    return (
      Boolean(localBlock.ordered) === Boolean(remoteBlock.ordered) &&
      Math.max(0, Math.floor(localBlock.level ?? 0)) === Math.max(0, Math.floor(remoteBlock.level ?? 0)) &&
      (localBlock.checked ?? null) === (remoteBlock.checked ?? null)
    );
  }

  if (localBlock.type === "code") {
    return normalizeCodeLanguage(localBlock.language) === normalizeCodeLanguage(remoteBlock.language);
  }

  return true;
};

export const htmlToMarkdownSimple = (html: string): string => {
  if (!html) return "";
  if (typeof window === "undefined") {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  const blocks: string[] = [];

  const children = Array.from(container.children);
  if (children.length === 0) {
    return (container.textContent || "").trim();
  }

  children.forEach((node) => {
    const tag = node.tagName.toLowerCase();
    const text = (node.textContent || "").trim();
    if (!text) return;
    if (tag === "h1") blocks.push(`# ${text}`);
    else if (tag === "h2") blocks.push(`## ${text}`);
    else if (tag === "h3") blocks.push(`### ${text}`);
    else if (tag === "li") blocks.push(`- ${text}`);
    else if (tag === "blockquote") blocks.push(`> ${text}`);
    else blocks.push(text);
  });

  return blocks.join("\n\n").trim();
};

export const markdownToHtml = (markdown: string): string => {
  if (!markdown.trim()) return "<p></p>";
  return String(marked.parse(markdown, { gfm: true, breaks: true }));
};

export const editorJsonToNormalizedBlocks = (editorJson: unknown): NormalizedDocBlock[] => {
  if (!editorJson || typeof editorJson !== "object") return [];
  const doc = editorJson as EditorJsonNode;
  const children = Array.isArray(doc.content) ? doc.content : [];
  const blocks = children.flatMap((node) => parseTopLevelNode(node));
  return blocks;
};

export const extractTopLevelBlocksFromContent = (
  content: DocumentContent
): {
  rootBlockId: string | null;
  blocks: RemoteTopLevelBlock[];
} => {
  const tree = content.tree;
  if (!tree) {
    return { rootBlockId: null, blocks: [] };
  }

  const rootBlockId = tree.blockId || null;
  const children = Array.isArray(tree.children) ? tree.children : [];
  const blocks = children
    .filter((node) => (node.type || "").toLowerCase() !== "root")
    .map((node) => ({
      blockId: node.blockId,
      type: node.type || "paragraph",
      normalized: normalizeRemoteBlock(node),
      parentId: node.parentId,
      sortKey: node.sortKey,
      indent: node.indent,
      rawPayload: node.payload,
    }));

  return {
    rootBlockId,
    blocks,
  };
};

const walkTreeToBlocks = (node: DocumentContentTreeNode | undefined, blocks: NormalizedDocBlock[]) => {
  if (!node) return;
  if ((node.type || "").toLowerCase() !== "root") {
    blocks.push(normalizeRemoteBlock(node));
  }
  const children = Array.isArray(node.children) ? node.children : [];
  children.forEach((child) => walkTreeToBlocks(child, blocks));
};

const walkTreeToFlatBlocks = (
  node: DocumentContentTreeNode | undefined,
  flatBlocks: FlatContentBlock[],
  depth: number
) => {
  if (!node) return;
  const typeRaw = (node.type || "").toLowerCase();
  if (typeRaw !== "root") {
    const normalized = normalizeRemoteBlock(node);
    flatBlocks.push({
      blockId: node.blockId,
      type: node.type || "paragraph",
      depth,
      sortKey: node.sortKey,
      indent: node.indent,
      markdown: normalizedBlockToMarkdown(normalized),
      normalized,
    });
  }
  const children = Array.isArray(node.children) ? node.children : [];
  children.forEach((child) => walkTreeToFlatBlocks(child, flatBlocks, depth + 1));
};

const findFirstEditableBlockId = (node: DocumentContentTreeNode | undefined): string | null => {
  if (!node) return null;
  if ((node.type || "").toLowerCase() !== "root" && node.blockId) {
    return node.blockId;
  }
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    const found = findFirstEditableBlockId(child);
    if (found) return found;
  }
  return null;
};

export const contentTreeToMarkdown = (content: DocumentContent): string => {
  const blocks: NormalizedDocBlock[] = [];
  const tree = content.tree || undefined;
  walkTreeToBlocks(tree, blocks);
  return blocks.map((block) => normalizedBlockToMarkdown(block)).join("\n\n").trim();
};

export const contentTreeToHtml = (content: DocumentContent): string => {
  const blocks: NormalizedDocBlock[] = [];
  const tree = content.tree || undefined;
  walkTreeToBlocks(tree, blocks);
  return normalizedBlocksToHtml(blocks);
};

export const contentTreeToFlatBlocks = (content: DocumentContent): FlatContentBlock[] => {
  const flatBlocks: FlatContentBlock[] = [];
  const tree = content.tree || undefined;
  walkTreeToFlatBlocks(tree, flatBlocks, 0);
  return flatBlocks;
};

export const getPrimaryBlockIdFromContent = (content: DocumentContent): string | null => {
  const tree = content.tree || undefined;
  return findFirstEditableBlockId(tree);
};
