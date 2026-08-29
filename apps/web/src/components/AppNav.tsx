import {
  Files,
  Layers3,
  LayoutDashboard,
  MessagesSquare,
  Settings,
} from "lucide-react";
import { NavLink } from "react-router-dom";

interface AppNavProps {
  ariaLabel: string;
  onNavigate?: () => void;
}

const navigationItems = [
  {
    label: "Dashboard",
    to: "/app",
    icon: LayoutDashboard,
    available: true,
  },
  {
    label: "Workspaces",
    to: "/app/workspaces",
    icon: Layers3,
    available: true,
  },
  {
    label: "Documents",
    to: "/app/documents",
    icon: Files,
    available: true,
  },
  {
    label: "Conversations",
    to: "/app/conversations",
    icon: MessagesSquare,
    available: false,
  },
  {
    label: "Settings",
    to: "/app/settings",
    icon: Settings,
    available: false,
  },
] as const;

export function AppNav({ ariaLabel, onNavigate }: AppNavProps) {
  return (
    <nav aria-label={ariaLabel}>
      <ul className="space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;

          return (
            <li key={item.label}>
              {item.available ? (
                <NavLink
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                      isActive
                        ? "bg-indigo-400 text-slate-950"
                        : "text-slate-300 hover:bg-white/5 hover:text-white",
                    ].join(" ")
                  }
                  end={item.to === "/app"}
                  onClick={onNavigate}
                  to={item.to}
                >
                  <Icon aria-hidden="true" size={18} />
                  {item.label}
                </NavLink>
              ) : (
                <span
                  aria-disabled="true"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500"
                >
                  <Icon aria-hidden="true" size={18} />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider">
                    Soon
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
