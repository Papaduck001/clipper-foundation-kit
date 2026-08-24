/**
 * The boundary between Clipper's UI/application logic and real video processing.
 *
 * NOTHING in this file processes video. It only declares the contract that a
 * real engine (FFmpeg via a Tauri/Electron sidecar, or a local Node service)
 * must implement during the desktop phase.
 *
 * The app currently runs with `unavailableVideoEngine`, which rejects every
 * call with `EngineUnavailableError`. The UI surfaces that state honestly
 * instead of faking progress or results.
 *
 * To wire up a real engine:
 *   1. Implement `VideoEngine` in e.g. `src/core/engines/ffmpeg-engine.ts`.
 *   2. Return it from `getVideoEngine()` below.
 *   No UI changes are required.
 */
import type { ClipResult, ClipSettings, SourceVideo, VideoMetadata } from "./types";

export interface EngineProgress {
  /** 0-1, or `null` when the operation cannot report a percentage. */
  progress: number | null;
  currentOperation: string;
  currentFile: string | null;
}

export interface ClipRequest {
  jobId: string;
  source: SourceVideo;
  settings: ClipSettings;
  onProgress: (progress: EngineProgress) => void;
  /** Aborting this signal must stop the underlying process. */
  signal: AbortSignal;
}

export interface VideoEngine {
  /** Human-readable engine name, shown in the UI status bar. */
  readonly name: string;
  /** Whether the engine can actually run on this host. */
  isAvailable(): Promise<boolean>;
  /** Read technical metadata from a local file. */
  probe(source: SourceVideo): Promise<VideoMetadata>;
  /** Produce clips. Resolves once every clip has been written to disk. */
  createClips(request: ClipRequest): Promise<ClipResult[]>;
  /** Reveal a produced file in the OS file manager. */
  revealInFileManager(filePath: string): Promise<void>;
}

export class EngineUnavailableError extends Error {
  constructor(operation: string) {
    super(
      `Video engine not available: "${operation}" requires the local processing engine, which is not implemented yet.`,
    );
    this.name = "EngineUnavailableError";
  }
}

/** Placeholder engine used until a real one is connected. */
export const unavailableVideoEngine: VideoEngine = {
  name: "No engine connected",
  async isAvailable() {
    return false;
  },
  async probe() {
    throw new EngineUnavailableError("probe");
  },
  async createClips() {
    throw new EngineUnavailableError("createClips");
  },
  async revealInFileManager() {
    throw new EngineUnavailableError("revealInFileManager");
  },
};

/** Single place where the active engine is chosen. */
export function getVideoEngine(): VideoEngine {
  return unavailableVideoEngine;
}
