/**
 * Honest status notice: the local processing engine is not implemented yet, so
 * probing and clipping will fail on purpose rather than showing fake output.
 */
import { TriangleAlert } from "lucide-react";

export function EngineNotice({ className }: { className?: string }) {
  return (
    <div
      className={`flex gap-3 rounded-lg border border-border bg-surface p-4 text-sm ${className ?? ""}`}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
      <div className="space-y-1">
        <p className="font-medium text-foreground">No processing engine connected</p>
        <p className="text-muted-foreground">
          Video analysis and clipping run through a local engine that has not been implemented yet.
          Settings can be configured and jobs can be started, but every engine call will report an
          error until <span className="tech">src/core/video-engine.ts</span> returns a real
          implementation.
        </p>
      </div>
    </div>
  );
}
