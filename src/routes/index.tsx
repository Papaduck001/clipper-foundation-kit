import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderInput } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { EngineNotice } from "@/components/layout/EngineNotice";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useClipper } from "@/core/app-state";
import { formatRelativeTime } from "@/core/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clipper — Local video clipping utility" },
      {
        name: "description",
        content:
          "Clipper is a local desktop utility for splitting long videos into clips: import a file, configure output, run the job, review the exported clips.",
      },
      { property: "og:title", content: "Clipper — Local video clipping utility" },
      {
        property: "og:description",
        content: "Import a local video, configure clipping, and export clips on your own machine.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { source, job, results, recentProjects } = useClipper();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Clipper"
        description="A local utility that splits long videos into shorter clips. Import a video, configure the output, run the job, then review the exported files."
        actions={
          <Button asChild size="sm">
            <Link to="/import">
              <FolderInput className="size-4" />
              Import video
            </Link>
          </Button>
        }
      />

      <EngineNotice className="mb-6" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatusCard label="Current video" value={source ? source.name : "None selected"} />
        <StatusCard label="Job status" value={job ? job.status : "idle"} />
        <StatusCard label="Clips generated" value={String(results.length)} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Recent videos</h2>
        {recentProjects.length === 0 ? (
          <EmptyState
            title="No videos yet"
            description="Videos you open in this session appear here."
            action={
              <Button asChild variant="secondary" size="sm">
                <Link to="/import">Import a video</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {recentProjects.map((project) => (
              <li
                key={project.id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <span className="truncate text-foreground">{project.videoName}</span>
                <span className="tech shrink-0 text-muted-foreground">
                  {project.clipCount} clips · {formatRelativeTime(project.openedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
