# Clipper

Clipper is a local video-clipping utility: open a video from your machine, configure how it
should be cut, run the job, and review the exported clips.

This repository currently contains the **foundation**: the full UI, the application workflow,
and the boundary where a real local video-processing engine plugs in. **No video processing
exists yet** — engine calls fail loudly instead of faking progress or results.

## Run the development version

```bash
npm install     # or bun install
npm run dev     # http://localhost:8080
npm run build   # production build
npm run lint
```

Stack: React 19 + TypeScript, TanStack Start/Router, Tailwind CSS v4, shadcn/ui components.

## Project structure

```
src/
  core/                     application logic + domain model (no React UI, no browser APIs)
    types.ts                SourceVideo, VideoMetadata, ClipSettings, Job, ClipResult
    clip-settings.ts        defaults, option lists, validation
    video-engine.ts         VideoEngine interface + placeholder engine  <-- the seam
    app-state.tsx           React context store: workflow state, only caller of the engine
    file-selection.ts       browser File -> SourceVideo (replaced by a native dialog)
    format.ts               display formatting helpers
  components/
    layout/                 AppShell (sidebar/chrome), PageHeader, EngineNotice
    video/                  VideoDropzone, SelectedVideoCard
    settings/               SettingRow
    results/                ClipResultCard
    ui/                     shadcn primitives
  routes/                   one file per screen (file-based routing)
    __root.tsx              html shell + providers + AppShell
    index.tsx               Dashboard
    import.tsx              Video import
    configure.tsx           Clipping settings
    processing.tsx          Job progress / cancel / errors
    results.tsx             Generated clips
  styles.css                design tokens (single dark utility theme)
```

## Architecture

```
UI (src/routes, src/components)
        |  reads state, dispatches actions
Application logic (src/core/app-state.tsx)
        |  VideoEngine interface
Video processing engine (not implemented)
        |
Local file system
```

Key decisions:

1. **The UI never imports the engine.** Only `src/core/app-state.tsx` does. Screens call
   `useClipper()` for state and actions.
2. **`src/core/video-engine.ts` is the single seam.** Implement `VideoEngine`
   (`probe`, `createClips`, `revealInFileManager`, `isAvailable`) and return it from
   `getVideoEngine()`. No UI change is needed.
3. **`src/core` is framework-light and UI-agnostic** (only `app-state.tsx` uses React), so it can
   move into a desktop main process or a local service.
4. **No mock processing.** `unavailableVideoEngine` throws `EngineUnavailableError`; the UI shows
   the real error and an explicit "no engine connected" notice.
5. **State is in-memory for one session.** Persisting recent projects and last-used settings
   belongs to the desktop runtime and can live behind the same `useClipper()` API.
6. No auth, no payments, no analytics, no AI claims.

## Next steps for the desktop phase

- Choose the desktop shell (Tauri or Electron) and move the browser dev server behind it.
- Implement an FFmpeg-backed `VideoEngine` in `src/core/engines/` and return it from
  `getVideoEngine()`.
- Replace `file-selection.ts` with a native file dialog so `SourceVideo.path` is a real path.
- Add output-folder picker + `revealInFileManager` via the shell API.
- Persist recent projects and settings to local storage on disk.
