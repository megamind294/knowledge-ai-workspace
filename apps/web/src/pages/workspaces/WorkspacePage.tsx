import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { StatePanel } from "../../components/StatePanel";
import { knowledgeQueryKeys } from "../../data/queryKeys";
import { useKnowledgeRepository } from "../../data/useKnowledgeRepository";

export function WorkspacePage() {
  const { workspaceId = "" } = useParams();
  const repository = useKnowledgeRepository();
  const workspaceQuery = useQuery({
    queryKey: knowledgeQueryKeys.workspace(workspaceId),
    queryFn: async () => {
      const workspace = await repository.getWorkspace(workspaceId);
      const collections = workspace
        ? await repository.getCollections(workspaceId)
        : [];
      return { workspace, collections };
    },
  });

  const workspace = workspaceQuery.data?.workspace;
  const collections = workspaceQuery.data?.collections ?? [];

  return (
    <section className="mx-auto max-w-7xl">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-slate-400">
        <Link className="hover:text-indigo-300" to="/app/workspaces">
          All workspaces
        </Link>
      </nav>
      <PageHeader
        description={workspace?.description ?? "Review workspace collections and document coverage."}
        eyebrow="Workspace"
        title={workspace?.name ?? "Workspace"}
      />
      <div className="mt-8">
        {workspaceQuery.isPending ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-slate-300" role="status">
            Loading workspace…
          </div>
        ) : null}
        {workspaceQuery.isError ? (
          <StatePanel
            actionLabel="Retry workspace"
            description="The workspace could not be loaded from the knowledge repository."
            onAction={() => void workspaceQuery.refetch()}
            title="Workspace unavailable"
          />
        ) : null}
        {workspaceQuery.isSuccess && !workspace ? (
          <StatePanel
            actionLabel="Back to workspaces"
            actionTo="/app/workspaces"
            description="This workspace does not exist or is no longer available in the demo repository."
            title="Workspace not found"
          />
        ) : null}
        {workspace && collections.length === 0 ? (
          <StatePanel
            description="Create a collection later to group related documents and conversations inside this workspace."
            title="No collections yet"
          />
        ) : null}
        {workspace && collections.length > 0 ? (
          <ul className="grid gap-5 lg:grid-cols-2">
            {collections.map((collection) => (
              <li key={collection.id}>
                <Link
                  className="group block h-full rounded-2xl border border-white/10 bg-slate-900/60 p-6 transition hover:border-indigo-300/40 hover:bg-slate-900"
                  to={`/app/workspaces/${workspace.id}/collections/${collection.id}`}
                >
                  <h2 className="text-xl font-semibold text-white group-hover:text-indigo-300">
                    {collection.name}
                  </h2>
                  <p className="mt-2 leading-7 text-slate-400">
                    {collection.description}
                  </p>
                  <p className="mt-6 text-sm text-slate-500">
                    {collection.documentCount} documents · {collection.indexedDocumentCount} indexed
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
