import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { StatePanel } from "../../components/StatePanel";
import { knowledgeQueryKeys } from "../../data/queryKeys";
import { useKnowledgeRepository } from "../../data/useKnowledgeRepository";
import { DocumentStatusBadge } from "./DocumentStatusBadge";

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1_000_000) {
    return `${Math.round(sizeBytes / 1_000)} KB`;
  }
  return `${(sizeBytes / 1_000_000).toFixed(1)} MB`;
}

export function DocumentDetailPage() {
  const { documentId = "" } = useParams();
  const repository = useKnowledgeRepository();
  const queryClient = useQueryClient();
  const documentQuery = useQuery({
    queryKey: knowledgeQueryKeys.document(documentId),
    queryFn: () => repository.getDocument(documentId),
  });
  const retryMutation = useMutation({
    mutationFn: () => repository.retryDocument(documentId),
    onSuccess: (document) => {
      queryClient.setQueryData(
        knowledgeQueryKeys.document(documentId),
        document,
      );
      void queryClient.invalidateQueries({
        queryKey: knowledgeQueryKeys.documents,
      });
      void queryClient.invalidateQueries({
        queryKey: knowledgeQueryKeys.dashboard,
      });
    },
  });
  const document = documentQuery.data;

  return (
    <section className="mx-auto max-w-5xl">
      {documentQuery.isPending || documentQuery.isError || document ? (
        <Link
          className="text-sm font-medium text-indigo-300 hover:text-indigo-200"
          to="/app/documents"
        >
          ← Back to document library
        </Link>
      ) : null}

      <div className="mt-6">
        {documentQuery.isPending ? (
          <div
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-slate-300"
            role="status"
          >
            Loading document details…
          </div>
        ) : null}
        {documentQuery.isError ? (
          <StatePanel
            actionLabel="Retry document details"
            description="This document could not be loaded from the knowledge repository."
            onAction={() => void documentQuery.refetch()}
            title="Document unavailable"
          />
        ) : null}
        {documentQuery.isSuccess && !document ? (
          <StatePanel
            actionLabel="Back to document library"
            actionTo="/app/documents"
            description="This document is no longer available or the link is incorrect."
            title="Document not found"
          />
        ) : null}
        {document ? (
          <>
            <PageHeader
              description="Metadata and ingestion state from the local Day 2 repository."
              eyebrow={document.mediaType}
              title={document.name}
            />

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-white">
                    Ingestion status
                  </h2>
                  <DocumentStatusBadge status={document.status} />
                </div>
                <p className="mt-4 leading-7 text-slate-300">
                  This is a local ingestion simulation. No file bytes are uploaded,
                  parsed, stored, or sent to an AI provider.
                </p>
                {document.failureReason ? (
                  <div className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
                    {document.failureReason}
                  </div>
                ) : null}
                {document.status === "failed" ? (
                  <button
                    className="mt-5 rounded-xl bg-indigo-400 px-4 py-2.5 font-semibold text-slate-950 disabled:opacity-60"
                    disabled={retryMutation.isPending}
                    onClick={() => retryMutation.mutate()}
                    type="button"
                  >
                    {retryMutation.isPending
                      ? "Retrying simulation…"
                      : "Retry simulated ingestion"}
                  </button>
                ) : null}
              </section>

              <dl className="grid gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-sm">
                <div>
                  <dt className="text-slate-500">Format</dt>
                  <dd className="mt-1 uppercase text-slate-200">
                    {document.mediaType}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Size</dt>
                  <dd className="mt-1 text-slate-200">
                    {formatBytes(document.sizeBytes)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Created</dt>
                  <dd className="mt-1 text-slate-200">
                    {dateFormatter.format(new Date(document.createdAt))}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Updated</dt>
                  <dd className="mt-1 text-slate-200">
                    {dateFormatter.format(new Date(document.updatedAt))}
                  </dd>
                </div>
              </dl>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
