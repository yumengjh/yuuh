import { useCallback, useEffect, useRef, useState } from "react";
import { message } from "antd";
import type { Editor } from "@tiptap/react";
import { defaultBgColor, defaultTextColor } from "./toolbarData";

export function useToolbarActions(editor: Editor | null) {
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [selectedColor, setSelectedColor] = useState(defaultTextColor);
  const [selectedBgColor, setSelectedBgColor] = useState(defaultBgColor);
  const [tooltipOpen, setTooltipOpen] = useState<Record<string, boolean>>({});
  const colorSelectTimeoutRef = useRef<number | null>(null);
  const bgColorSelectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (colorSelectTimeoutRef.current !== null) {
        window.clearTimeout(colorSelectTimeoutRef.current);
      }
      if (bgColorSelectTimeoutRef.current !== null) {
        window.clearTimeout(bgColorSelectTimeoutRef.current);
      }
    };
  }, []);

  const hideTooltip = useCallback((id: string) => {
    setTooltipOpen((current) => ({ ...current, [id]: false }));
  }, []);

  const setTooltipVisible = useCallback((id: string, open: boolean) => {
    setTooltipOpen((current) => ({ ...current, [id]: open }));
  }, []);

  const openLinkModal = useCallback(() => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);
    const existingLink = editor.getAttributes("link");

    setLinkValue(existingLink.href || selectedText || "");
    setLinkModalOpen(true);
  }, [editor]);

  const closeLinkModal = useCallback(() => {
    setLinkModalOpen(false);
    setLinkValue("");
  }, []);

  const applyLink = useCallback(() => {
    if (!editor) return;

    const url = linkValue.trim();
    if (url) {
      const href = /^https?:\/\//.test(url) ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }

    closeLinkModal();
  }, [closeLinkModal, editor, linkValue]);

  const handleToolbarClick = useCallback(
    (id: string) => {
      if (!editor) return;

      switch (id) {
        case "undo":
          editor.chain().focus().undo().run();
          break;
        case "redo":
          editor.chain().focus().redo().run();
          break;
        case "clearFormat":
          editor.chain().focus().unsetAllMarks().clearNodes().run();
          break;
        case "cursor":
          editor.chain().focus().run();
          break;
        case "bold":
          editor.chain().focus().toggleBold().run();
          break;
        case "italic":
          editor.chain().focus().toggleItalic().run();
          break;
        case "strike":
          editor.chain().focus().toggleStrike().run();
          break;
        case "underline":
          editor.chain().focus().toggleUnderline().run();
          break;
        case "align-left":
          editor.chain().focus().setTextAlign("left").run();
          break;
        case "align-center":
          editor.chain().focus().setTextAlign("center").run();
          break;
        case "align-right":
          editor.chain().focus().setTextAlign("right").run();
          break;
        case "align-justify":
          editor.chain().focus().setTextAlign("justify").run();
          break;
        case "bullet-list":
          editor.chain().focus().toggleBulletList().run();
          break;
        case "check-list":
          editor.chain().focus().toggleTaskList().run();
          break;
        case "blockquote":
          editor.chain().focus().toggleBlockquote().run();
          break;
        case "code-block":
          editor.chain().focus().toggleCodeBlock().run();
          break;
        case "link":
          openLinkModal();
          break;
        default:
          break;
      }
    },
    [editor, openLinkModal],
  );

  const handleDropdownSelect = useCallback(
    (id: string, key: string) => {
      if (!editor) return;

      switch (id) {
        case "text-mode": {
          const level = Number(key);
          if (level === 0) {
            editor.chain().focus().setParagraph().run();
          } else if (level >= 1 && level <= 6) {
            editor
              .chain()
              .focus()
              .toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 })
              .run();
          }
          break;
        }
        case "font-size": {
          editor.chain().focus().setFontSize(key.replace("px", "")).run();
          break;
        }
        case "text-align": {
          editor
            .chain()
            .focus()
            .setTextAlign(key as "left" | "center" | "right" | "justify")
            .run();
          break;
        }
        case "ordered-list": {
          if (!editor.isActive("orderedList")) {
            editor.chain().focus().toggleOrderedList().run();
          }

          const listItems = document.querySelectorAll(".tiptap-editor ol li");
          listItems.forEach((item) => {
            (item as HTMLElement).style.listStyleType = key;
          });
          break;
        }
        case "code-language": {
          if (!editor.isActive("codeBlock")) {
            editor.chain().focus().setCodeBlock({ language: key }).run();
            return;
          }
          editor.chain().focus().updateAttributes("codeBlock", { language: key }).run();
          break;
        }
        default:
          break;
      }
    },
    [editor],
  );

  const scheduleColorApply = useCallback(
    (color: string, type: "text" | "background") => {
      if (!editor) return;

      const timeoutRef = type === "background" ? bgColorSelectTimeoutRef : colorSelectTimeoutRef;
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        if (type === "background") {
          editor.chain().focus().toggleHighlight({ color }).run();
          return;
        }
        editor.chain().focus().setColor(color).run();
      }, 300);
    },
    [editor],
  );

  const handleColorSelect = useCallback(
    (color: string) => {
      setSelectedColor(color);
      scheduleColorApply(color, "text");
    },
    [scheduleColorApply],
  );

  const handleBgColorSelect = useCallback(
    (color: string) => {
      setSelectedBgColor(color);
      scheduleColorApply(color, "background");
    },
    [scheduleColorApply],
  );

  const handleGradientSelect = useCallback((gradientId: string) => {
    message.info(`渐变色功能暂未实现，已选择：${gradientId}`);
  }, []);

  return {
    applyLink,
    closeLinkModal,
    handleBgColorSelect,
    handleColorSelect,
    handleDropdownSelect,
    handleGradientSelect,
    handleToolbarClick,
    hideTooltip,
    linkModalOpen,
    linkValue,
    selectedBgColor,
    selectedColor,
    setLinkValue,
    setTooltipVisible,
    tooltipOpen,
  };
}
