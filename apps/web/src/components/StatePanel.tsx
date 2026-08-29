import { Link } from "react-router-dom";

interface StatePanelProps {
  actionLabel?: string;
  actionTo?: string;
  description: string;
  onAction?: () => void;
  title: string;
}

export function StatePanel({
  actionLabel,
  actionTo,
  description,
  onAction,
  title,
}: StatePanelProps) {
  const actionClassName =
    "mt-6 inline-flex rounded-xl bg-indigo-400 px-5 py-3 font-semibold text-slate-950 hover:bg-indigo-300";

  return (
    <section className="rounded-2xl border border-dashed border-white/15 bg-slate-900/40 p-10 text-center">
      <h2 className="text-2xl font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-300">
        {description}
      </p>
      {actionLabel && actionTo ? (
        <Link className={actionClassName} to={actionTo}>
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction ? (
        <button className={actionClassName} onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}
