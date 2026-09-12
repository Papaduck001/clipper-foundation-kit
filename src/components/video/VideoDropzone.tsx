/** File picker + drag & drop target for selecting one local video. */
import { Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  ACCEPTED_VIDEO_EXTENSIONS,
  isVideoFile,
  sourceVideoFromFile,
  sourceVideoFromNative,
} from "@/core/file-selection";
import { getDesktopApi } from "@/core/desktop-bridge";
import type { SourceVideo } from "@/core/types";
import { cn } from "@/lib/utils";

export function VideoDropzone({ onSelect }: { onSelect: (source: SourceVideo) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const desktop = getDesktopApi();

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

  async function browseNative() {
    const picked = await desktop?.selectVideo();
    if (picked) {
      setError(null);
      onSelect(sourceVideoFromNative(picked));
    }
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
          const file = event.dataTransfer.files?.[0] as (File & { path?: string }) | undefined;
          if (desktop && file?.path) {
            setError(null);
            onSelect(
              sourceVideoFromNative({ path: file.path, name: file.name, sizeBytes: file.size }),
            );
            return;
          }
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
        <Button
          variant="secondary"
          size="sm"
          onClick={() => (desktop ? void browseNative() : inputRef.current?.click())}
        >
          {desktop ? "Browse files" : "Select video"}
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
      {!desktop ? (
        <p className="mt-3 text-xs text-muted-foreground">
          In the browser dev build the file picker cannot read an absolute path, so local processing
          is disabled. The desktop build reads the file directly from disk.
        </p>
      ) : null}
    </div>
  );
}
