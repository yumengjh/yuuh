import { useEffect, useRef, useState } from "react";
import type { CodeThemeMode } from "./codeHighlight";

const resolvePreferredThemeMode = (): CodeThemeMode => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const usePreferredThemeMode = () => {
  const [themeMode, setThemeMode] = useState<CodeThemeMode>(resolvePreferredThemeMode);
  const themeModeRef = useRef<CodeThemeMode>(themeMode);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = (matches: boolean) => {
      const nextMode: CodeThemeMode = matches ? "dark" : "light";
      themeModeRef.current = nextMode;
      setThemeMode(nextMode);
    };

    applyTheme(media.matches);

    const onThemeChange = (event: MediaQueryListEvent) => {
      applyTheme(event.matches);
    };

    media.addEventListener("change", onThemeChange);
    return () => {
      media.removeEventListener("change", onThemeChange);
    };
  }, []);

  return {
    themeMode,
    themeModeRef,
  };
};
