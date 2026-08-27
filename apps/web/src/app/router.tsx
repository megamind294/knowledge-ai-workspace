import { Route, Routes } from "react-router-dom";
import { RequireSession } from "../auth/RequireSession";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/auth/LoginPage";
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { RouteErrorPage } from "./RouteErrorPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<HomePage />} path="/" />
      <Route element={<LoginPage />} path="/login" />
      <Route element={<RequireSession />}>
        <Route element={<DashboardPage />} path="/app" />
      </Route>
      <Route element={<RouteErrorPage />} path="*" />
    </Routes>
  );
}
