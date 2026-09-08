import type { RetrievalScope } from "@knowledge-ai/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { StatePanel } from "../../components/StatePanel";
import { knowledgeQueryKeys } from "../../data/queryKeys";
import { useKnowledgeRepository } from "../../data/useKnowledgeRepository";

export function ConversationListPage() {
  const repository = useKnowledgeRepository();
  const navigate = useNavigate();
  const isApi = repository.mode === "api";
  const [workspaceId, setWorkspaceId] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [title, setTitle] = useState("");
  const workspaces = useQuery({
    queryKey: knowledgeQueryKeys.workspaces,
    queryFn: () => repository.getWorkspaces(),
    enabled: isApi,
  });
  const collections = useQuery({
    queryKey: knowledgeQueryKeys.collections(workspaceId),
    queryFn: () => repository.getCollections(workspaceId),
    enabled: isApi && Boolean(workspaceId),
  });
  const documents = useQuery({
    queryKey: knowledgeQueryKeys.scopeDocuments(workspaceId, collectionId),
    queryFn: () => repository.getDocuments(workspaceId, collectionId || undefined),
    enabled: isApi && Boolean(workspaceId),
  });
  const conversations = useQuery({
    queryKey: knowledgeQueryKeys.conversations(workspaceId),
    queryFn: () => repository.listConversations(workspaceId),
    enabled: isApi && Boolean(workspaceId),
  });
  const create = useMutation({
    mutationFn: async () => {
      let scope: RetrievalScope = { type: "workspace" };
      if (documentId) scope = { type: "document", documentId };
      else if (collectionId) scope = { type: "collection", collectionId };
      return repository.createConversation(workspaceId, { title: title.trim(), scope });
    },
    onSuccess: (conversation) =>
      navigate(`/app/conversations/${conversation.workspaceId}/${conversation.id}`),
  });
  const scopeLoading = workspaces.isPending
    || (Boolean(workspaceId) && (collections.isPending || documents.isPending));
  const scopeUnavailable = workspaces.isError
    || (Boolean(workspaceId) && (collections.isError || documents.isError));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (workspaceId && title.trim()) create.mutate();
  }

  if (!isApi) {
    return (
      <section className="mx-auto max-w-5xl">
        <PageHeader eyebrow="Grounded chat" title="Conversations" description="Authenticated grounded conversations require API mode." />
        <div className="mt-8"><StatePanel title="Grounded conversations require API mode" description="Fixture mode remains a deterministic local preview. No AI provider call is made." /></div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Grounded chat" title="Conversations" description="Create a scope-bound conversation and inspect every answer's stored sources." />
      <form className="mt-8 grid gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-6 lg:grid-cols-2" onSubmit={submit}>
        {scopeLoading ? <p className="text-sm text-slate-300 lg:col-span-2" role="status">Loading conversation scopes…</p> : null}
        {workspaces.isError ? <div className="rounded-xl border border-rose-300/20 bg-rose-950/30 p-4 lg:col-span-2" role="alert"><p>Workspaces are unavailable. Try again.</p><button className="mt-3 rounded-lg border border-white/20 px-3 py-2" onClick={()=>void workspaces.refetch()} type="button">Retry workspaces</button></div> : null}
        {workspaceId && (collections.isError || documents.isError) ? <div className="rounded-xl border border-rose-300/20 bg-rose-950/30 p-4 lg:col-span-2" role="alert"><p>Conversation scopes are unavailable. Try again before creating a conversation.</p><button className="mt-3 rounded-lg border border-white/20 px-3 py-2" onClick={()=>void Promise.all([collections.refetch(), documents.refetch()])} type="button">Retry conversation scopes</button></div> : null}
        <label className="text-sm font-medium text-slate-200">Workspace
          <select className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5" disabled={workspaces.isPending || workspaces.isError} value={workspaceId} onChange={(event)=>{setWorkspaceId(event.target.value);setCollectionId("");setDocumentId("");}}>
            <option value="">Choose a workspace</option>
            {(workspaces.data ?? []).map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-200">Conversation title
          <input className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5" value={title} onChange={(event)=>setTitle(event.target.value)} />
        </label>
        <label className="text-sm font-medium text-slate-200">Collection scope
          <select className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5" disabled={!workspaceId || collections.isPending || collections.isError} value={collectionId} onChange={(event)=>{setCollectionId(event.target.value);setDocumentId("");}}>
            <option value="">Entire workspace</option>
            {(collections.data ?? []).map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-200">Document scope
          <select className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5" disabled={!workspaceId || documents.isPending || documents.isError} value={documentId} onChange={(event)=>setDocumentId(event.target.value)}>
            <option value="">All documents in scope</option>
            {(documents.data ?? []).map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        {create.isError ? <p className="text-sm text-rose-200 lg:col-span-2" role="alert">Conversation could not be created. Try again.</p> : null}
        <button className="rounded-xl bg-indigo-300 px-4 py-2.5 font-semibold text-slate-950 disabled:opacity-50 lg:col-span-2" disabled={!workspaceId || !title.trim() || create.isPending || scopeLoading || scopeUnavailable} type="submit">{create.isPending ? "Creating…" : "Create conversation"}</button>
      </form>
      {workspaceId ? <section className="mt-8" aria-labelledby="conversation-list-title"><h2 id="conversation-list-title" className="text-xl font-semibold">Recent conversations</h2>
        {conversations.isPending ? <p className="mt-4" role="status">Loading conversations…</p> : null}
        {conversations.isError ? <div className="mt-4"><StatePanel title="Conversations unavailable" description="The conversation list could not be loaded." actionLabel="Retry conversations" onAction={()=>void conversations.refetch()} /></div> : null}
        {conversations.isSuccess && conversations.data.length === 0 ? <p className="mt-4 text-slate-400">No conversations in this workspace yet.</p> : null}
        <ul className="mt-4 grid gap-3">{(conversations.data ?? []).map((item)=><li key={item.id}><Link className="block rounded-xl border border-white/10 bg-slate-900/60 p-4 hover:border-indigo-300/40" to={`/app/conversations/${item.workspaceId}/${item.id}`}><span className="font-semibold text-white">{item.title}</span><span className="mt-1 block text-sm text-slate-400">{item.scope.type} scope</span></Link></li>)}</ul>
      </section> : null}
    </section>
  );
}
