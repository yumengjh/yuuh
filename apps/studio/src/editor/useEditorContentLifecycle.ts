import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { Editor } from "@tiptap/react";
import { message } from "antd";
import { apiV1 } from "../api_v1";
import type { DocumentInfo } from "../context/documentContext";
import { contentTreeToHtml, extractTopLevelBlocksFromContent } from "./contentAdapter";
import type { RemoteTopLevelBlock } from "./content-adapter/types";
import type { SaveStage } from "./saveStage";

type LatestDocState = {
  initialized: boolean;
  docId: string | null;
  blockId: string | null;
  markdown: string;
  currentDocument: DocumentInfo | null;
};

type UseEditorContentLifecycleOptions = {
  currentDocument: DocumentInfo | null;
  docId: string | null;
  editor: Editor | null;
  initialized: boolean;
  isEditing: boolean;
  isUpdatingFromStoreRef: MutableRefObject<boolean>;
  initializingDocIdRef: MutableRefObject<string | null>;
  latestDocStateRef: MutableRefObject<LatestDocState>;
  markdown: string;
  prevEditingRef: MutableRefObject<boolean>;
  resetAutoBlockSyncState: (nextStage?: SaveStage) => void;
  setMarkdown: (markdown: string) => void;
  setRemoteSnapshot: (
    targetDocId: string,
    rootBlockId: string | null,
    blocks: RemoteTopLevelBlock[],
  ) => void;
  setSaveStage: Dispatch<SetStateAction<SaveStage>>;
  switchDocument: (docId: string, engine: DocumentInfo["engine"]) => Promise<unknown>;
};

const setEditorContentSilently = (
  editor: Editor,
  content: string,
  isUpdatingFromStoreRef: MutableRefObject<boolean>,
) => {
  isUpdatingFromStoreRef.current = true;
  editor.commands.setContent(content, { emitUpdate: false });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      isUpdatingFromStoreRef.current = false;
    });
  });
};

export function useEditorContentLifecycle({
  currentDocument,
  docId,
  editor,
  initialized,
  isEditing,
  isUpdatingFromStoreRef,
  initializingDocIdRef,
  latestDocStateRef,
  markdown,
  prevEditingRef,
  resetAutoBlockSyncState,
  setMarkdown,
  setRemoteSnapshot,
  setSaveStage,
  switchDocument,
}: UseEditorContentLifecycleOptions) {
  const reloadFromServer = useCallback(
    async (withFeedback = true) => {
      const state = latestDocStateRef.current;
      if (!state.docId) return;

      try {
        const docMeta = await apiV1.documents.getDocument(state.docId);
        const targetVersion = typeof docMeta?.head === "number" ? docMeta.head : undefined;
        const res = await apiV1.documents.getDocumentContent(state.docId, {
          limit: 10000,
          ...(typeof targetVersion === "number" ? { version: targetVersion } : {}),
        });
        const html = contentTreeToHtml(res);
        const { rootBlockId, blocks } = extractTopLevelBlocksFromContent(res);
        setRemoteSnapshot(state.docId, rootBlockId, blocks);

        setMarkdown(html);
        if (editor) {
          setEditorContentSilently(editor, html || "<p></p>", isUpdatingFromStoreRef);
        }

        resetAutoBlockSyncState("synced");
        if (withFeedback) {
          message.success("已加载最新已提交版本内容");
        }
      } catch (error) {
        setSaveStage("error");
        if (withFeedback) {
          const msg = error instanceof Error ? error.message : "加载文档内容失败";
          message.error(msg);
        }
      }
    },
    [
      editor,
      isUpdatingFromStoreRef,
      latestDocStateRef,
      resetAutoBlockSyncState,
      setMarkdown,
      setRemoteSnapshot,
      setSaveStage,
    ],
  );

  useEffect(() => {
    if (!currentDocument) return;

    const engine = currentDocument.engine;
    const newDocId = currentDocument.docId;

    if (initializingDocIdRef.current === newDocId || (initialized && docId === newDocId)) {
      return;
    }

    initializingDocIdRef.current = newDocId;

    if (editor && newDocId !== docId) {
      setEditorContentSilently(editor, "<p></p>", isUpdatingFromStoreRef);
    }

    switchDocument(newDocId, engine).finally(() => {
      if (initializingDocIdRef.current === newDocId) {
        initializingDocIdRef.current = null;
      }
    });
  }, [
    currentDocument,
    docId,
    editor,
    initialized,
    initializingDocIdRef,
    isUpdatingFromStoreRef,
    switchDocument,
  ]);

  useEffect(() => {
    if (!editor) return;

    if (!initialized) {
      const currentHtml = editor.getHTML();
      if (currentHtml !== "<p></p>") {
        setEditorContentSilently(editor, "<p></p>", isUpdatingFromStoreRef);
      }
      return;
    }

    if (docId !== currentDocument?.docId) {
      return;
    }

    const current = editor.getHTML();
    const normalizedCurrent = current === "<p></p>" ? "" : current;
    const normalizedMarkdown = markdown || "";

    if (normalizedCurrent === normalizedMarkdown) {
      return;
    }

    setEditorContentSilently(editor, markdown || "<p></p>", isUpdatingFromStoreRef);
  }, [currentDocument?.docId, docId, editor, initialized, isUpdatingFromStoreRef, markdown]);

  useEffect(() => {
    const wasEditing = prevEditingRef.current;
    if (wasEditing && !isEditing) {
      void reloadFromServer(true);
    }
    prevEditingRef.current = isEditing;
  }, [isEditing, prevEditingRef, reloadFromServer]);

  return {
    reloadFromServer,
  };
}
