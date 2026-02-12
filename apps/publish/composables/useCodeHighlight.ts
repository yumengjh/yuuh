import { createHighlighter, type HighlighterGeneric } from "shiki";

export type CodeThemeMode = "light" | "dark";
export type ShikiHighlighter = HighlighterGeneric<any, any>;

const LANGUAGE_ALIAS_MAP: Record<string, string> = {
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  yml: "yaml",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  text: "plaintext",
  plain: "plaintext",
};

let highlighterPromise: Promise<ShikiHighlighter> | null = null;

const normalizeLanguage = (language?: string): string => {
  const raw = (language || "").trim().toLowerCase();
  if (!raw) return "plaintext";
  return LANGUAGE_ALIAS_MAP[raw] || raw;
};

export const getCodeThemeByMode = (mode: CodeThemeMode): string => {
  return mode === "dark" ? "github-dark" : "github-light";
};

export const getShikiHighlighter = async () => {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: [
        "plaintext",
        "bash",
        "json",
        "yaml",
        "markdown",
        "javascript",
        "typescript",
        "tsx",
        "jsx",
        "html",
        "css",
        "sql",
        "vue",
        "python",
        "java",
        "go",
        "rust",
      ],
    });
  }
  return highlighterPromise;
};

export const resolveCodeLanguageForShiki = (
  highlighter: ShikiHighlighter,
  language?: string,
): string => {
  const normalized = normalizeLanguage(language);
  const alias = highlighter.getLanguage(normalized) ? normalized : "plaintext";
  return alias;
};
