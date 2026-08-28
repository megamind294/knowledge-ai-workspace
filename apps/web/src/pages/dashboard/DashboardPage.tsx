import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { knowledgeQueryKeys } from "../../data/queryKeys";
import { useKnowledgeRepository } from "../../data/useKnowledgeRepository";
import { MetricCard } from "./MetricCard";
import { RecentDocumentList } from "./RecentDocumentList";
import { RecentWorkspaceList } from "./RecentWorkspaceList";

export function DashboardPage() {
  const repository = useKnowledgeRepository();
  const dashboardQuery = useQuery({
    queryKey: knowledgeQueryKeys.dashboard,
    queryFn: () => repository.getDashboard(),
  });

  if (dashboardQuery.isPending) {
    return (
      <section className="mx-auto max-w-7xl">
        <PageHeader description="Preparing your latest workspace activity." eyebrow="Demo workspace" title="Dashboard" />
        <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-slate-300" role="status">
          Loading dashboard…
        </div>
      </section>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <section className="mx-auto max-w-7xl">
        <PageHeader description="Your workspace data could not be loaded." eyebrow="Demo workspace" title="Dashboard" />
        <div className="mt-8 rounded-2xl border border-rose-400/20 bg-rose-400/5 p-8">
          <h2 className="text-xl font-semibold text-white">Dashboard unavailable</h2>
          <p className="mt-2 text-slate-300">The knowledge repository did not respond. You can safely try again.</p>
          <button className="mt-5 rounded-xl bg-indigo-400 px-5 py-3 font-semibold text-slate-950 hover:bg-indigo-300" onClick={() => void dashboardQuery.refetch()} type="button">
            Retry dashboard
          </button>
        </div>
      </section>
    );
  }

  const dashboard = dashboardQuery.data;

  if (dashboard.metrics.workspaces === 0) {
    return (
      <section className="mx-auto max-w-7xl">
        <PageHeader description="Organize documents into focused knowledge spaces." eyebrow="Demo workspace" title="Dashboard" />
        <div className="mt-8 rounded-2xl border border-dashed border-indigo-300/30 bg-indigo-400/5 p-10 text-center">
          <h2 className="text-2xl font-semibold text-white">Build your first workspace</h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-300">Workspaces keep collections, source documents, and future AI conversations within a clear boundary.</p>
          <Link className="mt-6 inline-flex rounded-xl bg-indigo-400 px-5 py-3 font-semibold text-slate-950 hover:bg-indigo-300" to="/app/workspaces">
            Explore workspaces
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl">
      <PageHeader
        description="A live overview derived from the same repository that powers workspace and collection views."
        eyebrow="Demo workspace"
        title="Dashboard"
      />
      <dl className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Workspaces" value={dashboard.metrics.workspaces} />
        <MetricCard label="Collections" value={dashboard.metrics.collections} />
        <MetricCard label="Documents" value={dashboard.metrics.documents} />
        <MetricCard label="Indexed" value={dashboard.metrics.indexedDocuments} />
      </dl>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <RecentWorkspaceList workspaces={dashboard.recentWorkspaces} />
        <RecentDocumentList documents={dashboard.recentDocuments} />
      </div>
    </section>
  );
}
