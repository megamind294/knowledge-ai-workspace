import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDemoSession } from "../../auth/useDemoSession";
import { AuthLayout } from "../../components/AuthLayout";

export function RegisterPage() {
  const {mode,register}=useDemoSession(); const navigate=useNavigate(); const [error,setError]=useState<string|null>(null); const [pending,setPending]=useState(false);
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setError(null);setPending(true);const data=new FormData(event.currentTarget);try{await register({displayName:String(data.get("name")),email:String(data.get("email")),password:String(data.get("password"))});navigate("/app",{replace:true});}catch(cause){setError(cause instanceof Error?cause.message:"Registration failed");}finally{setPending(false);}}
  return (
    <AuthLayout
      description={mode === "api" ? "Create a secure Keystone account and begin your workspace." : "Registration is disabled in the local fixture preview."}
      footer={
        <p>
          Already have an account?{" "}
          <Link className="font-semibold text-indigo-300 hover:text-indigo-200" to="/login">
            Sign in
          </Link>
        </p>
      }
      title="Create your account"
    >
      <form className="space-y-5" onSubmit={submit}>
        <label className="block text-sm font-medium text-slate-200">
          Full name
          <input
            autoComplete="name"
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100 placeholder:text-slate-600"
            name="name"
            placeholder="Rinkle Sharma"
            required
            type="text"
          />
        </label>
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
            autoComplete="new-password"
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100 placeholder:text-slate-600"
            name="password"
            placeholder="Create a password"
            minLength={12}
            required
            type="password"
          />
        </label>
        <button
          className="w-full rounded-xl bg-indigo-400 px-5 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          disabled={mode === "fixture" || pending}
          type="submit"
        >
          Create account
        </button>
      </form>
      {error ? <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p> : null}
      {mode === "fixture" ? <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm leading-6 text-amber-100/80">This fixture preview does not create a real account or store these form values.</p> : null}
    </AuthLayout>
  );
}
