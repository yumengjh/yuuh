import { apiV1 } from "../api_v1";
import type { NormalizedDocBlock } from "./contentAdapter";

const normalizedBlockToMarkdown = (block: NormalizedDocBlock): string => {
  if (block.type === "heading") {
    const level = Math.max(1, Math.min(6, Math.floor(block.level ?? 1)));
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
    if (typeof block.checked === "boolean") {
      return `- [${block.checked ? "x" : " "}] ${block.text}`;
    }
    return `- ${block.text}`;
  }

  if (block.type === "code") {
    const language = (block.language || "text").trim().toLowerCase() || "text";
    return `\`\`\`${language}\n${block.text}\n\`\`\``;
  }

  return block.text;
};

export const buildRemoteBlockPayload = (
  block: NormalizedDocBlock
): { type: string; payload: Record<string, unknown>; plainText: string } => {
  const markdownText = normalizedBlockToMarkdown(block);

  return {
    // 当前后端实际行为会统一返回 paragraph，这里统一按 markdown 原文存储最稳妥
    type: "paragraph",
    payload: { text: markdownText },
    plainText: markdownText,
  };
};

export const createRemoteBlock = async (
  docId: string,
  block: NormalizedDocBlock,
  options?: {
    parentId?: string;
    sortKey?: string;
    indent?: number;
  }
) => {
  const normalized = buildRemoteBlockPayload(block);
  const res = await apiV1.blocks.createBlock({
    docId,
    type: normalized.type,
    payload: normalized.payload,
    parentId: options?.parentId,
    sortKey: options?.sortKey,
    indent: options?.indent,
    createVersion: false,
  });
  return res.blockId;
};

export const updateRemoteBlockContent = async (
  blockId: string,
  block: NormalizedDocBlock
) => {
  const normalized = buildRemoteBlockPayload(block);
  return apiV1.blocks.updateBlockContent(blockId, {
    payload: normalized.payload,
    plainText: normalized.plainText,
    createVersion: false,
  });
};

export const moveRemoteBlock = async (
  blockId: string,
  payload: { parentId: string; sortKey: string; indent?: number }
) => {
  return apiV1.blocks.moveBlock(blockId, {
    ...payload,
    createVersion: false,
  });
};

export const deleteRemoteBlock = async (blockId: string) => {
  return apiV1.blocks.deleteBlock(blockId);
};

export const batchRemoteBlocks = async (payload: {
  docId: string;
  operations: Array<{
    type: "create" | "update" | "delete" | "move";
    blockId?: string;
    payload?: unknown;
    parentId?: string;
    sortKey?: string;
    indent?: number;
  }>;
}) => {
  return apiV1.blocks.batchBlocks({
    ...payload,
    createVersion: false,
  });
};
