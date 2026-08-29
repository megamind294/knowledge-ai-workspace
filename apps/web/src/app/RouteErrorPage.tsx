import { Link } from "react-router-dom";

export function RouteErrorPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <section className="max-w-lg text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">
          404
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Page not found</h1>
        <p className="mt-4 text-slate-300">
          This page does not exist or may have moved.
        </p>
        <Link
          className="mt-8 inline-flex rounded-xl bg-indigo-400 px-5 py-3 font-semibold text-slate-950"
          to="/"
        >
          Return home
        </Link>
      </section>
    </main>
  );
}
