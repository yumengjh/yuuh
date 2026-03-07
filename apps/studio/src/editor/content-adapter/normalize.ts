import type { DocumentContentTreeNode } from "../../api_v1";
import type { NormalizedDocBlock } from "./types";
import { htmlToMarkdownSimple, parseMarkdownHeuristic } from "./markdown";

const looksLikeHtml = (value: string): boolean => {
  return /<\/?[a-z][\s\S]*>/i.test(value);
};

export const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

export const toLineHtml = (value: string): string => {
  return escapeHtml(value).replace(/\n/g, "<br />");
};

export const clampHeadingLevel = (level: number): number => {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.min(6, Math.floor(level)));
};

export const normalizeCodeLanguage = (language?: string): string => {
  const raw = (language || "").trim().toLowerCase();
  if (!raw) return "text";
  if (raw === "plaintext" || raw === "plain") return "text";
  if (raw === "sh") return "bash";
  if (raw === "yml") return "yaml";
  return raw;
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

const payloadToListMeta = (
  payload: unknown,
  fallbackText: string,
): { ordered: boolean; level: number; checked?: boolean } => {
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

export const normalizeRemoteBlock = (node: DocumentContentTreeNode): NormalizedDocBlock => {
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
