import type { RecentDocument } from "../../domain/knowledge";

interface RecentDocumentListProps {
  documents: RecentDocument[];
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1_000_000) {
    return `${Math.round(sizeBytes / 1_000)} KB`;
  }
  return `${(sizeBytes / 1_000_000).toFixed(1)} MB`;
}

export function RecentDocumentList({ documents }: RecentDocumentListProps) {
  return (
    <section aria-labelledby="recent-documents-title" className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
      <h2 className="text-lg font-semibold text-white" id="recent-documents-title">
        Recent documents
      </h2>
      <ul className="mt-5 divide-y divide-white/10">
        {documents.map((document) => (
          <li className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0" key={document.id}>
            <div className="min-w-0">
              <h3 className="truncate font-medium text-slate-100">{document.name}</h3>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                {document.mediaType} · {formatBytes(document.sizeBytes)} · {dateFormatter.format(new Date(document.updatedAt))}
              </p>
            </div>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-medium capitalize text-slate-300">
              {document.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
