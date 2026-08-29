import type { IngestionStatus } from "../../domain/knowledge";

const statusStyles: Record<IngestionStatus, string> = {
  uploaded: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  processing: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  indexed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  failed: "border-rose-400/30 bg-rose-400/10 text-rose-200",
};

const statusLabels: Record<IngestionStatus, string> = {
  uploaded: "Uploaded",
  processing: "Processing",
  indexed: "Indexed",
  failed: "Failed",
};

export function DocumentStatusBadge({ status }: { status: IngestionStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
