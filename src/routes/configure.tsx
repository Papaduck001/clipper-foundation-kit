import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { EngineNotice } from "@/components/layout/EngineNotice";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingRow } from "@/components/settings/SettingRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { useClipper } from "@/core/app-state";
import {
  ASPECT_RATIO_OPTIONS,
  FORMAT_OPTIONS,
  QUALITY_OPTIONS,
  STRATEGY_OPTIONS,
  validateSettings,
} from "@/core/clip-settings";
import type { AspectRatio, ClipStrategy, OutputFormat, OutputQuality } from "@/core/types";

export const Route = createFileRoute("/configure")({
  head: () => ({
    meta: [
      { title: "Clipping settings — Clipper" },
      {
        name: "description",
        content:
          "Configure clip count, duration, trim range, output format, quality and aspect ratio before running a clipping job.",
      },
      { property: "og:title", content: "Clipping settings — Clipper" },
      {
        property: "og:description",
        content: "Set clip count, duration, trim range, format, quality and aspect ratio.",
      },
    ],
  }),
  component: ConfigurePage,
});

function ConfigurePage() {
  const { source, settings, updateSettings, resetSettings, startJob } = useClipper();
  const navigate = useNavigate();
  const errors = validateSettings(settings);

  if (!source) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Clipping settings" />
        <EmptyState
          title="No video selected"
          description="Import a video before configuring the clipping job."
          action={
            <Button asChild size="sm">
              <Link to="/import">Import a video</Link>
            </Button>
          }
        />
      </div>
    );
  }

  async function handleRun() {
    void navigate({ to: "/processing" });
    await startJob();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Clipping settings"
        description="These values are passed to the processing engine when a job starts."
        actions={
          <Button variant="ghost" size="sm" onClick={resetSettings}>
            Reset defaults
          </Button>
        }
      />

      <EngineNotice className="mb-6" />

      <div className="rounded-lg border border-border bg-card px-4">
        <SettingRow
          label="Clipping mode"
          description="How the source range is divided into clips. Content-aware modes arrive with the engine."
        >
          <Select
            value={settings.strategy}
            onValueChange={(value) => updateSettings({ strategy: value as ClipStrategy })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STRATEGY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          id="clip-count"
          label="Number of clips"
          description="Used by the fixed-interval mode."
        >
          <Input
            id="clip-count"
            type="number"
            min={1}
            value={settings.clipCount}
            disabled={settings.strategy !== "fixed-interval"}
            onChange={(event) => updateSettings({ clipCount: Number(event.target.value) })}
          />
        </SettingRow>

        <SettingRow id="clip-duration" label="Clip duration (seconds)">
          <Input
            id="clip-duration"
            type="number"
            min={1}
            value={settings.clipDurationSeconds}
            onChange={(event) =>
              updateSettings({ clipDurationSeconds: Number(event.target.value) })
            }
          />
        </SettingRow>

        <SettingRow id="start-seconds" label="Start (seconds)">
          <Input
            id="start-seconds"
            type="number"
            min={0}
            value={settings.startSeconds}
            onChange={(event) => updateSettings({ startSeconds: Number(event.target.value) })}
          />
        </SettingRow>

        <SettingRow
          id="end-seconds"
          label="End (seconds)"
          description="Leave empty to run to the end of the video."
        >
          <Input
            id="end-seconds"
            type="number"
            min={0}
            value={settings.endSeconds ?? ""}
            onChange={(event) =>
              updateSettings({
                endSeconds: event.target.value === "" ? null : Number(event.target.value),
              })
            }
          />
        </SettingRow>

        <SettingRow label="Output format">
          <Select
            value={settings.outputFormat}
            onValueChange={(value) => updateSettings({ outputFormat: value as OutputFormat })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow label="Output quality">
          <Select
            value={settings.outputQuality}
            onValueChange={(value) => updateSettings({ outputQuality: value as OutputQuality })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUALITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow label="Aspect ratio">
          <Select
            value={settings.aspectRatio}
            onValueChange={(value) => updateSettings({ aspectRatio: value as AspectRatio })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_RATIO_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          id="output-directory"
          label="Output folder"
          description="Chosen by the desktop build's folder dialog; free text for now."
        >
          <Input
            id="output-directory"
            placeholder="engine default"
            value={settings.outputDirectory ?? ""}
            onChange={(event) =>
              updateSettings({ outputDirectory: event.target.value || null })
            }
          />
        </SettingRow>
      </div>

      {errors.length > 0 ? (
        <ul className="mt-4 space-y-1 text-xs text-destructive">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 flex gap-2">
        <Button size="sm" disabled={errors.length > 0} onClick={handleRun}>
          Start clipping
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link to="/import">Back to import</Link>
        </Button>
      </div>
    </div>
  );
}
