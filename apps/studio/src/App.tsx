import { Fragment, lazy, Suspense, useEffect, useMemo, type ReactNode } from "react";
import { matchPath, Route, Routes, useLocation } from "react-router-dom";
import { LoadingOutlined } from "@ant-design/icons";
import Header from "./component/Header/Header";
import Toolbar from "./component/Toolbar/Toolbar";
import Footer from "./component/Footer/Footer";
import Sidebar from "./component/Sidebar/Sidebar";
import type { AppRoute } from "./routes";
import { appRoutes, sidebarItems } from "./routes";
import { DataProvider } from "./context/dataContext";
import { DocumentProvider } from "./context/documentContext";
import { EditProvider, useEditContext } from "./context/editContext";
import RequireAuth from "./routes/RequireAuth";
import { tokenManager } from "./api";
import { usePreferenceStore, useSessionStore } from "./store";

import "./App.css";

const NotFound = lazy(() => import("./pages/NotFound"));
const LAST_NON_SETTINGS_PATH_KEY = "app.last_non_settings_path";

function AppContent() {
  const { isEditing } = useEditContext();
  const location = useLocation();
  const workspaceId = useSessionStore((state) => state.workspaceId);
  const bootstrapWorkspaceSession = useSessionStore((state) => state.bootstrapWorkspaceSession);
  const hydratePreferences = usePreferenceStore((state) => state.hydrate);
  const effectiveSettings = usePreferenceStore((state) => state.effectiveSettings);

  const isLoginPage = location.pathname === "/login";
  const isAuthed = tokenManager.isAuthenticated();
  const showShell = isAuthed && !isLoginPage;
  const routeMetaList = useMemo(() => {
    const joinPath = (parentPath: string, childPath: string) => {
      if (childPath.startsWith("/")) return childPath;
      if (!parentPath) return `/${childPath}`.replace(/\/+/g, "/");
      return `${parentPath.replace(/\/+$/, "")}/${childPath.replace(/^\/+/, "")}`.replace(
        /\/+/g,
        "/",
      );
    };
    const walk = (routes: AppRoute[], parentPath = ""): Array<{
      path: string;
      showSidebar?: boolean;
      showHeader?: boolean;
    }> => {
      return routes.flatMap((route) => {
        const currentPath = route.index
          ? parentPath || "/"
          : route.path
            ? joinPath(parentPath, route.path)
            : parentPath || "/";
        const self = route.path || route.index
          ? [{
              path: currentPath,
              showSidebar: route.showSidebar,
              showHeader: route.showHeader,
            }]
          : [];
        if (!route.children?.length) return self;
        return [...self, ...walk(route.children, currentPath)];
      });
    };
    return walk(appRoutes);
  }, []);
  const currentRoute = useMemo(() => {
    return routeMetaList.find((route) =>
      Boolean(matchPath({ path: route.path, end: true }, location.pathname))
    );
  }, [location.pathname, routeMetaList]);
  const showSidebar = showShell && Boolean(currentRoute?.showSidebar);
  const showHeader = showShell && currentRoute?.showHeader !== false;
  const showToolbar = showHeader && showShell && isEditing;
  const isSettingsRoute = Boolean(showShell && location.pathname.startsWith("/settings"));

  const renderRoutes = (
    routes: AppRoute[],
    parentRequiresAuth = false,
  ): ReactNode => {
    return routes.map((route) => {
      const requiresAuth = !route.isPublic;
      const shouldWrapWithAuth = !parentRequiresAuth && requiresAuth;
      const element = shouldWrapWithAuth ? <RequireAuth>{route.element}</RequireAuth> : route.element;
      const nextParentRequiresAuth = parentRequiresAuth || requiresAuth;
      if (route.index) {
        return (
          <Route
            key={route.key}
            index
            element={element}
          />
        );
      }
      return (
        <Route key={route.key} path={route.path} element={element}>
          {route.children?.length ? (
            <Fragment>{renderRoutes(route.children, nextParentRequiresAuth)}</Fragment>
          ) : null}
        </Route>
      );
    });
  };

  useEffect(() => {
    if (!showShell || !isAuthed) return;
    void bootstrapWorkspaceSession();
  }, [bootstrapWorkspaceSession, isAuthed, showShell]);

  useEffect(() => {
    if (!showShell) return;
    void hydratePreferences(workspaceId);
  }, [hydratePreferences, showShell, workspaceId]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty(
      "--app-reader-width",
      `${effectiveSettings.reader.contentWidth}px`
    );
    document.documentElement.style.setProperty(
      "--app-editor-width",
      `${effectiveSettings.editor.contentWidth}px`
    );
    document.documentElement.style.setProperty(
      "--app-reader-font-size",
      `${effectiveSettings.reader.fontSize}px`
    );
    document.documentElement.style.setProperty(
      "--app-editor-font-size",
      `${effectiveSettings.editor.fontSize}px`
    );
    document.documentElement.style.setProperty(
      "--app-doc-code-font",
      effectiveSettings.advanced.codeFontFamily
    );
    document.documentElement.style.setProperty(
      "--app-doc-list-spacing",
      effectiveSettings.advanced.compactList ? "0px" : "8px"
    );
  }, [effectiveSettings]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!showSidebar) {
      document.documentElement.style.setProperty("--sidebar-width", "0px");
    }
  }, [showSidebar]);

  useEffect(() => {
    if (!showShell || typeof window === "undefined") return;
    if (location.pathname.startsWith("/settings")) return;
    const fullPath = `${location.pathname}${location.search}${location.hash}`;
    window.sessionStorage.setItem(LAST_NON_SETTINGS_PATH_KEY, fullPath || "/dash");
  }, [location.hash, location.pathname, location.search, showShell]);

  return (
    <div className={showShell ? "dashboard" : undefined}>
      <div className={showShell ? "dashboard-shell" : undefined}>
        {showSidebar && (
          <div className="dashboard-sidebar">
            <Sidebar items={sidebarItems} />
          </div>
        )}

        <div
          className={
            showShell
              ? `dashboard-main ${showHeader ? "" : "dashboard-main--no-header"}`
              : undefined
          }
        >
          {showHeader && <Header />}
          {showToolbar && (
            <div className="toolbar-container">
              <Toolbar />
            </div>
          )}

          <main
            className={
              showShell
                ? `dashboard-content ${showHeader ? "" : "dashboard-content--no-header"} ${isSettingsRoute ? "dashboard-content--settings" : ""}`
                : undefined
            }
          >
            <Suspense
              fallback={
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "200px",
                  }}
                >
                  <LoadingOutlined style={{ fontSize: 24, color: "#1890ff" }} spin />
                </div>
              }
            >
              <Routes>
                {renderRoutes(appRoutes)}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>

          {showShell && <Footer />}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <DataProvider>
      <DocumentProvider>
        <EditProvider>
          <AppContent />
          {/* <FloatingBall /> */}
        </EditProvider>
      </DocumentProvider>
    </DataProvider>
  );
}

export default App;
