/** Shows the selected source video and whatever metadata the engine provided. */
import { FileVideo, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatBytes, formatDuration } from "@/core/format";
import type { SourceVideo } from "@/core/types";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="tech mt-0.5 text-foreground">{value}</p>
    </div>
  );
}

export function SelectedVideoCard({
  source,
  onRemove,
  onProbe,
  probing,
  probeError,
}: {
  source: SourceVideo;
  onRemove: () => void;
  onProbe?: () => void;
  probing?: boolean;
  probeError?: string | null;
}) {
  const { metadata } = source;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent">
            <FileVideo className="size-4 text-primary" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{source.name}</p>
            <p className="tech truncate text-muted-foreground">
              {source.path ?? "path unavailable in browser build"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onProbe ? (
            <Button variant="secondary" size="sm" onClick={onProbe} disabled={probing}>
              <RefreshCw className="size-3.5" />
              {probing ? "Reading…" : "Read metadata"}
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove video">
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
        <Field label="Size" value={formatBytes(source.sizeBytes)} />
        <Field label="Type" value={source.mimeType ?? "—"} />
        <Field
          label="Duration"
          value={metadata ? formatDuration(metadata.durationSeconds) : "not read"}
        />
        <Field
          label="Resolution"
          value={metadata ? `${metadata.width}x${metadata.height}` : "not read"}
        />
      </div>

      {probeError ? <p className="mt-3 text-xs text-destructive">{probeError}</p> : null}
    </div>
  );
}
