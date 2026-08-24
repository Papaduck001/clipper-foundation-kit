/**
 * Turns a browser `File` from the dev-time file picker into a `SourceVideo`.
 *
 * In the browser there is no absolute path, so `path` stays `null` and
 * `metadata` stays `null` — metadata comes from the engine's `probe()`.
 * A desktop runtime replaces this module with a native file dialog that
 * returns a real path.
 */
import type { SourceVideo } from "./types";

export const ACCEPTED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"];

export function isVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  const name = file.name.toLowerCase();
  return ACCEPTED_VIDEO_EXTENSIONS.some((extension) => name.endsWith(extension));
}

export function sourceVideoFromFile(file: File): SourceVideo {
  return {
    id: `src_${Math.random().toString(36).slice(2, 10)}`,
    name: file.name,
    path: null,
    sizeBytes: file.size,
    mimeType: file.type || null,
    metadata: null,
  };
}
