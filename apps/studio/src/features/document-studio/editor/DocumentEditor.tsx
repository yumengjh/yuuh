import TiptapNotionEditor from "../../../editor/TiptapNotionEditor";

type DocumentEditorProps = {
  docId: string;
};

export default function DocumentEditor({ docId: _docId }: DocumentEditorProps) {
  return <TiptapNotionEditor />;
}
