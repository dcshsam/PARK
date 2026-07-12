"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { getLeads } from "@/lib/db";
import type { Lead, LeadStatus, TeamActivity, TeamActivityCategory } from "@/lib/types";
import { leadStatusLabels } from "@/lib/types";
import { LEAD_EVENT_SHORT, LEAD_STATUS_COLORS, LEAD_STATUS_BADGE, LEAD_STATUS_ORDER } from "@/lib/lead-events";
import { getTeamActivities, teamActivityCategoryLabels } from "@/lib/team-activity";
import { getTeamMembers, seedTeamMembers } from "@/lib/team-members";
import type { TeamMember } from "@/lib/team-members";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, cn } from "@/lib/utils";
import {
  Clock,
  CheckCircle2,
  Plus,
  ArrowRight,
  TrendingUp,
  Activity,
  BarChart3,
  Zap,
  AlertCircle,
  Users,
  CalendarDays,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const ACTIVITY_CATEGORY_COLORS: Record<TeamActivityCategory, string> = {
  customer: "#f59e0b",
  capability: "#3b82f6",
  assessment: "#22c55e",
  idea: "#14b8a6",
  internal: "#a855f7",
  other: "#64748b",
};

const cardGradients = [
  "from-blue-500 to-indigo-600",
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-600",
  "from-rose-400 to-red-600",
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Sparkline({ color = "#6366f1" }: { color?: string }) {
  const [data] = useState(() => Array.from({ length: 8 }, (_, i) => ({ i, v: 15 + ((i * 7) % 31) })));
  return (
    <div className="h-10 w-24 opacity-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#spark-${color})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function overlapsRange(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return start <= rangeEnd && end >= rangeStart;
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [activities, setActivities] = useState<TeamActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    seedTeamMembers();
    Promise.resolve().then(() => setTeamMembers(getTeamMembers()));
    getLeads().then((data) => {
      setLeads(data);
      setLoading(false);
    });
    getTeamActivities().then(setActivities);
  }, []);

  // ── Proposal Master pipeline (leads presented as proposals) ────────────────
  const leadStats = useMemo(() => {
    const total = leads.length;
    const converted = leads.filter((l) => l.status === "converted").length;
    const dropped = leads.filter((l) => l.status === "dropped").length;
    const onHold = leads.filter((l) => l.status === "on_hold").length;
    const active = total - converted - dropped;
    const decided = converted + dropped;
    const conversionRate = decided > 0 ? Math.round((converted / decided) * 100) : null;
    return { total, active, converted, dropped, onHold, conversionRate };
  }, [leads]);

  const leadFunnelData = useMemo(
    () =>
      LEAD_EVENT_SHORT.map((label, i) => ({
        name: `${i + 1}. ${label}`,
        short: label,
        value: leads.filter((l) => l.status !== "dropped" && (l.currentEvent ?? 1) === i + 1).length,
      })),
    [leads]
  );

  const leadStatusData = useMemo(() => {
    return LEAD_STATUS_ORDER
      .map((s) => ({ name: leadStatusLabels[s], status: s, value: leads.filter((l) => l.status === s).length }))
      .filter((d) => d.value > 0);
  }, [leads]);

  const activeLeads = useMemo(
    () =>
      leads
        .filter((l) => l.status !== "converted" && l.status !== "dropped")
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 6),
    [leads]
  );

  // ── Team activity KPIs ─────────────────────────────────────────────────────
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const activitiesThisWeek = activities.filter((a) =>
    overlapsRange(new Date(a.startDate), new Date(a.endDate), weekStart, weekEnd)
  ).length;

  const activitiesThisMonth = activities.filter((a) =>
    overlapsRange(new Date(a.startDate), new Date(a.endDate), monthStart, monthEnd)
  ).length;

  const memberWorkload = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of activities) {
      counts.set(a.memberName, (counts.get(a.memberName) ?? 0) + 1);
    }
    return teamMembers
      .map((m) => ({ name: m.name, count: counts.get(m.name) ?? 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 6);
  }, [activities, teamMembers]);

  const topContributor = memberWorkload[0];

  const categoryData = useMemo(() => {
    const categories: TeamActivityCategory[] = ["customer", "capability", "assessment", "idea", "internal", "other"];
    return categories
      .map((c) => ({
        name: teamActivityCategoryLabels[c],
        category: c,
        value: activities.filter((a) => a.category === c).length,
      }))
      .filter((d) => d.value > 0);
  }, [activities]);

  const upcomingActivities = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return activities
      .filter((a) => new Date(a.endDate) >= todayStart)
      .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
      .slice(0, 5);
  }, [activities]);

  return (
    <div className="space-y-8">
      {/* Hero header */}
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-indigo-700 p-6 text-white shadow-lg sm:p-8"
      >
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{greeting()}, reviewer</h1>
            <p className="mt-1 text-primary-100">
              Here&apos;s what&apos;s happening across your proposal pipeline today.
            </p>
          </div>
          <Link href="/leads/new">
            <Button className="bg-white text-primary-700 hover:bg-primary-50">
              <Plus size={18} className="mr-2" />
              New Proposal
            </Button>
          </Link>
        </div>
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-indigo-400/20 blur-2xl" />
      </motion.div>

      {/* Proposal Master pipeline — management view */}
      <motion.div
        className="space-y-4"
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Proposal Master pipeline</h2>
          <p className="text-sm text-text-tertiary">Where every proposal sits in the 8-event journey, and who owns it.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Users, label: "Total Proposals", value: leadStats.total, color: "text-white", gradient: cardGradients[0] },
            { icon: TrendingUp, label: "Active Pipeline", value: leadStats.active, color: "text-white", gradient: cardGradients[1] },
            {
              icon: CheckCircle2,
              label: "Converted",
              value: leadStats.conversionRate === null ? leadStats.converted : `${leadStats.converted} (${leadStats.conversionRate}%)`,
              color: "text-white",
              gradient: cardGradients[2],
            },
            { icon: AlertCircle, label: "On Hold / Dropped", value: leadStats.onHold + leadStats.dropped, color: "text-white", gradient: cardGradients[3] },
          ].map((stat, idx) => (
            <StatCard key={stat.label} {...stat} index={idx} />
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 size={20} className="text-primary-600" /> Pipeline by event
              </CardTitle>
              <CardDescription>Active proposals at each stage of the 8-event journey.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-64 animate-pulse rounded-xl bg-surface-muted" />
              ) : leads.length === 0 ? (
                <EmptyState message="No proposals yet. Create your first proposal in Proposal Master." />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={leadFunnelData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                      <XAxis dataKey="short" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" name="Leads" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity size={20} className="text-primary-600" /> Proposal statuses
              </CardTitle>
              <CardDescription>Health of the overall funnel.</CardDescription>
            </CardHeader>
            <CardContent>
              {leadStatusData.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-sm text-text-muted">No data yet</div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={leadStatusData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          innerRadius={45}
                          paddingAngle={3}
                        >
                          {leadStatusData.map((entry) => (
                            <Cell key={entry.status} fill={LEAD_STATUS_COLORS[entry.status]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex flex-wrap justify-center gap-3">
                    {leadStatusData.map((d) => (
                      <div key={d.status} className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LEAD_STATUS_COLORS[d.status] }} />
                        {d.name} ({d.value})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users size={20} className="text-primary-600" /> Active proposals — ownership
            </CardTitle>
            <CardDescription>Who is responsible for what, and where each proposal stands.</CardDescription>
          </CardHeader>
          <CardContent>
            {activeLeads.length === 0 ? (
              <EmptyState message="No active proposals right now." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium uppercase text-text-tertiary">
                      <th className="pb-2 pr-4">Proposal</th>
                      <th className="pb-2 pr-4">GTM</th>
                      <th className="pb-2 pr-4">SPARC Mentor</th>
                      <th className="pb-2 pr-4">Region</th>
                      <th className="pb-2 pr-4">Vertical</th>
                      <th className="pb-2 pr-4">Event</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeLeads.map((lead) => (
                      <tr key={lead.id} className="border-b border-border/60 last:border-0 hover:bg-surface-muted/40">
                        <td className="py-3 pr-4">
                          <Link href={`/leads/${lead.id}`} className="group">
                            <p className="font-medium text-text-primary group-hover:text-primary-600">{lead.leadName}</p>
                            <p className="text-xs text-text-tertiary">{lead.clientName || "—"}</p>
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-text-secondary">{lead.gtmName || "—"}</td>
                        <td className="py-3 pr-4 text-text-secondary">{lead.sparcMentor || "—"}</td>
                        <td className="py-3 pr-4 text-text-secondary">{lead.proposalRegion || "—"}</td>
                        <td className="py-3 pr-4 text-text-secondary">{lead.vertical || "—"}</td>
                        <td className="py-3 pr-4">
                          <span className="whitespace-nowrap rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
                            {lead.currentEvent ?? 1}/8 · {LEAD_EVENT_SHORT[(lead.currentEvent ?? 1) - 1]}
                          </span>
                        </td>
                        <td className="py-3">
                          <Badge className={LEAD_STATUS_BADGE[lead.status]}>{leadStatusLabels[lead.status]}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick link to analytics */}
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
      >
        <Link href="/analytics">
          <Card className="group cursor-pointer transition-colors hover:border-primary-300 hover:bg-surface-muted/30">
            <CardContent className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                  <Zap size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary group-hover:text-primary-600">Deep analytics</p>
                  <p className="text-xs text-text-tertiary">Pipeline performance by GTM, region, vertical and more.</p>
                </div>
              </div>
              <ArrowRight size={18} className="text-text-muted transition-transform group-hover:translate-x-1" />
            </CardContent>
          </Card>
        </Link>
      </motion.div>

      {/* Team activity insights */}
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="grid gap-6 lg:grid-cols-3"
      >
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users size={20} className="text-primary-600" /> Team activity insights
              </CardTitle>
              <CardDescription>Workload, categories, and contribution trends.</CardDescription>
            </div>
            <Link href="/team-activity">
              <Button variant="outline" size="sm">
                View all <ArrowRight size={16} className="ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <InsightTile
                label="Team members"
                value={teamMembers.length}
                icon={Users}
                color="text-indigo-600"
                bg="bg-indigo-50 dark:bg-indigo-500/10"
              />
              <InsightTile
                label="Total activities"
                value={activities.length}
                icon={Activity}
                color="text-blue-600"
                bg="bg-blue-50 dark:bg-blue-500/10"
              />
              <InsightTile
                label="Active this week"
                value={activitiesThisWeek}
                icon={Clock}
                color="text-amber-600"
                bg="bg-amber-50 dark:bg-amber-500/10"
              />
              <InsightTile
                label="Active this month"
                value={activitiesThisMonth}
                icon={CalendarDays}
                color="text-emerald-600"
                bg="bg-emerald-50 dark:bg-emerald-500/10"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Workload by member */}
              <div className="rounded-xl border border-border bg-surface-muted/20 p-4">
                <p className="text-xs font-medium text-text-tertiary">Workload by member</p>
                <div className="mt-3 h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={memberWorkload} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={40} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {topContributor && (
                  <p className="mt-2 text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">{topContributor.name}</span> is the top contributor with{" "}
                    <span className="font-semibold text-text-primary">{topContributor.count}</span> activities.
                  </p>
                )}
              </div>

              {/* Category breakdown */}
              <div className="rounded-xl border border-border bg-surface-muted/20 p-4">
                <p className="text-xs font-medium text-text-tertiary">Activities by category</p>
                <div className="mt-1 h-44">
                  {categoryData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-text-muted">No activities yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={60}
                          innerRadius={35}
                          paddingAngle={3}
                        >
                          {categoryData.map((entry) => (
                            <Cell key={entry.category} fill={ACTIVITY_CATEGORY_COLORS[entry.category]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap justify-center gap-2">
                  {categoryData.map((d) => (
                    <div key={d.category} className="flex items-center gap-1 text-[10px] text-text-secondary">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: ACTIVITY_CATEGORY_COLORS[d.category] }}
                      />
                      {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming activities */}
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays size={20} className="text-primary-600" /> Upcoming
            </CardTitle>
            <CardDescription>Activities ending soon.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingActivities.length === 0 ? (
              <EmptyState message="No upcoming activities." />
            ) : (
              upcomingActivities.map((activity, i) => (
                <motion.div
                  key={activity.id}
                  initial={false}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: 0.1 + i * 0.05 }}
                  className="rounded-xl border border-border bg-surface-muted/30 p-3 transition-colors hover:border-primary-200 hover:bg-surface-muted/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-text-primary">{activity.title}</p>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${ACTIVITY_CATEGORY_COLORS[activity.category]}20`,
                        color: ACTIVITY_CATEGORY_COLORS[activity.category],
                      }}
                    >
                      {teamActivityCategoryLabels[activity.category]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-text-tertiary">{activity.memberName}</p>
                  <p className="mt-1.5 text-[11px] text-text-secondary">
                    {formatDate(activity.startDate)} – {formatDate(activity.endDate)}
                  </p>
                </motion.div>
              ))
            )}
          </CardContent>
        </Card>
      </motion.div>

    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  gradient,
  index,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  gradient: string;
  index: number;
}) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 + index * 0.05 }}
    >
      <Card className={cn("relative overflow-hidden border-0 text-white shadow-md", `bg-gradient-to-br ${gradient}`)}>
        <CardContent className="relative z-10 flex items-center justify-between p-5">
          <div>
            <p className="text-3xl font-bold">{value}</p>
            <p className="mt-1 text-sm font-medium text-white/90">{label}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Icon size={22} className="text-white" />
            </div>
            <Sparkline color="#ffffff" />
          </div>
        </CardContent>
        <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-white/10 blur-xl" />
      </Card>
    </motion.div>
  );
}

function InsightTile({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  color: string;
  bg: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-muted/30 p-3">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", bg, color)}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-text-tertiary">{label}</p>
        <p className="truncate text-sm font-bold text-text-primary">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-muted/50 py-12 text-center">
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  );
}
