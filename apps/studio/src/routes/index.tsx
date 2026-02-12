import { lazy, type ReactNode } from "react";
import { Navigate } from "react-router-dom";

const MainPage = lazy(() => import("../component/Main/main"));
const BlankHomePage = lazy(() => import("../pages/BlankHome"));
const HistoryPage = lazy(() => import("../pages/History"));
const DocumentPage = lazy(() => import("../pages/Document"));
const LoginPage = lazy(() => import("../pages/Login"));
const ApiTestPage = lazy(() => import("../pages/ApiTest"));
const SettingsLayoutPage = lazy(() => import("../pages/settings/SettingsLayoutPage"));
const PreferencesPage = lazy(() => import("../pages/settings/PreferencesPage"));
const ProfileSettingsPage = lazy(() => import("../pages/settings/ProfileSettingsPage"));
const WorkspacesOverviewPage = lazy(() => import("../pages/settings/WorkspacesOverviewPage"));
const WorkspacesListPage = lazy(() => import("../pages/settings/WorkspacesListPage"));
const WorkspaceCreatePage = lazy(() => import("../pages/settings/WorkspaceCreatePage"));
const WorkspaceMembersPage = lazy(() => import("../pages/settings/WorkspaceMembersPage"));

export type AppRoute = {
  key: string;
  label: string;
  path?: string;
  index?: boolean;
  element: ReactNode;
  inSidebar?: boolean;
  showSidebar?: boolean;
  showHeader?: boolean;
  isPublic?: boolean;
  children?: AppRoute[];
};

export const appRoutes: AppRoute[] = [
  {
    key: "home",
    label: "空白页",
    path: "/",
    element: <BlankHomePage />,
    inSidebar: false,
    showSidebar: false,
    showHeader: true,
  },
  {
    key: "dash",
    label: "首页",
    path: "/dash",
    element: <MainPage />,
    inSidebar: true,
    showSidebar: true,
    showHeader: true,
  },
  {
    key: "history",
    label: "历史版本",
    path: "/history",
    element: <HistoryPage />,
    inSidebar: false,
    showSidebar: false,
    showHeader: true,
  },
  {
    key: "api-test",
    label: "接口测试",
    path: "/api-test",
    element: <ApiTestPage />,
    inSidebar: true,
    showSidebar: false,
    showHeader: true,
  },
  {
    key: "settings",
    label: "设置",
    path: "/settings",
    element: <SettingsLayoutPage />,
    inSidebar: false,
    showSidebar: false,
    showHeader: false,
    children: [
      {
        key: "settings-index",
        label: "设置首页",
        index: true,
        element: <Navigate to="/settings/preferences" replace />,
        showSidebar: false,
        showHeader: false,
      },
      {
        key: "settings-preferences",
        label: "偏好设置",
        path: "preferences",
        element: <PreferencesPage />,
        showSidebar: false,
        showHeader: false,
      },
      {
        key: "settings-profile",
        label: "账号信息",
        path: "profile",
        element: <ProfileSettingsPage />,
        showSidebar: false,
        showHeader: false,
      },
      {
        key: "settings-workspaces-overview",
        label: "工作空间概览",
        path: "workspaces/overview",
        element: <WorkspacesOverviewPage />,
        showSidebar: false,
        showHeader: false,
      },
      {
        key: "settings-workspaces-list",
        label: "我的工作空间",
        path: "workspaces/list",
        element: <WorkspacesListPage />,
        showSidebar: false,
        showHeader: false,
      },
      {
        key: "settings-workspaces-create",
        label: "创建工作空间",
        path: "workspaces/create",
        element: <WorkspaceCreatePage />,
        showSidebar: false,
        showHeader: false,
      },
      {
        key: "settings-workspaces-members",
        label: "成员管理",
        path: "workspaces/members",
        element: <WorkspaceMembersPage />,
        showSidebar: false,
        showHeader: false,
      },
    ],
  },
  {
    key: "login",
    label: "登录",
    path: "/login",
    element: <LoginPage />,
    inSidebar: false,
    showSidebar: false,
    showHeader: false,
    isPublic: true,
  },
  {
    key: "document",
    label: "文档",
    path: "/doc/:docId",
    element: <DocumentPage />,
    inSidebar: false,
    showSidebar: true,
    showHeader: true,
  },
];

export const sidebarItems = appRoutes
  .filter((route) => route.inSidebar)
  .map(({ key, label, path }) => ({ key, label, path: path || "/" }));
