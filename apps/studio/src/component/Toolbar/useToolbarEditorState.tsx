import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
} from "@ant-design/icons";

export type AlignmentItem = {
  key: "left" | "center" | "right" | "justify";
  label: string;
  icon: ReactNode;
};

export type CurrentAlignment = {
  key: AlignmentItem["key"];
  label: string;
  icon: ReactNode;
};

const defaultAlignment: CurrentAlignment = {
  key: "left",
  label: "左对齐",
  icon: <AlignLeftOutlined />,
};

const alignItems: AlignmentItem[] = [
  { key: "left", label: "左对齐", icon: <AlignLeftOutlined /> },
  { key: "center", label: "居中", icon: <AlignCenterOutlined /> },
  { key: "right", label: "右对齐", icon: <AlignRightOutlined /> },
  {
    key: "justify",
    label: "两端对齐",
    icon: <AlignLeftOutlined style={{ transform: "scaleX(-1)" }} />,
  },
];

export function useToolbarEditorState(editor: Editor | null) {
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (!editor) return;

    const rerender = () => {
      setVersion((current) => current + 1);
    };

    editor.on("transaction", rerender);
    editor.on("selectionUpdate", rerender);

    return () => {
      editor.off("transaction", rerender);
      editor.off("selectionUpdate", rerender);
    };
  }, [editor]);

  let currentHeadingKey = "0";
  if (editor) {
    for (let i = 1; i <= 6; i += 1) {
      if (editor.isActive("heading", { level: i as 1 | 2 | 3 | 4 | 5 | 6 })) {
        currentHeadingKey = String(i);
        break;
      }
    }
  }

  const currentHeadingLabel = currentHeadingKey === "0" ? "正文" : `标题 ${currentHeadingKey}`;

  const fontSize = editor?.getAttributes("textStyle")?.fontSize;
  const currentFontSize = fontSize ? `${fontSize}px` : "15px";

  const codeLanguage = editor?.isActive("codeBlock")
    ? editor.getAttributes("codeBlock")?.language
    : undefined;
  const currentCodeLanguage =
    typeof codeLanguage === "string" && codeLanguage.trim() ? codeLanguage.trim().toLowerCase() : "text";

  const currentOrderedListType = editor?.isActive("orderedList") ? "decimal" : "decimal";

  const alignmentKey = ((editor?.getAttributes("paragraph")?.textAlign ||
    editor?.getAttributes("heading")?.textAlign ||
    "left") as AlignmentItem["key"]);
  const currentAlignment = alignItems.find((item) => item.key === alignmentKey) ?? defaultAlignment;

  const isActive = (id: string) => {
    if (!editor) return false;

    switch (id) {
      case "bold":
        return editor.isActive("bold");
      case "italic":
        return editor.isActive("italic");
      case "strike":
        return editor.isActive("strike");
      case "underline":
        return editor.isActive("underline");
      case "align-left":
        return currentAlignment.key === "left";
      case "align-center":
        return currentAlignment.key === "center";
      case "align-right":
        return currentAlignment.key === "right";
      case "align-justify":
        return currentAlignment.key === "justify";
      case "bullet-list":
        return editor.isActive("bulletList");
      case "ordered-list":
        return editor.isActive("orderedList");
      case "check-list":
        return editor.isActive("taskList");
      case "blockquote":
        return editor.isActive("blockquote");
      case "code-block":
        return editor.isActive("codeBlock");
      default:
        return false;
    }
  };

  return {
    alignItems,
    currentAlignment,
    currentCodeLanguage,
    currentFontSize,
    currentHeadingKey,
    currentHeadingLabel,
    currentOrderedListType,
    editorReady: Boolean(editor),
    isActive,
  };
}
