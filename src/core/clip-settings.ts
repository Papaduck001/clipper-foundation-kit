/**
 * Default settings plus the option metadata the configuration UI renders from.
 *
 * The configuration screen loops over these descriptors instead of hardcoding
 * fields, so new options can be added here without touching the layout.
 */
import type {
  AspectRatio,
  ClipSettings,
  ClipStrategy,
  OutputFormat,
  OutputQuality,
} from "./types";

export const DEFAULT_CLIP_SETTINGS: ClipSettings = {
  strategy: "fixed-interval",
  clipCount: 5,
  clipDurationSeconds: 30,
  startSeconds: 0,
  endSeconds: null,
  outputFormat: "mp4",
  outputQuality: "high",
  aspectRatio: "source",
  outputDirectory: null,
};

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export const STRATEGY_OPTIONS: SelectOption<ClipStrategy>[] = [
  {
    value: "fixed-interval",
    label: "Fixed interval",
    hint: "Split the selected range into equal-length clips.",
  },
  {
    value: "manual",
    label: "Manual range",
    hint: "Export a single clip from the start/end range.",
  },
];

export const FORMAT_OPTIONS: SelectOption<OutputFormat>[] = [
  { value: "mp4", label: "MP4 (H.264)" },
  { value: "mov", label: "MOV" },
  { value: "webm", label: "WebM (VP9)" },
];

export const QUALITY_OPTIONS: SelectOption<OutputQuality>[] = [
  { value: "source", label: "Match source" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export const ASPECT_RATIO_OPTIONS: SelectOption<AspectRatio>[] = [
  { value: "source", label: "Source" },
  { value: "16:9", label: "16:9 — landscape" },
  { value: "9:16", label: "9:16 — vertical" },
  { value: "1:1", label: "1:1 — square" },
  { value: "4:5", label: "4:5 — portrait" },
];

/** Basic validation so the UI can block obviously invalid jobs. */
export function validateSettings(settings: ClipSettings): string[] {
  const errors: string[] = [];
  if (settings.clipDurationSeconds <= 0) errors.push("Clip duration must be greater than 0.");
  if (settings.strategy === "fixed-interval" && settings.clipCount < 1) {
    errors.push("Clip count must be at least 1.");
  }
  if (settings.startSeconds < 0) errors.push("Start time cannot be negative.");
  if (settings.endSeconds !== null && settings.endSeconds <= settings.startSeconds) {
    errors.push("End time must be after start time.");
  }
  return errors;
}
