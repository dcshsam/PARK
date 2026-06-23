"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProposals } from "@/lib/db";
import type { Proposal } from "@/lib/types";
import { statusLabels } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, cn } from "@/lib/utils";
import {
  FileText,
  Clock,
  CheckCircle2,
  Plus,
  ArrowRight,
  RotateCcw,
  TrendingUp,
  Activity,
} from "lucide-react";
import { getCycleSummary } from "@/lib/workflow-utils";
import { formatDurationShort } from "@/lib/workflow-utils";

export default function DashboardPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProposals().then((data) => {
      setProposals(data);
      setLoading(false);
    });
  }, []);

  const inRework = proposals.filter((p) => p.workflowStage?.endsWith("_rework")).length;

  const completedProposalCycles = proposals.flatMap((p) =>
    p.workflowCycles
      .filter((c) => c.cycleType === "proposal" && c.completedAt)
      .map((c) => getCycleSummary(c, p.workflowEvents).durationMs)
  );
  const avgProposalCycleDuration =
    completedProposalCycles.length > 0
      ? completedProposalCycles.reduce((a, b) => a + b, 0) / completedProposalCycles.length
      : 0;

  const allCycles = proposals.flatMap((p) =>
    p.workflowCycles.map((c) => getCycleSummary(c, p.workflowEvents).iterations)
  );
  const avgIterations = allCycles.length > 0 ? allCycles.reduce((a, b) => a + b, 0) / allCycles.length : 0;

  const stats = {
    total: proposals.length,
    underReview: proposals.filter((p) => p.status === "under_review").length,
    approved: proposals.filter((p) => p.status === "approved").length,
    inRework,
  };

  const recent = proposals.slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">Dashboard</h1>
          <p className="text-text-secondary">Overview of your proposal reviews and activities.</p>
        </div>
        <Link href="/proposals/new">
          <Button>
            <Plus size={18} className="mr-2" />
            New Review
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FileText}
          label="Total Proposals"
          value={stats.total}
          color="text-primary-600"
          bg="bg-primary-50 dark:bg-primary-50/10"
          trend="All time"
        />
        <StatCard
          icon={Clock}
          label="Under Review"
          value={stats.underReview}
          color="text-amber-600"
          bg="bg-amber-50 dark:bg-amber-50/10"
          trend="Active"
        />
        <StatCard
          icon={CheckCircle2}
          label="Approved"
          value={stats.approved}
          color="text-green-600"
          bg="bg-green-50 dark:bg-green-50/10"
          trend="Won"
        />
        <StatCard
          icon={RotateCcw}
          label="In Rework"
          value={stats.inRework}
          color="text-red-600"
          bg="bg-red-50 dark:bg-red-50/10"
          trend="Needs attention"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent proposals</CardTitle>
              <CardDescription>Latest reviews across your pipeline.</CardDescription>
            </div>
            <Link href="/proposals">
              <Button variant="ghost" size="sm">
                View all <ArrowRight size={16} className="ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-muted" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <EmptyState message="No proposals yet. Create your first review." />
            ) : (
              <div className="divide-y divide-border-subtle">
                {recent.map((proposal) => (
                  <Link
                    key={proposal.id}
                    href={`/proposals/${proposal.id}`}
                    className="group flex items-center justify-between rounded-lg py-4 transition-colors hover:bg-surface-muted/50"
                  >
                    <div className="min-w-0 px-2">
                      <p className="truncate text-sm font-medium text-text-primary group-hover:text-primary-600">
                        {proposal.title}
                      </p>
                      <p className="text-xs text-text-tertiary">{proposal.clientName}</p>
                    </div>
                    <div className="flex items-center gap-3 px-2">
                      {proposal.aiReview && (
                        <span className={cn(
                          "rounded-md px-2 py-0.5 text-xs font-semibold",
                          proposal.aiReview.overallScore >= 6 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        )}>
                          {proposal.aiReview.overallScore}/10
                        </span>
                      )}
                      <span className="text-xs text-text-tertiary">
                        {proposal.dueDate ? formatDate(proposal.dueDate) : "No due date"}
                      </span>
                      <Badge variant={proposal.status}>{statusLabels[proposal.status]}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity size={18} className="text-text-muted" />
              Workflow insights
            </CardTitle>
            <CardDescription>Pipeline health and review velocity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <InsightRow
              label="Avg. proposal cycle"
              value={avgProposalCycleDuration > 0 ? formatDurationShort(avgProposalCycleDuration) : "—"}
              icon={TrendingUp}
            />
            <InsightRow
              label="Avg. iterations"
              value={avgIterations > 0 ? avgIterations.toFixed(1) : "—"}
              icon={RotateCcw}
            />
            <InsightRow label="In rework" value={String(inRework)} icon={Clock} />
            <div className="rounded-xl bg-surface-muted p-4">
              <p className="text-xs text-text-tertiary">Pipeline tip</p>
              <p className="mt-1 text-sm text-text-secondary">
                Proposals in rework longer than 3 days usually need a stakeholder sync.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  bg: string;
  trend: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="flex items-center gap-4 p-6">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${bg} ${color}`}>
          <Icon size={24} />
        </div>
        <div>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
          <p className="text-sm text-text-secondary">{label}</p>
        </div>
        <span className="absolute right-4 top-4 text-[10px] font-medium uppercase tracking-wider text-text-muted">
          {trend}
        </span>
      </CardContent>
    </Card>
  );
}

function InsightRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Icon size={16} className="text-text-muted" />
        {label}
      </div>
      <span className="text-sm font-semibold text-text-primary">{value}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-muted/50 py-10 text-center">
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  );
}
