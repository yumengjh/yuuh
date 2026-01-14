// App.tsx
import { NavLink } from "react-router-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import "./style.css";

import { Tooltip } from "antd";

type SidebarItem = {
  key: string;
  label: string;
  path: string;
};

type SidebarProps = {
  items?: SidebarItem[];
  children?: ReactNode;
};

type DocNode = {
  id: string;
  title: string;
  children?: DocNode[];
};

// 简单的嵌套文档示例数据，后续可以从接口或上下文替换
const docTree: DocNode[] = [
  {
    id: "doc-124",
    title: "文档1",
    children: [
      { id: "doc-124-1", title: "Demo1" },
      { id: "doc-124-2", title: "Demo2" },
      {
        id: "doc-124-3",
        title: "Demo3",
        children: [
          { id: "doc-124-3-1", title: "Demo4" },
          { id: "doc-124-3-2", title: "Demo5" },
        ],
      },
    ],
  },
  {
    id: "doc-collect",
    title: "Demo6",
  },
  {
    id: "doc-note",
    title: "Demo7",
  },
];

export default function Sidebar({ items = [], children }: SidebarProps) {
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(350); // 当前宽度（用于 inline style）
  const [isResizing, setIsResizing] = useState(false); // 鼠标是否在拖拽
  const [isCollapsed, setIsCollapsed] = useState(false); // 视觉上的“折叠”（宽度为 0）
  const defaultWidth = 350;
  const MIN = 250;
  const MAX = 450;
  const HIDE_THRESHOLD = 0;
  const [activeDocId, setActiveDocId] = useState<string>("doc-124");

  // 将当前侧边栏宽度同步到全局 CSS 变量，供 Header / Toolbar 等使用
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-width",
      `${width + 10}px`
    );
  }, [width]);

  // ----- 开始拖拽 -----
  const startResizing = () => {
    // 只有在非折叠下才允许拖拽
    if (isCollapsed) return;
    setIsResizing(true);
    // 禁用 transition，保证拖拽实时无延迟
    if (sidebarRef.current) {
      sidebarRef.current.style.transition = "none";
    }
  };

  // ----- 拖拽中（全局监听） -----
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing) return;
      let newW = e.clientX;
      if (newW < HIDE_THRESHOLD) {
        // 当拖到阈值以下，触发折叠动画（不要马上卸载）
        // 先设置宽度为 0，然后在 transitionend 里做后续处理
        if (sidebarRef.current) {
          // 恢复 transition 设置为折叠动画
          sidebarRef.current.style.transition =
            "width 0.25s ease, padding 0.25s ease, opacity 0.2s ease";
        }
        setWidth(0);
        setIsResizing(false); // 停止拖拽逻辑（避免重复）
        setIsCollapsed(true); // 视觉上标记要折叠（但我们仍保留 DOM）
        return;
      }
      if (newW < MIN) newW = MIN;
      if (newW > MAX) newW = MAX;
      setWidth(newW);
    };

    const onUp = () => {
      if (!isResizing) return;
      setIsResizing(false);
      // 恢复 transition，这样如果用户放开鼠标后我们想做回弹动画就会生效
      if (sidebarRef.current) {
        sidebarRef.current.style.transition = ""; // 还原到 css 中的 transition 规则
      }
      // no other immediate changes here
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizing]);

  // ----- transitionend 事件：在动画结束后做最终处理 -----
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;

    const onTransitionEnd = (ev: TransitionEvent) => {
      // 我们关心 width 过渡结束时（也可检查 propertyName === 'width'）
      if (ev.propertyName !== "width") return;

      if (isCollapsed) {
        // 折叠动画完成后，保持宽度 0，并让侧边栏不可交互（pointer-events）
        // 我们不卸载组件，仅使其不可见/不可交互以避免卡顿
        if (sidebarRef.current) {
          sidebarRef.current.style.pointerEvents = "none";
        }
      } else {
        // 展开动画完成后，确保可以交互
        if (sidebarRef.current) {
          sidebarRef.current.style.pointerEvents = "";
        }
      }
    };

    el.addEventListener("transitionend", onTransitionEnd);
    return () => el.removeEventListener("transitionend", onTransitionEnd);
  }, [isCollapsed]);

  // ----- 点击切换折叠/展开 -----
  const toggle = () => {
    if (!isCollapsed) {
      // 触发折叠动画：设置 transition（使用 CSS 里已存在，但为保险这里可以明确设置）
      if (sidebarRef.current) {
        sidebarRef.current.style.transition =
          "width 0.25s ease, padding 0.25s ease, opacity 0.2s ease";
      }
      setWidth(0);
      setIsCollapsed(true);
    } else {
      // 展开：先允许交互，然后把宽度设回默认值；使用 requestAnimationFrame 保证样式刷新顺序正确
      if (sidebarRef.current) {
        sidebarRef.current.style.pointerEvents = ""; // 允许交互
        // 明确 transition，保证展开有动画
        sidebarRef.current.style.transition =
          "width 0.25s ease, padding 0.25s ease, opacity 0.2s ease";
      }
      setIsCollapsed(false);
      // 使用 rAF 确保 DOM 已渲染 collapsed -> then set width
      requestAnimationFrame(() => {
        setWidth(defaultWidth);
      });
    }
  };

  // ----- 当宽度通过外部逻辑被设置为非零时确保不是 collapsed -----
  useEffect(() => {
    if (width > 0 && isCollapsed) {
      // 说明外部设置恢复了宽度，解除折叠标记
      setIsCollapsed(false);
    }
  }, [width, isCollapsed]);

  const renderDocNode = (node: DocNode, depth: number = 0) => {
    const hasChildren = !!node.children?.length;
    return (
      <div key={node.id} className="doc-node">
        <button
          type="button"
          className={`doc-node-btn ${activeDocId === node.id ? "active" : ""}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => setActiveDocId(node.id)}
        >
          {hasChildren ? (
            <span className="doc-node-arrow">▸</span>
          ) : (
            <span className="doc-node-dot">•</span>
          )}
          <span className="doc-node-title">{node.title}</span>
        </button>
        {hasChildren && (
          <div className="doc-node-children">
            {node.children!.map((child) => renderDocNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-container">
      {/* 永远渲染侧边栏 —— 用类/样式控制可见性与交互 */}
      <div
        ref={sidebarRef}
        className={`sidebar ${isCollapsed ? "collapsed" : ""} ${
          isResizing ? "no-transition" : ""
        }`}
        style={{
          width: width,
          // 当折叠时缩小 padding 以避免内容冲突（和 CSS transition 保持一致）
          paddingLeft: isCollapsed ? 0 : undefined,
          paddingRight: isCollapsed ? 0 : undefined,
          opacity: isCollapsed ? 0 : 1,
        }}
      >
        <div className="sidebar-inner">
          <div className="sidebar-top">
            <div className="sidebar-brand">
              <span className="brand-icon" aria-hidden="true">
                Z
              </span>
              <span className="brand-text">个人知识库</span>
            </div>
            <div className="sidebar-workspace">
              <span className="workspace-icon" aria-hidden="true">
                D
              </span>
              <span className="workspace-name">Demo</span>
              <span className="workspace-meta" aria-hidden="true">
                🌏
              </span>
              <Tooltip title="更多操作" placement="right">
                <button
                  type="button"
                  className="workspace-action"
                  aria-label="更多"
                >
                  ...
                </button>
              </Tooltip>
            </div>
            <div className="sidebar-search-row">
              <div className="sidebar-search">
                <span className="search-icon" aria-hidden="true">
                  #
                </span>
                <input
                  className="search-input"
                  type="text"
                  placeholder="搜索"
                  aria-label="搜索"
                />
                <span className="search-shortcut">Ctrl + J</span>
              </div>
              <Tooltip title="新建文档" placement="right">
                <button type="button" className="search-add" aria-label="新建">
                  +
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="sidebar-fixed">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `fixed-item ${isActive ? "active" : ""}`
              }
            >
              {/* <span className="fixed-icon home" aria-hidden="true" /> */}
              <svg
                viewBox="0 0 1024 1024"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                p-id="6667"
                width="16"
                height="16"
              >
                <path
                  d="M996.087285 487.193252L557.600175 19.815769a62.655677 62.655677 0 0 0-91.443421 0L27.720959 487.193252a62.655677 62.655677 0 0 0 45.721711 105.606375h62.245157v314.715207a116.33122 116.33122 0 0 0 116.177275 116.228591h170.622544v-312.3034a21.398376 21.398376 0 0 1 21.347061-21.347061h136.087515a21.398376 21.398376 0 0 1 21.347061 21.347061v312.559975h170.622545a116.33122 116.33122 0 0 0 116.177275-116.22859v-314.971783h62.245157a62.706992 62.706992 0 0 0 45.773025-105.606375z m-182.425006 31.199551v389.122031a41.821766 41.821766 0 0 1-41.770451 41.821767h-96.215721v-237.896576a95.856515 95.856515 0 0 0-95.753885-95.753885H443.834707a95.856515 95.856515 0 0 0-95.753885 95.753885v238.153151H251.865102a41.821766 41.821766 0 0 1-41.770452-41.821766v-389.378607H100.434387l411.444078-438.58974 411.444078 438.58974z"
                  fill="#8A8A8A"
                  p-id="6668"
                ></path>
              </svg>
              首页
            </NavLink>
            <NavLink
              to="/tool"
              className={({ isActive }) =>
                `fixed-item ${isActive ? "active" : ""}`
              }
            >
              <svg
                viewBox="0 0 1024 1024"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                p-id="7746"
                width="16"
                height="16"
              >
                <path
                  d="M814.933333 1009.066667c-38.4 0-74.666667-14.933333-104.533333-42.666667l-258.133333-256 76.8-76.8 12.8 12.8 29.866666-29.866667 46.933334 46.933334-46.933334 46.933333 196.266667 196.266667c23.466667 23.466667 64 23.466667 89.6 0l53.333333-53.333334c25.6-25.6 25.6-64 0-89.6l-196.266666-196.266666-46.933334 46.933333-46.933333-46.933333 29.866667-29.866667-10.666667-14.933333 76.8-76.8 256 258.133333c57.6 57.6 57.6 151.466667 0 209.066667l-53.333333 53.333333c-29.866667 29.866667-66.133333 42.666667-104.533334 42.666667zM328.533333 490.666667l-85.333333-83.2-113.066667-59.733334L6.4 189.866667 196.266667 0l157.866666 123.733333 59.733334 115.2 89.6 87.466667-59.733334 61.866667-130.133333-130.133334 10.666667-8.533333-36.266667-70.4-85.333333-64-81.066667 81.066667 64 85.333333 70.4 36.266667 8.533333-10.666667 123.733334 123.733333z"
                  p-id="7747"
                  fill="#a2a4a7"
                ></path>
                <path
                  d="M179.2 1009.066667c-29.866667 0-57.6-10.666667-81.066667-34.133334l-53.333333-53.333333c-44.8-44.8-44.8-117.333333 0-162.133333l452.266667-452.266667c-12.8-83.2 12.8-166.4 72.533333-226.133333C650.666667 0 772.266667-19.2 874.666667 34.133333l51.2 27.733334-149.333334 149.333333 32 32 149.333334-149.333333 27.733333 51.2c53.333333 102.4 34.133333 224-46.933333 305.066666-59.733333 59.733333-145.066667 85.333333-226.133334 72.533334L260.266667 977.066667c-21.333333 21.333333-51.2 32-81.066667 32z m576-917.333334c-44.8 0-89.6 17.066667-123.733333 51.2-44.8 44.8-61.866667 108.8-44.8 168.533334l6.4 23.466666L106.666667 821.333333c-10.666667 10.666667-10.666667 29.866667 0 40.533334l53.333333 53.333333c10.666667 10.666667 29.866667 10.666667 40.533333 0l486.4-486.4 23.466667 6.4c59.733333 17.066667 125.866667-2.133333 168.533333-44.8 38.4-38.4 57.6-93.866667 51.2-145.066667L810.666667 364.8 657.066667 213.333333l119.466666-119.466666c-6.4-2.133333-14.933333-2.133333-21.333333-2.133334z"
                  p-id="7748"
                  fill="#a2a4a7"
                ></path>
              </svg>
              工具
            </NavLink>
            <NavLink
              to="/history"
              className={({ isActive }) =>
                `fixed-item ${isActive ? "active" : ""}`
              }
            >
              <svg
                viewBox="0 0 1060 1024"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                p-id="9012"
                id="mx_n_1768398598285"
                width="16"
                height="16"
              >
                <path
                  d="M515.762599 958.870845c246.966761 0 447.17029-200.203529 447.17029-447.170289 0-246.966761-200.203529-447.17029-447.17029-447.17029-246.966761 0-447.17029 200.203529-447.170289 447.17029 0 246.966761 200.203529 447.17029 447.170289 447.170289z m0 63.88147c-282.251292 0-511.051759-228.800468-511.051759-511.051759 0-282.251292 228.800468-511.051759 511.051759-511.05176 282.238815 0 511.051759 228.800468 511.05176 511.05176 0 282.251292-228.800468 511.051759-511.05176 511.051759z m0 0"
                  fill="#a2a4a7"
                  p-id="9013"
                ></path>
                <path
                  d="M547.703334 192.293206c0-17.642265-14.29847-31.940735-31.940735-31.940735s-31.940735 14.29847-31.940735 31.940735v343.362901c0 9.195438 3.955161 17.954187 10.85486 24.017935l191.644409 167.688859c13.262891 11.640901 33.462911 10.318355 45.103812-2.93206 11.640901-13.262891 10.318355-33.462911-2.93206-45.103811L547.703334 521.158008V192.293206z m0 0"
                  fill="#a2a4a7"
                  p-id="9014"
                ></path>
              </svg>
              历史版本
            </NavLink>
          </div>

          <div className="sidebar-scroll">
            <div className="doc-tree">
              {docTree.map((node) => renderDocNode(node))}
            </div>
          </div>
        </div>
      </div>

      {/* 拖拽条（始终存在） */}
      <div
        className={`resizer ${isCollapsed ? "collapsed" : ""}`}
        onMouseDown={isCollapsed ? undefined : startResizing}
      >
        <div className="split"></div>
        <Tooltip
          title={isCollapsed ? "展开侧边栏" : "折叠侧边栏"}
          placement="right"
        >
          <button
            type="button"
            className="toggle-btn"
            onClick={toggle}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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
