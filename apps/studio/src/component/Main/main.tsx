import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Tabs, Dropdown, message, type MenuProps } from "antd";
import {
  FileTextOutlined,
  LoadingOutlined,
  MoreOutlined,
  EditOutlined,
  CopyOutlined,
  LinkOutlined,
  ExportOutlined,
  DeleteOutlined,
  DownOutlined,
} from "@ant-design/icons";
import { useEditContext } from "../../context/editContext";
import { useDocumentContext } from "../../context/documentContext";
import { useSessionStore } from "../../store";
import "./style.css";

export default function MainPage() {
  const { setIsEditing } = useEditContext();
  const { switchDocument } = useDocumentContext();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("edited");
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const docList = useSessionStore((state) => state.docList);
  const docListStatus = useSessionStore((state) => state.status.docList);
  const docError = useSessionStore((state) => state.errors.doc);
  const currentWorkspace = useSessionStore((state) => state.currentWorkspace);

  const handleDocClick = async (docId: string) => {
    if (openingDocId === docId) return;
    setOpeningDocId(docId);
    try {
      await switchDocument(docId);
      navigate(`/doc/${docId}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "打开文档失败";
      message.error(msg);
    } finally {
      setOpeningDocId(null);
    }
  };

  const getDocMenu = (docId: string): MenuProps["items"] => [
    {
      key: "edit",
      label: "编辑",
      icon: <EditOutlined />,
      onClick: () => {
        void handleDocClick(docId);
        setTimeout(() => setIsEditing(true), 100);
      },
    },
    {
      key: "copy-link",
      label: "复制链接",
      icon: <LinkOutlined />,
      onClick: () => {
        const url = `${window.location.origin}/doc/${docId}`;
        void navigator.clipboard.writeText(url);
      },
    },
    { type: "divider" },
    {
      key: "duplicate",
      label: "复制...",
      icon: <CopyOutlined />,
    },
    {
      key: "export",
      label: "导出...",
      icon: <ExportOutlined />,
    },
    { type: "divider" },
    {
      key: "delete",
      label: "删除",
      icon: <DeleteOutlined />,
      danger: true,
    },
  ];

  const formatDate = (value?: string) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return `${(date.getMonth() + 1).toString().padStart(2, "0")}-${date
      .getDate()
      .toString()
      .padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="main-page">
      <div className="main-header">
        <h1 className="main-title">开始</h1>
      </div>

      <div className="main-content">
        <div className="documents-section">
          <div className="documents-header">
            <h2 className="documents-title">文档</h2>
            <div className="documents-filters">
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                  { key: "edited", label: "编辑过" },
                  { key: "browsed", label: "浏览过" },
                  { key: "liked", label: "我点赞的" },
                ]}
                size="small"
              />
              <div className="documents-sort">
                <Dropdown menu={{ items: [{ key: "all", label: "全部类型" }] }} trigger={["click"]}>
                  <Button type="text" size="small">
                    类型 <DownOutlined />
                  </Button>
                </Dropdown>
              </div>
            </div>
          </div>

          <div className="documents-list">
            {docListStatus === "loading" && <div className="documents-loading">文档加载中...</div>}
            {docList.map((doc) => (
              <div
                key={doc.docId}
                className={`document-row ${openingDocId === doc.docId ? "loading" : ""}`}
                onClick={() => void handleDocClick(doc.docId)}
              >
                {openingDocId === doc.docId ? (
                  <LoadingOutlined className="document-row-icon" />
                ) : (
                  <FileTextOutlined className="document-row-icon" />
                )}
                <span className="document-row-title">{doc.title || "未命名文档"}</span>
                <span className="document-row-path">{currentWorkspace?.name || "未选择工作空间"}</span>
                <span className="document-row-date">{formatDate(doc.updatedAt || doc.createdAt)}</span>
                <Dropdown menu={{ items: getDocMenu(doc.docId) }} trigger={["click"]}>
                  <Button
                    type="text"
                    size="small"
                    icon={<MoreOutlined />}
                    className="document-row-action"
                    onClick={(e) => e.stopPropagation()}
                  />
                </Dropdown>
              </div>
            ))}
            {docListStatus !== "loading" && docList.length === 0 && (
              <div className="documents-empty">{docError || "暂无文档"}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
