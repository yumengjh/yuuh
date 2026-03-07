import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { Editor } from "@tiptap/react";
import { message } from "antd";
import { createRemoteBlock, deleteRemoteBlock, updateRemoteBlockContent } from "./blockGateway";
import {
  areNormalizedBlocksEqual,
  editorJsonToNormalizedBlocks,
  type NormalizedDocBlock,
  type RemoteTopLevelBlock,
} from "./contentAdapter";
import type { SaveStage } from "./saveStage";
import {
  AUTO_BLOCK_SYNC_DEBOUNCE_MS,
  AUTO_BLOCK_SYNC_MAX_WAIT_MS,
  AUTO_BLOCK_SYNC_OPERATION_THRESHOLD,
  buildBlockSignature,
  buildLcsPairs,
  calcSortKeyForCreate,
  normalizeSortKey,
  resolveSyncConcurrency,
  runWithConcurrency,
} from "./tiptapSync";

type LatestDocState = {
  initialized: boolean;
  docId: string | null;
  blockId: string | null;
  markdown: string;
  currentDocument: unknown;
};

type UseAutoBlockSyncOptions = {
  currentDocId?: string;
  editor: Editor | null;
  isEditing: boolean;
  latestDocStateRef: MutableRefObject<LatestDocState>;
  loadRemoteSnapshot: (targetDocId: string, force?: boolean) => Promise<void>;
  remoteSnapshotByDocRef: MutableRefObject<Map<string, RemoteTopLevelBlock[]>>;
  rootBlockIdByDocRef: MutableRefObject<Map<string, string>>;
  setMarkdown: (markdown: string) => void;
  setRemoteSnapshot: (
    targetDocId: string,
    rootBlockId: string | null,
    blocks: RemoteTopLevelBlock[],
  ) => void;
  setSaveStage: Dispatch<SetStateAction<SaveStage>>;
};

const sortRemoteBlocks = (blocks: RemoteTopLevelBlock[]): RemoteTopLevelBlock[] => {
  return [...blocks].sort((a, b) => normalizeSortKey(a.sortKey) - normalizeSortKey(b.sortKey));
};

