import { Link } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout";

export function RegisterPage() {
  return (
    <AuthLayout
      description="Set up your future workspace profile. Account creation becomes available with the secure API in Day 3."
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
      <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
        <label className="block text-sm font-medium text-slate-200">
          Full name
          <input
            autoComplete="name"
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100 placeholder:text-slate-600"
            name="name"
            placeholder="Rinkle Sharma"
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
            type="password"
          />
        </label>
        <button
          className="w-full cursor-not-allowed rounded-xl bg-slate-700 px-5 py-3 font-semibold text-slate-400"
          disabled
          type="submit"
        >
          Create account
        </button>
      </form>
      <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm leading-6 text-amber-100/80">
        This Day 1 preview does not create a real account or store these form
        values.
      </p>
    </AuthLayout>
  );
}
