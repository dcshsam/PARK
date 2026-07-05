"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
}

/** The "Current Stage" hero bar — shared by the workflow roadmap and the lead events. */
export function StageHeroCard({
  eyebrow = "Current Stage",
  title,
  badge,
  theme = DEFAULT_THEME,
  metrics,
}: StageHeroCardProps) {
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
          <div className="flex flex-wrap gap-4 text-sm">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-xl bg-surface-muted/70 px-4 py-2">
                <p className="text-xs text-text-tertiary">{m.label}</p>
                <p className="font-semibold text-text-primary">{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
