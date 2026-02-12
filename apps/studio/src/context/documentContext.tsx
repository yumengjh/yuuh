/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { DocumentEngine } from "../engine/engine";
import { InMemoryStorage } from "../engine/storage";
import type { DocID } from "../engine/types";
import { useSessionStore } from "../store";

type RuntimeMeta = {
  createdAt?: number;
  updatedAt?: number;
};

export interface DocumentInfo {
  docId: DocID;
  title: string;
  engine: DocumentEngine;
  storage: InMemoryStorage;
  meta?: RuntimeMeta;
}

interface DocumentContextType {
  documents: DocumentInfo[];
  currentDocId: DocID | null;
  currentDocument: DocumentInfo | null;
  addDocument: (docId: DocID, title: string) => Promise<DocID>;
  switchDocument: (docId: DocID) => Promise<void>;
  removeDocument: (docId: DocID) => void;
  updateDocumentTitle: (docId: DocID, title: string) => Promise<void>;
  initializeDocument: (docId: DocID) => Promise<void>;
}

const DocumentContext = createContext<DocumentContextType | null>(null);

export const useDocumentContext = () => {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error("useDocumentContext must be used within DocumentProvider");
  }
  return context;
};

const toTimestamp = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const runtimeStorage = new InMemoryStorage();
const runtimeEngine = new DocumentEngine(runtimeStorage, { snapshotEvery: 5 });

export const DocumentProvider = ({ children }: { children: ReactNode }) => {
  const workspaceId = useSessionStore((state) => state.workspaceId);
  const docList = useSessionStore((state) => state.docList);
  const docId = useSessionStore((state) => state.docId);
  const currentDoc = useSessionStore((state) => state.currentDoc);
  const setDoc = useSessionStore((state) => state.setDoc);
  const setDocList = useSessionStore((state) => state.setDocList);
  const setCurrentDoc = useSessionStore((state) => state.setCurrentDoc);
  const createDoc = useSessionStore((state) => state.createDoc);
  const openDoc = useSessionStore((state) => state.openDoc);
  const renameDoc = useSessionStore((state) => state.renameDoc);
  const syncDocMetaLocal = useSessionStore((state) => state.syncDocMetaLocal);

  const ensureLocalDocument = useCallback(
    async (targetDocId: string, targetTitle: string) => {
      const existing = await runtimeEngine.getDocument(targetDocId);
      if (existing) return;
      await runtimeEngine.createDocument({
        docId: targetDocId,
        title: targetTitle || "未命名文档",
        workspaceId: workspaceId || undefined,
        createdBy: "u_1",
      });
    },
    [workspaceId]
  );

  const documents = useMemo(() => {
    return docList.map((item) => ({
      docId: item.docId,
      title: item.title || "未命名文档",
      engine: runtimeEngine,
      storage: runtimeStorage,
      meta: {
        createdAt: toTimestamp(item.createdAt),
        updatedAt: toTimestamp(item.updatedAt),
      },
    }));
  }, [docList]);

  const currentDocId = docId;
  const currentDocument = useMemo(() => {
    const found = documents.find((item) => item.docId === currentDocId);
    if (found) return found;
    if (!currentDoc) return null;
    return {
      docId: currentDoc.docId,
      title: currentDoc.title || "未命名文档",
      engine: runtimeEngine,
      storage: runtimeStorage,
      meta: {
        createdAt: toTimestamp(currentDoc.createdAt),
        updatedAt: toTimestamp(currentDoc.updatedAt),
      },
    };
  }, [currentDoc, currentDocId, documents]);

  useEffect(() => {
    if (!currentDocument) return;
    void ensureLocalDocument(currentDocument.docId, currentDocument.title);
  }, [currentDocument, ensureLocalDocument]);

  const addDocument = useCallback(
    async (_newDocId: DocID, title: string) => {
      if (!workspaceId) {
        throw new Error("请先选择工作空间后再创建文档");
      }
      const createdDoc = await createDoc({
        workspaceId,
        title: title || "未命名文档",
      });
      if (!createdDoc) {
        throw new Error("创建文档失败");
      }
      await ensureLocalDocument(createdDoc.docId, createdDoc.title || title || "未命名文档");
      syncDocMetaLocal(createdDoc);
      return createdDoc.docId;
    },
    [createDoc, ensureLocalDocument, syncDocMetaLocal, workspaceId]
  );

  const switchDocument = useCallback(
    async (nextDocId: DocID) => {
      if (docId === nextDocId && currentDoc?.docId === nextDocId) {
        await ensureLocalDocument(nextDocId, currentDoc.title || "未命名文档");
        return;
      }
      const opened = await openDoc(nextDocId);
      const targetTitle = opened?.title || docList.find((item) => item.docId === nextDocId)?.title || "未命名文档";
      await ensureLocalDocument(nextDocId, targetTitle);
      if (opened) {
        syncDocMetaLocal(opened);
      } else {
        setDoc(nextDocId);
      }
    },
    [currentDoc, docId, docList, ensureLocalDocument, openDoc, setDoc, syncDocMetaLocal]
  );

  const removeDocument = useCallback(
    (targetDocId: DocID) => {
      const nextList = docList.filter((item) => item.docId !== targetDocId);
      setDocList(nextList);
      if (docId === targetDocId) {
        const nextCurrent = nextList[0] || null;
        setCurrentDoc(nextCurrent);
        setDoc(nextCurrent?.docId || null);
      }
    },
    [docId, docList, setCurrentDoc, setDoc, setDocList]
  );

  const updateDocumentTitle = useCallback(
    async (targetDocId: DocID, title: string) => {
      const updated = await renameDoc(targetDocId, title);
      if (updated) {
        syncDocMetaLocal(updated);
      }
    },
    [renameDoc, syncDocMetaLocal]
  );

  const initializeDocument = useCallback(
    async (targetDocId: DocID) => {
      const found = docList.find((item) => item.docId === targetDocId);
      if (!found) return;
      await ensureLocalDocument(targetDocId, found.title || "未命名文档");
    },
    [docList, ensureLocalDocument]
  );

  return (
    <DocumentContext.Provider
      value={{
        documents,
        currentDocId,
        currentDocument,
        addDocument,
        switchDocument,
        removeDocument,
        updateDocumentTitle,
        initializeDocument,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
};
