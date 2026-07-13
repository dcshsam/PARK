"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Download,
  Euro,
  Flag,
  FileText,
  ListChecks,
  LoaderCircle,
  Milestone,
  ShieldAlert,
  Sparkles,
  UserRound,
  Users,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getLeads } from "@/lib/db";
import { LEAD_EVENT_LABELS } from "@/lib/lead-events";
import { buildProjectCardFromLead, type ProjectCard, type ProjectHealth, type ProjectLog } from "@/lib/project-cards-data";

const healthDot: Record<ProjectHealth, string> = {
  "On track": "bg-emerald-500",
  "At risk": "bg-amber-500",
  "Needs attention": "bg-red-500",
};

const logConfig: Record<ProjectLog["type"], { icon: React.ElementType; color: string; bg: string }> = {
  milestone: { icon: Flag, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
  decision: { icon: CircleDot, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-500/10" },
  risk: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-500/10" },
  update: { icon: Activity, color: "text-primary-600", bg: "bg-primary-50 dark:bg-primary-500/10" },
};

export default function ProjectCardsPage() {
  const [owner, setOwner] = useState("all");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getLeads()
      .then((leads) => {
        if (cancelled) return;
        const cards = leads.map(buildProjectCardFromLead);
        setProjects(cards);
        setProjectId(cards[0]?.id ?? "");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const sparcOwners = useMemo(
    () => Array.from(new Set(projects.map((project) => project.owner))).sort(),
    [projects],
  );

  const availableProjects = useMemo(
    () => (owner === "all" ? projects : projects.filter((project) => project.owner === owner)),
    [owner, projects],
  );
  const project = availableProjects.find((item) => item.id === projectId) ?? availableProjects[0];

  const handleOwnerChange = (value: string) => {
    setOwner(value);
    const firstMatch = value === "all" ? projects[0] : projects.find((item) => item.owner === value);
    if (firstMatch) setProjectId(firstMatch.id);
  };

  const handleDownload = async () => {
    if (!project) return;
    setExporting(true);
    try {
      const { downloadProjectCardPdf } = await import("@/lib/project-card-pdf");
      downloadProjectCardPdf(project);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[65vh] items-center justify-center"><div className="text-center"><LoaderCircle size={28} className="mx-auto animate-spin text-primary-600" /><p className="mt-3 text-sm text-text-secondary">Building proposal cards from Proposal Master…</p></div></div>;
  }

  if (!project) {
    return <Card className="mx-auto mt-16 max-w-xl"><CardContent className="flex flex-col items-center py-14 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-text-muted"><FileText size={22} /></div><h1 className="mt-4 text-lg font-bold text-text-primary">No proposals to showcase yet</h1><p className="mt-2 max-w-sm text-sm text-text-secondary">Add an initiative in Proposal Master and its weekly Proposal Card will appear here automatically.</p></CardContent></Card>;
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 pb-10">
      <section className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#102849] px-5 py-6 text-white shadow-xl shadow-slate-900/10 sm:px-7 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_0%,rgba(27,150,255,0.32),transparent_36%),radial-gradient(circle_at_12%_110%,rgba(15,185,201,0.22),transparent_38%)]" />
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border-[42px] border-white/[0.04]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-200">
              <Sparkles size={14} /> Weekly command brief
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Proposal Cards</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              One page for the weekly call — every Proposal Master initiative becomes a clear story of health, progress, decisions, risks, and activity.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:min-w-[570px] xl:grid-cols-[1fr_1.35fr_auto]">
            <FilterField label="SPARC owner" icon={UserRound}>
              <Select value={owner} onChange={(event) => handleOwnerChange(event.target.value)} className="h-11 border-white/15 bg-white/10 pr-9 text-white focus:border-sky-300 [&>option]:text-slate-900">
                <option value="all">All owners</option>
                {sparcOwners.map((name) => <option key={name} value={name}>{name}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Initiative" icon={WalletCards}>
              <div className="relative">
                <Select value={project.id} onChange={(event) => setProjectId(event.target.value)} className="h-11 border-white/15 bg-white/10 pr-9 text-white focus:border-sky-300 [&>option]:text-slate-900">
                  {availableProjects.map((item) => <option key={item.id} value={item.id}>{item.initiative}</option>)}
                </Select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3.5 text-slate-300" />
              </div>
            </FilterField>
            <Button onClick={handleDownload} disabled={exporting} className="h-11 self-end bg-white px-4 font-semibold text-[#102849] shadow-md hover:bg-sky-50 sm:col-span-2 xl:col-span-1">
              <Download size={16} className="mr-2" /> {exporting ? "Preparing…" : "Download PDF"}
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(310px,0.75fr)]">
        <div className="space-y-5">
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary-700 via-primary-600 to-cyan-600 text-white shadow-lg">
            <div className="absolute -right-14 -top-16 h-52 w-52 rounded-full border-[34px] border-white/10" />
            <CardContent className="relative p-6 sm:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <Link
                  href={`/leads/${project.id}`}
                  className="group block min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  title={`Open ${project.initiative} in Proposal Master`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/90">{project.phase}</span>
                    <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-800">
                      <span className={cn("h-2 w-2 rounded-full", healthDot[project.health])} /> {project.health}
                    </span>
                  </div>
                  <h2 className="mt-4 flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
                    <span className="truncate">{project.initiative}</span>
                    <ArrowUpRight size={21} className="shrink-0 text-white/65 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
                  </h2>
                  <p className="mt-3 max-w-3xl truncate text-sm leading-6 text-white/85" title={project.summary}>{project.summary}</p>
                </Link>
                <ProgressRing value={project.progress} />
              </div>
              <div className="mt-6 grid gap-4 border-t border-white/20 pt-5 sm:grid-cols-2 lg:grid-cols-6">
                <HeroMeta icon={Euro} label="DLV Cost" value={project.dlvCost} />
                <HeroMeta icon={Users} label="DLV HeadCount" value={project.dlvHeadCount} />
                <HeroMeta icon={UserRound} label="SPARC owner" value={project.owner} />
                <HeroMeta icon={UsersRound} label="GTM owner" value={project.sponsor} />
                <HeroMeta icon={CalendarDays} label="Start date" value={project.startDate} />
                <HeroMeta icon={FileText} label="Client" value={project.clientName || "Not set"} />
              </div>
            </CardContent>
          </Card>

          <ProposalRoadmap project={project} />

          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard icon={ListChecks} label="Work completed" value={String(project.completed)} note={`${project.inProgress} in progress`} tone="violet" />
            <MetricCard icon={ShieldAlert} label="Blocked items" value={String(project.blocked)} note={project.blocked === 0 ? "No blockers" : "Needs weekly focus"} tone={project.blocked > 2 ? "red" : "green"} />
            <MetricCard icon={UsersRound} label="Roadmap stage" value={`${project.currentEvent ?? 1}/8`} note={project.phase} tone="amber" />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FocusCard title="Wins this week" icon={CheckCircle2} tone="green" items={project.achievements} />
            <FocusCard title="Next 7 days" icon={ArrowRight} tone="blue" items={project.nextSteps} />
          </div>
        </div>

        <aside className="space-y-5">
          <Card className="overflow-hidden border-amber-200/70 dark:border-amber-700/50">
            <div className="border-b border-amber-100 bg-amber-50/80 px-5 py-4 dark:border-amber-700/40 dark:bg-amber-500/10">
              <SectionHeading icon={AlertTriangle} title="Risks & decisions" subtitle="Items to unblock in the weekly call" />
            </div>
            <CardContent className="space-y-4 p-5">
              {project.risks.map((risk) => (
                <div key={risk.title} className="rounded-xl border border-border bg-surface-muted/30 p-4">
                  <div className="flex items-start justify-between gap-2"><p className="text-sm font-bold text-text-primary">{risk.title}</p><Badge className="shrink-0 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300">{risk.level}</Badge></div>
                  <p className="mt-2 text-xs leading-5 text-text-secondary">{risk.mitigation}</p>
                </div>
              ))}
              {project.decisions.map((decision) => (
                <div key={decision.title} className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-700/50 dark:bg-violet-500/10">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300"><CircleDot size={13} /> Decision required</div>
                  <p className="mt-2 text-sm font-bold text-text-primary">{decision.title}</p>
                  <p className="mt-2 text-xs text-text-secondary">{decision.owner} • Due {decision.due}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-border bg-surface-muted/30 px-5 py-4">
              <SectionHeading icon={Activity} title="Proposal log" subtitle="The story since the last call" />
            </div>
            <CardContent className="p-5">
              <div className="relative space-y-0 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-border">
                {project.logs.map((log) => {
                  const config = logConfig[log.type];
                  const Icon = config.icon;
                  return (
                    <div key={`${log.date}-${log.title}`} className="relative flex gap-3 pb-6 last:pb-0">
                      <div className={cn("relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-surface", config.bg, config.color)}><Icon size={15} /></div>
                      <div className="min-w-0 pt-0.5">
                        <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-text-primary">{log.title}</p><span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{log.date}</span></div>
                        <p className="mt-1 text-xs leading-5 text-text-secondary">{log.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

        </aside>
      </section>
    </div>
  );
}

function FilterField({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300"><Icon size={12} /> {label}</span>{children}</label>;
}

function ProgressRing({ value }: { value: number }) {
  const degrees = value * 3.6;
  return <div className="relative h-24 w-24 shrink-0 rounded-full p-[7px] shadow-inner" style={{ background: `conic-gradient(#ffffff ${degrees}deg, rgba(255,255,255,.18) ${degrees}deg)` }}><div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-primary-600"><span className="text-2xl font-bold">{value}%</span><span className="text-[9px] font-semibold uppercase tracking-wider text-white/70">complete</span></div></div>;
}

function ProposalRoadmap({ project }: { project: ProjectCard }) {
  const currentIndex = Math.max(0, Math.min(7, project.currentEvent - 1));
  const progressIndex = project.completed >= 8 ? 7 : currentIndex;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <Milestone size={18} className="text-primary-600" />
              <h3 className="font-bold text-text-primary">Proposal roadmap</h3>
            </div>
            <p className="mt-1 text-xs text-text-tertiary">{project.referenceId} · Proposal Master 8-event journey</p>
          </div>
          <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
            Event {project.currentEvent} of 8
          </span>
        </div>

        <div className="overflow-x-auto px-5 pb-5 pt-10 sm:px-6">
          <div className="min-w-[680px] px-1">
            <div className="relative">
              <div className="absolute left-[6.25%] right-[6.25%] top-[7px] h-0.5 bg-border" />
              <div
                className="absolute left-[6.25%] top-[7px] h-0.5 bg-primary-600 transition-[width] duration-500"
                style={{ width: `${(progressIndex / 7) * 87.5}%` }}
              />
              <div className="relative grid grid-cols-8">
                {LEAD_EVENT_LABELS.map((label, index) => {
                  const completed = index < project.completed;
                  const active = project.completed < 8 && index === currentIndex;
                  const reached = completed || active;
                  return (
                    <div key={label} className="relative flex min-w-0 flex-col items-center px-2 text-center">
                      {index < LEAD_EVENT_LABELS.length - 1 && (
                        <span className="absolute left-1/2 top-[-25px] z-20 flex w-full justify-center">
                          <span className={cn(
                            "rounded-full border bg-surface px-1.5 py-0.5 text-[8px] font-bold leading-none shadow-sm",
                            index < progressIndex ? "border-primary-200 text-primary-700 dark:border-primary-700 dark:text-primary-300" : "border-border text-text-muted",
                          )}>
                            {project.roadmapDurations[index]}
                          </span>
                        </span>
                      )}
                      <span
                        className={cn(
                          "relative z-10 block h-4 w-4 rounded-full border-[3px] bg-surface transition-colors",
                          reached ? "border-primary-600" : "border-border-strong",
                          completed && "bg-primary-600",
                          active && "ring-4 ring-primary-100 dark:ring-primary-500/20",
                        )}
                      />
                      <span
                        className={cn(
                          "mt-3 text-[10px] font-medium leading-4 text-text-tertiary",
                          completed && "text-text-secondary",
                          active && "font-bold text-primary-700 dark:text-primary-300",
                        )}
                      >
                        {label}
                      </span>
                      <span className={cn(
                        "mt-1 text-[9px] font-semibold leading-3 text-text-muted",
                        completed && "text-text-secondary",
                        active && "text-primary-600 dark:text-primary-300",
                      )}>
                        {project.roadmapDates[index]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HeroMeta({ icon: Icon, label, value, wide = false }: { icon: React.ElementType; label: string; value: string; wide?: boolean }) {
  return <div className={cn("flex gap-3", wide && "sm:col-span-2 lg:col-span-2")}><div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15"><Icon size={15} /></div><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-white/60">{label}</p><p className={cn("mt-1 truncate font-semibold text-white", wide ? "text-xs leading-5" : "text-sm")} title={value}>{value}</p></div></div>;
}

const tones = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/10",
  red: "bg-red-50 text-red-600 dark:bg-red-500/10",
  green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10",
};

function MetricCard({ icon: Icon, label, value, note, tone }: { icon: React.ElementType; label: string; value: string; note: string; tone: keyof typeof tones }) {
  return <Card><CardContent className="flex items-center gap-4 p-4"><div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tones[tone])}><Icon size={20} /></div><div className="min-w-0"><p className="truncate text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">{label}</p><div className="mt-0.5 flex items-baseline gap-2"><span className="text-xl font-bold text-text-primary">{value}</span><span className="truncate text-[10px] text-text-muted">{note}</span></div></div></CardContent></Card>;
}

function SectionHeading({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return <div><div className="flex items-center gap-2"><Icon size={18} className="text-primary-600" /><h3 className="font-bold text-text-primary">{title}</h3></div><p className="mt-1 text-xs text-text-tertiary">{subtitle}</p></div>;
}

function FocusCard({ title, icon: Icon, tone, items }: { title: string; icon: React.ElementType; tone: "green" | "blue"; items: string[] }) {
  const color = tone === "green" ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" : "text-primary-600 bg-primary-50 dark:bg-primary-500/10";
  return <Card><CardContent className="p-5 sm:p-6"><div className="flex items-center gap-3"><div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", color)}><Icon size={18} /></div><h3 className="font-bold text-text-primary">{title}</h3></div><div className="mt-4 space-y-3">{items.map((item, index) => <div key={item} className="flex gap-3"><span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", color)}>{index + 1}</span><p className="text-sm leading-5 text-text-secondary">{item}</p></div>)}</div></CardContent></Card>;
}
