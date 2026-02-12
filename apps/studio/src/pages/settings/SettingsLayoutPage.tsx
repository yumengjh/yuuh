import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Menu, Typography, type MenuProps } from "antd";
import { useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import "./SettingsLayoutPage.css";

const LAST_NON_SETTINGS_PATH_KEY = "app.last_non_settings_path";

const menuItems: MenuProps["items"] = [
  {
    key: "group-preferences",
    type: "group",
    label: "体验设置",
    children: [
      {
        key: "/settings/profile",
        label: "账号信息",
      },
      {
        key: "/settings/preferences",
        label: "偏好设置",
      },
    ],
  },
  {
    key: "group-workspaces",
    type: "group",
    label: "工作空间管理",
    children: [
      {
        key: "/settings/workspaces/overview",
        label: "工作空间概览",
      },
      {
        key: "/settings/workspaces/list",
        label: "我的工作空间",
      },
      {
        key: "/settings/workspaces/create",
        label: "创建工作空间",
      },
      {
        key: "/settings/workspaces/members",
        label: "成员管理",
      },
    ],
  },
] as const;

const resolveSelectedKey = (pathname: string) => {
  if (pathname.startsWith("/settings/profile")) return "/settings/profile";
  if (pathname.startsWith("/settings/workspaces/overview")) return "/settings/workspaces/overview";
  if (pathname.startsWith("/settings/workspaces/list")) return "/settings/workspaces/list";
  if (pathname.startsWith("/settings/workspaces/create")) return "/settings/workspaces/create";
  if (pathname.startsWith("/settings/workspaces/members")) return "/settings/workspaces/members";
  return "/settings/preferences";
};

export default function SettingsLayoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedKey = useMemo(() => resolveSelectedKey(location.pathname), [location.pathname]);

  const onBack = () => {
    if (typeof window === "undefined") {
      navigate("/dash");
      return;
    }
    const target = window.sessionStorage.getItem(LAST_NON_SETTINGS_PATH_KEY) || "/dash";
    if (target.startsWith("/settings")) {
      navigate("/dash");
      return;
    }
    navigate(target);
  };

  return (
    <div className="settings-shell-page">
      <div className="settings-shell-header">
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
          返回
        </Button>
        <div className="settings-shell-header-text">
          <Typography.Title level={4} style={{ margin: 0 }}>
            设置中心
          </Typography.Title>
          {/* <Typography.Text type="secondary">
            统一管理偏好设置与工作空间管理能力
          </Typography.Text> */}
        </div>
      </div>

      <div className="settings-shell-body">
        <aside className="settings-shell-sider">
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => navigate(String(key))}
          />
        </aside>
        <section className="settings-shell-content">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
