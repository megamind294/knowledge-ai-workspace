import { type Location, useLocation, useNavigate } from "react-router-dom";
import { useDemoSession } from "../../auth/useDemoSession";

interface LoginLocationState {
  from?: Location;
}

export function LoginPage() {
  const { startDemo } = useDemoSession();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LoginLocationState | null;

  function enterDemo() {
    startDemo();
    navigate(state?.from?.pathname ?? "/app", { replace: true });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">
          Keystone
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Welcome back</h1>
        <p className="mt-3 leading-7 text-slate-300">
          Authentication arrives with the API milestone. This preview stores
          only a local demo-session marker and does not create an account.
        </p>
        <button
          className="mt-8 w-full rounded-xl bg-indigo-400 px-5 py-3 font-semibold text-slate-950"
          onClick={enterDemo}
          type="button"
        >
          Explore demo workspace
        </button>
      </section>
    </main>
  );
}
