/**
 * Application logic layer: owns the workflow state (selected video, settings,
 * current job, results) and is the only place that talks to the video engine.
 *
 * The UI reads/writes this state through `useClipper()` and never imports the
 * engine directly. Swapping in a real engine therefore requires no UI changes.
 *
 * State is in-memory only. Persistence (recent projects, last-used settings)
 * belongs to the desktop runtime and can be added here behind the same API.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { DEFAULT_CLIP_SETTINGS } from "./clip-settings";
import { getVideoEngine } from "./video-engine";
import type { ClipResult, ClipSettings, Job, RecentProject, SourceVideo } from "./types";

interface ClipperState {
  engineName: string;
  engineAvailable: boolean | null;
  source: SourceVideo | null;
  settings: ClipSettings;
  job: Job | null;
  results: ClipResult[];
  recentProjects: RecentProject[];
}

interface ClipperActions {
  selectSource: (source: SourceVideo) => void;
  clearSource: () => void;
  probeSource: () => Promise<void>;
  updateSettings: (patch: Partial<ClipSettings>) => void;
  resetSettings: () => void;
  startJob: () => Promise<void>;
  cancelJob: () => void;
  clearJob: () => void;
  revealClip: (clip: ClipResult) => Promise<void>;
  checkEngine: () => Promise<void>;
}

type ClipperContextValue = ClipperState & ClipperActions;

const ClipperContext = createContext<ClipperContextValue | null>(null);

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function ClipperProvider({ children }: { children: ReactNode }) {
  const engine = useMemo(() => getVideoEngine(), []);
  const abortRef = useRef<AbortController | null>(null);

  const [engineAvailable, setEngineAvailable] = useState<boolean | null>(null);
  const [source, setSource] = useState<SourceVideo | null>(null);
  const [settings, setSettings] = useState<ClipSettings>(DEFAULT_CLIP_SETTINGS);
  const [job, setJob] = useState<Job | null>(null);
  const [results, setResults] = useState<ClipResult[]>([]);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  const checkEngine = useCallback(async () => {
    setEngineAvailable(await engine.isAvailable());
  }, [engine]);

  const selectSource = useCallback((next: SourceVideo) => {
    setSource(next);
    setResults([]);
    setJob(null);
    setRecentProjects((prev) => [
      { id: next.id, videoName: next.name, openedAt: Date.now(), clipCount: 0 },
      ...prev.filter((project) => project.videoName !== next.name),
    ]);
  }, []);

  const clearSource = useCallback(() => {
    setSource(null);
    setResults([]);
    setJob(null);
  }, []);

  const probeSource = useCallback(async () => {
    if (!source) return;
    const metadata = await engine.probe(source);
    setSource((prev) => (prev ? { ...prev, metadata } : prev));
  }, [engine, source]);

  const updateSettings = useCallback((patch: Partial<ClipSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetSettings = useCallback(() => setSettings(DEFAULT_CLIP_SETTINGS), []);

  const startJob = useCallback(async () => {
    if (!source) return;
    const controller = new AbortController();
    abortRef.current = controller;

    const jobId = createId("job");
    setResults([]);
    setJob({
      id: jobId,
      sourceVideoId: source.id,
      status: "queued",
      progress: null,
      currentOperation: "Waiting for the processing engine",
      currentFile: null,
      startedAt: Date.now(),
      finishedAt: null,
      error: null,
    });

    try {
      const clips = await engine.createClips({
        jobId,
        source,
        settings,
        signal: controller.signal,
        onProgress: ({ progress, currentOperation, currentFile }) => {
          setJob((prev) =>
            prev && prev.id === jobId
              ? { ...prev, status: "clipping", progress, currentOperation, currentFile }
              : prev,
          );
        },
      });
      setResults(clips);
      setJob((prev) =>
        prev && prev.id === jobId
          ? {
              ...prev,
              status: "completed",
              progress: 1,
              currentOperation: "Done",
              currentFile: null,
              finishedAt: Date.now(),
            }
          : prev,
      );
      setRecentProjects((prev) =>
        prev.map((project) =>
          project.id === source.id ? { ...project, clipCount: clips.length } : project,
        ),
      );
    } catch (error) {
      const cancelled = controller.signal.aborted;
      setJob((prev) =>
        prev && prev.id === jobId
          ? {
              ...prev,
              status: cancelled ? "cancelled" : "failed",
              currentOperation: null,
              currentFile: null,
              finishedAt: Date.now(),
              error: cancelled ? null : error instanceof Error ? error.message : String(error),
            }
          : prev,
      );
    } finally {
      abortRef.current = null;
    }
  }, [engine, settings, source]);

  const cancelJob = useCallback(() => {
    abortRef.current?.abort();
    setJob((prev) =>
      prev && (prev.status === "queued" || prev.status === "clipping")
        ? { ...prev, status: "cancelled", currentOperation: null, finishedAt: Date.now() }
        : prev,
    );
  }, []);

  const clearJob = useCallback(() => setJob(null), []);

  const revealClip = useCallback(
    async (clip: ClipResult) => {
      if (!clip.filePath) return;
      await engine.revealInFileManager(clip.filePath);
    },
    [engine],
  );

  const value = useMemo<ClipperContextValue>(
    () => ({
      engineName: engine.name,
      engineAvailable,
      source,
      settings,
      job,
      results,
      recentProjects,
      selectSource,
      clearSource,
      probeSource,
      updateSettings,
      resetSettings,
      startJob,
      cancelJob,
      clearJob,
      revealClip,
      checkEngine,
    }),
    [
      engine.name,
      engineAvailable,
      source,
      settings,
      job,
      results,
      recentProjects,
      selectSource,
      clearSource,
      probeSource,
      updateSettings,
      resetSettings,
      startJob,
      cancelJob,
      clearJob,
      revealClip,
      checkEngine,
    ],
  );

  return <ClipperContext.Provider value={value}>{children}</ClipperContext.Provider>;
}

export function useClipper(): ClipperContextValue {
  const context = useContext(ClipperContext);
  if (!context) throw new Error("useClipper must be used inside <ClipperProvider>");
  return context;
}
