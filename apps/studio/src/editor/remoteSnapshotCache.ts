import type { RemoteTopLevelBlock } from "./contentAdapter";

type RemoteSnapshotCacheItem = {
  rootBlockId: string | null;
  blocks: RemoteTopLevelBlock[];
  updatedAt: number;
};

const snapshotCache = new Map<string, RemoteSnapshotCacheItem>();

export const getRemoteSnapshotCache = (docId: string): RemoteSnapshotCacheItem | null => {
  if (!docId) return null;
  return snapshotCache.get(docId) || null;
};

export const setRemoteSnapshotCache = (
  docId: string,
  payload: { rootBlockId: string | null; blocks: RemoteTopLevelBlock[] }
) => {
  if (!docId) return;
  snapshotCache.set(docId, {
    rootBlockId: payload.rootBlockId,
    blocks: payload.blocks,
    updatedAt: Date.now(),
  });
};

export const clearRemoteSnapshotCache = (docId?: string) => {
  if (docId) {
    snapshotCache.delete(docId);
    return;
  }
  snapshotCache.clear();
};
