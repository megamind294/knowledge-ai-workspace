import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { StatePanel } from "../../components/StatePanel";
import { knowledgeQueryKeys } from "../../data/queryKeys";
import { useKnowledgeRepository } from "../../data/useKnowledgeRepository";
import type { IngestionStatus } from "../../domain/knowledge";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import { DocumentUploadPanel } from "./DocumentUploadPanel";

type StatusFilter = "all" | IngestionStatus;

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1_000_000) {
    return `${Math.round(sizeBytes / 1_000)} KB`;
  }
  return `${(sizeBytes / 1_000_000).toFixed(1)} MB`;
}

export function DocumentLibraryPage() {
  const repository = useKnowledgeRepository();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const documentsQuery = useQuery({
    queryKey: knowledgeQueryKeys.documents,
    queryFn: async () => {
      const workspaces = await repository.getWorkspaces();
      const documents = await Promise.all(
        workspaces.map((workspace) => repository.getDocuments(workspace.id)),
      );
      return documents
        .flat()
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },
  });
  const documents = documentsQuery.data ?? [];
  const visibleDocuments =
    statusFilter === "all"
      ? documents
      : documents.filter((document) => document.status === statusFilter);

  return (
    <section className="mx-auto max-w-7xl">
      <PageHeader
        description={
          repository.mode === "api"
            ? "Review uploaded documents and durable ingestion progress across your workspaces."
            : "Review document metadata and simulated ingestion progress across your workspaces."
        }
        eyebrow={repository.mode === "api" ? "Ingestion" : "Day 2"}
        title="Document library"
      />

      <div className="mt-8">
        <DocumentUploadPanel />
      </div>

      <div className="mt-8">
        {documentsQuery.isPending ? (
          <div
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-slate-300"
            role="status"
          >
            Loading document library…
          </div>
        ) : null}
        {documentsQuery.isError ? (
          <StatePanel
            actionLabel="Retry document library"
            description="Documents could not be loaded from the knowledge repository."
            onAction={() => void documentsQuery.refetch()}
            title="Document library unavailable"
          />
        ) : null}
        {documentsQuery.isSuccess && documents.length === 0 ? (
          <StatePanel
            description={
              repository.mode === "api"
                ? "Uploaded documents will appear here with their durable ingestion state."
                : "Validated local document previews will appear here after you add them."
            }
            title="No documents yet"
          />
        ) : null}
        {documents.length > 0 ? (
          <>
            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:flex-row sm:items-end sm:justify-between">
              <label className="text-sm font-medium text-slate-200">
                Ingestion status
                <select
                  className="mt-2 block min-w-48 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
                  onChange={(event) =>
                    setStatusFilter(event.target.value as StatusFilter)
                  }
                  value={statusFilter}
                >
                  <option value="all">All statuses</option>
                  <option value="uploaded">Uploaded</option>
                  <option value="processing">Processing</option>
                  <option value="indexed">Indexed</option>
                  <option value="failed">Failed</option>
                </select>
              </label>
              <p className="text-sm text-slate-400">
                {visibleDocuments.length} {visibleDocuments.length === 1 ? "document" : "documents"} shown
              </p>
            </div>

            {visibleDocuments.length === 0 ? (
              <StatePanel
                description="Choose another ingestion status to review available documents."
                title="No documents match this filter"
              />
            ) : (
              <ul className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-slate-900/60 px-6">
                {visibleDocuments.map((document) => (
                  <li
                    className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
                    key={document.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">
                        {document.name}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                        {document.mediaType} · {formatBytes(document.sizeBytes)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <DocumentStatusBadge status={document.status} />
                      <Link
                        aria-label={`Open ${document.name}`}
                        className="rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-slate-200 hover:border-indigo-300/40 hover:text-indigo-200"
                        to={`/app/documents/${document.id}`}
                      >
                        Open
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
