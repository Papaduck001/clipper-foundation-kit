/**
 * Turns clip settings into concrete time ranges. Pure logic, shared by the UI
 * and by the desktop engine, so both agree on what a job will produce.
 */
import type { ClipSettings, VideoMetadata } from "./types";

export interface PlannedClip {
  start: number;
  end: number;
}

export function planClips(
  settings: ClipSettings,
  metadata: VideoMetadata | null,
): PlannedClip[] {
  const duration = metadata?.durationSeconds ?? null;
  const start = Math.max(0, settings.startSeconds);
  const end =
    settings.endSeconds !== null
      ? settings.endSeconds
      : duration !== null
        ? duration
        : start + settings.clipDurationSeconds;
  const span = end - start;
  if (span <= 0) return [];

  if (settings.strategy === "manual") {
    return [{ start, end }];
  }

  const count = Math.max(1, Math.floor(settings.clipCount));
  const clipLength = Math.min(settings.clipDurationSeconds, span);
  const step = count === 1 ? 0 : Math.max(0, (span - clipLength) / (count - 1));
  const clips: PlannedClip[] = [];
  for (let i = 0; i < count; i++) {
    const clipStart = start + step * i;
    const clipEnd = Math.min(end, clipStart + clipLength);
    if (clipEnd - clipStart > 0.05) clips.push({ start: clipStart, end: clipEnd });
  }
  return clips;
}
