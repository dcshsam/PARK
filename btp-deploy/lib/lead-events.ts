import type { LeadStatus } from "./types";

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

/**
 * lead.status is only written at Event 1 (user-picked, defaults to "new") and at
 * Event 8 (retro outcome) — Events 2-7 never touch it, so a lead halfway through
 * the roadmap still reads "New". Derive the status from the event it's actually
 * on, unless it was explicitly parked or closed out.
 */
export function deriveLeadStatus(status: LeadStatus, currentEvent: number): LeadStatus {
  if (status === "converted" || status === "dropped" || status === "on_hold") return status;
  if (currentEvent >= 5) return "proposal";
  if (currentEvent >= 3) return "qualified";
  return "new";
}

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: "#3b82f6",
  qualified: "#14b8a6",
  proposal: "#8b5cf6",
  converted: "#22c55e",
  on_hold: "#f59e0b",
  dropped: "#ef4444",
};

export const LEAD_STATUS_BADGE: Record<LeadStatus, string> = {
  new: "bg-status-info-bg text-status-info-text",
  qualified: "bg-status-success-bg text-status-success-text",
  proposal: "bg-primary-100 text-primary-700",
  converted: "bg-status-success-bg text-status-success-text",
  on_hold: "bg-status-warning-bg text-status-warning-text",
  dropped: "bg-status-danger-bg text-status-danger-text",
};
