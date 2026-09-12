import type { ConversationMessage } from "@knowledge-ai/contracts";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { StatePanel } from "../../components/StatePanel";
import { knowledgeQueryKeys } from "../../data/queryKeys";
import { useKnowledgeRepository } from "../../data/useKnowledgeRepository";

export function ConversationPage() {
  const { workspaceId = "", conversationId = "" } = useParams();
  const repository = useKnowledgeRepository();
  const [question, setQuestion] = useState("");
  const routeKey = `${workspaceId}:${conversationId}`;
  const [sentMessages, setSentMessages] = useState<{
    routeKey: string;
    messages: ConversationMessage[];
  }>({ routeKey, messages: [] });
  const conversation = useQuery({
    queryKey: knowledgeQueryKeys.conversation(workspaceId, conversationId),
    queryFn: () => repository.getConversation(workspaceId, conversationId),
    enabled: repository.mode === "api",
  });
  const history = useInfiniteQuery({
    queryKey: knowledgeQueryKeys.conversationHistory(workspaceId, conversationId),
    queryFn: ({ pageParam }) => repository.getConversationHistory(
      workspaceId,
      conversationId,
      pageParam ?? undefined,
    ),
    initialPageParam: null as number | null,
    getNextPageParam: (page) => page.nextPosition,
    enabled: repository.mode === "api",
  });
  const send = useMutation({
    mutationFn: (input: { question: string; submissionId: string }) => repository.sendConversationMessage(
      workspaceId,
      conversationId,
      { ...input, topK: 5 },
    ),
    onSuccess: (response) => {
      setSentMessages((current) => ({
        routeKey,
        messages: [
          ...(current.routeKey === routeKey ? current.messages : []),
          response.turn.userMessage,
          response.turn.assistantMessage,
        ],
      }));
    },
  });
  const messages = Array.from(
    new Map(
      [
        ...(history.data?.pages.flatMap((page) => page.messages) ?? []),
        ...(sentMessages.routeKey === routeKey ? sentMessages.messages : []),
      ].map((message) => [message.id, message]),
    ).values(),
  ).sort((left, right) => left.position - right.position);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (question.trim()) {
      const submittedQuestion = question.trim();
      setQuestion("");
      send.mutate({ question: submittedQuestion, submissionId: crypto.randomUUID() });
    }
  }

  if (repository.mode !== "api") return <StatePanel title="Grounded conversations require API mode" description="No AI provider call is made in fixture mode." />;
  if (conversation.isSuccess && !conversation.data) return <StatePanel title="Conversation not found" description="This conversation is unavailable or you no longer have access." actionLabel="Back to conversations" actionTo="/app/conversations" />;

  return (
    <section className="mx-auto max-w-5xl">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm"><Link className="text-indigo-300" to="/app/conversations">Conversations</Link></nav>
      <PageHeader eyebrow="Grounded conversation" title={conversation.data?.title ?? "Conversation"} description="Answers are generated only from authorized indexed sources. Open each citation to inspect its exact passage." />
      {conversation.isPending ? <p className="mt-8" role="status">Loading conversation…</p> : null}
      {conversation.isError ? <div className="mt-8"><StatePanel title="Conversation unavailable" description="The conversation could not be loaded." actionLabel="Retry conversation" onAction={()=>void conversation.refetch()} /></div> : null}
      <section className="mt-8 space-y-4" aria-label="Conversation history">
        {history.isPending ? <p role="status">Loading history…</p> : null}
        {history.isError ? <div role="alert" className="rounded-2xl border border-rose-300/20 bg-rose-950/30 p-5"><p>Conversation history is unavailable. Try again.</p><button className="mt-3 rounded-lg border border-white/20 px-3 py-2" onClick={()=>void history.refetch()} type="button">Retry history</button></div> : null}
        {history.isFetchNextPageError ? <div role="alert" className="rounded-2xl border border-rose-300/20 bg-rose-950/30 p-5"><p>More messages could not be loaded. Try again.</p><button className="mt-3 rounded-lg border border-white/20 px-3 py-2" onClick={()=>void history.fetchNextPage()} type="button">Retry more messages</button></div> : null}
        {history.isSuccess && messages.length === 0 ? <p className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-slate-400">No messages yet. Ask a question grounded in this conversation's scope.</p> : null}
        {messages.map((message)=><article className={`rounded-2xl border p-5 ${message.role === "assistant" ? "border-indigo-300/20 bg-indigo-950/20" : "border-white/10 bg-slate-900/60"}`} key={message.id}>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{message.role === "assistant" ? (message.model ? "Grounded answer" : "Insufficient context") : "You"}</p>
          <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-200">{message.content}</p>
          {message.role === "assistant" && message.sources.length > 0 ? <section aria-label="Sources for answer" className="mt-5"><h2 className="text-sm font-semibold text-indigo-200">Sources</h2><ol className="mt-3 grid gap-3">{message.sources.map((source)=><li className="rounded-xl border border-white/10 bg-slate-950/60 p-4" key={source.chunkId}><div className="flex flex-wrap justify-between gap-3"><p className="font-medium">[{source.citationOrdinal + 1}] {source.originalFilename}</p><Link aria-label={`Open ${source.originalFilename}`} className="text-sm text-indigo-300" to={`/app/documents/${source.documentId}`}>Open source</Link></div><p className="mt-2 text-xs text-slate-400">{source.sectionHeading ?? `Passage ${source.ordinal + 1}`}{source.pageNumber ? ` · Page ${source.pageNumber}` : ""}</p><p className="mt-3 text-sm leading-6 text-slate-300">{source.content}</p></li>)}</ol></section> : null}
        </article>)}
        {history.hasNextPage && !history.isFetchNextPageError ? <button className="rounded-lg border border-white/20 px-4 py-2 disabled:opacity-50" disabled={history.isFetchingNextPage} onClick={()=>void history.fetchNextPage()} type="button">{history.isFetchingNextPage ? "Loading more messages…" : "Load more messages"}</button> : null}
      </section>
      <form className="sticky bottom-4 mt-8 rounded-2xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl backdrop-blur" onSubmit={submit}>
        <label className="text-sm font-medium">Ask a question<textarea className="mt-2 block min-h-24 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3" value={question} onChange={(event)=>setQuestion(event.target.value)} /></label>
        {send.isError ? <div className="mt-3" role="alert"><p className="text-sm text-rose-200">The question could not be answered. Try again.</p><button className="mt-2 rounded-lg border border-white/20 px-3 py-2" onClick={()=>send.variables && send.mutate(send.variables)} type="button">Retry question</button></div> : null}
        <button className="mt-4 rounded-xl bg-indigo-300 px-4 py-2.5 font-semibold text-slate-950 disabled:opacity-50" disabled={!question.trim() || send.isPending || !history.isSuccess} type="submit">{send.isPending ? "Generating grounded answer…" : "Send question"}</button>
      </form>
    </section>
  );
}
