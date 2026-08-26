import { createFileRoute, Link } from "@tanstack/react-router";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { ClipResultCard } from "@/components/results/ClipResultCard";
import { Button } from "@/components/ui/button";
import { useClipper } from "@/core/app-state";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Results — Clipper" },
      {
        name: "description",
        content:
          "Review generated clips with duration, resolution, file size and output location on disk.",
      },
      { property: "og:title", content: "Results — Clipper" },
      {
        property: "og:description",
        content: "Generated clips with duration, resolution, size and output path.",
      },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const { results, revealClip, settings } = useClipper();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Results"
        description={
          settings.outputDirectory
            ? `Output folder: ${settings.outputDirectory}`
            : "Output folder: engine default"
        }
      />

      {results.length === 0 ? (
        <EmptyState
          title="No clips yet"
          description="Clips appear here after a job completes successfully."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link to="/configure">Open settings</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((clip) => (
            <ClipResultCard key={clip.id} clip={clip} onReveal={revealClip} />
          ))}
        </div>
      )}
    </div>
  );
}
