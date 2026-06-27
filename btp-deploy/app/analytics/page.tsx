"use client";

import { useEffect, useMemo, useState } from "react";
import { getProposals } from "@/lib/db";
import type { Proposal, ProposalStatus } from "@/lib/types";
import { statusLabels } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCycleSummary, formatDurationShort } from "@/lib/workflow-utils";
import { getScoreStats, getVerdict } from "@/lib/ruleset-utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts";
import {
  BarChart3,
  Clock,
  Users,
  Globe,
  Layers,
  FileCheck,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Lightbulb,
  Download,
  Filter,
  Calendar,
  PieChart as PieChartIcon,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type ReportType =
  | "score_quality"
  | "workflow_velocity"
  | "pipeline_volume"
  | "owner_performance"
  | "region_breakdown"
  | "ruleset_compliance";

type GroupBy =
  | "status"
  | "region"
  | "technology"
  | "projectType"
  | "sparcOwner"
  | "proposalReviewer"
  | "ruleset"
  | "stage";

type TimeRange = "all" | "last7" | "last30" | "last90" | "thisYear";

const reportTypes: { value: ReportType; label: string; icon: React.ElementType; description: string }[] = [
  {
    value: "score_quality",
    label: "Score & Quality",
    icon: FileCheck,
    description: "AI review scores, verdict distribution, and quality gaps.",
  },
  {
    value: "workflow_velocity",
    label: "Workflow Velocity",
    icon: Clock,
    description: "Cycle durations, iterations, and stage bottlenecks.",
  },
  {
    value: "pipeline_volume",
    label: "Pipeline Volume",
    icon: BarChart3,
    description: "Proposal counts and status distribution over time.",
  },
  {
    value: "owner_performance",
    label: "Owner Performance",
    icon: Users,
    description: "Performance grouped by owner, reviewer, or mentor.",
  },
  {
    value: "region_breakdown",
    label: "Region & Technology",
    icon: Globe,
    description: "Breakdown by region, technology stack, or project type.",
  },
  {
    value: "ruleset_compliance",
    label: "Ruleset Compliance",
    icon: Layers,
    description: "Compliance by ruleset, section, and validation type.",
  },
];

const groupByOptions: { value: GroupBy; label: string; reports: ReportType[] }[] = [
  { value: "status", label: "Status", reports: ["pipeline_volume", "score_quality", "workflow_velocity"] },
  { value: "region", label: "Region", reports: ["region_breakdown", "score_quality", "workflow_velocity"] },
  { value: "technology", label: "Technology", reports: ["region_breakdown", "score_quality"] },
  { value: "projectType", label: "Project Type", reports: ["region_breakdown", "pipeline_volume"] },
  { value: "sparcOwner", label: "SPARC Owner", reports: ["owner_performance", "score_quality", "workflow_velocity"] },
  { value: "proposalReviewer", label: "Proposal Reviewer", reports: ["owner_performance", "score_quality"] },
  { value: "ruleset", label: "Ruleset", reports: ["ruleset_compliance", "score_quality"] },
  { value: "stage", label: "Workflow Stage", reports: ["workflow_velocity", "pipeline_volume"] },
];

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "last90", label: "Last 90 days" },
  { value: "thisYear", label: "This year" },
];

const statusOrder: ProposalStatus[] = ["draft", "submitted", "under_review", "approved", "rejected"];

const CHART_COLORS = [
  "#4f46e5", // primary-600
  "#0ea5e9", // sky-500
  "#22c55e", // green-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#a855f7", // purple-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
  "#f97316", // orange-500
  "#6366f1", // indigo-500
];

const STATUS_COLORS: Record<ProposalStatus, string> = {
  draft: "#94a3b8",
  submitted: "#0ea5e9",
  under_review: "#f59e0b",
  approved: "#22c55e",
  rejected: "#ef4444",
};

function isInTimeRange(date: Date, range: TimeRange): boolean {
  if (range === "all") return true;
  const now = Date.now();
  const ms = date.getTime();
  const days = (now - ms) / (1000 * 60 * 60 * 24);
  switch (range) {
    case "last7":
      return days <= 7;
    case "last30":
      return days <= 30;
    case "last90":
      return days <= 90;
    case "thisYear":
      return new Date(ms).getFullYear() === new Date().getFullYear();
    default:
      return true;
  }
}

