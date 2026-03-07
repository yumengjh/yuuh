import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { message } from "antd";
import type { DocumentInfo } from "../context/documentContext";
import type { SaveStage } from "./saveStage";
import { TITLE_AUTO_SAVE_DEBOUNCE_MS } from "./tiptapSync";

type UseTitleAutoSaveOptions = {
  currentDocument: DocumentInfo | null;
  onSaveTitle: (docId: string, title: string) => Promise<void>;
  setSaveStage: Dispatch<SetStateAction<SaveStage>>;
};

export function useTitleAutoSave({
  currentDocument,
  onSaveTitle,
  setSaveStage,
}: UseTitleAutoSaveOptions) {
  const isEditingTitle = useRef(false);
  const lastSyncedDocId = useRef<string | null>(null);
  const titleAutoSaveTimerRef = useRef<number | null>(null);
  const titleSavingPromiseRef = useRef<Promise<void> | null>(null);
  const lastSavedTitleRef = useRef("");
  const latestTitleValueRef = useRef("");
  const [title, setTitle] = useState("");

  const clearTitleAutoSaveTimer = useCallback(() => {
    if (titleAutoSaveTimerRef.current !== null) {
      window.clearTimeout(titleAutoSaveTimerRef.current);
      titleAutoSaveTimerRef.current = null;
    }
  }, []);

  const saveTitleIfNeeded = useCallback(
    async (nextRawTitle: string, withFeedback = false) => {
      const targetDocId = currentDocument?.docId;
      if (!targetDocId) return false;

      const normalizedTitle = nextRawTitle.trim();
      if (normalizedTitle === lastSavedTitleRef.current) return false;

      setSaveStage("saving");

      const run = async () => {
        await onSaveTitle(targetDocId, normalizedTitle);
        lastSavedTitleRef.current = normalizedTitle;
        setSaveStage("synced");
        if (withFeedback) {
          message.success("标题已自动保存");
        }
      };

      const chained = (titleSavingPromiseRef.current || Promise.resolve())
        .catch(() => undefined)
        .then(run);

      titleSavingPromiseRef.current = chained.then(() => undefined).catch(() => undefined);

      try {
        await chained;
        return true;
      } catch (error) {
        setSaveStage("error");
        const msg = error instanceof Error ? error.message : "标题保存失败";
        message.error(msg);
        return false;
      }
    },
    [currentDocument?.docId, onSaveTitle, setSaveStage],
  );

  const scheduleTitleAutoSave = useCallback(() => {
    clearTitleAutoSaveTimer();
    titleAutoSaveTimerRef.current = window.setTimeout(() => {
      titleAutoSaveTimerRef.current = null;
      void saveTitleIfNeeded(latestTitleValueRef.current);
    }, TITLE_AUTO_SAVE_DEBOUNCE_MS);
  }, [clearTitleAutoSaveTimer, saveTitleIfNeeded]);

  const flushTitleAutoSave = useCallback(async () => {
    clearTitleAutoSaveTimer();
    await saveTitleIfNeeded(latestTitleValueRef.current);
  }, [clearTitleAutoSaveTimer, saveTitleIfNeeded]);

  useEffect(() => {
    if (currentDocument?.docId && !isEditingTitle.current) {
      if (lastSyncedDocId.current !== currentDocument.docId) {
        const nextTitle = currentDocument.title || "";
        clearTitleAutoSaveTimer();
        setTitle(nextTitle);
        latestTitleValueRef.current = nextTitle;
        lastSavedTitleRef.current = nextTitle.trim();
        lastSyncedDocId.current = currentDocument.docId;
      }
    }
  }, [clearTitleAutoSaveTimer, currentDocument?.docId, currentDocument?.title]);

  useEffect(() => {
    latestTitleValueRef.current = title;
  }, [title]);

  useEffect(() => {
    return () => {
      clearTitleAutoSaveTimer();
    };
  }, [clearTitleAutoSaveTimer]);

  const handleTitleChange = useCallback(
    (nextTitle: string) => {
      isEditingTitle.current = true;
      setTitle(nextTitle);
      setSaveStage("dirty");
      scheduleTitleAutoSave();
    },
    [scheduleTitleAutoSave, setSaveStage],
  );

  const handleTitleFocus = useCallback(() => {
    isEditingTitle.current = true;
  }, []);

  const handleTitleBlur = useCallback(async () => {
    await flushTitleAutoSave();
    isEditingTitle.current = false;
  }, [flushTitleAutoSave]);

  return {
    flushTitleAutoSave,
    handleTitleBlur,
    handleTitleChange,
    handleTitleFocus,
    title,
  };
}
