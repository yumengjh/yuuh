import MarkdownIt from "markdown-it";
import type {
  DocumentContent,
  DocumentContentPagination,
  DocumentContentTreeNode,
  FlatContentBlock,
  NormalizedDocBlock,
  RenderBlock,
} from "~/types/api";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

const clampHeadingLevel = (level: number): number => {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.min(6, Math.floor(level)));
};

const normalizeCodeLanguage = (language?: string): string => {
  const raw = (language || "").trim().toLowerCase();
  if (!raw) return "plaintext";
  if (raw === "plain" || raw === "text") return "plaintext";
  if (raw === "yml") return "yaml";
  if (raw === "sh") return "bash";
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
    const language = normalizeCodeLanguage(fenced[1] || "plaintext");
    const code = fenced[2] || "";
    return {
      type: "code",
      text: code,
      language,
      payload: { code, language },
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
      payload: { text: content, level },
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
      payload: { text: content },
    };
  }

  return {
    type: "paragraph",
    text,
    payload: { text },
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
  if (typeof data.body?.richText?.source === "string") return data.body.richText.source;
  return "";
};

const payloadToCodeLanguage = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") return "plaintext";
  const data = payload as { language?: unknown; lang?: unknown };
  if (typeof data.language === "string") return normalizeCodeLanguage(data.language);
  if (typeof data.lang === "string") return normalizeCodeLanguage(data.lang);
  return "plaintext";
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

const payloadToListMeta = (payload: unknown, fallbackText: string) => {
  let ordered = false;
  let level = 0;
  let checked: boolean | undefined;

  if (payload && typeof payload === "object") {
    const data = payload as {
      ordered?: unknown;
      level?: unknown;
      indent?: unknown;
      checked?: unknown;
    };
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
      payload: { code: text, language },
    };
  }

  if (typeRaw === "heading") {
    const level = payloadToHeadingLevel(node.payload, text);
    const headingText = text.replace(/^#{1,6}\s+/, "").trim();
    return {
      type: "heading",
      text: headingText,
      level,
      payload: { text: headingText, level },
    };
  }

  if (typeRaw === "quote" || typeRaw === "blockquote") {
    const quoteText = text.replace(/^>\s+/, "").trim();
    return {
      type: "quote",
      text: quoteText,
      payload: { text: quoteText },
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

  if (typeRaw === "paragraph") return parseMarkdownHeuristic(text);

  return {
    type: "paragraph",
    text,
    payload: { text },
  };
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
    if (block.ordered) return `1. ${block.text}`;
    const task = typeof block.checked === "boolean" ? `[${block.checked ? "x" : " "}] ` : "";
    return `- ${task}${block.text}`;
  }

  if (block.type === "code") {
    const language = normalizeCodeLanguage(block.language);
    return `\`\`\`${language}\n${block.text}\n\`\`\``;
  }

  return block.text;
};

const walkTreeToFlatBlocks = (
  node: DocumentContentTreeNode | undefined,
  flatBlocks: FlatContentBlock[],
  depth: number,
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

export const contentTreeToFlatBlocks = (content: DocumentContent): FlatContentBlock[] => {
  const flatBlocks: FlatContentBlock[] = [];
  walkTreeToFlatBlocks(content.tree || undefined, flatBlocks, 0);
  return flatBlocks;
};

export const markdownToHtml = (markdown: string): string => {
  if (!markdown.trim()) return "<p></p>";
  return String(md.render(markdown));
};

export const toRenderBlocks = (blocks: FlatContentBlock[]): RenderBlock[] => {
  return blocks.map((block) => {
    return {
      ...block,
      html: markdownToHtml(block.markdown || ""),
      renderKey: `${block.blockId}:${block.markdown}:${block.depth}`,
    };
  });
};

export const mergeRenderBlocks = (
  existing: RenderBlock[],
  incoming: RenderBlock[],
): RenderBlock[] => {
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

export const resolvePagination = (
  pagination: DocumentContentPagination | undefined,
  topLevel: Pick<DocumentContent, "totalBlocks" | "hasMore" | "nextStartBlockId">,
  currentCount: number,
  previousTotalBlocks = 0,
) => {
  const responseTotal = toSafeNumber(pagination?.totalBlocks) ?? toSafeNumber(topLevel.totalBlocks);
  const totalBlocks = Math.max(responseTotal ?? 0, currentCount, previousTotalBlocks);
  const responseHasMore = pagination?.hasMore ?? topLevel.hasMore ?? false;
  const inferredHasMore = totalBlocks > 0 ? currentCount < totalBlocks : false;
  const responseNext = pagination?.nextStartBlockId ?? topLevel.nextStartBlockId ?? null;
  return {
    totalBlocks,
    responseHasMore,
    inferredHasMore,
    responseNextStartBlockId: responseNext,
  };
};
