import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { StatePanel } from "../../components/StatePanel";
import { knowledgeQueryKeys } from "../../data/queryKeys";
import { useKnowledgeRepository } from "../../data/useKnowledgeRepository";

export function WorkspaceListPage() {
  const repository = useKnowledgeRepository();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const workspacesQuery = useQuery({
    queryKey: knowledgeQueryKeys.workspaces,
    queryFn: () => repository.getWorkspaces(),
  });
  const createWorkspace = useMutation({
    mutationFn: () => repository.createWorkspace({
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim(),
    }),
    onSuccess: async (workspace) => {
      await queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.workspaces });
      navigate(`/app/workspaces/${workspace.id}`);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim() && slug.trim()) createWorkspace.mutate();
  }

  return (
    <section className="mx-auto max-w-7xl">
      <PageHeader
        description="Keep collections and documents within clear knowledge boundaries."
        eyebrow="Knowledge library"
        title="Workspaces"
      />
      {repository.mode === "api" ? (
        <form className="mt-8 grid gap-4 rounded-2xl border border-indigo-300/20 bg-indigo-950/30 p-6 md:grid-cols-2" onSubmit={submit}>
          <h2 className="text-xl font-semibold text-white md:col-span-2">Create a workspace</h2>
          <label className="text-sm font-medium text-slate-200">Workspace name
            <input className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5" maxLength={100} onChange={(event) => setName(event.target.value)} required value={name} />
          </label>
          <label className="text-sm font-medium text-slate-200">Workspace slug
            <input className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5" maxLength={80} onChange={(event) => setSlug(event.target.value)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required value={slug} />
          </label>
          <label className="text-sm font-medium text-slate-200 md:col-span-2">Workspace description
            <textarea className="mt-2 block min-h-20 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5" maxLength={500} onChange={(event) => setDescription(event.target.value)} value={description} />
          </label>
          {createWorkspace.isError ? <p className="text-sm text-rose-200 md:col-span-2" role="alert">Workspace could not be created. Check the fields and try again.</p> : null}
          <button className="rounded-xl bg-indigo-300 px-4 py-2.5 font-semibold text-slate-950 disabled:opacity-50 md:col-span-2" disabled={!name.trim() || !slug.trim() || createWorkspace.isPending} type="submit">{createWorkspace.isPending ? "Creating workspace…" : "Create workspace"}</button>
        </form>
      ) : null}
      <div className="mt-8">
        {workspacesQuery.isPending ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-slate-300" role="status">
            Loading workspaces…
          </div>
        ) : null}
        {workspacesQuery.isError ? (
          <StatePanel
            actionLabel="Retry workspaces"
            description="The knowledge repository did not respond. You can safely try again."
            onAction={() => void workspacesQuery.refetch()}
            title="Workspaces unavailable"
          />
        ) : null}
        {workspacesQuery.data?.length === 0 ? (
          <StatePanel
            description="Your first workspace will become the home for related collections and source documents."
            title="No workspaces yet"
          />
        ) : null}
        {workspacesQuery.data && workspacesQuery.data.length > 0 ? (
          <ul className="grid gap-5 lg:grid-cols-2">
            {workspacesQuery.data.map((workspace) => (
              <li key={workspace.id}>
                <Link
                  className="group block h-full rounded-2xl border border-white/10 bg-slate-900/60 p-6 transition hover:border-indigo-300/40 hover:bg-slate-900"
                  to={`/app/workspaces/${workspace.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-white group-hover:text-indigo-300">
                        {workspace.name}
                      </h2>
                      <p className="mt-2 leading-7 text-slate-400">
                        {workspace.description}
                      </p>
                    </div>
                    <span className="rounded-full bg-indigo-400/10 px-2.5 py-1 text-xs font-medium capitalize text-indigo-200">
                      {workspace.role}
                    </span>
                  </div>
                  <p className="mt-6 text-sm text-slate-500">
                    {workspace.collectionCount} collections · {workspace.documentCount} documents
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
