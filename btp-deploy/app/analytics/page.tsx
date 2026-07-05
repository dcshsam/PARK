"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Responsive as ResponsiveGridLayout, type Layout, useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { getProposals, getDeepReviewMap, getLeads } from "@/lib/db";
import type { Lead, Proposal, ProposalStatus } from "@/lib/types";
import { statusLabels, leadStatusLabels } from "@/lib/types";
import { LEAD_EVENT_SHORT, LEAD_STATUS_BADGE } from "@/lib/lead-events";
import type { DeepReview } from "@/lib/deep-review/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { BarChart3, FileText, Gauge, AlertTriangle, CheckCircle2, Filter, RotateCcw, GripVertical } from "lucide-react";

// ── Filter / segment dimensions ─────────────────────────────────────────────

type Period = "all" | "7d" | "30d" | "90d" | "12m";
type SegmentKey = "sparcOwner" | "gtmOwner" | "proposalReviewer" | "proposalRegion" | "status" | "technology" | "projectType";

const PERIOD_LABELS: Record<Period, string> = {
  all: "All time",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "12m": "Last 12 months",
};

const SEGMENTS: { key: SegmentKey; label: string }[] = [
  { key: "sparcOwner", label: "SPARC Owner" },
  { key: "gtmOwner", label: "GTM Owner" },
  { key: "proposalReviewer", label: "Reviewer" },
  { key: "proposalRegion", label: "Region" },
  { key: "status", label: "Status" },
  { key: "technology", label: "Technology" },
  { key: "projectType", label: "Project Type" },
];

const STATUS_COLORS: Record<ProposalStatus, string> = {
  draft: "#9ca3af",
  submitted: "#3b82f6",
  under_review: "#eab308",
  approved: "#22c55e",
  rejected: "#ef4444",
};

const BAR_PALETTE = ["#6366f1", "#8b5cf6", "#0ea5e9", "#14b8a6", "#f59e0b", "#ec4899", "#22c55e", "#ef4444"];


const LAYOUT_KEY = "prop-review:analytics-layout";

const defaultLayouts = {
  lg: [
    { i: "status", x: 0, y: 0, w: 6, h: 10, minW: 3, minH: 6 },
    { i: "trend", x: 6, y: 0, w: 6, h: 10, minW: 3, minH: 6 },
    { i: "segmentCount", x: 0, y: 10, w: 6, h: 12, minW: 3, minH: 6 },
    { i: "segmentScore", x: 6, y: 10, w: 6, h: 12, minW: 3, minH: 6 },
  ],
  md: [
    { i: "status", x: 0, y: 0, w: 5, h: 10, minW: 3, minH: 6 },
    { i: "trend", x: 5, y: 0, w: 5, h: 10, minW: 3, minH: 6 },
    { i: "segmentCount", x: 0, y: 10, w: 5, h: 12, minW: 3, minH: 6 },
    { i: "segmentScore", x: 5, y: 10, w: 5, h: 12, minW: 3, minH: 6 },
  ],
  sm: [
    { i: "status", x: 0, y: 0, w: 6, h: 10, minW: 3, minH: 6 },
    { i: "trend", x: 0, y: 10, w: 6, h: 10, minW: 3, minH: 6 },
    { i: "segmentCount", x: 0, y: 20, w: 6, h: 12, minW: 3, minH: 6 },
    { i: "segmentScore", x: 0, y: 32, w: 6, h: 12, minW: 3, minH: 6 },
  ],
  xs: [
    { i: "status", x: 0, y: 0, w: 4, h: 10, minW: 2, minH: 6 },
    { i: "trend", x: 0, y: 10, w: 4, h: 10, minW: 2, minH: 6 },
    { i: "segmentCount", x: 0, y: 20, w: 4, h: 12, minW: 2, minH: 6 },
    { i: "segmentScore", x: 0, y: 32, w: 4, h: 12, minW: 2, minH: 6 },
  ],
  xxs: [
    { i: "status", x: 0, y: 0, w: 2, h: 10, minW: 2, minH: 6 },
    { i: "trend", x: 0, y: 10, w: 2, h: 10, minW: 2, minH: 6 },
    { i: "segmentCount", x: 0, y: 20, w: 2, h: 12, minW: 2, minH: 6 },
    { i: "segmentScore", x: 0, y: 32, w: 2, h: 12, minW: 2, minH: 6 },
  ],
};

