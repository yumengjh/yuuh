import type { DocumentContent, DocumentContentTreeNode } from "../../api_v1";
import { normalizedBlockToMarkdown, normalizedBlocksToHtml } from "./markdown";
import { normalizeRemoteBlock } from "./normalize";
import type { FlatContentBlock, NormalizedDocBlock, RemoteTopLevelBlock } from "./types";

export const extractTopLevelBlocksFromContent = (
  content: DocumentContent,
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

const walkTreeToBlocks = (
  node: DocumentContentTreeNode | undefined,
  blocks: NormalizedDocBlock[],
) => {
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
  walkTreeToBlocks(content.tree || undefined, blocks);
  return blocks
    .map((block) => normalizedBlockToMarkdown(block))
    .join("\n\n")
    .trim();
};

export const contentTreeToHtml = (content: DocumentContent): string => {
  const blocks: NormalizedDocBlock[] = [];
  walkTreeToBlocks(content.tree || undefined, blocks);
  return normalizedBlocksToHtml(blocks);
};

export const contentTreeToFlatBlocks = (content: DocumentContent): FlatContentBlock[] => {
  const flatBlocks: FlatContentBlock[] = [];
  walkTreeToFlatBlocks(content.tree || undefined, flatBlocks, 0);
  return flatBlocks;
};

export const getPrimaryBlockIdFromContent = (content: DocumentContent): string | null => {
  return findFirstEditableBlockId(content.tree || undefined);
};
