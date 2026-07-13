import { LEAD_EVENT_LABELS, LEAD_EVENT_SHORT } from "@/lib/lead-events";
import type { Lead } from "@/lib/types";

export type ProjectHealth = "On track" | "At risk" | "Needs attention";

export type ProjectLog = {
  date: string;
  title: string;
  detail: string;
  type: "milestone" | "decision" | "risk" | "update";
};

export type ProjectCard = {
  id: string;
  initiative: string;
  shortName: string;
  owner: string;
  sponsor: string;
  health: ProjectHealth;
  phase: string;
  summary: string;
  dlvCost: string;
  dlvHeadCount: string;
  progress: number;
  confidence: number;
  currentEvent: number;
  clientName: string;
  referenceId: string;
  startDate: string;
  completed: number;
  inProgress: number;
  blocked: number;
  roadmapDates: string[];
  roadmapDurations: string[];
  trend: { week: string; planned: number; actual: number }[];
  workstreams: { name: string; progress: number; status: ProjectHealth }[];
  achievements: string[];
  nextSteps: string[];
  risks: { title: string; mitigation: string; level: "High" | "Medium" | "Low" }[];
  decisions: { title: string; owner: string; due: string }[];
  logs: ProjectLog[];
};

function displayDate(value: Date | string | undefined) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not set"
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function displayEuro(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "Not set";
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

function eventProgress(currentEvent: number, start: number, end: number) {
  if (currentEvent < start) return 0;
  if (currentEvent === start) return 18;
  if (currentEvent > end) return 100;
  return Math.round(((currentEvent - start) / Math.max(1, end - start + 1)) * 100);
}

/** Build the weekly presentation model directly from a Proposal Master record. */
export function buildProjectCardFromLead(lead: Lead): ProjectCard {
  const currentEvent = Math.min(Math.max(lead.currentEvent || 1, 1), 8);
  const isClosed = lead.status === "converted" || lead.status === "dropped";
  const completedEvents = isClosed ? 8 : currentEvent - 1;
  const owner = lead.sparcOwner || lead.sparcMentor || "Unassigned";
  const isPaused = lead.status === "on_hold" || lead.status === "dropped";
  const health: ProjectHealth = isPaused
    ? "Needs attention"
    : lead.hgStatus.toLowerCase() === "cold" || owner === "Unassigned"
      ? "At risk"
      : "On track";
  const progress = Math.round((completedEvents / 8) * 100);
  const confidence = health === "On track" ? Math.min(94, 74 + currentEvent * 2) : health === "At risk" ? 64 : 42;
  const eventData = lead.eventData ?? {};

  const eventTimestamps = Array.from({ length: 8 }, (_, index) => {
    const data = eventData[`event${index + 1}`] as Record<string, unknown> | undefined;
    const value = data?.completedAt ?? data?.endDate ?? data?.startDate ?? (index === 0 ? lead.date || lead.createdAt : undefined);
    if (!value) return null;
    const timestamp = new Date(value as Date | string).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  });
  const roadmapDates = eventTimestamps.map((timestamp, index) => {
    if (timestamp) return displayDate(new Date(timestamp)).replace(/ 202\d$/, "");
    if (index < completedEvents) return "Not recorded";
    if (!isClosed && index === currentEvent - 1) return "In progress";
    return "Pending";
  });
  const roadmapDurations = eventTimestamps.slice(0, -1).map((timestamp, index) => {
    const nextTimestamp = eventTimestamps[index + 1];
    if (!timestamp || !nextTimestamp) return "TBD";
    const days = Math.max(0, Math.ceil((nextTimestamp - timestamp) / 86_400_000));
    return days === 1 ? "1 day" : `${days} days`;
  });

  const eventLogs: ProjectLog[] = Array.from({ length: 8 })
    .flatMap((_, index): Array<ProjectLog & { timestamp: number }> => {
      const number = index + 1;
      const data = eventData[`event${number}`] as Record<string, unknown> | undefined;
      if (!data?.completedAt) return [];
      return [{
        date: displayDate(data.completedAt as Date | string).replace(/ 202\d$/, ""),
        title: `${LEAD_EVENT_SHORT[index]} completed`,
        detail: number === 7 && typeof data.meetingFeedback === "string"
          ? data.meetingFeedback
          : number === 8 && typeof data.wentWell === "string"
            ? data.wentWell
            : `${lead.leadName} advanced through ${LEAD_EVENT_LABELS[index]}.`,
        type: number >= 7 ? "decision" : "milestone",
        timestamp: new Date(data.completedAt as Date | string).getTime(),
      }];
    })
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((log) => ({ date: log.date, title: log.title, detail: log.detail, type: log.type }));

  const currentLog: ProjectLog = {
    date: displayDate(lead.updatedAt).replace(/ 202\d$/, ""),
    title: `${LEAD_EVENT_SHORT[currentEvent - 1]} in focus`,
    detail: `Current proposal status is ${lead.status.replaceAll("_", " ")} with ${owner} accountable for the next move.`,
    type: isPaused ? "risk" : "update",
  };
  const completedLabels = LEAD_EVENT_LABELS.slice(0, completedEvents).slice(-3).reverse();
  const achievements = completedLabels.length
    ? completedLabels.map((label) => `${label} completed and recorded in Proposal Master`)
    : ["Initiative captured in Proposal Master and ownership review started"];

  const risks = isPaused
    ? [{
        title: lead.status === "dropped" ? "Proposal marked dropped" : "Proposal currently on hold",
        mitigation: "Confirm the reactivation or closure decision and record the accountable owner.",
        level: "High" as const,
      }]
    : owner === "Unassigned"
      ? [{
          title: "SPARC ownership is unassigned",
          mitigation: "Assign an owner before the next proposal event to protect momentum.",
          level: "High" as const,
        }]
      : [{
          title: health === "At risk" ? "Low pursuit heat signal" : "No critical blocker recorded",
          mitigation: health === "At risk" ? "Revalidate customer intent and agree a dated next action." : "Continue monitoring in the weekly cadence.",
          level: health === "At risk" ? "Medium" as const : "Low" as const,
        }];

  return {
    id: lead.id,
    initiative: lead.leadName || lead.kytesId,
    shortName: lead.leadName || lead.kytesId,
    owner,
    sponsor: lead.gtmName || "Not assigned",
    health,
    phase: LEAD_EVENT_SHORT[currentEvent - 1],
    summary: lead.requirementSummary || `Proposal initiative for ${lead.clientName || "the customer"}.`,
    dlvCost: displayEuro(lead.dlvCost),
    dlvHeadCount: lead.dlvHeadCount === undefined
      ? "Not set"
      : new Intl.NumberFormat("en-GB").format(lead.dlvHeadCount),
    progress,
    confidence,
    currentEvent,
    clientName: lead.clientName || "Not set",
    referenceId: lead.kytesId,
    startDate: displayDate(lead.date || lead.createdAt),
    completed: completedEvents,
    inProgress: isPaused ? 0 : 1,
    blocked: isPaused || owner === "Unassigned" ? 1 : 0,
    roadmapDates,
    roadmapDurations,
    trend: Array.from({ length: 6 }, (_, index) => {
      const actual = Math.max(0, progress - (5 - index) * Math.max(5, Math.round(progress / 10)));
      return { week: `W${index + 1}`, planned: Math.min(100, actual + (health === "On track" ? 3 : 8)), actual };
    }),
    workstreams: [
      { name: "Qualification & diligence", progress: eventProgress(currentEvent, 1, 3), status: currentEvent >= 3 ? "On track" : health },
      { name: "Proposal & reviews", progress: eventProgress(currentEvent, 4, 6), status: currentEvent >= 6 ? "On track" : health },
      { name: "Customer & closure", progress: eventProgress(currentEvent, 7, 8), status: currentEvent >= 8 && lead.status === "converted" ? "On track" : health },
    ],
    achievements,
    nextSteps: [
      `Complete ${LEAD_EVENT_LABELS[currentEvent - 1]}`,
      currentEvent < 8 ? `Prepare for ${LEAD_EVENT_LABELS[currentEvent]}` : "Close the proposal outcome and lessons learned",
      owner === "Unassigned" ? "Assign a SPARC owner" : `Confirm weekly actions with ${owner}`,
    ],
    risks,
    decisions: [{
      title: currentEvent < 8 ? `Approve progression to ${LEAD_EVENT_LABELS[currentEvent]}` : "Confirm final proposal outcome",
      owner,
      due: "Next call",
    }],
    logs: [currentLog, ...eventLogs].slice(0, 4),
  };
}
