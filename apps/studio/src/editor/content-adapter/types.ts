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

export type EditorJsonNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{
    type?: string;
    attrs?: Record<string, unknown>;
  }>;
  content?: EditorJsonNode[];
};
