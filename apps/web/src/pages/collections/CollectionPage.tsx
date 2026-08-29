import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { StatePanel } from "../../components/StatePanel";
import { knowledgeQueryKeys } from "../../data/queryKeys";
import { useKnowledgeRepository } from "../../data/useKnowledgeRepository";

export function CollectionPage() {
  const { workspaceId = "", collectionId = "" } = useParams();
  const repository = useKnowledgeRepository();
  const collectionQuery = useQuery({
    queryKey: knowledgeQueryKeys.collection(workspaceId, collectionId),
    queryFn: async () => {
      const workspace = await repository.getWorkspace(workspaceId);
      const collection = workspace
        ? await repository.getCollection(workspaceId, collectionId)
        : null;
      const documents = collection
        ? await repository.getDocuments(workspaceId, collectionId)
        : [];
      return { workspace, collection, documents };
    },
  });

  const { workspace, collection, documents } = collectionQuery.data ?? {
    workspace: null,
    collection: null,
    documents: [],
  };

  return (
    <section className="mx-auto max-w-7xl">
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-400">
        <Link className="hover:text-indigo-300" to="/app/workspaces">
          Workspaces
        </Link>
        {workspace ? (
          <>
            <span aria-hidden="true">/</span>
            <Link className="hover:text-indigo-300" to={`/app/workspaces/${workspace.id}`}>
              {workspace.name}
            </Link>
          </>
        ) : null}
      </nav>
      <PageHeader
        description={collection?.description ?? "Review collection documents and indexing coverage."}
        eyebrow="Collection"
        title={collection?.name ?? "Collection"}
      />
      <div className="mt-8">
        {collectionQuery.isPending ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-slate-300" role="status">
            Loading collection…
          </div>
        ) : null}
        {collectionQuery.isError ? (
          <StatePanel
            actionLabel="Retry collection"
            description="The collection could not be loaded from the knowledge repository."
            onAction={() => void collectionQuery.refetch()}
            title="Collection unavailable"
          />
        ) : null}
        {collectionQuery.isSuccess && !collection ? (
          <StatePanel
            actionLabel="Back to workspaces"
            actionTo="/app/workspaces"
            description="This collection does not belong to the requested workspace or is no longer available."
            title="Collection not found"
          />
        ) : null}
        {collection && documents.length === 0 ? (
          <StatePanel
            description="Documents added to this collection will appear here with their ingestion status."
            title="No documents yet"
          />
        ) : null}
        {collection && documents.length > 0 ? (
          <ul className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-slate-900/60 px-6">
            {documents.map((document) => (
              <li className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between" key={document.id}>
                <div>
                  <h2 className="font-semibold text-white">{document.name}</h2>
                  <p className="mt-1 text-sm uppercase tracking-wide text-slate-500">
                    {document.mediaType} · {(document.sizeBytes / 1_000).toFixed(0)} KB
                  </p>
                </div>
                <span className="w-fit rounded-full border border-white/10 px-2.5 py-1 text-xs font-medium capitalize text-slate-300">
                  {document.status}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
