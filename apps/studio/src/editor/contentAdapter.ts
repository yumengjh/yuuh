export type {
  EditorJsonNode,
  FlatContentBlock,
  NormalizedBlockType,
  NormalizedDocBlock,
  RemoteTopLevelBlock,
} from "./content-adapter/types";

export { areNormalizedBlocksEqual } from "./content-adapter/compare";

export {
  editorJsonToNormalizedBlocks,
} from "./content-adapter/editorJson";

export {
  htmlToMarkdownSimple,
  markdownToHtml,
  normalizedBlockToMarkdown,
} from "./content-adapter/markdown";

export {
  clampHeadingLevel,
  normalizeCodeLanguage,
} from "./content-adapter/normalize";

export {
  contentTreeToFlatBlocks,
  contentTreeToHtml,
  contentTreeToMarkdown,
  extractTopLevelBlocksFromContent,
  getPrimaryBlockIdFromContent,
} from "./content-adapter/tree";
