import { marked } from "marked";
import type { EditorJsonNode, NormalizedDocBlock } from "./types";
import { clampHeadingLevel, escapeHtml, normalizeCodeLanguage, toLineHtml } from "./normalize";

export const parseMarkdownHeuristic = (input: string): NormalizedDocBlock => {
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

export const extractInlineText = (node: EditorJsonNode | undefined): string => {
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
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>,
): string => {
  let text = rawText.replace(/\u00a0/g, " ");
  if (!marks?.length) return text;

  const normalizedMarks = marks.filter(
    (mark) => typeof mark?.type === "string" && mark.type?.trim(),
  );
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

export const extractInlineMarkdown = (node: EditorJsonNode | undefined): string => {
  if (!node) return "";
  if (node.type === "text") {
    return applyInlineMarks(node.text || "", node.marks);
  }
  if (node.type === "hardBreak") return "\n";
  const children = Array.isArray(node.content) ? node.content : [];
  return children.map((child) => extractInlineMarkdown(child)).join("");
};

export const normalizeParagraphText = (node: EditorJsonNode): string => {
  return extractInlineMarkdown(node).trim();
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

export const normalizedBlocksToHtml = (blocks: NormalizedDocBlock[]): string => {
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
        `<pre><code class="language-${escapeHtml(language)}">${escapeHtml(block.text)}</code></pre>`,
      );
      index += 1;
      continue;
    }

    html.push(String(marked.parse(block.text, { gfm: true, breaks: true })));
    index += 1;
  }

  return html.join("");
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
