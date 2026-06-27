"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, formatDateTime } from "@/lib/utils";
import { categoryLabels, requirementStatusLabels } from "@/lib/types";
import type { DynamicReview, DynamicRequirement, RequirementCoverageStatus } from "@/lib/types";
import { CheckCircle2, CircleDashed, XCircle, ListChecks } from "lucide-react";

interface DynamicRequirementsCardProps {
  dynamicReview: DynamicReview;
}

const statusStyle: Record<
  RequirementCoverageStatus,
  { badge: string; icon: React.ElementType; iconColor: string }
> = {
  covered: {
    badge: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
    icon: CheckCircle2,
    iconColor: "text-green-600 dark:text-green-400",
  },
  partial: {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
    icon: CircleDashed,
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  missing: {
    badge: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
    icon: XCircle,
    iconColor: "text-red-600 dark:text-red-400",
  },
};

function scoreColor(score: number): string {
  if (score >= 8) return "text-green-600 dark:text-green-400";
  if (score >= 6) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function CountPill({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status: RequirementCoverageStatus;
}) {
  const style = statusStyle[status];
  const Icon = style.icon;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
      <div className={cn("rounded-md p-1.5", style.badge)}>
        <Icon size={14} />
      </div>
      <div>
        <p className="text-xs text-text-tertiary">{label}</p>
        <p className="text-sm font-semibold text-text-primary">{value}</p>
      </div>
    </div>
  );
}

function RequirementRow({ req }: { req: DynamicRequirement }) {
  const style = statusStyle[req.status];
  const Icon = style.icon;
  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Icon size={16} className={cn("mt-0.5 shrink-0", style.iconColor)} />
          <div>
            <p className="text-sm font-medium text-text-primary">{req.text}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                  style.badge
                )}
              >
                {requirementStatusLabels[req.status]}
              </span>
              {req.category && (
                <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-text-secondary">
                  {req.category}
                </span>
              )}
              {req.priority && (
                <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-text-secondary">
                  {req.priority}
                </span>
              )}
            </div>
          </div>
        </div>
        <span className={cn("shrink-0 text-sm font-semibold", scoreColor(req.score))}>
          {req.score} / 10
        </span>
      </div>

      {req.evidence && (
        <div className="rounded-lg bg-surface-muted/50 p-2">
          <p className="text-[10px] font-semibold uppercase text-text-tertiary">Evidence</p>
          <p className="text-xs text-text-secondary">{req.evidence}</p>
        </div>
      )}
      {req.feedback && (
        <div className="rounded-lg bg-surface-muted/50 p-2">
          <p className="text-[10px] font-semibold uppercase text-text-tertiary">Assessment</p>
          <p className="text-xs text-text-secondary">{req.feedback}</p>
        </div>
      )}
      {req.recommendation && req.status !== "covered" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-400">
            How to close the gap
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-300">{req.recommendation}</p>
        </div>
      )}
    </div>
  );
}

export function DynamicRequirementsCard({ dynamicReview }: DynamicRequirementsCardProps) {
  const { requirements, total, coveredCount, partialCount, missingCount, score } = dynamicReview;
  const coveragePct = total > 0 ? Math.round(((coveredCount + 0.5 * partialCount) / total) * 100) : 0;

  // Group by source (rfp -> transcript -> customer_doc), preserving requirement order.
  const sourceOrder: DynamicRequirement["source"][] = ["rfp", "transcript", "customer_doc"];
  const grouped = sourceOrder
    .map((source) => ({
      source,
      items: requirements.filter((r) => r.source === source),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <ListChecks size={20} className="text-primary-600" />
          Dynamic Requirements Coverage
        </CardTitle>
        <CardDescription>
          Requirements auto-extracted from the RFP, meeting transcript, and customer documents, then
          checked against the final proposal.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Coverage summary */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface px-6 py-4">
            <span className={cn("text-3xl font-bold", scoreColor(score))}>{coveragePct}%</span>
            <span className="text-[10px] font-medium uppercase text-text-tertiary">Coverage</span>
          </div>

          <div className="flex-1 space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-tertiary">Coverage score</span>
                <span className="font-medium text-text-primary">{score} / 10</span>
              </div>
              <Progress value={coveragePct} className="h-2.5" />
            </div>
            <Badge variant="secondary">
              {coveredCount} of {total} requirements fully covered
            </Badge>
          </div>
        </div>

        {/* Count pills */}
        <div className="grid grid-cols-3 gap-3">
          <CountPill label="Covered" value={coveredCount} status="covered" />
          <CountPill label="Partial" value={partialCount} status="partial" />
          <CountPill label="Missing" value={missingCount} status="missing" />
        </div>

        {/* Requirements grouped by source */}
        <div className="space-y-5">
          {grouped.map((group) => (
            <div key={group.source} className="space-y-3">
              <p className="text-sm font-semibold text-text-primary">
                {categoryLabels[group.source]}{" "}
                <span className="text-xs font-normal text-text-tertiary">
                  ({group.items.length})
                </span>
              </p>
              <div className="space-y-3">
                {group.items.map((req) => (
                  <RequirementRow key={req.id} req={req} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-text-muted">Generated {formatDateTime(dynamicReview.generatedAt)}</p>
      </CardContent>
    </Card>
  );
}
