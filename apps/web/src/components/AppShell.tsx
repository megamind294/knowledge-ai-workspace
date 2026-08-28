import { LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDemoSession } from "../auth/useDemoSession";
import { AppNav } from "./AppNav";
import { BrandMark } from "./BrandMark";

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, endDemo } = useDemoSession();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  function signOut() {
    endDemo();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <a
        className="fixed left-4 top-4 z-50 -translate-y-20 rounded-lg bg-white px-4 py-2 font-semibold text-slate-950 transition focus:translate-y-0"
        href="#main-content"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-white/10 bg-slate-900/95 px-5 py-6 lg:flex">
        <BrandMark />
        <div className="mt-10 flex-1">
          <AppNav ariaLabel="Primary navigation" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <p className="font-medium text-white">{user?.name}</p>
          <p className="mt-1 text-xs text-slate-400">Local demo preview</p>
          <button
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
            onClick={signOut}
            type="button"
          >
            <LogOut aria-hidden="true" size={16} />
            Sign out of demo
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-slate-950/90 px-5 py-4 backdrop-blur lg:hidden">
        <BrandMark />
        <button
          aria-controls="mobile-navigation"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          className="grid size-11 place-items-center rounded-xl border border-white/10 text-slate-200"
          onClick={() => setMobileOpen((open) => !open)}
          type="button"
        >
          {mobileOpen ? (
            <X aria-hidden="true" size={20} />
          ) : (
            <Menu aria-hidden="true" size={20} />
          )}
        </button>
      </header>

      {mobileOpen ? (
        <div
          className="border-b border-white/10 bg-slate-900 px-5 py-5 lg:hidden"
          id="mobile-navigation"
        >
          <AppNav
            ariaLabel="Mobile navigation"
            onNavigate={() => setMobileOpen(false)}
          />
        </div>
      ) : null}

      <main
        className="min-h-screen px-5 py-8 sm:px-8 lg:ml-72 lg:px-12 lg:py-10"
        id="main-content"
      >
        <Outlet />
      </main>
    </div>
  );
}
