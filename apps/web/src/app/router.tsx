import { Route, Routes } from "react-router-dom";
import { RequireSession } from "../auth/RequireSession";
import { AppShell } from "../components/AppShell";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/auth/LoginPage";
import { RegisterPage } from "../pages/auth/RegisterPage";
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { CollectionPage } from "../pages/collections/CollectionPage";
import { DocumentDetailPage } from "../pages/documents/DocumentDetailPage";
import { DocumentLibraryPage } from "../pages/documents/DocumentLibraryPage";
import { MockKnowledgePage } from "../pages/knowledge/MockKnowledgePage";
import { WorkspaceListPage } from "../pages/workspaces/WorkspaceListPage";
import { WorkspacePage } from "../pages/workspaces/WorkspacePage";
import { RouteErrorPage } from "./RouteErrorPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<HomePage />} path="/" />
      <Route element={<LoginPage />} path="/login" />
      <Route element={<RegisterPage />} path="/register" />
      <Route element={<RequireSession />}>
        <Route element={<AppShell />}>
          <Route element={<DashboardPage />} path="/app" />
          <Route element={<WorkspaceListPage />} path="/app/workspaces" />
          <Route element={<DocumentLibraryPage />} path="/app/documents" />
          <Route element={<MockKnowledgePage />} path="/app/knowledge" />
          <Route
            element={<DocumentDetailPage />}
            path="/app/documents/:documentId"
          />
          <Route element={<WorkspacePage />} path="/app/workspaces/:workspaceId" />
          <Route
            element={<CollectionPage />}
            path="/app/workspaces/:workspaceId/collections/:collectionId"
          />
        </Route>
      </Route>
      <Route element={<RouteErrorPage />} path="*" />
    </Routes>
  );
}
