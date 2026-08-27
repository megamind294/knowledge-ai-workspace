import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useDemoSession } from "./useDemoSession";

export function RequireSession() {
  const { user } = useDemoSession();
  const location = useLocation();

  if (!user) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  return <Outlet />;
}
