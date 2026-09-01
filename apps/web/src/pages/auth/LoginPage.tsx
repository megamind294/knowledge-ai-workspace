import {
  useState,
} from "react";
import {
  Link,
  type Location,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useDemoSession } from "../../auth/useDemoSession";
import { AuthLayout } from "../../components/AuthLayout";

interface LoginLocationState {
  from?: Location;
}

export function LoginPage() {
  const { startDemo, login, mode, googleOAuthEnabled, googleOAuthStartUrl } = useDemoSession();
  const [error,setError]=useState<string|null>(null); const [pending,setPending]=useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LoginLocationState | null;

  function enterDemo() {
    startDemo();
    navigate(state?.from?.pathname ?? "/app", { replace: true });
  }
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setError(null);setPending(true);const data=new FormData(event.currentTarget);try{await login({email:String(data.get("email")),password:String(data.get("password"))});navigate(state?.from?.pathname??"/app",{replace:true});}catch(cause){setError(cause instanceof Error?cause.message:"Sign in failed");}finally{setPending(false);}}

  return (
    <AuthLayout
      description={mode === "api" ? "Sign in to your secure Keystone workspace." : "Explore the product with an explicitly local fixture session."}
      footer={
        <p>
          New to Keystone?{" "}
          <Link className="font-semibold text-indigo-300 hover:text-indigo-200" to="/register">
            Create account
          </Link>
        </p>
      }
      title="Welcome back"
    >
      <form className="space-y-5" onSubmit={submit}>
        <label className="block text-sm font-medium text-slate-200">
          Email address
          <input
            autoComplete="email"
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100 placeholder:text-slate-600"
            name="email"
            placeholder="you@example.com"
            required
            type="email"
          />
        </label>
        <label className="block text-sm font-medium text-slate-200">
          Password
          <input
            autoComplete="current-password"
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100 placeholder:text-slate-600"
            name="password"
            placeholder="Enter your password"
            required
            type="password"
          />
        </label>
        <button
          className="w-full rounded-xl bg-indigo-400 px-5 py-3 font-semibold text-slate-950 disabled:cursor-wait disabled:opacity-60"
          disabled={mode === "fixture" || pending}
          type="submit"
        >
          Sign in
        </button>
      </form>

      {error ? <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p> : null}
      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-slate-600">
        <span className="h-px flex-1 bg-white/10" />
        Preview access
        <span className="h-px flex-1 bg-white/10" />
      </div>

      {googleOAuthEnabled && googleOAuthStartUrl ? <a
        className="block w-full rounded-xl border border-indigo-300/30 px-5 py-3 text-center font-semibold text-indigo-200 hover:bg-indigo-400/10"
        href={googleOAuthStartUrl}
      >Continue with Google</a> : <button
        className="w-full cursor-not-allowed rounded-xl border border-white/10 px-5 py-3 font-semibold text-slate-500"
        disabled
        type="button"
      >
        Continue with Google
      </button>}
      <p className="mt-3 text-center text-xs text-slate-500">
        {googleOAuthEnabled
          ? "Google authentication is handled by the configured provider; credentials never pass through this form."
          : "Google sign-in remains unavailable until provider configuration is added."}
      </p>

      {mode === "fixture" ? <div className="mt-6 rounded-2xl border border-indigo-400/20 bg-indigo-400/5 p-4">
        <p className="text-sm leading-6 text-slate-300">
          Demo access stores only a local session marker. It does not create a
          real account or send credentials.
        </p>
        <button
          className="mt-4 w-full rounded-xl bg-indigo-400 px-5 py-3 font-semibold text-slate-950 hover:bg-indigo-300"
          onClick={enterDemo}
          type="button"
        >
          Explore demo workspace
        </button>
      </div> : null}
    </AuthLayout>
  );
}
