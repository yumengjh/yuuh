import LoadingState from "../../component/Loading/LoadingState";
import { useEditContext } from "../../context/editContext";
import { useDocumentEngineStore } from "../../editor/useDocumentEngineStore";
import { useSessionStore } from "../../store";
import DocumentEditor from "./editor/DocumentEditor";
import { useEnsureDocumentOpen } from "./hooks/useEnsureDocumentOpen";
import { usePrepareDocumentEditor } from "./hooks/usePrepareDocumentEditor";
import DocumentReader from "./reader/DocumentReader";
import { DOCUMENT_STUDIO_COPY } from "./shared/messages";
import type { DocumentStudioMode } from "./shared/types";

type DocumentStudioProps = {
  docId: string;
  mode?: DocumentStudioMode;
  className?: string;
};

export default function DocumentStudio({
  docId,
  mode = "auto",
  className,
}: DocumentStudioProps) {
  const { isEditing, setIsEditing } = useEditContext();
  const currentDocId = useSessionStore((state) => state.docId);
  const docDetailStatus = useSessionStore((state) => state.status.docDetail);
  const openDoc = useSessionStore((state) => state.openDoc);
  const hydrateRemoteDocument = useDocumentEngineStore((state) => state.hydrateRemoteDocument);

  const targetDocId = docId || currentDocId || "";
  const resolvedMode: Exclude<DocumentStudioMode, "auto"> =
    mode === "auto" ? (isEditing ? "edit" : "read") : mode;
  const rootClassName = className ? `document-studio ${className}` : "document-studio";
  const checkingToken = useEnsureDocumentOpen({
    docId,
    currentDocId,
    mode,
    openDoc,
    setIsEditing,
  });
  const { preparingEditor, preparedDocId } = usePrepareDocumentEditor({
    enabled: resolvedMode === "edit",
    docId: targetDocId,
    hydrateRemoteDocument,
  });

  let content = null;

  if (checkingToken || (docId && currentDocId !== docId && docDetailStatus === "loading")) {
    content = <LoadingState tip={DOCUMENT_STUDIO_COPY.loadingDocument} minHeight={320} />;
  } else if (!targetDocId) {
    content = <LoadingState tip={DOCUMENT_STUDIO_COPY.preparingDocument} minHeight={320} />;
  } else if (resolvedMode === "edit") {
    if (preparingEditor || preparedDocId !== targetDocId) {
      content = <LoadingState tip={DOCUMENT_STUDIO_COPY.loadingFullDocument} minHeight={320} />;
    } else {
      content = <DocumentEditor docId={targetDocId} />;
    }
  } else {
    content = <DocumentReader docId={targetDocId} />;
  }

  return <div className={rootClassName}>{content}</div>;
}
