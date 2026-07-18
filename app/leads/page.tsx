"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { deleteLead, getLeads, getProposals, seedSampleLeads, getDeepReviewMap } from "@/lib/db";
import type { DeepReview } from "@/lib/deep-review/types";
import { useProfile } from "@/components/profile-provider";
import { RequireAccess } from "@/components/require-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ProposalScoreBadge } from "@/components/proposal-score-badge";
import { leadStatusLabels, type Lead } from "@/lib/types";
import { LEAD_EVENT_LABELS, LEAD_STATUS_BADGE } from "@/lib/lead-events";
import { cn, formatDate } from "@/lib/utils";
import {
  PROPOSAL_PERIOD_OPTIONS,
  parseProposalPeriod,
  parseProposalPipelineFilter,
  proposalInPeriod,
  proposalMatchesPipeline,
} from "@/lib/proposal-dashboard-filters";
import { Plus, Trash2, FileText, Eye, Pencil, Database, Loader2, Search, SlidersHorizontal, RotateCcw, ArrowUpDown } from "lucide-react";

type LeadSort = "updated_desc" | "updated_asc" | "name_asc" | "name_desc" | "client_asc" | "event_desc";

function sparcOwnerFor(lead: Lead) {
  return lead.sparcOwner || lead.sparcMentor || "Unassigned";
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function IterationBadge({ lead, iterations }: { lead: Lead; iterations: Map<string, number> }) {
  const iteration = lead.proposalId ? iterations.get(lead.proposalId) ?? 0 : 0;
  if (iteration <= 0) return null;
  return (
    <Badge className="border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
      Iteration {iteration}
    </Badge>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">{label}</span>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>{children}</Select>
    </label>
  );
}

// The lead's 8-event roadmap. currentEvent is 1-based and points at the event
// still being worked, so everything before it is done. on_hold / dropped leaves
// the track where it is and greys the active dot.
function LeadStageTrack({ lead }: { lead: Lead }) {
  const current = Math.min(Math.max(lead.currentEvent, 1), LEAD_EVENT_LABELS.length);
  const finalEventCompleted = Boolean(
    (lead.eventData?.event8 as { completedAt?: Date | string } | undefined)?.completedAt
  );
  const completed = finalEventCompleted ? LEAD_EVENT_LABELS.length : current - 1;
  const completedSegments = Math.min(completed, LEAD_EVENT_LABELS.length - 1);
  const paused = !finalEventCompleted && (lead.status === "on_hold" || lead.status === "dropped");
  // Dots sit at the centre of each equal-width column.
  const trackInset = 50 / LEAD_EVENT_LABELS.length;

  return (
    <div className="mt-3 border-t border-border-subtle pt-4">
      <div className="relative flex items-start">
        <div
          className="absolute top-1.5 h-0.5 bg-border"
          style={{ left: `${trackInset}%`, right: `${trackInset}%` }}
        />
        {completed > 0 && (
          <div
            className="absolute top-1.5 h-0.5 bg-primary-600"
            style={{
              left: `${trackInset}%`,
              width: `${(completedSegments / (LEAD_EVENT_LABELS.length - 1)) * (100 - 2 * trackInset)}%`,
            }}
          />
        )}
        {LEAD_EVENT_LABELS.map((label, i) => {
          const done = i < completed;
          const active = !finalEventCompleted && !paused && i === completed;
          return (
            <div key={label} className="relative z-10 flex flex-1 flex-col items-center gap-1.5 px-1">
              <span
                className={cn(
                  "h-3 w-3 shrink-0 rounded-full border-2",
                  done
                    ? "border-primary-600 bg-primary-600"
                    : active
                      ? "border-primary-600 bg-surface ring-4 ring-primary-100"
                      : "border-border bg-surface"
                )}
              />
              <span
                className={cn(
                  "text-center text-[10px] font-medium leading-tight",
                  active ? "text-primary-700" : done ? "text-text-secondary" : "text-text-muted"
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
      {paused && (
        <p className="mt-2 text-center text-[11px] font-medium text-text-tertiary">
          {leadStatusLabels[lead.status]} — progress paused
        </p>
      )}
    </div>
  );
}

export default function LeadsPage() {
  return (
    <RequireAccess action="view">
      <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-surface-muted" />}>
        <LeadsPageContent />
      </Suspense>
    </RequireAccess>
  );
}

function LeadsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dashboardPeriod = parseProposalPeriod(searchParams.get("period"));
  const dashboardPipeline = parseProposalPipelineFilter(searchParams.get("pipeline"));
  const dashboardEventParam = searchParams.get("events") ?? searchParams.get("event") ?? "";
  const dashboardEvents = useMemo(
    () => dashboardEventParam
      .split(",")
      .map(Number)
      .filter((event) => Number.isInteger(event) && event >= 1 && event <= 8),
    [dashboardEventParam]
  );
  const reviewedOnly = searchParams.get("reviewed") === "true";
  const metricFilter = searchParams.get("metric") === "headcount"
    ? "headcount"
    : searchParams.get("metric") === "dlv"
      ? "dlv"
      : null;
  const hasDashboardFilters = dashboardPeriod !== "all" || dashboardPipeline !== "all" || dashboardEvents.length > 0 || reviewedOnly || metricFilter !== null;
  const dashboardFilterLabels = [
    dashboardPeriod !== "all" ? PROPOSAL_PERIOD_OPTIONS.find((option) => option.value === dashboardPeriod)?.label : null,
    dashboardPipeline === "active"
      ? "Active Pipeline"
      : dashboardPipeline === "converted"
        ? "Converted"
        : dashboardPipeline === "attention"
          ? "On Hold / Dropped"
          : null,
    dashboardEvents.length > 0
      ? dashboardEvents.length > 1
        ? `Events ${dashboardEvents.join(", ")}`
        : `Event ${dashboardEvents[0]}`
      : null,
    reviewedOnly ? "Review completed" : null,
    metricFilter === "headcount" ? "Headcount added" : metricFilter === "dlv" ? "DLV added" : null,
  ].filter(Boolean) as string[];
  const { can } = useProfile();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [reviews, setReviews] = useState<Map<string, DeepReview>>(new Map());
  const [proposalIterations, setProposalIterations] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(hasDashboardFilters);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sparcFilter, setSparcFilter] = useState("all");
  const [gtmFilter, setGtmFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [verticalFilter, setVerticalFilter] = useState("all");
  const [sortBy, setSortBy] = useState<LeadSort>("updated_desc");

  const filterOptions = useMemo(() => ({
    sparcOwners: uniqueValues(leads.map(sparcOwnerFor)),
    gtmOwners: uniqueValues(leads.map((lead) => lead.gtmName || "Unassigned")),
    regions: uniqueValues(leads.map((lead) => lead.proposalRegion || "Unassigned")),
    verticals: uniqueValues(leads.map((lead) => lead.vertical || "Unassigned")),
  }), [leads]);

  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = leads.filter((lead) => {
      const searchable = [lead.leadName, lead.kytesId, lead.clientName, lead.requirementSummary, lead.gtmName, sparcOwnerFor(lead)]
        .join(" ")
        .toLowerCase();
      return (!normalizedQuery || searchable.includes(normalizedQuery))
        && proposalInPeriod(lead, dashboardPeriod)
        && proposalMatchesPipeline(lead, dashboardPipeline)
        && (dashboardEvents.length === 0 || dashboardEvents.includes(lead.currentEvent ?? 1))
        && (!reviewedOnly || Boolean(lead.proposalId && reviews.has(lead.proposalId)))
        && (metricFilter !== "headcount" || (lead.dlvHeadCount ?? 0) > 0)
        && (metricFilter !== "dlv" || (lead.dlvCost ?? 0) > 0)
        && (statusFilter === "all" || lead.status === statusFilter)
        && (sparcFilter === "all" || sparcOwnerFor(lead) === sparcFilter)
        && (gtmFilter === "all" || (lead.gtmName || "Unassigned") === gtmFilter)
        && (regionFilter === "all" || (lead.proposalRegion || "Unassigned") === regionFilter)
        && (verticalFilter === "all" || (lead.vertical || "Unassigned") === verticalFilter);
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "updated_asc": return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case "name_asc": return (a.leadName || a.kytesId).localeCompare(b.leadName || b.kytesId);
        case "name_desc": return (b.leadName || b.kytesId).localeCompare(a.leadName || a.kytesId);
        case "client_asc": return (a.clientName || "").localeCompare(b.clientName || "");
        case "event_desc": return (b.currentEvent || 1) - (a.currentEvent || 1);
        default: return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });
  }, [dashboardEvents, dashboardPeriod, dashboardPipeline, gtmFilter, leads, metricFilter, query, regionFilter, reviewedOnly, reviews, sortBy, sparcFilter, statusFilter, verticalFilter]);

  const hasActiveFilters = hasDashboardFilters || Boolean(query.trim()) || [statusFilter, sparcFilter, gtmFilter, regionFilter, verticalFilter].some((value) => value !== "all") || sortBy !== "updated_desc";

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setSparcFilter("all");
    setGtmFilter("all");
    setRegionFilter("all");
    setVerticalFilter("all");
    setSortBy("updated_desc");
    if (hasDashboardFilters) router.replace("/leads");
  };

  const load = async () => {
    const all = await getLeads();
    const [proposals, reviewMap] = await Promise.all([getProposals(), getDeepReviewMap()]);
    setLeads(all);
    setLoading(false);
    setReviews(reviewMap);
    setProposalIterations(new Map(proposals.map((proposal) => [
      proposal.id,
      Math.max(0, ...proposal.workflowCycles.map((cycle) => cycle.iteration ?? 0)),
    ])));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await getLeads();
      if (!cancelled) {
        setLeads(all);
        setLoading(false);
      }
      const [reviewMap, proposals] = await Promise.all([getDeepReviewMap(), getProposals()]);
      if (!cancelled) {
        setReviews(reviewMap);
        setProposalIterations(new Map(proposals.map((proposal) => [
          proposal.id,
          Math.max(0, ...proposal.workflowCycles.map((cycle) => cycle.iteration ?? 0)),
        ])));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this lead?")) return;
    await deleteLead(id);
    await load();
  };

  const handleLoadSamples = async () => {
    setSeeding(true);
    try {
      await seedSampleLeads();
      await load();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">Proposal Master</h1>
          <p className="text-text-secondary">View and manage all ongoing SPARC proposals.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltersOpen((open) => !open)}
            className={cn("relative h-10 w-10 p-0", filtersOpen && "border-primary-300 bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300")}
            aria-label={filtersOpen ? "Hide filter and sort panel" : "Show filter and sort panel"}
            aria-expanded={filtersOpen}
            title="Filter and sort proposals"
          >
            <SlidersHorizontal size={17} />
            {hasActiveFilters && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary-600 ring-2 ring-surface" />}
          </Button>
          {can("create_lead") && (
            <>
            <Button variant="outline" onClick={handleLoadSamples} disabled={seeding}>
              {seeding ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <Database size={16} className="mr-2" />
              )}
              Load sample data
            </Button>
            <Button onClick={() => router.push("/leads/new")}>
              <Plus size={16} className="mr-2" /> New Proposal
            </Button>
            </>
          )}
        </div>
      </div>

      {!loading && leads.length > 0 && filtersOpen && (
        <Card className="overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                  <SlidersHorizontal size={17} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">Filter and sort proposals</p>
                  <p className="text-xs text-text-tertiary">Showing {filteredLeads.length} of {leads.length} proposals</p>
                </div>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="self-start text-text-secondary sm:self-auto">
                  <RotateCcw size={14} className="mr-1.5" /> Reset filters
                </Button>
              )}
            </div>

            {dashboardFilterLabels.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-primary-200 bg-primary-50/60 px-3 py-2 dark:border-primary-700 dark:bg-primary-500/10">
                <span className="text-xs font-semibold text-primary-700 dark:text-primary-300">From dashboard:</span>
                {dashboardFilterLabels.map((label) => (
                  <span key={label} className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary shadow-sm">
                    {label}
                  </span>
                ))}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="relative sm:col-span-2">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Search master</span>
                <Search size={15} className="pointer-events-none absolute bottom-3 left-3 text-text-muted" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Initiative, client, ID, GTM or SPARC owner…"
                  className="pl-9"
                />
              </label>

              <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter}>
                <option value="all">All statuses</option>
                {Object.entries(leadStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </FilterSelect>

              <FilterSelect label="SPARC owner" value={sparcFilter} onChange={setSparcFilter}>
                <option value="all">All SPARC owners</option>
                {filterOptions.sparcOwners.map((value) => <option key={value} value={value}>{value}</option>)}
              </FilterSelect>

              <FilterSelect label="GTM owner" value={gtmFilter} onChange={setGtmFilter}>
                <option value="all">All GTM owners</option>
                {filterOptions.gtmOwners.map((value) => <option key={value} value={value}>{value}</option>)}
              </FilterSelect>

              <FilterSelect label="Region" value={regionFilter} onChange={setRegionFilter}>
                <option value="all">All regions</option>
                {filterOptions.regions.map((value) => <option key={value} value={value}>{value}</option>)}
              </FilterSelect>

              <FilterSelect label="Vertical" value={verticalFilter} onChange={setVerticalFilter}>
                <option value="all">All verticals</option>
                {filterOptions.verticals.map((value) => <option key={value} value={value}>{value}</option>)}
              </FilterSelect>

              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary"><ArrowUpDown size={12} /> Sort by</span>
                <Select value={sortBy} onChange={(event) => setSortBy(event.target.value as LeadSort)}>
                  <option value="updated_desc">Recently updated</option>
                  <option value="updated_asc">Oldest updated</option>
                  <option value="name_asc">Initiative A–Z</option>
                  <option value="name_desc">Initiative Z–A</option>
                  <option value="client_asc">Client A–Z</option>
                  <option value="event_desc">Roadmap stage: highest</option>
                </Select>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-muted" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-text-muted">
              <FileText size={24} />
            </div>
            <p className="font-semibold text-text-primary">No leads yet</p>
            <p className="max-w-md text-sm text-text-secondary">
              Create your first lead to start tracking opportunities through the SPARC roadmap.
            </p>
            {can("create_lead") && (
              <Button onClick={() => router.push("/leads/new")}>
                <Plus size={16} className="mr-2" /> New Lead
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredLeads.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-14 text-center">
                <Search size={24} className="text-text-muted" />
                <p className="mt-3 font-semibold text-text-primary">No proposals match these filters</p>
                <p className="mt-1 text-sm text-text-secondary">Try changing a filter or clearing the current search.</p>
                <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4">
                  <RotateCcw size={14} className="mr-1.5" /> Reset filters
                </Button>
              </CardContent>
            </Card>
          ) : filteredLeads.map((lead) => (
            <Card
              key={lead.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => router.push(`/leads/${lead.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{lead.leadName || lead.kytesId}</CardTitle>
                    <Badge className={LEAD_STATUS_BADGE[lead.status]}>
                      {leadStatusLabels[lead.status]}
                    </Badge>
                    <IterationBadge lead={lead} iterations={proposalIterations} />
                    <ProposalScoreBadge lead={lead} reviews={reviews} />
                  </div>
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/leads/${lead.id}`)}
                      aria-label={`View lead ${lead.kytesId}`}
                    >
                      <Eye size={16} />
                    </Button>
                    {can("edit_lead") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/leads/${lead.id}`)}
                        aria-label={`Edit lead ${lead.kytesId}`}
                      >
                        <Pencil size={16} />
                      </Button>
                    )}
                    {can("delete_lead") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(lead.id)}
                        aria-label={`Delete lead ${lead.kytesId}`}
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">Kytes ID</dt>
                    <dd className="text-text-primary">{lead.kytesId || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">Lead Type</dt>
                    <dd className="text-text-primary">{lead.leadType || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">Vertical</dt>
                    <dd className="text-text-primary">{lead.vertical || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">GTM Owner</dt>
                    <dd className="text-text-primary">{lead.gtmName || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">SPARC Owner</dt>
                    <dd className="text-text-primary">{sparcOwnerFor(lead)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">Date</dt>
                    <dd className="text-text-primary">{lead.date ? formatDate(lead.date) : "—"}</dd>
                  </div>
                </dl>
                <LeadStageTrack lead={lead} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