function getGroupValue(proposal: Proposal, groupBy: GroupBy): string {
  switch (groupBy) {
    case "status":
      return statusLabels[proposal.status];
    case "stage":
      return proposal.workflowStage ?? "No stage";
    case "ruleset":
      return proposal.rulesetId ?? "No ruleset";
    case "region":
      return proposal.proposalRegion ?? "Unassigned";
    case "technology":
      return proposal.technology ?? "Unassigned";
    case "projectType":
      return proposal.projectType ?? "Unassigned";
    case "sparcOwner":
      return proposal.sparcOwner ?? "Unassigned";
    case "proposalReviewer":
      return proposal.proposalReviewer ?? "Unassigned";
    default:
      return "Unassigned";
  }
}

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function formatNumber(num: number, digits = 1): string {
  return Number.isInteger(num) ? String(num) : num.toFixed(digits);
}

export default function AnalyticsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<ReportType>("score_quality");
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | "all">("all");
  const [showParams, setShowParams] = useState(true);

  useEffect(() => {
    getProposals().then((data) => {
      setProposals(data);
      setLoading(false);
    });
  }, []);

  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      const inRange = isInTimeRange(p.createdAt, timeRange);
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return inRange && matchesStatus;
    });
  }, [proposals, timeRange, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Proposal[]>();
    for (const proposal of filteredProposals) {
      const key = getGroupValue(proposal, groupBy);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(proposal);
    }
    return Array.from(map.entries())
      .map(([key, items]) => ({ key, items }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [filteredProposals, groupBy]);

  const kpis = useMemo(() => computeKpis(filteredProposals), [filteredProposals]);
  const insights = useMemo(() => generateInsights(filteredProposals, grouped, reportType, groupBy), [
    filteredProposals,
    grouped,
    reportType,
    groupBy,
  ]);

  const reportDescription = reportTypes.find((r) => r.value === reportType)!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">Analytics</h1>
          <p className="text-text-secondary">Interactive reports and insights across your proposal pipeline.</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download size={16} className="mr-2" />
          Export CSV
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Proposals"
          value={String(kpis.total)}
          icon={BarChart3}
          color="bg-primary-600"
          trend={kpis.total ? `${kpis.active} active` : undefined}
        />
        <KpiCard
          label="Average Score"
          value={kpis.avgScore ? formatNumber(kpis.avgScore) : "—"}
          icon={FileCheck}
          color="bg-emerald-500"
          trend={kpis.avgScore ? getVerdict(kpis.avgScore).shortLabel : undefined}
        />
        <KpiCard
          label="Win Rate"
          value={kpis.winRate.toFixed(0) + "%"}
          icon={TrendingUp}
          color="bg-sky-500"
          trend={`${kpis.approved} approved`}
        />
        <KpiCard
          label="Avg Cycle Time"
          value={kpis.avgDuration ? formatDurationShort(kpis.avgDuration) : "—"}
          icon={Clock}
          color="bg-amber-500"
          trend={kpis.avgIterations ? `${formatNumber(kpis.avgIterations)} iterations` : undefined}
        />
      </div>

      {/* Report type tabs */}
      <div className="rounded-xl border border-border bg-surface p-1.5 shadow-sm">
        <div className="flex flex-wrap gap-1">
          {reportTypes.map((type) => {
            const Icon = type.icon;
            const active = reportType === type.value;
            return (
              <button
                key={type.value}
                onClick={() => setReportType(type.value)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                  active
                    ? "bg-primary-600 text-white shadow-sm"
                    : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"
                )}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{type.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Parameters panel */}
      <Card className="overflow-hidden">
        <button
          onClick={() => setShowParams(!showParams)}
          className="flex w-full items-center justify-between p-4 text-left hover:bg-surface-muted/50"
        >
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-primary-600" />
            <span className="font-semibold text-text-primary">Report parameters</span>
            <span className="text-sm text-text-secondary">
              · {filteredProposals.length} proposals grouped by{" "}
              <span className="font-medium text-text-primary">
                {groupByOptions.find((g) => g.value === groupBy)?.label}
              </span>
            </span>
          </div>
          {showParams ? <ChevronUp size={18} className="text-text-tertiary" /> : <ChevronDown size={18} className="text-text-tertiary" />}
        </button>
        {showParams && (
          <CardContent className="border-t border-border pt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                  <BarChart3 size={14} /> Group by
                </label>
                <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
                  {groupByOptions
                    .filter((g) => g.reports.includes(reportType))
                    .map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                  <Calendar size={14} /> Time range
                </label>
                <Select value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)}>
                  {timeRangeOptions.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                  <Activity size={14} /> Status filter
                </label>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ProposalStatus | "all")}
                >
                  <option value="all">All statuses</option>
                  {statusOrder.map((s) => (
                    <option key={s} value={s}>
                      {statusLabels[s]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                  <PieChartIcon size={14} /> Report
                </label>
                <div className="flex h-10 items-center rounded-lg border border-border-strong bg-surface px-3 text-sm text-text-primary">
                  {reportDescription.label}
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Main report area */}
      {loading ? (
        <div className="space-y-4">
          <div className="h-80 animate-pulse rounded-xl bg-surface-muted" />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />
            <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />
            <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />
          </div>
        </div>
      ) : filteredProposals.length === 0 ? (
        <EmptyState message="No proposals match the selected filters." />
      ) : (
        <div className="space-y-6">
          <ReportContent
            reportType={reportType}
            groupBy={groupBy}
            grouped={grouped}
            proposals={filteredProposals}
          />
          <InsightsPanel insights={insights} />
        </div>
      )}
    </div>
  );

  function exportCsv() {
    const rows = grouped.map(({ key, items }) => {
      const scores = items.map((p) => p.aiReview?.overallScore).filter((s): s is number => s !== undefined);
      const durations = items.flatMap((p) =>
        p.workflowCycles.filter((c) => c.completedAt).map((c) => getCycleSummary(c, p.workflowEvents).durationMs)
      );
      const iterations = items.flatMap((p) => p.workflowCycles.map((c) => getCycleSummary(c, p.workflowEvents).iterations));
      return {
        group: key,
        count: items.length,
        avgScore: scores.length ? avg(scores).toFixed(1) : "—",
        winRate: items.length
          ? ((items.filter((p) => p.status === "approved").length / items.length) * 100).toFixed(0) + "%"
          : "—",
        avgDuration: durations.length ? formatDurationShort(avg(durations)) : "—",
        avgIterations: iterations.length ? avg(iterations).toFixed(1) : "—",
      };
    });
    const csv = [
      ["Group", "Count", "Avg Score", "Win Rate", "Avg Duration", "Avg Iterations"].join(","),
      ...rows.map((r) => [r.group, r.count, r.avgScore, r.winRate, r.avgDuration, r.avgIterations].join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  trend?: string;
}) {
  return (
    <Card className="relative overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm", color)}>
          <Icon size={22} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-secondary">{label}</p>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
          {trend && <p className="text-xs text-text-tertiary">{trend}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function ReportContent({
  reportType,
  groupBy,
  grouped,
  proposals,
}: {
  reportType: ReportType;
  groupBy: GroupBy;
  grouped: { key: string; items: Proposal[] }[];
  proposals: Proposal[];
}) {
  switch (reportType) {
    case "score_quality":
      return <ScoreQualityReport grouped={grouped} />;
    case "workflow_velocity":
      return <WorkflowVelocityReport grouped={grouped} />;
    case "pipeline_volume":
      return <PipelineVolumeReport grouped={grouped} groupBy={groupBy} />;
    case "owner_performance":
      return <OwnerPerformanceReport grouped={grouped} />;
    case "region_breakdown":
      return <RegionBreakdownReport grouped={grouped} groupBy={groupBy} />;
    case "ruleset_compliance":
      return <RulesetComplianceReport grouped={grouped} proposals={proposals} />;
    default:
      return null;
  }
}

function ScoreQualityReport({ grouped }: { grouped: { key: string; items: Proposal[] }[] }) {
  const data = grouped.map(({ key, items }) => {
    const scored = items.filter((p) => p.aiReview);
    const scores = scored.map((p) => p.aiReview!.overallScore);
    const stats = scored.flatMap((p) => (p.aiReview ? getScoreStats(p.aiReview.ratings) : []));
    return {
      name: key,
      count: items.length,
      scored: scored.length,
      avgScore: scores.length ? avg(scores) : 0,
      issues: stats.reduce((sum, s) => sum + s.error.count + s.warning.count, 0),
      belowThreshold: stats.reduce((sum, s) => sum + s.belowThreshold, 0),
    };
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Average score by group</CardTitle>
          <CardDescription>AI review overall score grouped by selected dimension.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" angle={-30} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: "0.75rem", border: "none", boxShadow: "0 4px 6px -1px rgb(15 23 42 / 0.1)" }}
                  formatter={(value) => [typeof value === "number" ? value.toFixed(1) : value, "Avg Score"]}
                />
                <Bar dataKey="avgScore" radius={[6, 6, 0, 0]}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quality distribution</CardTitle>
          <CardDescription>Verdict breakdown based on average scores.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.filter((d) => d.avgScore > 0)}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Detailed breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="pb-3 font-medium">Group</th>
                  <th className="pb-3 font-medium">Proposals</th>
                  <th className="pb-3 font-medium">Reviewed</th>
                  <th className="pb-3 font-medium">Avg Score</th>
                  <th className="pb-3 font-medium">Issues</th>
                  <th className="pb-3 font-medium">Below Threshold</th>
                  <th className="pb-3 font-medium">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {data.map((row) => (
                  <tr key={row.name} className="text-text-primary">
                    <td className="py-3 font-medium">{row.name}</td>
                    <td className="py-3">{row.count}</td>
                    <td className="py-3">{row.scored}</td>
                    <td className="py-3 font-semibold">{row.avgScore ? row.avgScore.toFixed(1) : "—"}</td>
                    <td className="py-3 text-amber-600">{row.issues}</td>
                    <td className="py-3 text-red-600">{row.belowThreshold}</td>
                    <td className="py-3">
                      {row.avgScore ? (
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-medium",
                            getVerdict(row.avgScore).bg,
                            getVerdict(row.avgScore).color
                          )}
                        >
                          {getVerdict(row.avgScore).shortLabel}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WorkflowVelocityReport({ grouped }: { grouped: { key: string; items: Proposal[] }[] }) {
  const data = grouped.map(({ key, items }) => {
    const cycles = items.flatMap((p) => p.workflowCycles.map((c) => getCycleSummary(c, p.workflowEvents)));
    return {
      name: key,
      count: items.length,
      avgDuration: cycles.length ? avg(cycles.map((c) => c.durationMs)) : 0,
      avgIterations: cycles.length ? avg(cycles.map((c) => c.iterations)) : 0,
      active: cycles.filter((c) => !c.cycle.completedAt).length,
      completed: cycles.filter((c) => c.cycle.completedAt).length,
    };
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Average cycle duration</CardTitle>
          <CardDescription>Time from cycle start to completion (or now for active cycles).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" angle={-30} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(ms) => formatDurationShort(ms)} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: "0.75rem", border: "none", boxShadow: "0 4px 6px -1px rgb(15 23 42 / 0.1)" }}
                  formatter={(value) => [typeof value === "number" ? formatDurationShort(value) : value, "Avg Duration"]}
                />
                <Bar dataKey="avgDuration" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Iterations per cycle</CardTitle>
          <CardDescription>Average number of iterations grouped by dimension.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" angle={-30} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                <YAxis allowDecimals tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: "0.75rem", border: "none", boxShadow: "0 4px 6px -1px rgb(15 23 42 / 0.1)" }}
                  formatter={(value) => [typeof value === "number" ? value.toFixed(1) : value, "Avg Iterations"]}
                />
                <Bar dataKey="avgIterations" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Detailed velocity breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.map((row, i) => (
              <div key={row.name} className="rounded-xl border border-border bg-surface p-4">
                <p className="text-sm font-medium text-text-secondary">{row.name}</p>
                <p className="mt-1 text-2xl font-bold text-text-primary">{formatDurationShort(row.avgDuration)}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <RotateCcw size={12} />
                    {row.avgIterations.toFixed(1)} iterations
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    {row.active} active
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (row.avgIterations / Math.max(...data.map((d) => d.avgIterations))) * 100)}%`,
                      backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PipelineVolumeReport({
  grouped,
  groupBy,
}: {
  grouped: { key: string; items: Proposal[] }[];
  groupBy: GroupBy;
}) {
  const data = grouped.map(({ key, items }) => {
    const byStatus = Object.fromEntries(
      statusOrder.map((s) => [s, items.filter((p) => p.status === s).length])
    ) as Record<ProposalStatus, number>;
    return {
      name: key,
      ...byStatus,
      total: items.length,
    };
  });

  const pieData = statusOrder
    .map((status) => ({
      name: statusLabels[status],
      value: grouped.reduce((sum, g) => sum + g.items.filter((p) => p.status === status).length, 0),
      color: STATUS_COLORS[status],
    }))
    .filter((d) => d.value > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Status distribution by group</CardTitle>
          <CardDescription>Proposal volume segmented by status within each group.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" angle={-30} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: "0.75rem", border: "none", boxShadow: "0 4px 6px -1px rgb(15 23 42 / 0.1)" }}
                />
                <Legend />
                {statusOrder.map((status) => (
                  <Bar
                    key={status}
                    dataKey={status}
                    name={statusLabels[status]}
                    stackId="a"
                    fill={STATUS_COLORS[status]}
                    radius={status === "rejected" ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Overall status mix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Volume breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="pb-3 font-medium">{groupByOptions.find((g) => g.value === groupBy)?.label}</th>
                  {statusOrder.map((s) => (
                    <th key={s} className="pb-3 font-medium">
                      {statusLabels[s]}
                    </th>
                  ))}
                  <th className="pb-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {data.map((row) => (
                  <tr key={row.name} className="text-text-primary">
                    <td className="py-3 font-medium">{row.name}</td>
                    {statusOrder.map((s) => (
                      <td key={s} className="py-3">
                        {row[s]}
                      </td>
                    ))}
                    <td className="py-3 font-bold">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OwnerPerformanceReport({ grouped }: { grouped: { key: string; items: Proposal[] }[] }) {
  const data = grouped.map(({ key, items }) => {
    const scores = items.map((p) => p.aiReview?.overallScore).filter((s): s is number => s !== undefined);
    const approved = items.filter((p) => p.status === "approved").length;
    const rejected = items.filter((p) => p.status === "rejected").length;
    return {
      name: key,
      count: items.length,
      avgScore: scores.length ? avg(scores) : 0,
      winRate: items.length ? (approved / items.length) * 100 : 0,
      approved,
      rejected,
    };
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Win rate by owner</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: "0.75rem", border: "none", boxShadow: "0 4px 6px -1px rgb(15 23 42 / 0.1)" }}
                  formatter={(value) => [typeof value === "number" ? `${value.toFixed(0)}%` : value, "Win Rate"]}
                />
                <Bar dataKey="winRate" fill="#22c55e" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Score vs volume</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" angle={-30} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" domain={[0, 10]} tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: "0.75rem", border: "none", boxShadow: "0 4px 6px -1px rgb(15 23 42 / 0.1)" }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="avgScore" name="Avg Score" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                <Bar yAxisId="right" dataKey="count" name="Proposals" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Performance cards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.map((row, i) => (
              <div key={row.name} className="rounded-xl border border-border bg-surface p-4">
                <p className="text-sm font-medium text-text-secondary">{row.name}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-text-primary">{row.winRate.toFixed(0)}%</span>
                  <span className="text-xs text-text-tertiary">win rate</span>
                </div>
                <p className="mt-1 text-sm text-text-secondary">
                  {row.approved} approved · {row.rejected} rejected · {row.count} total
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{ width: `${Math.min(100, row.winRate)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RegionBreakdownReport({
  grouped,
  groupBy,
}: {
  grouped: { key: string; items: Proposal[] }[];
  groupBy: GroupBy;
}) {
  const data = grouped.map(({ key, items }) => {
    const scores = items.map((p) => p.aiReview?.overallScore).filter((s): s is number => s !== undefined);
    const approved = items.filter((p) => p.status === "approved").length;
    return {
      name: key,
      count: items.length,
      avgScore: scores.length ? avg(scores) : 0,
      winRate: items.length ? (approved / items.length) * 100 : 0,
    };
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Volume by {groupByOptions.find((g) => g.value === groupBy)?.label}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={3}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Win rate & score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={data}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="Win Rate %" dataKey="winRate" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
                <Radar name="Avg Score x10" dataKey="avgScore" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.3} />
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Detailed breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.map((row, i) => (
              <div key={row.name} className="rounded-xl border border-border bg-surface p-4">
                <p className="text-sm font-medium text-text-secondary">{row.name}</p>
                <p className="mt-1 text-2xl font-bold text-text-primary">{row.count}</p>
                <p className="text-xs text-text-tertiary">proposals</p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">Win rate</span>
                    <span className="font-semibold text-green-600">{row.winRate.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(100, row.winRate)}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">Avg score</span>
                    <span className="font-semibold text-primary-600">{row.avgScore ? row.avgScore.toFixed(1) : "—"}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full rounded-full bg-primary-500"
                      style={{ width: `${Math.min(100, (row.avgScore / 10) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RulesetComplianceReport({
  grouped,
  proposals,
}: {
  grouped: { key: string; items: Proposal[] }[];
  proposals: Proposal[];
}) {
  const data = grouped.map(({ key, items }) => {
    const scored = items.filter((p) => p.aiReview);
    const stats = scored.flatMap((p) => (p.aiReview ? getScoreStats(p.aiReview.ratings) : []));
    const total = stats.reduce((sum, s) => sum + s.total, 0);
    const errors = stats.reduce((sum, s) => sum + s.error.count, 0);
    const warnings = stats.reduce((sum, s) => sum + s.warning.count, 0);
    const suggestions = stats.reduce((sum, s) => sum + s.suggestion.count, 0);
    const below = stats.reduce((sum, s) => sum + s.belowThreshold, 0);
    return {
      name: key,
      count: items.length,
      scored: scored.length,
      compliance: total ? ((total - below) / total) * 100 : 0,
      errors,
      warnings,
      suggestions,
    };
  });

  const overall = useMemo(() => {
    const allRatings = proposals.flatMap((p) => p.aiReview?.ratings ?? []);
    const stats = getScoreStats(allRatings);
    return [
      { name: "Errors", value: stats.error.count, color: "#ef4444" },
      { name: "Warnings", value: stats.warning.count, color: "#f59e0b" },
      { name: "Suggestions", value: stats.suggestion.count, color: "#4f46e5" },
    ];
  }, [proposals]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Compliance rate by ruleset</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" angle={-30} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: "0.75rem", border: "none", boxShadow: "0 4px 6px -1px rgb(15 23 42 / 0.1)" }}
                  formatter={(value) => [typeof value === "number" ? `${value.toFixed(0)}%` : value, "Compliance"]}
                />
                <Bar dataKey="compliance" radius={[6, 6, 0, 0]}>
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.compliance >= 80 ? "#22c55e" : d.compliance >= 60 ? "#f59e0b" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Issue distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={overall}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {overall.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Ruleset breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.map((row) => (
              <div key={row.name} className="rounded-xl border border-border bg-surface p-4">
                <p className="text-sm font-medium text-text-secondary">{row.name}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-text-primary">{row.compliance.toFixed(0)}%</span>
                  <span className="text-xs text-text-tertiary">compliance</span>
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  {row.scored} reviewed · {row.errors} errors · {row.warnings} warnings
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className={cn("h-full rounded-full", row.compliance >= 80 ? "bg-green-500" : row.compliance >= 60 ? "bg-amber-500" : "bg-red-500")}
                    style={{ width: `${Math.min(100, row.compliance)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InsightsPanel({ insights }: { insights: string[] }) {
  if (!insights.length) return null;
  return (
    <Card className="border-l-4 border-l-primary-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb size={18} className="text-primary-600" />
          Key insights
        </CardTitle>
        <CardDescription>Automatically generated observations from the current report.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl bg-surface-muted p-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                <span className="text-xs font-bold">{i + 1}</span>
              </div>
              <p className="text-sm text-text-secondary">{insight}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function computeKpis(proposals: Proposal[]) {
  const scored = proposals.filter((p) => p.aiReview);
  const scores = scored.map((p) => p.aiReview!.overallScore);
  const approved = proposals.filter((p) => p.status === "approved").length;
  const active = proposals.filter((p) => p.status === "under_review").length;
  const cycles = proposals.flatMap((p) => p.workflowCycles.map((c) => getCycleSummary(c, p.workflowEvents)));
  const durations = cycles.map((c) => c.durationMs);
  const iterations = cycles.map((c) => c.iterations);
  return {
    total: proposals.length,
    avgScore: scores.length ? avg(scores) : 0,
    winRate: proposals.length ? (approved / proposals.length) * 100 : 0,
    avgDuration: durations.length ? avg(durations) : 0,
    avgIterations: iterations.length ? avg(iterations) : 0,
    approved,
    active,
  };
}

function generateInsights(
  proposals: Proposal[],
  grouped: { key: string; items: Proposal[] }[],
  reportType: ReportType,
  groupBy: GroupBy
): string[] {
  const insights: string[] = [];
  if (proposals.length === 0) return insights;

  const approved = proposals.filter((p) => p.status === "approved").length;
  const rejected = proposals.filter((p) => p.status === "rejected").length;
  const underReview = proposals.filter((p) => p.status === "under_review").length;
  const winRate = proposals.length ? (approved / proposals.length) * 100 : 0;
  insights.push(
    `Overall win rate is ${winRate.toFixed(0)}% (${approved} approved, ${rejected} rejected, ${underReview} under review out of ${proposals.length} proposals).`
  );

  const scored = proposals.filter((p) => p.aiReview);
  if (scored.length) {
    const avgScore = avg(scored.map((p) => p.aiReview!.overallScore));
    const below = scored.filter((p) => p.aiReview!.overallScore < 6).length;
    insights.push(
      `Average AI review score across ${scored.length} proposals is ${avgScore.toFixed(
        1
      )}/10. ${below} proposal(s) scored below the threshold (< 6).`
    );
  }

  if (grouped.length > 1) {
    const sortedByCount = [...grouped].sort((a, b) => b.items.length - a.items.length);
    insights.push(`"${sortedByCount[0].key}" has the highest volume with ${sortedByCount[0].items.length} proposals.`);

    if (reportType === "score_quality" || reportType === "owner_performance" || reportType === "region_breakdown") {
      const scoredGroups = grouped
        .map((g) => ({
          key: g.key,
          avg: avg(g.items.map((p) => p.aiReview?.overallScore).filter((s): s is number => s !== undefined)),
        }))
        .filter((g) => g.avg > 0)
        .sort((a, b) => b.avg - a.avg);
      if (scoredGroups.length) {
        insights.push(
          `"${scoredGroups[0].key}" leads on quality with an average score of ${scoredGroups[0].avg.toFixed(1)}/10.`
        );
      }
    }

    if (reportType === "workflow_velocity") {
      const durations = grouped
        .map((g) => ({
          key: g.key,
          avg: avg(g.items.flatMap((p) => p.workflowCycles.map((c) => getCycleSummary(c, p.workflowEvents).durationMs))),
        }))
        .filter((g) => g.avg > 0)
        .sort((a, b) => b.avg - a.avg);
      if (durations.length) {
        insights.push(
          `"${durations[0].key}" has the longest average cycle duration at ${formatDurationShort(durations[0].avg)}.`
        );
      }
    }

    if (reportType === "owner_performance") {
      const winRates = grouped
        .map((g) => ({
          key: g.key,
          rate: g.items.length ? (g.items.filter((p) => p.status === "approved").length / g.items.length) * 100 : 0,
        }))
        .filter((g) => g.rate > 0)
        .sort((a, b) => b.rate - a.rate);
      if (winRates.length) {
        insights.push(`"${winRates[0].key}" has the highest win rate at ${winRates[0].rate.toFixed(0)}%.`);
      }
    }
  }

  const iterations = proposals.flatMap((p) => p.workflowCycles.map((c) => getCycleSummary(c, p.workflowEvents).iterations));
  if (iterations.length) {
    const avgIterations = avg(iterations);
    const highIteration = proposals.filter((p) =>
      p.workflowCycles.some((c) => getCycleSummary(c, p.workflowEvents).iterations > 2)
    ).length;
    if (avgIterations > 1.5) {
      insights.push(
        `${highIteration} proposal(s) required more than 2 iterations — consider tighter upfront review criteria.`
      );
    }
  }

  return insights.slice(0, 6);
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-muted/50 py-16 text-center">
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  );
}
