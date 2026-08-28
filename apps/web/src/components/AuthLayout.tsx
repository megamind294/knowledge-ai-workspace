import { type PropsWithChildren, type ReactNode } from "react";
import { BrandMark } from "./BrandMark";

interface AuthLayoutProps extends PropsWithChildren {
  description: string;
  footer: ReactNode;
  title: string;
}

export function AuthLayout({
  children,
  description,
  footer,
  title,
}: AuthLayoutProps) {
  return (
    <main className="grid min-h-screen bg-slate-950 text-slate-100 lg:grid-cols-[minmax(0,1fr)_minmax(32rem,0.8fr)]">
      <section className="hidden border-r border-white/10 bg-slate-900/60 p-12 lg:flex lg:flex-col lg:justify-between">
        <BrandMark />
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">
            Your knowledge, grounded
          </p>
          <h2 className="mt-5 text-5xl font-semibold leading-tight">
            Ask better questions of every document you trust.
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">
            Keystone brings workspaces, collections, documents, and
            source-backed conversations into one focused research surface.
          </p>
        </div>
        <p className="text-sm text-slate-500">Day 1 product preview</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <BrandMark />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">
            Keystone preview
          </p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{title}</h1>
          <p className="mt-3 leading-7 text-slate-300">{description}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-8 border-t border-white/10 pt-6 text-sm text-slate-400">
            {footer}
          </div>
        </div>
      </section>
    </main>
  );
}
