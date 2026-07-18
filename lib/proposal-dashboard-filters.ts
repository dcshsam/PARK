import type { Lead } from "./types";

export type ProposalPeriod = "all" | "ytd" | "month" | "week";
export type ProposalPipelineFilter = "all" | "active" | "converted" | "attention";
export type ProposalMetricFilter = "headcount" | "dlv";

export const PROPOSAL_PERIOD_OPTIONS: { value: ProposalPeriod; label: string }[] = [
  { value: "all", label: "All Proposals" },
  { value: "ytd", label: "YTD" },
  { value: "month", label: "This Month" },
  { value: "week", label: "This Week" },
];

export function parseProposalPeriod(value: string | null): ProposalPeriod {
  return value === "ytd" || value === "month" || value === "week" ? value : "all";
}

export function parseProposalPipelineFilter(value: string | null): ProposalPipelineFilter {
  return value === "active" || value === "converted" || value === "attention" ? value : "all";
}

export function proposalInPeriod(lead: Lead, period: ProposalPeriod, now = new Date()): boolean {
  if (period === "all") return true;
  const proposalDate = new Date(lead.date ?? lead.createdAt);
  if (Number.isNaN(proposalDate.getTime())) return false;

  let start: Date;
  if (period === "ytd") {
    start = new Date(now.getFullYear(), 0, 1);
  } else if (period === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  }
  start.setHours(0, 0, 0, 0);
  return proposalDate >= start && proposalDate <= now;
}

export function proposalMatchesPipeline(lead: Lead, filter: ProposalPipelineFilter): boolean {
  if (filter === "active") return lead.status !== "converted" && lead.status !== "dropped";
  if (filter === "converted") return lead.status === "converted";
  if (filter === "attention") return lead.status === "on_hold" || lead.status === "dropped";
  return true;
}

export function proposalMasterHref({
  period,
  pipeline = "all",
  event,
  events,
  reviewed,
  metric,
}: {
  period: ProposalPeriod;
  pipeline?: ProposalPipelineFilter;
  event?: number;
  events?: number[];
  reviewed?: boolean;
  metric?: ProposalMetricFilter;
}): string {
  const params = new URLSearchParams();
  if (period !== "all") params.set("period", period);
  if (pipeline !== "all") params.set("pipeline", pipeline);
  if (event) params.set("event", String(event));
  if (events?.length) params.set("events", events.join(","));
  if (reviewed) params.set("reviewed", "true");
  if (metric) params.set("metric", metric);
  const query = params.toString();
  return `/leads${query ? `?${query}` : ""}`;
}
