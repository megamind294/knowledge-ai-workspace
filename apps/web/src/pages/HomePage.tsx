export function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <section className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-slate-900 p-10 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-indigo-300">
          Keystone
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Turn trusted documents into a useful AI workspace.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          The product foundation is ready. Workspaces, collections, and
          source-grounded conversations are the next Day 1 slices.
        </p>
      </section>
    </main>
  );
}
