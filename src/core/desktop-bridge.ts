/**
 * Typed access to the desktop (Electron) bridge exposed by electron/preload.cjs.
 * Returns `null` in the browser dev build, where no local processing exists.
 */
import type { ClipSettings, VideoMetadata } from "./types";
import type { PlannedClip } from "./clip-plan";

export interface DesktopClip {
  fileName: string;
  filePath: string;
  sizeBytes: number | null;
  durationSeconds: number;
  width: number;
  height: number;
  startSeconds: number;
  endSeconds: number;
}

export interface DesktopProgress {
  jobId: string;
  progress: number;
  currentOperation: string;
  currentFile: string | null;
}

export interface ClipperDesktopApi {
  isDesktop: true;
  engineAvailable(): Promise<boolean>;
  probe(filePath: string): Promise<VideoMetadata>;
  selectVideo(): Promise<{ path: string; name: string; sizeBytes: number } | null>;
  selectOutputFolder(): Promise<string | null>;
  createClips(payload: {
    jobId: string;
    sourcePath: string;
    sourceName: string;
    plan: PlannedClip[];
    settings: ClipSettings;
  }): Promise<{ outputDir: string; clips: DesktopClip[] }>;
  cancelJob(jobId: string): Promise<boolean>;
  revealFile(filePath: string): Promise<void>;
  openFile(filePath: string): Promise<void>;
  copyText(text: string): Promise<void>;
  onProgress(handler: (payload: DesktopProgress) => void): () => void;
}

declare global {
  interface Window {
    clipper?: ClipperDesktopApi;
  }
}

export function getDesktopApi(): ClipperDesktopApi | null {
  if (typeof window === "undefined") return null;
  return window.clipper ?? null;
}
