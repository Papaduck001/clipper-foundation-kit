import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { SelectedVideoCard } from "@/components/video/SelectedVideoCard";
import { VideoDropzone } from "@/components/video/VideoDropzone";
import { Button } from "@/components/ui/button";
import { useClipper } from "@/core/app-state";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "Import video — Clipper" },
      {
        name: "description",
        content: "Select or drag in a local video file and inspect its basic information.",
      },
      { property: "og:title", content: "Import video — Clipper" },
      {
        property: "og:description",
        content: "Select a local video file to clip and review its file information.",
      },
    ],
  }),
  component: ImportPage,
});

function ImportPage() {
  const { source, selectSource, clearSource, probeSource } = useClipper();
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);

  async function handleProbe() {
    setProbing(true);
    setProbeError(null);
    try {
      await probeSource();
    } catch (error) {
      setProbeError(error instanceof Error ? error.message : String(error));
    } finally {
      setProbing(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Import video"
        description="Choose the local video file you want to clip. One video at a time."
      />

      {source ? (
        <div className="space-y-4">
          <SelectedVideoCard
            source={source}
            onRemove={clearSource}
            onProbe={handleProbe}
            probing={probing}
            probeError={probeError}
          />
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link to="/configure">Continue to configuration</Link>
            </Button>
            <Button variant="secondary" size="sm" onClick={clearSource}>
              Change video
            </Button>
          </div>
        </div>
      ) : (
        <VideoDropzone onSelect={selectSource} />
      )}
    </div>
  );
}