export function useAutoBlockSync({
  currentDocId,
  editor,
  isEditing,
  latestDocStateRef,
  loadRemoteSnapshot,
  remoteSnapshotByDocRef,
  rootBlockIdByDocRef,
  setMarkdown,
  setRemoteSnapshot,
  setSaveStage,
}: UseAutoBlockSyncOptions) {
  const persistInFlightRef = useRef<Promise<void> | null>(null);
  const autoBlockSyncTimerRef = useRef<number | null>(null);
  const autoBlockSyncMaxWaitTimerRef = useRef<number | null>(null);
  const scheduleAutoBlockSyncRef = useRef<() => void>(() => undefined);
  const flushAutoBlockSyncRef = useRef<() => Promise<void>>(async () => undefined);
  const blockDirtyRef = useRef(false);
  const blockChangeVersionRef = useRef(0);
  const blockBufferedOpsRef = useRef(0);

  const clearAutoBlockSyncTimer = useCallback(() => {
    if (autoBlockSyncTimerRef.current !== null) {
      window.clearTimeout(autoBlockSyncTimerRef.current);
      autoBlockSyncTimerRef.current = null;
    }
  }, []);

  const clearAutoBlockSyncMaxWaitTimer = useCallback(() => {
    if (autoBlockSyncMaxWaitTimerRef.current !== null) {
      window.clearTimeout(autoBlockSyncMaxWaitTimerRef.current);
      autoBlockSyncMaxWaitTimerRef.current = null;
    }
  }, []);

  const resetAutoBlockSyncState = useCallback(
    (nextStage: SaveStage = "idle") => {
      blockDirtyRef.current = false;
      blockChangeVersionRef.current = 0;
      blockBufferedOpsRef.current = 0;
      clearAutoBlockSyncTimer();
      clearAutoBlockSyncMaxWaitTimer();
      setSaveStage(nextStage);
    },
    [clearAutoBlockSyncMaxWaitTimer, clearAutoBlockSyncTimer, setSaveStage],
  );

  useEffect(() => {
    if (!currentDocId) return;
    resetAutoBlockSyncState("idle");
  }, [currentDocId, resetAutoBlockSyncState]);

  useEffect(() => {
    if (!isEditing || !currentDocId) return;
    void loadRemoteSnapshot(currentDocId);
  }, [currentDocId, isEditing, loadRemoteSnapshot]);

  const persistNow = useCallback(async () => {
    if (persistInFlightRef.current) {
      await persistInFlightRef.current;
    }

    if (!blockDirtyRef.current) return null;

    const state = latestDocStateRef.current;
    if (!state.initialized || !state.currentDocument || !state.docId) return null;

    const targetDocId = state.docId;
    const editorJson = editor?.getJSON();
    const targetBlocks = editorJsonToNormalizedBlocks(editorJson);
    const syncStartVersion = blockChangeVersionRef.current;

    setSaveStage("saving");
    const persistJob = (async () => {
      await loadRemoteSnapshot(targetDocId);
      const remoteSortedBlocks = sortRemoteBlocks(
        remoteSnapshotByDocRef.current.get(targetDocId) || [],
      );
      const rootParentId = rootBlockIdByDocRef.current.get(targetDocId) || undefined;
      const docBlockSize = Math.max(targetBlocks.length, remoteSortedBlocks.length);
      const syncConcurrency = resolveSyncConcurrency(docBlockSize);
      const remoteSignatures = remoteSortedBlocks.map((item) =>
        buildBlockSignature(item.normalized),
      );
      const localSignatures = targetBlocks.map((item) => buildBlockSignature(item));
      const stablePairs = buildLcsPairs(remoteSignatures, localSignatures);

      let created = 0;
      let updated = 0;
      let deleted = 0;
      let replaced = 0;
      const mappedPairs: Array<{ remoteIndex: number; localIndex: number }> = [];
      const updates: Array<{
        remoteIndex: number;
        localIndex: number;
        blockId: string;
        localBlock: NormalizedDocBlock;
      }> = [];
      const deleteOps: Array<{ remoteIndex: number; blockId: string }> = [];
      const createOps: Array<{ localIndex: number; localBlock: NormalizedDocBlock }> = [];

      let remoteCursor = 0;
      let localCursor = 0;
      const anchors = [
        ...stablePairs,
        { remoteIndex: remoteSortedBlocks.length, localIndex: targetBlocks.length },
      ];

      anchors.forEach((anchor, anchorIdx) => {
        const remoteSegmentEnd = anchor.remoteIndex;
        const localSegmentEnd = anchor.localIndex;
        const remoteSegmentLen = remoteSegmentEnd - remoteCursor;
        const localSegmentLen = localSegmentEnd - localCursor;
        const pairCount = Math.min(remoteSegmentLen, localSegmentLen);

        for (let offset = 0; offset < pairCount; offset += 1) {
          const remoteIndex = remoteCursor + offset;
          const localIndex = localCursor + offset;
          const remoteBlock = remoteSortedBlocks[remoteIndex];
          const localBlock = targetBlocks[localIndex];
          if (!remoteBlock || !localBlock) continue;

          if (remoteBlock.normalized.type === localBlock.type) {
            mappedPairs.push({ remoteIndex, localIndex });
            if (!areNormalizedBlocksEqual(localBlock, remoteBlock.normalized)) {
              updates.push({
                remoteIndex,
                localIndex,
                blockId: remoteBlock.blockId,
                localBlock,
              });
            }
            continue;
          }

          deleteOps.push({ remoteIndex, blockId: remoteBlock.blockId });
          createOps.push({ localIndex, localBlock });
          replaced += 1;
        }

        for (
          let remoteIndex = remoteCursor + pairCount;
          remoteIndex < remoteSegmentEnd;
          remoteIndex += 1
        ) {
          const remoteBlock = remoteSortedBlocks[remoteIndex];
          if (!remoteBlock) continue;
          deleteOps.push({ remoteIndex, blockId: remoteBlock.blockId });
        }

        for (
          let localIndex = localCursor + pairCount;
          localIndex < localSegmentEnd;
          localIndex += 1
        ) {
          const localBlock = targetBlocks[localIndex];
          if (!localBlock) continue;
          createOps.push({ localIndex, localBlock });
        }

        if (anchorIdx < stablePairs.length) {
          mappedPairs.push({
            remoteIndex: anchor.remoteIndex,
            localIndex: anchor.localIndex,
          });
          remoteCursor = anchor.remoteIndex + 1;
          localCursor = anchor.localIndex + 1;
        }
      });

      const updatesSorted = [...updates].sort((a, b) => a.remoteIndex - b.remoteIndex);
      if (updatesSorted.length > 0) {
        await runWithConcurrency(
          updatesSorted,
          async (item) => updateRemoteBlockContent(item.blockId, item.localBlock),
          syncConcurrency,
        );
        updated = updatesSorted.length;
      }

      const deletesSorted = [...deleteOps].sort((a, b) => b.remoteIndex - a.remoteIndex);
      if (deletesSorted.length > 0) {
        await runWithConcurrency(deletesSorted, async (item) => deleteRemoteBlock(item.blockId), 1);
        deleted = deletesSorted.length;
      }

      const localPlacementSortKeys = new Array<number | undefined>(targetBlocks.length).fill(
        undefined,
      );
      mappedPairs.forEach((pair) => {
        const remoteBlock = remoteSortedBlocks[pair.remoteIndex];
        if (!remoteBlock) return;
        const sortKey = normalizeSortKey(remoteBlock.sortKey);
        if (Number.isFinite(sortKey)) {
          localPlacementSortKeys[pair.localIndex] = sortKey;
        }
      });

      const createdBlockIdByLocalIndex = new Map<number, string>();
      const createSortKeyByLocalIndex = new Map<number, string | undefined>();
      const createsSorted = [...createOps].sort((a, b) => a.localIndex - b.localIndex);
      const createPlans = createsSorted.map((item) => {
        const sortKey = calcSortKeyForCreate(item.localIndex, localPlacementSortKeys);
        if (sortKey) {
          const parsedSortKey = Number(sortKey);
          if (Number.isFinite(parsedSortKey)) {
            localPlacementSortKeys[item.localIndex] = parsedSortKey;
          }
        }
        createSortKeyByLocalIndex.set(item.localIndex, sortKey);
        return {
          ...item,
          sortKey,
        };
      });

      const createResults = await runWithConcurrency(
        createPlans,
        async (item) => {
          const blockId = await createRemoteBlock(targetDocId, item.localBlock, {
            parentId: rootParentId,
            sortKey: item.sortKey,
          });
          return {
            localIndex: item.localIndex,
            blockId,
          };
        },
        syncConcurrency,
      );

      const createsOrderedByLocalIndex = [...createResults].sort(
        (a, b) => a.localIndex - b.localIndex,
      );
      for (const item of createsOrderedByLocalIndex) {
        createdBlockIdByLocalIndex.set(item.localIndex, item.blockId);
      }
      if (createsOrderedByLocalIndex.length > 0) {
        created = createsOrderedByLocalIndex.length;
      }

      const remoteBlockByLocalIndex = new Map<number, RemoteTopLevelBlock>();
      mappedPairs.forEach((pair) => {
        const remoteBlock = remoteSortedBlocks[pair.remoteIndex];
        if (!remoteBlock) return;
        remoteBlockByLocalIndex.set(pair.localIndex, remoteBlock);
      });

      const nextRemoteBlocks = targetBlocks.map((localBlock, localIndex) => {
        const createdBlockId = createdBlockIdByLocalIndex.get(localIndex);
        if (createdBlockId) {
          return {
            blockId: createdBlockId,
            type: "paragraph",
            normalized: localBlock,
            parentId: rootParentId,
            sortKey: createSortKeyByLocalIndex.get(localIndex),
            indent: 0,
          } as RemoteTopLevelBlock;
        }

        const mappedRemoteBlock = remoteBlockByLocalIndex.get(localIndex);
        if (!mappedRemoteBlock) {
          throw new Error(`块同步失败：未找到本地块(${localIndex})对应的远端映射`);
        }

        return {
          ...mappedRemoteBlock,
          normalized: localBlock,
        };
      });

      setRemoteSnapshot(targetDocId, rootParentId || null, nextRemoteBlocks);

      if (
        updatesSorted.length === 0 &&
        deletesSorted.length === 0 &&
        createsOrderedByLocalIndex.length === 0
      ) {
        blockDirtyRef.current = false;
        blockBufferedOpsRef.current = 0;
        setSaveStage("synced");
        return { created: 0, updated: 0, deleted: 0, replaced: 0, total: targetBlocks.length };
      }

      if (blockChangeVersionRef.current === syncStartVersion) {
        blockDirtyRef.current = false;
        blockBufferedOpsRef.current = 0;
        setSaveStage("synced");
      } else {
        blockDirtyRef.current = true;
        blockBufferedOpsRef.current = Math.max(1, blockChangeVersionRef.current - syncStartVersion);
        setSaveStage("dirty");
        scheduleAutoBlockSyncRef.current();
      }
      return { created, updated, deleted, replaced, total: targetBlocks.length };
    })().catch((error) => {
      setSaveStage("error");
      throw error;
    });

    persistInFlightRef.current = persistJob.then(() => undefined).catch(() => undefined);
    return persistJob;
  }, [
    editor,
    latestDocStateRef,
    loadRemoteSnapshot,
    remoteSnapshotByDocRef,
    rootBlockIdByDocRef,
    setRemoteSnapshot,
    setSaveStage,
  ]);

  const flushAutoBlockSync = useCallback(async () => {
    clearAutoBlockSyncTimer();
    clearAutoBlockSyncMaxWaitTimer();
    if (persistInFlightRef.current) {
      await persistInFlightRef.current;
    }
    if (!blockDirtyRef.current) return;
    try {
      await persistNow();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "同步失败，请稍后重试";
      message.error(msg);
    }
  }, [clearAutoBlockSyncMaxWaitTimer, clearAutoBlockSyncTimer, persistNow]);

  useEffect(() => {
    flushAutoBlockSyncRef.current = async () => {
      await flushAutoBlockSync();
    };
  }, [flushAutoBlockSync]);

  const scheduleAutoBlockSync = useCallback(() => {
    if (!isEditing) return;

    if (blockBufferedOpsRef.current >= AUTO_BLOCK_SYNC_OPERATION_THRESHOLD) {
      clearAutoBlockSyncTimer();
      clearAutoBlockSyncMaxWaitTimer();
      void flushAutoBlockSync();
      return;
    }

    clearAutoBlockSyncTimer();
    autoBlockSyncTimerRef.current = window.setTimeout(() => {
      autoBlockSyncTimerRef.current = null;
      clearAutoBlockSyncMaxWaitTimer();
      void flushAutoBlockSync();
    }, AUTO_BLOCK_SYNC_DEBOUNCE_MS);

    if (autoBlockSyncMaxWaitTimerRef.current === null) {
      autoBlockSyncMaxWaitTimerRef.current = window.setTimeout(() => {
        autoBlockSyncMaxWaitTimerRef.current = null;
        clearAutoBlockSyncTimer();
        void flushAutoBlockSync();
      }, AUTO_BLOCK_SYNC_MAX_WAIT_MS);
    }
  }, [clearAutoBlockSyncMaxWaitTimer, clearAutoBlockSyncTimer, flushAutoBlockSync, isEditing]);

  useEffect(() => {
    scheduleAutoBlockSyncRef.current = () => {
      scheduleAutoBlockSync();
    };
  }, [scheduleAutoBlockSync]);

  useEffect(() => {
    return () => {
      clearAutoBlockSyncTimer();
      clearAutoBlockSyncMaxWaitTimer();
    };
  }, [clearAutoBlockSyncMaxWaitTimer, clearAutoBlockSyncTimer]);

  useEffect(() => {
    if (!isEditing) {
      clearAutoBlockSyncTimer();
      clearAutoBlockSyncMaxWaitTimer();
    }
  }, [clearAutoBlockSyncMaxWaitTimer, clearAutoBlockSyncTimer, isEditing]);

  const handleEditorBlur = useCallback(() => {
    void flushAutoBlockSyncRef.current();
  }, []);

  const handleEditorUpdate = useCallback(
    (nextEditor: Editor) => {
      const html = nextEditor.getHTML();
      const normalized = html === "<p></p>" ? "" : html;
      blockDirtyRef.current = true;
      blockChangeVersionRef.current += 1;
      blockBufferedOpsRef.current += 1;
      setSaveStage("dirty");
      setMarkdown(normalized);
      scheduleAutoBlockSyncRef.current();
    },
    [setMarkdown, setSaveStage],
  );

  const waitForPersist = useCallback(async () => {
    if (persistInFlightRef.current) {
      await persistInFlightRef.current;
    }
  }, []);

  return {
    flushAutoBlockSync,
    handleEditorBlur,
    handleEditorUpdate,
    resetAutoBlockSyncState,
    waitForPersist,
  };
}
