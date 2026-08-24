/** File picker + drag & drop target for selecting one local video. */
import { Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ACCEPTED_VIDEO_EXTENSIONS, isVideoFile, sourceVideoFromFile } from "@/core/file-selection";
import type { SourceVideo } from "@/core/types";
import { cn } from "@/lib/utils";

export function VideoDropzone({ onSelect }: { onSelect: (source: SourceVideo) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!isVideoFile(file)) {
      setError("That file is not a supported video format.");
      return;
    }
    setError(null);
    onSelect(sourceVideoFromFile(file));
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center transition-colors",
          dragging && "border-primary bg-accent",
        )}
      >
        <Upload className="size-6 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">Drop a video file here</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ACCEPTED_VIDEO_EXTENSIONS.join("  ")}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          Select video
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      <p className="mt-3 text-xs text-muted-foreground">
        In the browser dev build the file picker cannot read an absolute path. The desktop build
        replaces <span className="tech">src/core/file-selection.ts</span> with a native dialog.
      </p>
    </div>
  );
}
