/** One generated clip. Fields stay empty until a real engine fills them in. */
import { ExternalLink, Film } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatBytes, formatDuration } from "@/core/format";
import type { ClipResult } from "@/core/types";

export function ClipResultCard({
  clip,
  onReveal,
}: {
  clip: ClipResult;
  onReveal: (clip: ClipResult) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex aspect-video items-center justify-center bg-muted">
        {clip.thumbnailUrl ? (
          <img src={clip.thumbnailUrl} alt={clip.fileName} className="size-full object-cover" />
        ) : (
          <Film className="size-6 text-muted-foreground" />
        )}
      </div>
      <div className="space-y-2 p-3">
        <p className="truncate text-sm font-medium text-foreground">{clip.fileName}</p>
        <div className="tech flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
          <span>{formatDuration(clip.durationSeconds)}</span>
          <span>
            {clip.width}x{clip.height}
          </span>
          <span>{formatBytes(clip.sizeBytes)}</span>
        </div>
        <p className="tech truncate text-muted-foreground">{clip.filePath ?? "—"}</p>
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={!clip.filePath}
          onClick={() => onReveal(clip)}
        >
          <ExternalLink className="size-3.5" />
          Show in folder
        </Button>
      </div>
    </div>
  );
}
