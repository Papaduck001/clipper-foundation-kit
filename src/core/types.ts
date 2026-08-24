/**
 * Core domain types for Clipper.
 *
 * These types are intentionally UI-agnostic. They describe the data that flows
 * between the UI layer, the application logic layer (`src/core/app-state.tsx`)
 * and the future video-processing engine (`src/core/video-engine.ts`).
 *
 * Nothing here depends on React, the browser, or any Lovable-specific API,
 * so the whole `src/core` folder can be reused as-is by a desktop runtime
 * (Electron / Tauri main process, or a local Node service).
 */

/** A local video file the user selected as the source for clipping. */
export interface SourceVideo {
  /** Stable id generated when the file is selected. */
  id: string;
  /** File name, e.g. `podcast-ep-12.mp4`. */
  name: string;
  /**
   * Absolute path on the user's machine.
   * The browser cannot read this; a desktop runtime fills it in.
   */
  path: string | null;
  /** Size in bytes, when known. */
  sizeBytes: number | null;
  /** Container/mime type reported by the OS or the browser file picker. */
  mimeType: string | null;
  /** Metadata produced by the engine's `probe()` call. `null` until probed. */
  metadata: VideoMetadata | null;
}

/** Technical information about a video, produced by the processing engine. */
export interface VideoMetadata {
  durationSeconds: number;
  width: number;
  height: number;
  frameRate: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  bitrateKbps: number | null;
}

export type OutputFormat = "mp4" | "mov" | "webm";
export type OutputQuality = "low" | "medium" | "high" | "source";
export type AspectRatio = "source" | "16:9" | "9:16" | "1:1" | "4:5";
/**
 * `manual` = clip only the explicit time range below.
 * `fixed-interval` = cut the range into N clips of a fixed duration.
 * Additional strategies (e.g. scene/transcript driven) are added here once
 * the engine supports them. Nothing analyses content today.
 */
export type ClipStrategy = "manual" | "fixed-interval";

/** Everything the user can configure before starting a job. */
export interface ClipSettings {
  strategy: ClipStrategy;
  /** Number of clips to produce (used by `fixed-interval`). */
  clipCount: number;
  /** Target duration of each clip, in seconds. */
  clipDurationSeconds: number;
  /** Trim window within the source video, in seconds. */
  startSeconds: number;
  /** `null` means "until end of video". */
  endSeconds: number | null;
  outputFormat: OutputFormat;
  outputQuality: OutputQuality;
  aspectRatio: AspectRatio;
  /** Directory clips are written to. `null` = engine default. */
  outputDirectory: string | null;
}

export type JobStatus =
  | "idle"
  | "queued"
  | "probing"
  | "clipping"
  | "exporting"
  | "completed"
  | "cancelled"
  | "failed";

/** Live state of one clipping run. */
export interface Job {
  id: string;
  sourceVideoId: string;
  status: JobStatus;
  /** 0-1. `null` when the engine cannot report progress. */
  progress: number | null;
  /** Human-readable description of what the engine is doing right now. */
  currentOperation: string | null;
  /** File currently being written, if any. */
  currentFile: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
}

/** One clip produced by a completed job. */
export interface ClipResult {
  id: string;
  jobId: string;
  fileName: string;
  /** Absolute path on disk. `null` until a real engine writes the file. */
  filePath: string | null;
  durationSeconds: number;
  width: number;
  height: number;
  sizeBytes: number | null;
  /** Local path or object URL of a thumbnail frame, when the engine makes one. */
  thumbnailUrl: string | null;
  startSeconds: number;
  endSeconds: number;
}

/** A previously opened video, listed on the dashboard. */
export interface RecentProject {
  id: string;
  videoName: string;
  openedAt: number;
  clipCount: number;
}
