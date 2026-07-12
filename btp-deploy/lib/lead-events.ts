import type { Lead, LeadStatus } from "./types";

// Single source of truth for the Lead Master 8-event roadmap, shared by the
// lead form, dashboard and analytics.

export const LEAD_EVENT_LABELS = [
  "Lead Initiation",
  "Pre-Qualification",
  "Due Diligence",
  "Proposal Creation",
  "Proposal Review - SPARC",
  "Proposal Review - Delivery",
  "Customer Pitch & Feedback",
  "Proposal Retro & Wrap",
] as const;

export const LEAD_EVENT_SHORT = [
  "Initiation",
  "Pre-Qual",
  "Due Diligence",
  "Creation",
  "SPARC Review",
  "Delivery Review",
  "Customer Pitch",
  "Retro & Wrap",
] as const;

type PausePeriod = { startedAt: string | Date; endedAt?: string | Date };

/** True while any event has a pause that was started and never ended. */
export function hasOpenPause(eventData: Record<string, unknown> | undefined): boolean {
  if (!eventData) return false;
  return LEAD_EVENT_LABELS.some((_, i) => {
    const event = eventData[`event${i + 1}`] as { pausePeriods?: PausePeriod[] } | undefined;
    return (event?.pausePeriods ?? []).some((pause) => !pause.endedAt);
  });
}

/**
 * lead.status is only written at Event 1 (user-picked, defaults to "new") and at
 * Event 8 (retro outcome) — Events 2-7 never touch it, so a lead halfway through
 * the roadmap still reads "New". Derive it from the event actually reached, and
 * from the lead's own pause periods, so the badge can't drift from reality.
 *
 * Won / lost is a real decision recorded at the retro, so an explicit
 * converted / dropped always wins. Everything else is derived.
 */
export function deriveLeadStatus(
  lead: Pick<Lead, "status" | "currentEvent" | "eventData">
): LeadStatus {
  if (lead.status === "converted" || lead.status === "dropped") return lead.status;
  if (hasOpenPause(lead.eventData)) return "on_hold";
  const event = lead.currentEvent ?? 1;
  if (event >= 5) return "proposal";
  if (event >= 3) return "qualified";
  if (event >= 2) return "in_progress";
  return "new";
}

/** Display order for status filters, legends and charts. */
export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "new",
  "in_progress",
  "qualified",
  "proposal",
  "converted",
  "on_hold",
  "dropped",
];

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: "#3b82f6",
  in_progress: "#6366f1",
  qualified: "#14b8a6",
  proposal: "#8b5cf6",
  converted: "#22c55e",
  on_hold: "#f59e0b",
  dropped: "#ef4444",
};

export const LEAD_STATUS_BADGE: Record<LeadStatus, string> = {
  new: "bg-status-info-bg text-status-info-text",
  in_progress: "bg-primary-100 text-primary-700",
  qualified: "bg-status-success-bg text-status-success-text",
  proposal: "bg-primary-100 text-primary-700",
  converted: "bg-status-success-bg text-status-success-text",
  on_hold: "bg-status-warning-bg text-status-warning-text",
  dropped: "bg-status-danger-bg text-status-danger-text",
};
