import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { knowledgeQueryKeys } from "../../data/queryKeys";
import { useKnowledgeRepository } from "../../data/useKnowledgeRepository";
import {
  runMockKnowledgeQuery,
  type MockKnowledgeResult,
} from "./mockKnowledge";

export function MockKnowledgePage() {
  const repository = useKnowledgeRepository();
  const [workspaceId, setWorkspaceId] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<MockKnowledgeResult | null>(null);

  const workspacesQuery = useQuery({
    queryKey: knowledgeQueryKeys.workspaces,
    queryFn: () => repository.getWorkspaces(),
  });
  const collectionsQuery = useQuery({
    queryKey: knowledgeQueryKeys.collections(workspaceId),
    queryFn: () => repository.getCollections(workspaceId),
    enabled: Boolean(workspaceId),
  });
  const documentsQuery = useQuery({
    queryKey: knowledgeQueryKeys.scopeDocuments(workspaceId, collectionId),
    queryFn: () =>
      repository.getDocuments(workspaceId, collectionId || undefined),
    enabled: Boolean(workspaceId),
  });

  function clearResult() {
    setError("");
    setResult(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) {
      setError("Enter a question or search phrase.");
      setResult(null);
      return;
    }
    if (!workspaceId) {
      setError("Choose a workspace for the mock search.");
      setResult(null);
      return;
    }

    setError("");
    setResult(
      runMockKnowledgeQuery(query, {
        workspaceId,
        collectionId: collectionId || null,
        documentId: documentId || null,
      }),
    );
  }

  return (
    <section className="mx-auto max-w-7xl">
      <PageHeader
        description="Explore deterministic local fixtures across workspace, collection, and document scopes."
        eyebrow="Day 2 simulation"
        title="Mock knowledge preview"
      />

      <div
        className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-950/30 p-5 text-sm leading-6 text-amber-100"
        role="note"
      >
        <strong className="font-semibold">Local fixture only:</strong> no AI,
        embedding, retrieval, or network call is made. Answers and source labels
        below are deterministic demo content, not generated output or citations.
      </div>

      <form
        className="mt-6 grid gap-5 rounded-2xl border border-white/10 bg-slate-900/60 p-6 lg:grid-cols-3"
        onSubmit={handleSubmit}
      >
        <label className="text-sm font-medium text-slate-200">
          Workspace
          <select
            className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-slate-100"
            disabled={workspacesQuery.isPending}
            onChange={(event) => {
              setWorkspaceId(event.target.value);
              setCollectionId("");
              setDocumentId("");
              clearResult();
            }}
            value={workspaceId}
          >
            <option value="">Choose a workspace</option>
            {(workspacesQuery.data ?? []).map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-200">
          Collection
          <select
            className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-slate-100"
            disabled={!workspaceId || collectionsQuery.isPending}
            onChange={(event) => {
              setCollectionId(event.target.value);
              setDocumentId("");
              clearResult();
            }}
            value={collectionId}
          >
            <option value="">All collections</option>
            {(collectionsQuery.data ?? []).map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-200">
          Document
          <select
            className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-slate-100"
            disabled={!workspaceId || documentsQuery.isPending}
            onChange={(event) => {
              setDocumentId(event.target.value);
              clearResult();
            }}
            value={documentId}
          >
            <option value="">All documents in scope</option>
            {(documentsQuery.data ?? []).map((document) => (
              <option key={document.id} value={document.id}>
                {document.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-200 lg:col-span-3">
          Question or search phrase
          <textarea
            className="mt-2 block min-h-28 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-600"
            onChange={(event) => {
              setQuery(event.target.value);
              clearResult();
            }}
            placeholder="Example: What does the European market fixture say about AI adoption?"
            value={query}
          />
        </label>

        {error ? (
          <p
            className="rounded-xl border border-rose-300/20 bg-rose-950/30 px-4 py-3 text-sm text-rose-200 lg:col-span-3"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="lg:col-span-3">
          <button
            className="rounded-xl bg-indigo-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-indigo-200"
            type="submit"
          >
            Run mock search
          </button>
        </div>
      </form>

      {result ? (
        <section
          aria-labelledby="mock-answer-title"
          className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-6"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Deterministic fixture response — not AI-generated
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white" id="mock-answer-title">
            Mock answer preview
          </h2>
          <p className="mt-4 leading-7 text-slate-300">{result.answer}</p>

          {result.matches.length > 0 ? (
            <div className="mt-7">
              <h3 className="text-lg font-semibold text-white">
                Mock search matches
              </h3>
              <ul className="mt-4 grid gap-4 lg:grid-cols-2">
                {result.matches.map((match) => (
                  <li
                    className="rounded-xl border border-white/10 bg-slate-950/60 p-4"
                    key={match.documentId}
                  >
                    <p className="font-semibold text-indigo-200">
                      {match.documentName}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {match.excerpt}
                    </p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-300">
                      {match.sourceLabel}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
