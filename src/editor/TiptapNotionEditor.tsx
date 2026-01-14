import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useDocumentEngineStore } from "./useDocumentEngineStore";
import "./tiptap.css";

export default function TiptapNotionEditor() {
  const {
    engine,
    docId,
    blockId,
    markdown,
    docVer,
    initialized,
    init,
    ensureBlock,
    setMarkdown,
    setEditor,
    refresh,
  } = useDocumentEngineStore();

  const syncTimer = useRef<number | null>(null);

  // 初始化文档
  useEffect(() => {
    void init();
  }, [init]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: "像在 Notion / Typora 一样开始记录你的知识吧…",
      }),
    ],
    content: markdown,
    autofocus: "end",
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const normalized = html === "<p></p>" ? "" : html;
      setMarkdown(normalized);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current === markdown) return;
    editor.commands.setContent(markdown || "<p></p>", { emitUpdate: false });
  }, [markdown, editor]);

  // 内容变更时，同步到文档引擎（带防抖）
  useEffect(() => {
    if (!initialized) return;
    const run = async () => {
      const id = blockId ?? (await ensureBlock());
      if (!id) return;

      if (syncTimer.current) {
        window.clearTimeout(syncTimer.current);
      }

      syncTimer.current = window.setTimeout(async () => {
        await engine.updateBlockContent({
          docId,
          blockId: id,
          updatedBy: "u_1",
          payload: {
            schema: { type: "paragraph", ver: 1 },
            body: { richText: { format: "html", source: markdown } },
          },
        });
        await refresh();
      }, 800);
    };

    void run();

    return () => {
      if (syncTimer.current) {
        window.clearTimeout(syncTimer.current);
      }
    };
  }, [markdown, blockId, docId, engine, ensureBlock, refresh, initialized]);

  // 将 Tiptap 实例暴露给全局 store，供 Toolbar 使用
  useEffect(() => {
    if (!editor) return;
    setEditor(editor);
    return () => {
      setEditor(null);
    };
  }, [editor, setEditor]);

  if (!editor) {
    return (
      <div className="tiptap-shell">
        <div className="tiptap-card">正在初始化编辑器…</div>
      </div>
    );
  }

  return (
    <div className="tiptap-shell">
      <div className="tiptap-card">
        <header className="tiptap-header">
          <div className="tiptap-header-main">
            <div className="tiptap-title" contentEditable={false}>
              未命名文档
            </div>
            <p className="tiptap-subtitle">
              {/* 支持标题、列表、代码块、引用等常用结构，所见即所得书写体验。 */}
            </p>
          </div>
          <div className="tiptap-header-meta">
            <span className="tiptap-meta-pill">文档版本 {docVer}</span>
            <span className="tiptap-meta-dot">·</span>
            <span className="tiptap-meta-text">自动保存中</span>
          </div>
        </header>

        <div className="tiptap-editor-wrapper">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

