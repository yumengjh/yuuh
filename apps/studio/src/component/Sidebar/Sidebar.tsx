import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Avatar, Button, Dropdown, Input, Tooltip, message, type MenuProps } from "antd";
import {
  BookOutlined,
  FileTextOutlined,
  HomeOutlined,
  LoadingOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useDocumentContext } from "../../context/documentContext";
import { apiV1 } from "../../api_v1";
import { useSessionStore } from "../../store";
import "./style.css";

const DEFAULT_WIDTH = 350;
const MIN_WIDTH = 250;
const MAX_WIDTH = 420;
const COLLAPSE_THRESHOLD = 120;
const SIDEBAR_LAYOUT_STORAGE_KEY = "app.sidebar.layout.v1";

type PersistedSidebarLayout = {
  width: number;
  isCollapsed: boolean;
  lastExpandedWidth: number;
};

const clampExpandedWidth = (value: number): number => {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, value));
};

const readPersistedSidebarLayout = (): PersistedSidebarLayout => {
  const fallback: PersistedSidebarLayout = {
    width: DEFAULT_WIDTH,
    isCollapsed: false,
    lastExpandedWidth: DEFAULT_WIDTH,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(SIDEBAR_LAYOUT_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedSidebarLayout>;
    const isCollapsed = Boolean(parsed.isCollapsed);
    const safeLastExpandedWidth = Number.isFinite(parsed.lastExpandedWidth)
      ? clampExpandedWidth(Number(parsed.lastExpandedWidth))
      : DEFAULT_WIDTH;
    const rawWidth = Number(parsed.width);
    const safeWidth = isCollapsed
      ? 0
      : Number.isFinite(rawWidth) && rawWidth > 0
        ? clampExpandedWidth(rawWidth)
        : safeLastExpandedWidth;
    return {
      width: safeWidth,
      isCollapsed,
      lastExpandedWidth: safeLastExpandedWidth,
    };
  } catch {
    return fallback;
  }
};

const writePersistedSidebarLayout = (layout: PersistedSidebarLayout) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIDEBAR_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore localStorage write failures
  }
};

type SidebarItem = {
  key: string;
  label: string;
  path: string;
};

type SidebarProps = {
  items?: SidebarItem[];
  children?: ReactNode;
};

const generateUUID = (): string => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const arr = new Uint8Array(16);
    globalThis.crypto.getRandomValues(arr);
    return Array.from(arr)
      .map((item) => item.toString(16).padStart(2, "0"))
      .join("");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
};

