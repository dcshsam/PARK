"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, formatDateTime } from "@/lib/utils";
import { getVerdict, getScoreStats } from "@/lib/ruleset-utils";
import type { AiReviewResult, ReviewRating } from "@/lib/types";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Info,
  Lightbulb,
  Sparkles,
  XCircle,
} from "lucide-react";

interface AiReviewScoreCardProps {
  aiReview: AiReviewResult;
  ratings: ReviewRating[];
  rulesetName?: string;
  finalProposalCount?: number;
  contextDocCount?: number;
  compact?: boolean;
}

function CircularScore({ score }: { score: number }) {
  const radius = 50;
  const stroke = 8;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 10) * circumference;
  const verdict = getVerdict(score);

  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="-rotate-90">
        <circle
          stroke="currentColor"
          fill="transparent"
          strokeWidth={stroke}
          className="text-border"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke="currentColor"
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={cn("transition-all duration-700 ease-out", verdict.ring)}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          style={{
            strokeDasharray: `${circumference} ${circumference}`,
            strokeDashoffset,
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn("text-3xl font-bold", verdict.color)}>{score}</span>
        <span className="text-[10px] font-medium uppercase text-text-tertiary">/ 10</span>
      </div>
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  colorClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  colorClass: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
      <div className={cn("rounded-md p-1.5", colorClass)}>
        <Icon size={14} />
      </div>
      <div>
        <p className="text-xs text-text-tertiary">{label}</p>
        <p className="text-sm font-semibold text-text-primary">{value}</p>
      </div>
    </div>
  );
}

export function AiReviewScoreCard({
  aiReview,
  ratings,
  rulesetName,
  finalProposalCount = 0,
  contextDocCount = 0,
  compact = false,
}: AiReviewScoreCardProps) {
  const verdict = getVerdict(aiReview.overallScore);
  const stats = getScoreStats(ratings);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles size={20} className="text-primary-600" />
              AI Review Score
            </CardTitle>
            <CardDescription>
              {rulesetName ? `Evaluated against "${rulesetName}"` : "AI-powered proposal evaluation"}
            </CardDescription>
          </div>
          <Badge
            className={cn(
              "rounded-full px-3 py-1 text-sm font-semibold uppercase tracking-wide",
              verdict.bg,
              verdict.color
            )}
          >
            {verdict.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Main score + verdict */}
        <div className={cn("flex flex-col gap-6", compact ? "sm:flex-row sm:items-center" : "lg:flex-row lg:items-center")}>
          <CircularScore score={aiReview.overallScore} />

          <div className="flex-1 space-y-4">
            <div>
              <p className={cn("text-lg font-semibold", verdict.color)}>{verdict.label}</p>
              <p className="text-sm text-text-secondary">{verdict.description}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-tertiary">Score quality</span>
                <span className="font-medium text-text-primary">{aiReview.overallScore} / 10</span>
              </div>
              <Progress value={aiReview.overallScore * 10} className="h-2.5" />
            </div>

            <p className="text-xs text-text-muted">
              Generated {formatDateTime(aiReview.generatedAt)}
              {aiReview.modelUsed && ` · ${aiReview.modelUsed}`}
            </p>
          </div>
        </div>

        {/* Stats grid */}
        <div className={cn("grid grid-cols-2 gap-3", compact ? "sm:grid-cols-2" : "sm:grid-cols-4")}>
          <StatPill
            icon={FileText}
            label="Criteria reviewed"
            value={stats.total}
            colorClass="bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-400"
          />
          <StatPill
            icon={XCircle}
            label="Error type avg"
            value={stats.error.avg.toFixed(1)}
            colorClass="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
          />
          <StatPill
            icon={AlertTriangle}
            label="Warning type avg"
            value={stats.warning.avg.toFixed(1)}
            colorClass="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
          />
          <StatPill
            icon={Lightbulb}
            label="Suggestion avg"
            value={stats.suggestion.avg.toFixed(1)}
            colorClass="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
          />
        </div>

        {/* Flags */}
        {stats.belowThreshold > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10">
            <XCircle size={18} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                {stats.belowThreshold} criterion{stats.belowThreshold > 1 ? "ia" : "ion"} scored below 6/10
              </p>
              <p className="text-xs text-red-700 dark:text-red-400">
                Review the scorecard below to identify the gaps needing attention.
              </p>
            </div>
          </div>
        )}

        {stats.belowThreshold === 0 && stats.total > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-500/30 dark:bg-green-500/10">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-300">All criteria scored 6 or above</p>
              <p className="text-xs text-green-700 dark:text-green-400">
                The proposal meets the minimum threshold across the board.
              </p>
            </div>
          </div>
        )}

        {/* Document scope */}
        {!compact && (
        <div className="rounded-xl border border-border bg-surface-muted/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Info size={16} className="text-text-tertiary" />
            <p className="text-sm font-medium text-text-primary">Review scope</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
              <span className="text-sm text-text-secondary">Final proposal files</span>
              <span className="text-sm font-semibold text-text-primary">{finalProposalCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
              <span className="text-sm text-text-secondary">Context documents</span>
              <span className="text-sm font-semibold text-text-primary">{contextDocCount}</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-text-tertiary">
            Scoring is based strictly on the final proposal. Supporting documents are used only to understand customer
            requirements.
          </p>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
