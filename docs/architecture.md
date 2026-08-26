# Clipper architecture notes

Short reference for anyone (human or AI agent) continuing development.

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| UI | `src/routes`, `src/components` | Rendering and user input only. No engine imports, no file IO. |
| Application logic | `src/core/app-state.tsx` | Workflow state machine: selected video, settings, job lifecycle, results. Sole caller of the engine. |
| Domain model | `src/core/types.ts`, `clip-settings.ts`, `format.ts` | Plain TypeScript. No React, no browser APIs. |
| Engine contract | `src/core/video-engine.ts` | `VideoEngine` interface + placeholder implementation. |
| Engine implementation | *not written yet* | FFmpeg sidecar / native module in the desktop build. |
| File system | *not written yet* | Native file + folder dialogs, output paths, reveal-in-explorer. |

## Workflow

`Import` → `Configure` → `Processing` → `Results`, each a route. The sidebar exposes all four plus
the dashboard, so the user can jump around; screens that need a source video show an empty state
with a link back to import.

## Job lifecycle

`startJob()` creates a `Job` (`queued`), calls `engine.createClips()` with an `AbortSignal` and an
`onProgress` callback, then settles the job as `completed`, `cancelled` or `failed`. `cancelJob()`
aborts the signal; a real engine must terminate its subprocess on abort.

## Adding a setting

1. Add the field to `ClipSettings` in `src/core/types.ts`.
2. Add a default in `DEFAULT_CLIP_SETTINGS` (and an option list if it is a select).
3. Add a `<SettingRow>` in `src/routes/configure.tsx`.
4. Consume it in the engine implementation.

## Intentional non-goals

No authentication, accounts, payments, analytics, charts, or social features. No simulated
processing, no fake AI. If a feature is not implemented, the UI says so.