export default function Sidebar({ items: _items = [] }: SidebarProps) {
  const navigate = useNavigate();
  const { addDocument, switchDocument } = useDocumentContext();
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const initialLayout = useMemo(() => readPersistedSidebarLayout(), []);
  const currentDocId = useSessionStore((state) => state.docId);
  const workspaceId = useSessionStore((state) => state.workspaceId);
  const currentWorkspace = useSessionStore((state) => state.currentWorkspace);
  const docList = useSessionStore((state) => state.docList);
  const docListStatus = useSessionStore((state) => state.status.docList);
  const docError = useSessionStore((state) => state.errors.doc);

  const [searchValue, setSearchValue] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(initialLayout.width);
  const [isResizing, setIsResizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(initialLayout.isCollapsed);
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [selectedDocKey, setSelectedDocKey] = useState<string | null>(currentDocId);
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState("当前用户");
  const [currentUserSubText, setCurrentUserSubText] = useState("加载中...");
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const lastExpandedWidthRef = useRef(initialLayout.lastExpandedWidth);

  useEffect(() => {
    setSelectedDocKey(currentDocId);
  }, [currentDocId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const me = await apiV1.auth.me();
        if (cancelled) return;
        const displayName = me.displayName?.trim() || me.username?.trim() || "当前用户";
        const subText = me.email?.trim() || me.username?.trim() || "未设置邮箱";
        setCurrentUserDisplayName(displayName);
        setCurrentUserSubText(subText);
        setCurrentUserAvatar(me.avatar || null);
      } catch {
        if (cancelled) return;
        setCurrentUserDisplayName("当前用户");
        setCurrentUserSubText("资料加载失败");
        setCurrentUserAvatar(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const width = isCollapsed ? 0 : sidebarWidth + 14;
    document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
  }, [isCollapsed, sidebarWidth]);

  useEffect(() => {
    if (isCollapsed || sidebarWidth <= 0) return;
    lastExpandedWidthRef.current = clampExpandedWidth(sidebarWidth);
  }, [isCollapsed, sidebarWidth]);

  useEffect(() => {
    writePersistedSidebarLayout({
      width: isCollapsed ? 0 : sidebarWidth,
      isCollapsed,
      lastExpandedWidth: lastExpandedWidthRef.current,
    });
  }, [isCollapsed, sidebarWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (event: MouseEvent) => {
      let nextWidth = event.clientX;
      if (nextWidth < COLLAPSE_THRESHOLD) {
        nextWidth = 0;
      }
      nextWidth = Math.max(0, Math.min(MAX_WIDTH, nextWidth));
      if (nextWidth === 0) {
        setIsCollapsed(true);
        setSidebarWidth(0);
        return;
      }
      if (nextWidth < MIN_WIDTH) {
        nextWidth = MIN_WIDTH;
      }
      lastExpandedWidthRef.current = nextWidth;
      setIsCollapsed(false);
      setSidebarWidth(nextWidth);
    };

    const onMouseUp = () => {
      setIsResizing(false);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isResizing]);

  const startResizing = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (isCollapsed) return;
    const target = event.target as HTMLElement;
    if (target.closest(".toggle-btn")) return;
    setIsResizing(true);
  };

  const toggleSidebar = () => {
    if (isCollapsed) {
      const restoreWidth = clampExpandedWidth(lastExpandedWidthRef.current || DEFAULT_WIDTH);
      setIsCollapsed(false);
      setSidebarWidth(restoreWidth);
      return;
    }
    lastExpandedWidthRef.current = sidebarWidth > 0 ? sidebarWidth : DEFAULT_WIDTH;
    setIsCollapsed(true);
    setSidebarWidth(0);
  };

  const filteredDocs = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) return docList;
    return docList.filter((doc) => (doc.title || "").toLowerCase().includes(keyword));
  }, [docList, searchValue]);

  const navItems: SidebarItem[] =
    _items.length > 0
      ? _items
      : [
          { key: "dash", label: "首页", path: "/dash" },
          { key: "api-test", label: "接口测试", path: "/api-test" },
        ];

  const workspaceMenuItems: MenuProps["items"] = [
    {
      key: "workspace-detail",
      label: "工作空间设置",
      onClick: () => navigate("/settings/workspaces/overview"),
    },
    {
      key: "members",
      label: "成员管理",
      onClick: () => navigate("/settings/workspaces/members"),
    },
    {
      key: "settings",
      label: "偏好设置",
      onClick: () => navigate("/settings/preferences"),
    },
  ];

  const createDocMenuItems: MenuProps["items"] = [
    { key: "document", label: "新建文档" },
    { key: "table", label: "新建表格（预留）" },
    { key: "canvas", label: "新建画板（预留）" },
  ];

  const getDocNodeMenu = (docId: string): MenuProps["items"] => [
    {
      key: "copy-link",
      label: "复制链接",
      onClick: () => {
        const url = `${window.location.origin}/doc/${docId}`;
        void navigator.clipboard.writeText(url);
        message.success("文档链接已复制");
      },
    },
  ];

  const handleDocSelect = async (docId: string) => {
    if (openingDocId === docId || creatingDoc) return;
    setSelectedDocKey(docId);
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

  const handleCreateDocument = async () => {
    if (creatingDoc) return;
    if (!workspaceId) {
      message.warning("请先选择工作空间，再创建文档");
      navigate("/settings/workspaces/list");
      return;
    }
    const newDocId = generateUUID();
    setCreatingDoc(true);
    try {
      const createdDocId = await addDocument(newDocId, "未命名文档");
      navigate(`/doc/${createdDocId}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "创建文档失败";
      message.error(msg);
    } finally {
      setCreatingDoc(false);
    }
  };

  return (
    <div className="app-container">
      <div
        ref={sidebarRef}
        className={`sidebar ${isCollapsed ? "collapsed" : ""} ${isResizing ? "no-transition" : ""}`}
        style={{
          width: isCollapsed ? 0 : sidebarWidth,
          opacity: isCollapsed ? 0 : 1,
          pointerEvents: isCollapsed ? "none" : "auto",
        }}
      >
        <div className="sidebar-inner">
          <div className="sidebar-top">
            <div className="sidebar-user-summary">
              <Avatar
                size={28}
                src={currentUserAvatar || undefined}
                icon={!currentUserAvatar ? <UserOutlined /> : undefined}
                className="sidebar-user-summary__avatar"
              />
              <div className="sidebar-user-summary__text">
                <span className="sidebar-user-summary__name">{currentUserDisplayName}</span>
                <span className="sidebar-user-summary__sub">{currentUserSubText}</span>
              </div>
            </div>

            <div className="sidebar-workspace">
              <BookOutlined className="workspace-icon" />
              <span className="workspace-name">{currentWorkspace?.name || "未选择工作空间"}</span>
              <Dropdown menu={{ items: workspaceMenuItems }} trigger={["click"]} placement="bottomLeft">
                <Button type="text" size="small" icon={<MoreOutlined />} className="workspace-more" />
              </Dropdown>
            </div>

            <div className="sidebar-search-row">
              <div className="sidebar-search-wrapper">
                <SearchOutlined className="search-icon" />
                <Input
                  placeholder="搜索文档"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="sidebar-search-input"
                  bordered={false}
                />
              </div>
              <Dropdown
                menu={{
                  items: createDocMenuItems,
                  onClick: () => void handleCreateDocument(),
                }}
                trigger={["click"]}
              >
                <Button type="text" size="small" icon={<PlusOutlined />} className="search-add-btn" loading={creatingDoc} />
              </Dropdown>
            </div>
          </div>

          <div className="sidebar-fixed">
            {navItems.map((item) => (
              <NavLink key={item.key} to={item.path} className={({ isActive }) => `fixed-item ${isActive ? "active" : ""}`}>
                {(item.key === "home" || item.key === "dash") && <HomeOutlined />}
                {item.key === "api-test" && <ToolOutlined />}
                {item.key !== "home" &&
                  item.key !== "dash" &&
                  item.key !== "api-test" &&
                  <HomeOutlined />}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>

          <div className="sidebar-scroll">
            <div className="documents-section">
              <div className="documents-header">
                <span className="documents-title">文档列表</span>
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  className="new-doc-btn"
                  loading={creatingDoc}
                  onClick={() => void handleCreateDocument()}
                />
              </div>

              <div className="documents-list">
                {docListStatus === "loading" && (
                  <div className="document-loading-row">
                    <LoadingOutlined className="document-icon" />
                    <span className="document-title">文档加载中...</span>
                  </div>
                )}
                {filteredDocs.map((doc) => (
                  <div
                    key={doc.docId}
                    className={`document-item ${selectedDocKey === doc.docId ? "active" : ""} ${openingDocId === doc.docId ? "loading" : ""}`}
                    onClick={() => void handleDocSelect(doc.docId)}
                  >
                    {openingDocId === doc.docId ? (
                      <LoadingOutlined className="document-icon" />
                    ) : (
                      <FileTextOutlined className="document-icon" />
                    )}
                    <span className="document-title">{doc.title || "未命名文档"}</span>
                    <Dropdown menu={{ items: getDocNodeMenu(doc.docId) }} trigger={["click"]}>
                      <Button
                        type="text"
                        size="small"
                        icon={<MoreOutlined />}
                        className="document-action-btn"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Dropdown>
                  </div>
                ))}
                {filteredDocs.length === 0 && (
                  <div className="document-item">
                    <span className="document-title">{docListStatus === "loading" ? "加载中..." : "暂无文档"}</span>
                  </div>
                )}
                {docListStatus === "error" && docError && (
                  <div className="document-item">
                    <span className="document-title">{docError}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`resizer ${isCollapsed ? "collapsed" : ""}`} onMouseDown={startResizing}>
        <div className="split" />
        <Tooltip title={isCollapsed ? "展开侧边栏" : "折叠侧边栏"} placement="right">
          <button
            type="button"
            className="toggle-btn"
            onClick={toggleSidebar}
            aria-expanded={!isCollapsed}
          >
            <svg
              className={`icon ${isCollapsed ? "collapsed" : ""}`}
              viewBox="0 0 1024 1024"
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M753.613 996.727l-484.233-485.222 485.222-484.233z"
                fill="currentColor"
              />
            </svg>
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
