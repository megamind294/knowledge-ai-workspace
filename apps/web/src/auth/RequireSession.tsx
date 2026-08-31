import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useDemoSession } from "./useDemoSession";

export function RequireSession() {
  const { user, status } = useDemoSession();
  const location = useLocation();

  if (status === "restoring") {
    return <div className="grid min-h-screen place-items-center bg-slate-950 text-slate-300" role="status">Restoring secure session…</div>;
  }

  if (!user) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  return <Outlet />;
}
