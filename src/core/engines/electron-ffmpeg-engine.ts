/**
 * Real video engine: runs the bundled FFmpeg binary in the desktop main
 * process over IPC. Everything (probing, cutting, revealing files) happens on
 * the user's machine — no uploads, no simulated progress.
 */
import { planClips } from "../clip-plan";
import { getDesktopApi } from "../desktop-bridge";
import type { ClipRequest, VideoEngine } from "../video-engine";
import type { ClipResult, SourceVideo, VideoMetadata } from "../types";

function requireApi() {
  const api = getDesktopApi();
  if (!api) throw new Error("The desktop bridge is not available.");
  return api;
}

function requirePath(source: SourceVideo): string {
  if (!source.path) {
    throw new Error(
      'This video has no file path. Use "Browse files" in the desktop app so Clipper can read it from disk.',
    );
  }
  return source.path;
}

export const electronFfmpegEngine: VideoEngine = {
  name: "FFmpeg (local)",

  async isAvailable(): Promise<boolean> {
    const api = getDesktopApi();
    if (!api) return false;
    return api.engineAvailable();
  },

  async probe(source: SourceVideo): Promise<VideoMetadata> {
    return requireApi().probe(requirePath(source));
  },

  async createClips(request: ClipRequest): Promise<ClipResult[]> {
    const api = requireApi();
    const sourcePath = requirePath(request.source);

    let metadata = request.source.metadata;
    if (!metadata) {
      request.onProgress({
        progress: null,
        currentOperation: "Reading video metadata",
        currentFile: null,
      });
      metadata = await api.probe(sourcePath);
    }

    const plan = planClips(request.settings, metadata);
    if (plan.length === 0) {
      throw new Error("These settings produce no clips. Check the start/end range and duration.");
    }

    const unsubscribe = api.onProgress((payload) => {
      if (payload.jobId !== request.jobId) return;
      request.onProgress({
        progress: payload.progress,
        currentOperation: payload.currentOperation,
        currentFile: payload.currentFile,
      });
    });

    const onAbort = () => {
      void api.cancelJob(request.jobId);
    };
    request.signal.addEventListener("abort", onAbort);

    try {
      const { clips } = await api.createClips({
        jobId: request.jobId,
        sourcePath,
        sourceName: request.source.name,
        plan,
        settings: request.settings,
      });
      return clips.map((clip, index) => ({
        id: `${request.jobId}_${index + 1}`,
        jobId: request.jobId,
        fileName: clip.fileName,
        filePath: clip.filePath,
        durationSeconds: clip.durationSeconds,
        width: clip.width,
        height: clip.height,
        sizeBytes: clip.sizeBytes,
        thumbnailUrl: null,
        startSeconds: clip.startSeconds,
        endSeconds: clip.endSeconds,
      }));
    } finally {
      unsubscribe();
      request.signal.removeEventListener("abort", onAbort);
    }
  },

  async revealInFileManager(filePath: string): Promise<void> {
    await requireApi().revealFile(filePath);
  },
};
