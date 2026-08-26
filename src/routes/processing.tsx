import { createFileRoute, Link } from "@tanstack/react-router";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useClipper } from "@/core/app-state";
import { formatDuration } from "@/core/format";
import type { JobStatus } from "@/core/types";

export const Route = createFileRoute("/processing")({
  head: () => ({
    meta: [
      { title: "Processing — Clipper" },
      {
        name: "description",
        content:
          "Monitor the current clipping job: operation, progress, active file, and error state.",
      },
      { property: "og:title", content: "Processing — Clipper" },
      {
        property: "og:description",
        content: "Live status of the running clipping job, with cancel control.",
      },
    ],
  }),
  component: ProcessingPage,
});

const STATUS_LABEL: Record<JobStatus, string> = {
  idle: "Idle",
  queued: "Queued",
  probing: "Reading video",
  clipping: "Clipping",
  exporting: "Exporting",
  completed: "Completed",
  cancelled: "Cancelled",
  failed: "Failed",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-b-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tech truncate text-foreground">{value}</span>
    </div>
  );
}

function ProcessingPage() {
  const { job, source, cancelJob, clearJob } = useClipper();

  if (!job) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Processing" />
        <EmptyState
          title="No job running"
          description="Start a clipping job from the configuration screen."
          action={
            <Button asChild size="sm">
              <Link to="/configure">Open settings</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const running = job.status === "queued" || job.status === "clipping" || job.status === "probing";
  const elapsed =
    job.startedAt !== null ? ((job.finishedAt ?? Date.now()) - job.startedAt) / 1000 : null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Processing"
        description="Live status reported by the processing engine."
        actions={
          running ? (
            <Button variant="destructive" size="sm" onClick={cancelJob}>
              Cancel job
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={clearJob}>
              Clear job
            </Button>
          )
        }
      />

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">{STATUS_LABEL[job.status]}</p>
          <p className="tech text-muted-foreground">
            {job.progress === null ? "—" : `${Math.round(job.progress * 100)}%`}
          </p>
        </div>
        <Progress value={(job.progress ?? 0) * 100} />

        <div className="mt-4">
          <Row label="Current operation" value={job.currentOperation ?? "—"} />
          <Row label="Source video" value={source?.name ?? "—"} />
          <Row label="Current file" value={job.currentFile ?? "—"} />
          <Row label="Elapsed" value={formatDuration(elapsed)} />
          <Row label="Job id" value={job.id} />
        </div>
      </div>

      {job.error ? (
        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">Job failed</p>
          <p className="mt-1 text-sm text-muted-foreground">{job.error}</p>
        </div>
      ) : null}

      {job.status === "completed" ? (
        <Button asChild size="sm" className="mt-4">
          <Link to="/results">View results</Link>
        </Button>
      ) : null}
    </div>
  );
}
