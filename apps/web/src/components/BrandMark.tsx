export function BrandMark() {
  return (
    <div className="flex items-center gap-3" aria-label="Keystone home">
      <span
        aria-hidden="true"
        className="grid size-10 place-items-center rounded-xl bg-indigo-400 font-bold text-slate-950 shadow-lg shadow-indigo-950/30"
      >
        K
      </span>
      <span>
        <span className="block font-semibold tracking-tight text-white">
          Keystone
        </span>
        <span className="block text-xs text-slate-400">Knowledge workspace</span>
      </span>
    </div>
  );
}
