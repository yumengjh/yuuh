import { clampHeadingLevel, normalizeCodeLanguage } from "./normalize";
import type { NormalizedDocBlock } from "./types";

export const areNormalizedBlocksEqual = (
  localBlock: NormalizedDocBlock,
  remoteBlock: NormalizedDocBlock,
): boolean => {
  if (localBlock.type !== remoteBlock.type) return false;
  if ((localBlock.text || "").trim() !== (remoteBlock.text || "").trim()) return false;

  if (localBlock.type === "heading") {
    return clampHeadingLevel(localBlock.level ?? 1) === clampHeadingLevel(remoteBlock.level ?? 1);
  }

  if (localBlock.type === "list_item") {
    return (
      Boolean(localBlock.ordered) === Boolean(remoteBlock.ordered) &&
      Math.max(0, Math.floor(localBlock.level ?? 0)) ===
        Math.max(0, Math.floor(remoteBlock.level ?? 0)) &&
      (localBlock.checked ?? null) === (remoteBlock.checked ?? null)
    );
  }

  if (localBlock.type === "code") {
    return (
      normalizeCodeLanguage(localBlock.language) === normalizeCodeLanguage(remoteBlock.language)
    );
  }

  return true;
};
