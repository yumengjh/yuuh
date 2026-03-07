import { useEffect, useState } from "react";
import { message } from "antd";
import { apiV1 } from "../../../api_v1";
import { contentTreeToHtml, extractTopLevelBlocksFromContent } from "../../../editor/contentAdapter";
import { setRemoteSnapshotCache } from "../../../editor/remoteSnapshotCache";
import { DOCUMENT_STUDIO_COPY } from "../shared/messages";

type UsePrepareDocumentEditorParams = {
  enabled: boolean;
  docId: string;
  hydrateRemoteDocument: (input: {
    docId: string;
    markdown: string;
    docVer?: number;
  }) => void;
};

const FULL_DOCUMENT_LIMIT = 10000;

export const usePrepareDocumentEditor = ({
  enabled,
  docId,
  hydrateRemoteDocument,
}: UsePrepareDocumentEditorParams) => {
  const [preparingEditor, setPreparingEditor] = useState(false);
  const [preparedDocId, setPreparedDocId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !docId) {
      setPreparingEditor(false);
      setPreparedDocId(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setPreparingEditor(true);
      setPreparedDocId(null);

      try {
        const docMeta = await apiV1.documents.getDocument(docId);
        const targetVersion = typeof docMeta?.head === "number" ? docMeta.head : undefined;
        const content = await apiV1.documents.getDocumentContent(docId, {
          limit: FULL_DOCUMENT_LIMIT,
          ...(typeof targetVersion === "number" ? { version: targetVersion } : {}),
        });
        if (cancelled) return;

        const html = contentTreeToHtml(content);
        const { rootBlockId, blocks } = extractTopLevelBlocksFromContent(content);
        setRemoteSnapshotCache(docId, { rootBlockId, blocks });
        hydrateRemoteDocument({
          docId,
          markdown: html || "",
          docVer: targetVersion,
        });
      } catch (error) {
        if (cancelled) return;

        const errorMessage =
          error instanceof Error ? error.message : DOCUMENT_STUDIO_COPY.loadFullDocumentFailed;
        message.warning(DOCUMENT_STUDIO_COPY.loadBeforeEditFailed(errorMessage));
      } finally {
        if (!cancelled) {
          setPreparedDocId(docId);
          setPreparingEditor(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [docId, enabled, hydrateRemoteDocument]);

  return {
    preparingEditor,
    preparedDocId,
  };
};
