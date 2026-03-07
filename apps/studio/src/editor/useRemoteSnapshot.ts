import { useCallback, useRef } from "react";
import { apiV1 } from "../api_v1";
import {
  extractTopLevelBlocksFromContent,
  type RemoteTopLevelBlock,
} from "./contentAdapter";
import { getRemoteSnapshotCache, setRemoteSnapshotCache } from "./remoteSnapshotCache";
import { normalizeSortKey } from "./tiptapSync";

const sortRemoteBlocks = (blocks: RemoteTopLevelBlock[]): RemoteTopLevelBlock[] => {
  return [...blocks].sort((a, b) => normalizeSortKey(a.sortKey) - normalizeSortKey(b.sortKey));
};

export function useRemoteSnapshot() {
  const remoteSnapshotByDocRef = useRef(new Map<string, RemoteTopLevelBlock[]>());
  const rootBlockIdByDocRef = useRef(new Map<string, string>());
  const remoteSnapshotLoadingRef = useRef(new Map<string, Promise<void>>());

  const setRemoteSnapshot = useCallback(
    (targetDocId: string, rootBlockId: string | null, blocks: RemoteTopLevelBlock[]) => {
      const sortedBlocks = sortRemoteBlocks(blocks);
      remoteSnapshotByDocRef.current.set(targetDocId, sortedBlocks);

      if (rootBlockId) {
        rootBlockIdByDocRef.current.set(targetDocId, rootBlockId);
      } else {
        rootBlockIdByDocRef.current.delete(targetDocId);
      }

      setRemoteSnapshotCache(targetDocId, { rootBlockId, blocks: sortedBlocks });
    },
    [],
  );

  const loadRemoteSnapshot = useCallback(
    async (targetDocId: string, force = false) => {
      if (!force && remoteSnapshotByDocRef.current.has(targetDocId)) {
        return;
      }

      if (!force) {
        const cached = getRemoteSnapshotCache(targetDocId);
        if (cached) {
          setRemoteSnapshot(targetDocId, cached.rootBlockId, cached.blocks);
          return;
        }
      }

      const loading = remoteSnapshotLoadingRef.current.get(targetDocId);
      if (loading) {
        await loading;
        return;
      }

      const task = (async () => {
        const contentRes = await apiV1.documents.getDocumentContent(targetDocId, { limit: 10000 });
        const { rootBlockId, blocks } = extractTopLevelBlocksFromContent(contentRes);
        setRemoteSnapshot(targetDocId, rootBlockId, blocks);
      })();

      remoteSnapshotLoadingRef.current.set(targetDocId, task);
      try {
        await task;
      } finally {
        remoteSnapshotLoadingRef.current.delete(targetDocId);
      }
    },
    [setRemoteSnapshot],
  );

  return {
    loadRemoteSnapshot,
    remoteSnapshotByDocRef,
    rootBlockIdByDocRef,
    setRemoteSnapshot,
  };
}
