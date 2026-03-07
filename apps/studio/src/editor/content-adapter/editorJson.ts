import { clampHeadingLevel, normalizeCodeLanguage } from "./normalize";
import {
  extractInlineText,
  normalizeParagraphText,
} from "./markdown";
import type { EditorJsonNode, NormalizedDocBlock } from "./types";

const parseListNode = (
  node: EditorJsonNode,
  ordered: boolean,
  level: number,
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
      typeof node.attrs?.language === "string" ? node.attrs.language : "text",
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

export const editorJsonToNormalizedBlocks = (editorJson: unknown): NormalizedDocBlock[] => {
  if (!editorJson || typeof editorJson !== "object") return [];
  const doc = editorJson as EditorJsonNode;
  const children = Array.isArray(doc.content) ? doc.content : [];
  return children.flatMap((node) => parseTopLevelNode(node));
};
