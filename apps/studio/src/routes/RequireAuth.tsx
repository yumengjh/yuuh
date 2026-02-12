import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { tokenManager } from "../api";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isAuthed = tokenManager.isAuthenticated();

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
