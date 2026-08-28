import { Link } from "react-router-dom";
import type { WorkspaceSummary } from "../../domain/knowledge";

interface RecentWorkspaceListProps {
  workspaces: WorkspaceSummary[];
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function RecentWorkspaceList({ workspaces }: RecentWorkspaceListProps) {
  return (
    <section aria-labelledby="recent-workspaces-title" className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-white" id="recent-workspaces-title">
          Recent workspaces
        </h2>
        <Link className="text-sm font-semibold text-indigo-300 hover:text-indigo-200" to="/app/workspaces">
          View all
        </Link>
      </div>
      <ul className="mt-5 divide-y divide-white/10">
        {workspaces.map((workspace) => (
          <li className="py-4 first:pt-0 last:pb-0" key={workspace.id}>
            <Link className="group block" to={`/app/workspaces/${workspace.id}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-100 group-hover:text-indigo-300">
                    {workspace.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-400">
                    {workspace.description}
                  </p>
                </div>
                <span className="rounded-full bg-indigo-400/10 px-2.5 py-1 text-xs font-medium capitalize text-indigo-200">
                  {workspace.role}
                </span>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {workspace.collectionCount} collections · {workspace.documentCount} documents · Updated {dateFormatter.format(new Date(workspace.updatedAt))}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
