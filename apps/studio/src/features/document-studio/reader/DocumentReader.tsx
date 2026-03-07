import { useEffect, useState } from "react";
import { Alert, Empty } from "antd";
import { apiV1 } from "../../../api_v1";
import LoadingState from "../../../component/Loading/LoadingState";
import {
  getCodeThemeByMode,
  getShikiHighlighter,
  resolveCodeLanguageForShiki,
  type CodeThemeMode,
} from "../../../editor/codeHighlight";
import { contentTreeToHtml } from "../../../editor/contentAdapter";
import "../../../editor/tiptap.css";
import "../shared/documentContent.css";
import { DOCUMENT_STUDIO_COPY } from "../shared/messages";
import "./documentReader.css";

type DocumentReaderProps = {
  docId: string;
  className?: string;
};

type DocumentReaderStatus = "idle" | "loading" | "success" | "error";

const FULL_DOCUMENT_LIMIT = 10000;

const resolvePreferredThemeMode = (): CodeThemeMode => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const inferCodeLanguage = (className: string): string | undefined => {
  const languageClass = className
    .split(/\s+/)
    .map((item) => item.trim())
    .find((item) => item.startsWith("language-") || item.startsWith("lang-"));

  if (!languageClass) return undefined;
  return languageClass.replace(/^language-/, "").replace(/^lang-/, "").trim() || undefined;
};

const highlightDocumentHtml = async (
  html: string,
  themeMode: CodeThemeMode,
): Promise<string> => {
  if (!html.trim() || typeof window === "undefined") {
    return html;
  }

  const container = document.createElement("div");
  container.innerHTML = html;

  const codeBlocks = Array.from(container.querySelectorAll("pre > code"));
  if (codeBlocks.length === 0) {
    return html;
  }

  const highlighter = await getShikiHighlighter();
  const theme = getCodeThemeByMode(themeMode);

  codeBlocks.forEach((codeElement) => {
    const preElement = codeElement.parentElement;
    if (!preElement) return;

    const rawLanguage =
      inferCodeLanguage(codeElement.className) || preElement.getAttribute("data-language") || "text";
    const language = resolveCodeLanguageForShiki(highlighter, rawLanguage);
    const code = codeElement.textContent || "";
    const highlightedHtml = highlighter.codeToHtml(code, {
      lang: language,
      theme,
    });

    preElement.outerHTML = highlightedHtml;
  });

  return container.innerHTML;
};

export default function DocumentReader({ docId, className }: DocumentReaderProps) {
  const [status, setStatus] = useState<DocumentReaderStatus>("idle");
  const [error, setError] = useState<string>();
  const [rawHtml, setRawHtml] = useState("");
  const [renderedHtml, setRenderedHtml] = useState("");
  const [themeMode, setThemeMode] = useState<CodeThemeMode>(resolvePreferredThemeMode);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setThemeMode(event.matches ? "dark" : "light");
    };

    setThemeMode(media.matches ? "dark" : "light");
    media.addEventListener("change", handleChange);
    return () => {
      media.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    if (!docId) {
      setStatus("idle");
      setError(undefined);
      setRawHtml("");
      setRenderedHtml("");
      return;
    }

    let cancelled = false;

    const loadDocument = async () => {
      setStatus("loading");
      setError(undefined);

      try {
        const docMeta = await apiV1.documents.getDocument(docId);
        const version = typeof docMeta?.head === "number" ? docMeta.head : undefined;
        const content = await apiV1.documents.getDocumentContent(docId, {
          limit: FULL_DOCUMENT_LIMIT,
          ...(typeof version === "number" ? { version } : {}),
        });
        if (cancelled) return;

        const html = contentTreeToHtml(content);
        setRawHtml(html);
        setRenderedHtml(html);
        setStatus("success");
      } catch (loadError) {
        if (cancelled) return;
        setStatus("error");
        setError(
          loadError instanceof Error && loadError.message.trim()
            ? loadError.message
            : DOCUMENT_STUDIO_COPY.loadDocumentFailed,
        );
      }
    };

    void loadDocument();

    return () => {
      cancelled = true;
    };
  }, [docId]);

  useEffect(() => {
    if (!rawHtml.trim()) {
      setRenderedHtml(rawHtml);
      return;
    }

    let cancelled = false;

    const runHighlight = async () => {
      try {
        const highlighted = await highlightDocumentHtml(rawHtml, themeMode);
        if (!cancelled) {
          setRenderedHtml(highlighted);
        }
      } catch {
        if (!cancelled) {
          setRenderedHtml(rawHtml);
        }
      }
    };

    void runHighlight();

    return () => {
      cancelled = true;
    };
  }, [rawHtml, themeMode]);

  if (status === "loading") {
    return <LoadingState tip={DOCUMENT_STUDIO_COPY.loadingContent} minHeight={320} />;
  }

  if (status === "error") {
    return (
      <Alert
        type="error"
        showIcon
        message={DOCUMENT_STUDIO_COPY.loadDocumentFailed}
        description={error}
      />
    );
  }

  if (!renderedHtml.trim() || renderedHtml.trim() === "<p></p>") {
    return <Empty description={DOCUMENT_STUDIO_COPY.emptyContent} />;
  }

  const rootClassName = className ? `tiptap-shell document-reader ${className}` : "tiptap-shell document-reader";

  return (
    <div className={rootClassName}>
      <div className="tiptap-card document-reader__card" data-code-theme={themeMode}>
        <div className="tiptap-editor-wrapper">
          <article className="document-reader__article">
            <div
              className="document-content document-reader__content"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </article>
        </div>
      </div>
    </div>
  );
}
