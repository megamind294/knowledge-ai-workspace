import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { StatePanel } from "../../components/StatePanel";
import { knowledgeQueryKeys } from "../../data/queryKeys";
import { useKnowledgeRepository } from "../../data/useKnowledgeRepository";

export function WorkspaceListPage() {
  const repository = useKnowledgeRepository();
  const workspacesQuery = useQuery({
    queryKey: knowledgeQueryKeys.workspaces,
    queryFn: () => repository.getWorkspaces(),
  });

  return (
    <section className="mx-auto max-w-7xl">
      <PageHeader
        description="Keep collections and documents within clear knowledge boundaries."
        eyebrow="Knowledge library"
        title="Workspaces"
      />
      <div className="mt-8">
        {workspacesQuery.isPending ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-slate-300" role="status">
            Loading workspaces…
          </div>
        ) : null}
        {workspacesQuery.isError ? (
          <StatePanel
            actionLabel="Retry workspaces"
            description="The knowledge repository did not respond. You can safely try again."
            onAction={() => void workspacesQuery.refetch()}
            title="Workspaces unavailable"
          />
        ) : null}
        {workspacesQuery.data?.length === 0 ? (
          <StatePanel
            description="Your first workspace will become the home for related collections and source documents."
            title="No workspaces yet"
          />
        ) : null}
        {workspacesQuery.data && workspacesQuery.data.length > 0 ? (
          <ul className="grid gap-5 lg:grid-cols-2">
            {workspacesQuery.data.map((workspace) => (
              <li key={workspace.id}>
                <Link
                  className="group block h-full rounded-2xl border border-white/10 bg-slate-900/60 p-6 transition hover:border-indigo-300/40 hover:bg-slate-900"
                  to={`/app/workspaces/${workspace.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-white group-hover:text-indigo-300">
                        {workspace.name}
                      </h2>
                      <p className="mt-2 leading-7 text-slate-400">
                        {workspace.description}
                      </p>
                    </div>
                    <span className="rounded-full bg-indigo-400/10 px-2.5 py-1 text-xs font-medium capitalize text-indigo-200">
                      {workspace.role}
                    </span>
                  </div>
                  <p className="mt-6 text-sm text-slate-500">
                    {workspace.collectionCount} collections · {workspace.documentCount} documents
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
