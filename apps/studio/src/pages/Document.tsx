import { useParams } from "react-router-dom";
import { DocumentStudio } from "../features/document-studio";

export default function DocumentPage() {
  const { docId } = useParams<{ docId: string }>();
  return <DocumentStudio docId={docId ?? ""} />;
}
