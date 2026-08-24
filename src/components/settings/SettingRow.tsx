/** Label + description + control row used by the configuration screen. */
import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

export function SettingRow({
  id,
  label,
  description,
  children,
}: {
  id?: string;
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 border-b border-border py-4 last:border-b-0 sm:grid-cols-[1fr_16rem] sm:items-center sm:gap-6">
      <div>
        <Label htmlFor={id} className="text-sm text-foreground">
          {label}
        </Label>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div>{children}</div>
    </div>
  );
}
