"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface StageHeroTheme {
  /** Text color class for the stage title. */
  color: string;
  /** Solid background class for the top accent bar. */
  bg: string;
  /** Border color class for the left accent border. */
  border: string;
  /** Light background class for the badge. */
  lightBg: string;
}

const DEFAULT_THEME: StageHeroTheme = {
  color: "text-blue-700 dark:text-blue-300",
  bg: "bg-blue-600",
  border: "border-blue-200 dark:border-blue-500/30",
  lightBg: "bg-blue-50 dark:bg-blue-500/10",
};

interface StageHeroCardProps {
  /** Small label above the title (defaults to "Current Stage"). */
  eyebrow?: string;
  title: string;
  badge?: string;
  theme?: StageHeroTheme;
  metrics: { label: string; value: string }[];
  timingPaused?: boolean;
  pauseReason?: string;
  onPause?: (reason: string) => void;
  onResume?: () => void;
}

/** The "Current Stage" hero bar — shared by the workflow roadmap and the lead events. */
export function StageHeroCard({
  eyebrow = "Current Stage",
  title,
  badge,
  theme = DEFAULT_THEME,
  metrics,
  timingPaused = false,
  pauseReason,
  onPause,
  onResume,
}: StageHeroCardProps) {
  const [reason, setReason] = useState("");

  return (
    <Card className={cn("overflow-hidden border-l-4", theme.border)}>
      <div className={cn("h-2 w-full", theme.bg)} />
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-text-tertiary">{eyebrow}</p>
            <h2 className={cn("text-2xl font-bold", theme.color)}>{title}</h2>
            {badge && (
              <Badge variant="secondary" className={cn("font-medium", theme.lightBg, theme.color)}>
                {badge}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-4 text-sm">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-xl bg-surface-muted/70 px-4 py-2">
                <p className="text-xs text-text-tertiary">{m.label}</p>
                <p className="font-semibold text-text-primary">{m.value}</p>
              </div>
            ))}
            {onPause && onResume && (
              <div className="min-w-56 rounded-xl border border-border bg-surface-muted/40 p-2">
                <p className="mb-1.5 text-xs font-semibold text-text-secondary">Pause event</p>
                {timingPaused ? (
                  <div className="flex items-center gap-2">
                    {pauseReason && (
                      <p className="max-w-36 text-xs text-text-tertiary" title={pauseReason}>
                        {pauseReason}
                      </p>
                    )}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={false}
                      aria-label="Resume time"
                      onClick={() => {
                        onResume();
                        setReason("");
                      }}
                      className="relative flex h-10 w-[92px] items-center justify-between rounded-full bg-neutral-400 px-2 text-sm font-semibold text-white shadow-inner transition-colors hover:bg-neutral-500"
                    >
                      <span className="pl-1">OFF</span>
                      <span className="h-8 w-8 rounded-full bg-white shadow-md" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Pause comment"
                      className="h-9 w-36 text-xs"
                      aria-label="Pause comment"
                    />
                    <button
                      type="button"
                      role="switch"
                      aria-checked={true}
                      aria-label="Pause time"
                      disabled={!reason.trim()}
                      onClick={() => onPause(reason.trim())}
                      className="relative flex h-10 w-[92px] items-center justify-between rounded-full bg-primary-600 px-2 text-sm font-semibold text-white shadow-inner transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="pl-1">ON</span>
                      <span className="h-8 w-8 rounded-full bg-white shadow-md" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
