import { PageHeader } from "../../components/PageHeader";

export function DashboardPage() {
  return (
    <section className="mx-auto max-w-7xl">
      <PageHeader
        description="Repository-backed metrics and recent knowledge will appear in the next Day 1 slice."
        eyebrow="Demo workspace"
        title="Dashboard"
      />
    </section>
  );
}
