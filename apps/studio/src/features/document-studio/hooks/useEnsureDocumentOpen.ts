import { useEffect, useRef, useState } from "react";
import { message } from "antd";
import { useNavigate } from "react-router-dom";
import { apiV1 } from "../../../api_v1";
import { DOCUMENT_STUDIO_COPY } from "../shared/messages";
import type { DocumentStudioMode } from "../shared/types";

type UseEnsureDocumentOpenParams = {
  docId: string;
  currentDocId: string;
  mode: DocumentStudioMode;
  openDoc: (docId: string) => Promise<unknown>;
  setIsEditing: (value: boolean) => void;
};

export const useEnsureDocumentOpen = ({
  docId,
  currentDocId,
  mode,
  openDoc,
  setIsEditing,
}: UseEnsureDocumentOpenParams): boolean => {
  const navigate = useNavigate();
  const lastDocIdRef = useRef<string | null>(null);
  const [checkingToken, setCheckingToken] = useState(false);

  useEffect(() => {
    if (!docId || docId === lastDocIdRef.current) {
      return;
    }

    lastDocIdRef.current = docId;
    let cancelled = false;

    const run = async () => {
      setCheckingToken(true);

      try {
        await apiV1.auth.me();
        if (cancelled) return;

        if (currentDocId === docId) {
          if (mode === "auto") {
            setIsEditing(false);
          }
          return;
        }

        const openedDoc = await openDoc(docId);
        if (cancelled) return;

        if (!openedDoc) {
          message.error(DOCUMENT_STUDIO_COPY.loadDocumentFailed);
          return;
        }

        if (mode === "auto") {
          setIsEditing(false);
        }
      } catch (error) {
        if (cancelled) return;

        const status =
          error && typeof error === "object" && "status" in error
            ? (error as { status?: number }).status
            : undefined;

        if (status === 401) {
          message.warning(DOCUMENT_STUDIO_COPY.authExpired);
          navigate("/login", { replace: true });
          return;
        }

        message.error(DOCUMENT_STUDIO_COPY.loadDocumentFailed);
      } finally {
        if (!cancelled) {
          setCheckingToken(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [currentDocId, docId, mode, navigate, openDoc, setIsEditing]);

  return checkingToken;
};