function scoreColor(s: number) {
  return s >= 80 ? "text-green-600" : s >= 60 ? "text-amber-600" : "text-red-600";
}

function periodCutoff(period: Period): number {
  const now = Date.now();
  const day = 86400000;
  switch (period) {
    case "7d":
      return now - 7 * day;
    case "30d":
      return now - 30 * day;
    case "90d":
      return now - 90 * day;
    case "12m":
      return now - 365 * day;
    default:
      return 0;
  }
}

function dimValue(p: Proposal, key: SegmentKey): string {
  if (key === "status") return statusLabels[p.status];
  const v = (p[key] as string | undefined)?.trim();
  return v || "Unassigned";
}

/** Group leads by a dimension, tracking totals and conversions per bucket. */
function groupLeads(
  leads: Lead[],
  dim: (l: Lead) => string | undefined
): { name: string; total: number; converted: number }[] {
  const map = new Map<string, { total: number; converted: number }>();
  for (const l of leads) {
    const key = (dim(l) ?? "").trim() || "Unassigned";
    const entry = map.get(key) ?? { total: 0, converted: 0 };
    entry.total += 1;
    if (l.status === "converted") entry.converted += 1;
    map.set(key, entry);
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
}

function leadEventTimestamp(lead: Lead, eventNumber: number): Date | undefined {
  const data = lead.eventData?.[`event${eventNumber}`] as { completedAt?: string | Date } | undefined;
  return data?.completedAt ? new Date(data.completedAt) : undefined;
}

function distinctValues(proposals: Proposal[], key: "sparcOwner" | "proposalRegion"): string[] {
  const set = new Set<string>();
  for (const p of proposals) {
    const v = (p[key] as string | undefined)?.trim();
    if (v) set.add(v);
  }
  return Array.from(set).sort();
}

export default function AnalyticsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [reviews, setReviews] = useState<Map<string, DeepReview>>(new Map());
  const [loading, setLoading] = useState(true);

  // Filters
  const [period, setPeriod] = useState<Period>("all");
  const [status, setStatus] = useState<ProposalStatus | "all">("all");
  const [region, setRegion] = useState<string>("all");
  const [owner, setOwner] = useState<string>("all");
  const [segmentBy, setSegmentBy] = useState<SegmentKey>("sparcOwner");
  const [trendChartType, setTrendChartType] = useState<"bar" | "line" | "area">("bar");
  const [statusChartType, setStatusChartType] = useState<"pie" | "donut">("pie");
  const [layouts, setLayouts] = useState(() => {
    if (typeof window === "undefined") return defaultLayouts;
    try {
      const saved = window.localStorage.getItem(LAYOUT_KEY);
      return saved ? (JSON.parse(saved) as typeof defaultLayouts) : defaultLayouts;
    } catch {
      return defaultLayouts;
    }
  });
  const { containerRef: gridRef, width } = useContainerWidth();

  const handleLayoutChange = (_currentLayout: Layout, allLayouts: Partial<Record<string, Layout>>) => {
    const next = { ...defaultLayouts, ...allLayouts } as typeof defaultLayouts;
    setLayouts(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
    }
  };

  const resetLayout = () => {
    setLayouts(defaultLayouts);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LAYOUT_KEY);
    }
  };

  useEffect(() => {
    Promise.all([getProposals(), getDeepReviewMap(), getLeads()]).then(([p, m, l]) => {
      setProposals(p);
      setReviews(m);
      setLeads(l);
      setLoading(false);
    });
  }, []);

  const regionOptions = useMemo(() => distinctValues(proposals, "proposalRegion"), [proposals]);
  const ownerOptions = useMemo(() => distinctValues(proposals, "sparcOwner"), [proposals]);

  const filtered = useMemo(() => {
    const cutoff = periodCutoff(period);
    return proposals.filter((p) => {
      if (cutoff && new Date(p.createdAt).getTime() < cutoff) return false;
      if (status !== "all" && p.status !== status) return false;
      if (region !== "all" && (p.proposalRegion || "").trim() !== region) return false;
      if (owner !== "all" && (p.sparcOwner || "").trim() !== owner) return false;
      return true;
    });
  }, [proposals, period, status, region, owner]);

  const scoreOf = (p: Proposal) => reviews.get(p.id)?.overall_score;

  const kpis = useMemo(() => {
    const total = filtered.length;
    const reviewed = filtered.filter((p) => reviews.has(p.id));
    const scores = reviewed.map((p) => reviews.get(p.id)!.overall_score);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const approved = filtered.filter((p) => p.status === "approved").length;
    const critical = reviewed.filter((p) => reviews.get(p.id)!.verdict === "Critical").length;
    return { total, reviewed: reviewed.length, avgScore, approved, critical };
  }, [filtered, reviews]);

  const statusData = useMemo(() => {
    const order: ProposalStatus[] = ["draft", "submitted", "under_review", "approved", "rejected"];
    return order
      .map((s) => ({ name: statusLabels[s], status: s, value: filtered.filter((p) => p.status === s).length }))
      .filter((d) => d.value > 0);
  }, [filtered]);

  const segmentData = useMemo(() => {
    const map = new Map<string, { count: number; scores: number[] }>();
    for (const p of filtered) {
      const key = dimValue(p, segmentBy);
      const entry = map.get(key) ?? { count: 0, scores: [] };
      entry.count += 1;
      const s = scoreOf(p);
      if (typeof s === "number") entry.scores.push(s);
      map.set(key, entry);
    }
    return Array.from(map.entries())
      .map(([name, { count, scores }]) => ({
        name,
        count,
        avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
        reviewed: scores.length,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filtered, segmentBy, reviews]); // eslint-disable-line react-hooks/exhaustive-deps

  const trendData = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of filtered) {
      const d = new Date(p.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([key, count]) => {
        const [y, m] = key.split("-");
        const label = new Date(Number(y), Number(m) - 1).toLocaleString(undefined, { month: "short", year: "2-digit" });
        return { name: label, count };
      });
  }, [filtered]);

  // ── Lead Master analytics ──────────────────────────────────────────────────
  const filteredLeads = useMemo(() => {
    const cutoff = periodCutoff(period);
    return leads.filter((l) => !cutoff || new Date(l.createdAt).getTime() >= cutoff);
  }, [leads, period]);

  const leadKpis = useMemo(() => {
    const total = filteredLeads.length;
    const converted = filteredLeads.filter((l) => l.status === "converted").length;
    const dropped = filteredLeads.filter((l) => l.status === "dropped").length;
    const active = total - converted - dropped;
    const decided = converted + dropped;
    const winRate = decided > 0 ? Math.round((converted / decided) * 100) : null;
    // Age measured against the latest lead update rather than wall-clock time,
    // keeping this memo pure across re-renders.
    const newest = filteredLeads.reduce(
      (max, l) => Math.max(max, new Date(l.updatedAt).getTime()),
      0
    );
    const ages = filteredLeads.map((l) => newest - new Date(l.createdAt).getTime());
    const avgAgeDays = ages.length
      ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length / 86400000)
      : 0;
    return { total, active, converted, winRate, avgAgeDays };
  }, [filteredLeads]);

  const leadsByGtm = useMemo(() => groupLeads(filteredLeads, (l) => l.gtmName), [filteredLeads]);
  const leadsByRegion = useMemo(() => groupLeads(filteredLeads, (l) => l.proposalRegion), [filteredLeads]);
  const leadsByVertical = useMemo(() => groupLeads(filteredLeads, (l) => l.vertical), [filteredLeads]);

  // Average days spent in each lead event, from the completedAt checkpoints
  // (events driven by the proposal workflow don't record checkpoints and are skipped).
  const leadEventDurations = useMemo(() => {
    const sums = LEAD_EVENT_SHORT.map(() => ({ total: 0, count: 0 }));
    for (const l of filteredLeads) {
      for (let n = 1; n <= LEAD_EVENT_SHORT.length; n++) {
        const end = leadEventTimestamp(l, n);
        if (!end) continue;
        const start = n === 1 ? new Date(l.createdAt) : leadEventTimestamp(l, n - 1);
        if (!start) continue;
        const ms = end.getTime() - start.getTime();
        if (ms >= 0) {
          sums[n - 1].total += ms;
          sums[n - 1].count += 1;
        }
      }
    }
    return LEAD_EVENT_SHORT.map((label, i) => ({
      name: label,
      days: sums[i].count ? Number((sums[i].total / sums[i].count / 86400000).toFixed(1)) : 0,
    }));
  }, [filteredLeads]);

  const segmentLabel = SEGMENTS.find((s) => s.key === segmentBy)?.label ?? "Segment";
  const filtersActive = period !== "all" || status !== "all" || region !== "all" || owner !== "all";
  const resetFilters = () => {
    setPeriod("all");
    setStatus("all");
    setRegion("all");
    setOwner("all");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-1/3 animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-20 animate-pulse rounded-xl bg-surface-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-text-primary sm:text-3xl">
          <BarChart3 size={28} className="text-primary-600" /> Analytics
        </h1>
        <p className="text-text-secondary">Proposal pipeline insights — filter and segment across your proposals.</p>
      </motion.div>

      {/* Filter toolbar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-4">
            <FilterField label="Timeline">
              <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
                {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                  <option key={p} value={p}>
                    {PERIOD_LABELS[p]}
                  </option>
                ))}
              </Select>
            </FilterField>

            <FilterField label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value as ProposalStatus | "all")}>
                <option value="all">All statuses</option>
                {(["draft", "submitted", "under_review", "approved", "rejected"] as ProposalStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {statusLabels[s]}
                  </option>
                ))}
              </Select>
            </FilterField>

            <FilterField label="Region">
              <Select value={region} onChange={(e) => setRegion(e.target.value)} disabled={regionOptions.length === 0}>
                <option value="all">All regions</option>
                {regionOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </FilterField>

            <FilterField label="Owner (SPARC)">
              <Select value={owner} onChange={(e) => setOwner(e.target.value)} disabled={ownerOptions.length === 0}>
                <option value="all">All owners</option>
                {ownerOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </FilterField>

            <FilterField label="Segment by">
              <Select value={segmentBy} onChange={(e) => setSegmentBy(e.target.value as SegmentKey)}>
                {SEGMENTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </FilterField>

            <div className="ml-auto flex items-center gap-3 pb-0.5">
              <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <Filter size={14} />
                {filtered.length} of {proposals.length} proposals
              </span>
              {filtersActive && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  <RotateCcw size={14} className="mr-1" /> Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Gauge size={40} className="text-text-muted" />
            <p className="font-medium text-text-primary">No proposals match these filters</p>
            <p className="max-w-md text-sm text-text-secondary">Adjust the timeline, status, region or owner filters above.</p>
            {filtersActive && (
              <Button variant="outline" size="sm" onClick={resetFilters} className="mt-2">
                <RotateCcw size={14} className="mr-1" /> Reset filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <motion.div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Kpi icon={FileText} label="Proposals" value={kpis.total} sub={`${kpis.reviewed} reviewed`} color="text-primary-600" bg="bg-primary-50 dark:bg-primary-50/10" />
            <Kpi icon={Gauge} label="Avg. Review Score" value={kpis.reviewed ? `${kpis.avgScore}/100` : "—"} sub={kpis.reviewed ? "across reviewed" : "no reviews yet"} color={scoreColor(kpis.avgScore)} bg="bg-amber-50 dark:bg-amber-50/10" />
            <Kpi icon={CheckCircle2} label="Approved" value={kpis.approved} sub={kpis.total ? `${Math.round((kpis.approved / kpis.total) * 100)}% of filtered` : ""} color="text-green-600" bg="bg-green-50 dark:bg-green-50/10" />
            <Kpi icon={AlertTriangle} label="Critical (Do Not Send)" value={kpis.critical} sub="reviewed proposals" color="text-red-600" bg="bg-red-50 dark:bg-red-50/10" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="mb-2 flex items-center justify-end">
              <Button variant="ghost" size="sm" onClick={resetLayout}>
                <RotateCcw size={14} className="mr-1" /> Reset layout
              </Button>
            </div>
            <div ref={gridRef} className="min-h-[400px]">
              {width > 0 && (
                <ResponsiveGridLayout
                  className="layout"
                  width={width}
                  layouts={layouts}
                  onLayoutChange={handleLayoutChange}
                  breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                  cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                  rowHeight={30}
                  dragConfig={{ handle: ".drag-handle" }}
                  resizeConfig={{ handles: ["se"] }}
                  margin={[16, 16]}
                >
              {/* Status breakdown */}
              <Card key="status">
                <CardHeader className="drag-handle cursor-move flex-row items-center justify-between">
                  <div>
                    <CardTitle>Proposals by status</CardTitle>
                    <CardDescription>Pipeline distribution for the current filters.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={statusChartType}
                      onChange={(e) => setStatusChartType(e.target.value as typeof statusChartType)}
                      className="w-28"
                      aria-label="Status chart type"
                    >
                      <option value="pie">Pie</option>
                      <option value="donut">Donut</option>
                    </Select>
                    <GripVertical size={18} className="text-text-muted" />
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={statusChartType === "donut" ? 50 : 0}
                        label
                      >
                        {statusData.map((entry) => (
                          <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Created over time */}
              <Card key="trend">
                <CardHeader className="drag-handle cursor-move flex-row items-center justify-between">
                  <div>
                    <CardTitle>Proposals created over time</CardTitle>
                    <CardDescription>Monthly volume (last 12 months).</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={trendChartType}
                      onChange={(e) => setTrendChartType(e.target.value as typeof trendChartType)}
                      className="w-28"
                      aria-label="Trend chart type"
                    >
                      <option value="bar">Bar</option>
                      <option value="line">Line</option>
                      <option value="area">Area</option>
                    </Select>
                    <GripVertical size={18} className="text-text-muted" />
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    {trendChartType === "bar" ? (
                      <BarChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis allowDecimals={false} fontSize={12} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    ) : trendChartType === "line" ? (
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis allowDecimals={false} fontSize={12} />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    ) : (
                      <AreaChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis allowDecimals={false} fontSize={12} />
                        <Tooltip />
                        <Area type="monotone" dataKey="count" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Count by segment */}
              <Card key="segmentCount">
                <CardHeader className="drag-handle cursor-move flex-row items-center justify-between">
                  <div>
                    <CardTitle>Proposals by {segmentLabel}</CardTitle>
                    <CardDescription>Volume grouped by the selected segment.</CardDescription>
                  </div>
                  <GripVertical size={18} className="text-text-muted" />
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(260, segmentData.length * 34)}>
                    <BarChart data={segmentData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" allowDecimals={false} fontSize={12} />
                      <YAxis type="category" dataKey="name" width={130} fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                        {segmentData.map((entry, i) => (
                          <Cell key={entry.name} fill={BAR_PALETTE[i % BAR_PALETTE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Avg score by segment */}
              <Card key="segmentScore">
                <CardHeader className="drag-handle cursor-move flex-row items-center justify-between">
                  <div>
                    <CardTitle>Avg. review score by {segmentLabel}</CardTitle>
                    <CardDescription>Mean AI Enabled Review score (0–100) per segment.</CardDescription>
                  </div>
                  <GripVertical size={18} className="text-text-muted" />
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(260, segmentData.length * 34)}>
                    <BarChart data={segmentData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" domain={[0, 100]} fontSize={12} />
                      <YAxis type="category" dataKey="name" width={130} fontSize={11} />
                      <Tooltip formatter={(value) => [`${value}/100`, "Avg score"]} />
                      <Bar dataKey="avgScore" radius={[0, 6, 6, 0]}>
                        {segmentData.map((entry) => (
                          <Cell key={entry.name} fill={entry.avgScore >= 80 ? "#22c55e" : entry.avgScore >= 60 ? "#eab308" : "#ef4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
                </ResponsiveGridLayout>
              )}
            </div>
          </motion.div>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Proposals ({filtered.length})</CardTitle>
              <CardDescription>Owner · region · status · review score for the current filters.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border-subtle">
                {filtered
                  .slice()
                  .sort((a, b) => (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1))
                  .map((p) => {
                    const review = reviews.get(p.id);
                    return (
                      <Link
                        key={p.id}
                        href={`/proposals/${p.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-muted/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-primary">{p.title}</p>
                          <p className="truncate text-xs text-text-tertiary">
                            {p.clientName}
                            {p.sparcOwner ? ` · ${p.sparcOwner}` : ""}
                            {p.proposalRegion ? ` · ${p.proposalRegion}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <Badge variant={p.status}>{statusLabels[p.status]}</Badge>
                          {review ? (
                            <span className={cn("text-sm font-bold tabular-nums", scoreColor(review.overall_score))}>
                              {review.overall_score}/100
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted">No review</span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          {/* ── Lead Master analytics ─────────────────────────────────────── */}
          <div className="pt-4">
            <h2 className="text-lg font-semibold text-text-primary">Proposal Master analytics</h2>
            <p className="text-sm text-text-tertiary">
              Pipeline performance by GTM, region and vertical — {PERIOD_LABELS[period].toLowerCase()}.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              icon={FileText}
              label="Total Proposals"
              value={leadKpis.total}
              sub={`${leadKpis.active} active in pipeline`}
              color="text-primary-600"
              bg="bg-primary-100 dark:bg-primary-500/10"
            />
            <Kpi
              icon={CheckCircle2}
              label="Converted"
              value={leadKpis.converted}
              color="text-green-600"
              bg="bg-green-50 dark:bg-green-500/10"
            />
            <Kpi
              icon={Gauge}
              label="Win Rate"
              value={leadKpis.winRate === null ? "—" : `${leadKpis.winRate}%`}
              sub="of decided proposals (won vs dropped)"
              color="text-amber-600"
              bg="bg-amber-50 dark:bg-amber-500/10"
            />
            <Kpi
              icon={AlertTriangle}
              label="Avg. Proposal Age"
              value={`${leadKpis.avgAgeDays}d`}
              sub="since initiation"
              color="text-rose-600"
              bg="bg-rose-50 dark:bg-rose-500/10"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Proposals by GTM Owner</CardTitle>
                <CardDescription>Volume brought in vs. converted, per GTM.</CardDescription>
              </CardHeader>
              <CardContent>
                {leadsByGtm.length === 0 ? (
                  <div className="flex h-56 items-center justify-center text-sm text-text-muted">No proposals yet</div>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={leadsByGtm} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={44} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="total" name="Proposals" fill="#6366f1" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="converted" name="Converted" fill="#22c55e" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Proposals by Region</CardTitle>
                <CardDescription>Geographic spread of the pipeline.</CardDescription>
              </CardHeader>
              <CardContent>
                {leadsByRegion.length === 0 ? (
                  <div className="flex h-56 items-center justify-center text-sm text-text-muted">No proposals yet</div>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={leadsByRegion} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={44} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="total" name="Proposals" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="converted" name="Converted" fill="#22c55e" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Proposals by Vertical</CardTitle>
                <CardDescription>Which practice areas the pipeline leans on.</CardDescription>
              </CardHeader>
              <CardContent>
                {leadsByVertical.length === 0 ? (
                  <div className="flex h-56 items-center justify-center text-sm text-text-muted">No proposals yet</div>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={leadsByVertical} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={44} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="total" name="Proposals" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Avg. Days per Event</CardTitle>
                <CardDescription>
                  Where proposals spend their time (events with recorded checkpoints).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {leadKpis.total === 0 ? (
                  <div className="flex h-56 items-center justify-center text-sm text-text-muted">No proposals yet</div>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={leadEventDurations} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={52} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => [`${v} days`, "Avg. duration"]} />
                        <Bar dataKey="days" name="Avg. days" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Proposal Master ({filteredLeads.length})</CardTitle>
              <CardDescription>GTM · region · current event · status for the selected period.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border-subtle">
                {filteredLeads.map((l) => (
                  <Link
                    key={l.id}
                    href={`/leads/${l.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">{l.leadName}</p>
                      <p className="truncate text-xs text-text-tertiary">
                        {l.clientName || "—"}
                        {l.gtmName ? ` · GTM: ${l.gtmName}` : ""}
                        {l.proposalRegion ? ` · ${l.proposalRegion}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="whitespace-nowrap rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
                        {l.currentEvent ?? 1}/8 · {LEAD_EVENT_SHORT[(l.currentEvent ?? 1) - 1]}
                      </span>
                      <Badge className={LEAD_STATUS_BADGE[l.status]}>{leadStatusLabels[l.status]}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-[150px] flex-1 flex-col gap-1 sm:flex-none">
      <span className="text-xs font-medium text-text-tertiary">{label}</span>
      {children}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  color,
  bg,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  bg: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", bg, color)}>
          <Icon size={24} />
        </div>
        <div className="min-w-0">
          <p className={cn("text-2xl font-bold", color)}>{value}</p>
          <p className="text-sm text-text-secondary">{label}</p>
          {sub && <p className="text-xs text-text-tertiary">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
