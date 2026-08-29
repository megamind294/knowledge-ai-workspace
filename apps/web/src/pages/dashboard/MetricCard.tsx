interface MetricCardProps {
  label: string;
  value: number;
}

export function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
      <dt className="text-sm font-medium text-slate-400">{label}</dt>
      <dd className="mt-3 text-3xl font-semibold tracking-tight text-white">
        {value}
      </dd>
    </div>
  );
}
