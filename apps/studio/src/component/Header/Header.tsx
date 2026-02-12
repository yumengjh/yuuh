import "./style.css";
import { Tooltip, Button, Tag, Space, message } from "antd";
import {
  StarOutlined,
  UserOutlined,
  BellOutlined,
  ShareAltOutlined,
  HistoryOutlined,
  LockOutlined,
  EditOutlined,
  ReloadOutlined,
  CloudUploadOutlined,
  FormOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import { useEditContext } from "../../context/editContext";
import { getEditorSyncBridge } from "../../editor/editorSyncBridge";
import { useSessionStore } from "../../store";
import DocumentMetaModal from "./DocumentMetaModal";

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isEditing, setIsEditing } = useEditContext();
  const isDocPage = Boolean(matchPath("/doc/:docId", location.pathname));

  const currentDoc = useSessionStore((state) => state.currentDoc);
  const currentWorkspace = useSessionStore((state) => state.currentWorkspace);
  const currentDocId = useSessionStore((state) => state.docId);
  const pendingCount = useSessionStore((state) => state.pendingCount);
  const pendingStatus = useSessionStore((state) => state.status.pending);
  const publishStatus = useSessionStore((state) => state.status.publish);
  const refreshPendingCount = useSessionStore((state) => state.refreshPendingCount);
  const publishDoc = useSessionStore((state) => state.publishDoc);
  const commitCurrentDoc = useSessionStore((state) => state.commitCurrentDoc);

  const [finishing, setFinishing] = useState(false);
  const [docMetaModalOpen, setDocMetaModalOpen] = useState(false);

  const publishedHead = typeof currentDoc?.publishedHead === "number" ? currentDoc.publishedHead : 0;
  const publishStatusLabel = publishedHead > 0 ? `已发布 v${publishedHead}` : "未发布";
  const userRole = (currentWorkspace?.userRole || "").toLowerCase();
  const canPublishByRole = !userRole || ["owner", "admin", "editor"].includes(userRole);

  const onRefreshPending = async () => {
    const targetDocId = currentDoc?.docId || currentDocId;
    if (!targetDocId) {
      message.warning("请先进入文档，再获取 Pending 数");
      return;
    }
    const count = await refreshPendingCount(targetDocId);
    const latestError = useSessionStore.getState().errors.pending;
    if (latestError) {
      message.error(latestError);
      return;
    }
    message.success(`Pending 数已更新：${count}`);
  };

  const onPublishCurrentDoc = async () => {
    const targetDocId = currentDoc?.docId || currentDocId;
    if (!targetDocId) {
      message.warning("请先进入文档，再执行发布");
      return;
    }
    const published = await publishDoc(targetDocId);
    const latestError = useSessionStore.getState().errors.publish;
    if (latestError) {
      message.error(latestError);
      return;
    }
    const version = published?.publishedHead ?? useSessionStore.getState().currentDoc?.publishedHead;
    if (typeof version === "number" && version > 0) {
      message.success(`发布成功，当前发布版本 v${version}`);
      return;
    }
    message.success("发布成功");
  };

  const onOpenHistory = () => {
    const targetDocId = currentDoc?.docId || currentDocId;
    if (!targetDocId) {
      navigate("/history");
      return;
    }
    navigate(`/history?docId=${encodeURIComponent(targetDocId)}`);
  };

  const onToggleEdit = async () => {
    if (!isDocPage) {
      setIsEditing(!isEditing);
      return;
    }

    if (!isEditing) {
      setIsEditing(true);
      return;
    }

    if (finishing) return;

    const targetDocId = currentDoc?.docId || currentDocId;
    if (!targetDocId) {
      message.warning("请先进入文档再完成编辑");
      return;
    }

    setFinishing(true);
    try {
      const syncBridge = getEditorSyncBridge();
      if (syncBridge) {
        await syncBridge.flushAutoSync();
      }

      const committed = await commitCurrentDoc("auto commit on complete", targetDocId);
      if (!committed) {
        const latestError = useSessionStore.getState().errors.pending;
        message.error(latestError || "提交版本失败，请稍后重试");
        return;
      }

      setIsEditing(false);
      message.success("已完成编辑");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "完成编辑失败";
      message.error(msg);
    } finally {
      setFinishing(false);
    }
  };

  const onOpenDocMetaModal = () => {
    const targetDocId = currentDoc?.docId || currentDocId;
    if (!targetDocId || !currentDoc) {
      message.warning("请先进入文档后再编辑文档信息");
      return;
    }
    setDocMetaModalOpen(true);
  };

  return (
    <>
      <header className="header">
        <div className="header-left">
          <span className="header-title">{currentDoc?.title || "未命名文档"}</span>
          <span className="header-lock">
            <LockOutlined />
          </span>
          {isDocPage && (
            <Button
              type="text"
              icon={<HistoryOutlined />}
              className="header-history-btn"
              onClick={onOpenHistory}
            >
              查看历史
            </Button>
          )}
        </div>

        <div className="header-right">
          <Space size={8}>
            <Tag className="header-badge" color="blue">
              {currentWorkspace?.name || "未选择工作空间"}
            </Tag>
            <Tag color={pendingCount > 0 ? "orange" : "default"}>Pending {pendingCount}</Tag>
            {isDocPage && <Tag color={publishedHead > 0 ? "green" : "default"}>{publishStatusLabel}</Tag>}
            <Tooltip title="手动获取 Pending 数" placement="bottom">
              <Button
                type="text"
                icon={<ReloadOutlined />}
                className="icon-btn"
                aria-label="refresh-pending"
                loading={pendingStatus === "loading"}
                onClick={() => {
                  void onRefreshPending();
                }}
              />
            </Tooltip>
          </Space>

          <Tooltip title="收藏" placement="bottom">
            <Button type="text" icon={<StarOutlined />} className="icon-btn" aria-label="star" />
          </Tooltip>

          <Tooltip title="用户" placement="bottom">
            <Button type="text" icon={<UserOutlined />} className="icon-btn" aria-label="user" />
          </Tooltip>

          <Tooltip title="通知" placement="bottom">
            <Button type="text" icon={<BellOutlined />} className="icon-btn" aria-label="notify" />
          </Tooltip>

          <Tooltip title="分享" placement="bottom">
            <Button type="text" icon={<ShareAltOutlined />} className="icon-btn" aria-label="share" />
          </Tooltip>

          {isDocPage && (
            <Tooltip title="编辑文档信息" placement="bottom">
              <Button
                type="default"
                icon={<FormOutlined />}
                className="btn"
                onClick={onOpenDocMetaModal}
              >
                文档信息
              </Button>
            </Tooltip>
          )}

          {isDocPage && (
            <Tooltip title={canPublishByRole ? "发布当前文档" : "当前角色无发布权限"} placement="bottom">
              <Button
                type="default"
                icon={<CloudUploadOutlined />}
                className="btn"
                loading={publishStatus === "loading"}
                disabled={!canPublishByRole}
                onClick={() => {
                  void onPublishCurrentDoc();
                }}
              >
                发布
              </Button>
            </Tooltip>
          )}
          {isDocPage && !canPublishByRole && <span className="publish-permission-tip">当前角色无发布权限</span>}

          {isDocPage && (
            <Tooltip title={isEditing ? "退出编辑" : "点击开始编辑"} placement="bottom">
              <Button
                type="default"
                icon={<EditOutlined />}
                className={`btn header-edit-btn ${isEditing ? "header-edit-btn-finish" : "header-edit-btn-edit"}`}
                loading={finishing}
                onClick={() => {
                  void onToggleEdit();
                }}
              >
                {isEditing ? "完成" : "编辑"}
              </Button>
            </Tooltip>
          )}
        </div>
      </header>

      <DocumentMetaModal
        open={docMetaModalOpen}
        onClose={() => {
          setDocMetaModalOpen(false);
        }}
        currentDoc={currentDoc}
        fallbackDocId={currentDocId}
        workspaceId={currentWorkspace?.workspaceId}
      />
    </>
  );
}
