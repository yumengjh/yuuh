import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { message } from "antd";
import { useEditContext } from "../context/editContext";
import { apiV1 } from "../api_v1";
import { useSessionStore } from "../store";
import { useDocumentEngineStore } from "../editor/useDocumentEngineStore";
import { contentTreeToHtml, extractTopLevelBlocksFromContent } from "../editor/contentAdapter";
import { setRemoteSnapshotCache } from "../editor/remoteSnapshotCache";
import LoadingState from "../component/Loading/LoadingState";
import TiptapNotionEditor from "../editor/TiptapNotionEditor";
import DocumentVirtualReader from "./DocumentVirtualReader";

export default function DocumentPage() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const { isEditing, setIsEditing } = useEditContext();
  const currentDocId = useSessionStore((state) => state.docId);
  const docDetailStatus = useSessionStore((state) => state.status.docDetail);
  const openDoc = useSessionStore((state) => state.openDoc);
  const hydrateRemoteDocument = useDocumentEngineStore((state) => state.hydrateRemoteDocument);

  const lastDocIdRef = useRef<string | null>(null);
  const [checkingToken, setCheckingToken] = useState(false);
  const [preparingEditor, setPreparingEditor] = useState(false);
  const [preparedDocId, setPreparedDocId] = useState<string | null>(null);

  const targetDocId = docId || currentDocId || "";

  useEffect(() => {
    if (docId && docId !== lastDocIdRef.current) {
      lastDocIdRef.current = docId;

      const run = async () => {
        setCheckingToken(true);
        try {
          await apiV1.auth.me();
          if (currentDocId === docId) {
            setIsEditing(false);
            return;
          }
          const doc = await openDoc(docId);
          if (!doc) {
            message.error("文档加载失败，请稍后重试");
            return;
          }
          setIsEditing(false);
        } catch (error) {
          const status =
            error && typeof error === "object" && "status" in error
              ? (error as { status?: number }).status
              : undefined;
          if (status === 401) {
            message.warning("登录状态已失效，请重新登录");
            navigate("/login", { replace: true });
            return;
          }
          message.error("文档加载失败，请稍后重试");
        } finally {
          setCheckingToken(false);
        }
      };

      void run();
    }
  }, [currentDocId, docId, navigate, openDoc, setIsEditing]);

  useEffect(() => {
    if (!isEditing || !targetDocId) {
      setPreparingEditor(false);
      setPreparedDocId(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setPreparingEditor(true);
      setPreparedDocId(null);
      try {
        const docMeta = await apiV1.documents.getDocument(targetDocId);
        const targetVersion = typeof docMeta?.head === "number" ? docMeta.head : undefined;
        const content = await apiV1.documents.getDocumentContent(targetDocId, {
          limit: 10000,
          ...(typeof targetVersion === "number" ? { version: targetVersion } : {}),
        });
        if (cancelled) return;
        const html = contentTreeToHtml(content);
        const { rootBlockId, blocks } = extractTopLevelBlocksFromContent(content);
        setRemoteSnapshotCache(targetDocId, { rootBlockId, blocks });
        hydrateRemoteDocument({
          docId: targetDocId,
          markdown: html || "",
          docVer: targetVersion,
        });
      } catch (error) {
        if (cancelled) return;
        const msg = error instanceof Error ? error.message : "加载完整文档失败";
        message.warning(`进入编辑前加载完整文档失败，已继续进入编辑：${msg}`);
      } finally {
        if (!cancelled) {
          setPreparedDocId(targetDocId);
          setPreparingEditor(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [hydrateRemoteDocument, isEditing, targetDocId]);

  if (checkingToken || (docId && currentDocId !== docId && docDetailStatus === "loading")) {
    return <LoadingState tip="正在加载文档..." minHeight={320} />;
  }

  if (!targetDocId) {
    return <LoadingState tip="正在准备文档..." minHeight={320} />;
  }

  if (isEditing) {
    if (preparingEditor || preparedDocId !== targetDocId) {
      return <LoadingState tip="正在加载完整文档..." minHeight={320} />;
    }
    return <TiptapNotionEditor />;
  }

  return <DocumentVirtualReader docId={targetDocId} />;
}
