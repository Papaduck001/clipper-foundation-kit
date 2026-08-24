/** Persistent desktop-style chrome: left navigation, title bar, status bar. */
import { Link } from "@tanstack/react-router";
import { Film, FolderInput, Settings2, Activity, Scissors } from "lucide-react";
import type { ReactNode } from "react";

import { useClipper } from "@/core/app-state";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: Film },
  { to: "/import", label: "Import", icon: FolderInput },
  { to: "/configure", label: "Configure", icon: Settings2 },
  { to: "/processing", label: "Processing", icon: Activity },
  { to: "/results", label: "Results", icon: Scissors },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { source, engineName } = useClipper();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Scissors className="size-4" />
          </span>
          <span className="text-sm font-semibold text-sidebar-foreground">Clipper</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{
                className: cn("bg-sidebar-accent text-sidebar-accent-foreground font-medium"),
              }}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-sidebar-border px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Engine</p>
          <p className="tech mt-1 text-muted-foreground">{engineName}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-between border-b border-border bg-surface px-6">
          <p className="tech truncate text-muted-foreground">
            {source ? source.name : "No video selected"}
          </p>
          <p className="text-xs text-muted-foreground">Local video clipping utility</p>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
