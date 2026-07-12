"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addLead, updateLead, getProposal } from "@/lib/db";
import { applyWorkflowAction } from "@/lib/workflow-engine";
import { getCycleType } from "@/lib/workflow-config";
import { useProfile } from "@/components/profile-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogDescription as DialogDesc, DialogTitle } from "@/components/ui/dialog";
import { StageHeroCard } from "@/components/stage-hero-card";
import { LEAD_EVENT_LABELS } from "@/lib/lead-events";
import { FileUpload } from "@/components/file-upload";
import { WorkflowRoadmap } from "@/components/workflow-roadmap";
import { ProposalForm } from "@/components/proposal-form";
import {
  getLeadStatuses,
  getLeadTypes,
  getLeadVerticals,
  getSparcMentors,
  getSparcOwners,
  getGtmHeads,
  getDeliveryOwners,
  getDeliveryHeads,
  getGtmOwners,
  getProposalReviewers,
  getProposalRegions,
} from "@/lib/workspace-config";
import { getTeamMembers, combineAssignableNames } from "@/lib/team-members";
import type {
  DocumentCategory,
  Lead,
  LeadDocumentCategory,
  LeadStatus,
  Proposal,
  ReviewCycleType,
  UploadedFile,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { generateProposalDeck, downloadBlob } from "@/lib/proposal-ai";
import { invokeLlm } from "@/lib/deep-review/llm";
import {
  sampleLeadBasics,
  sampleLeadDocuments,
  sampleLeadPreQual,
  buildSampleDueDiligenceItems,
} from "@/lib/sample-lead";
import { Loader2, Save, X, Check, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, ExternalLink, Sparkles } from "lucide-react";

function getEventTimestamp(lead: Lead | undefined, eventNumber: number): Date | undefined {
  if (!lead?.eventData) return undefined;
  const eventData = lead.eventData[`event${eventNumber}`] as Record<string, unknown> | undefined;
  if (!eventData?.completedAt) return undefined;
  return new Date(eventData.completedAt as string | number | Date);
}

function formatDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

type EventPausePeriod = { startedAt: string | Date; endedAt?: string | Date; reason: string };

function getEventPausePeriods(lead: Lead | undefined, eventNumber: number): EventPausePeriod[] {
  const data = lead?.eventData?.[`event${eventNumber}`] as { pausePeriods?: EventPausePeriod[] } | undefined;
  return data?.pausePeriods ?? [];
}

function getActivePausedEvent(lead: Lead | undefined): number | undefined {
  if (!lead?.eventData) return undefined;
  for (let eventNumber = 1; eventNumber <= eventLabels.length; eventNumber++) {
    if (getEventPausePeriods(lead, eventNumber).some((pause) => !pause.endedAt)) return eventNumber;
  }
  return undefined;
}

function effectiveEventDurationMs(start: Date, end: Date, pauses: EventPausePeriod[], now: Date): number {
  const endMs = end.getTime();
  const pausedMs = pauses.reduce((total, pause) => {
    const pauseStart = new Date(pause.startedAt).getTime();
    const pauseEnd = Math.min(pause.endedAt ? new Date(pause.endedAt).getTime() : now.getTime(), endMs);
    return total + Math.max(0, pauseEnd - pauseStart);
  }, 0);
  return Math.max(0, endMs - start.getTime() - pausedMs);
}

function formatDurationMs(diffMs: number): string {
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function totalPauseDurationMs(pauses: EventPausePeriod[], now: Date): number {
  return pauses.reduce((total, pause) => {
    const start = new Date(pause.startedAt).getTime();
    const end = pause.endedAt ? new Date(pause.endedAt).getTime() : now.getTime();
    return total + Math.max(0, end - start);
  }, 0);
}

function getSegmentDurations(lead: Lead | undefined): (string | null)[] {
  const labelsCount = eventLabels.length;
  const durations: (string | null)[] = [];
  for (let i = 0; i < labelsCount - 1; i++) {
    const start = getEventTimestamp(lead, i + 1);
    const end = getEventTimestamp(lead, i + 2);
    if (start && end) {
      durations.push(formatDurationMs(effectiveEventDurationMs(start, end, getEventPausePeriods(lead, i + 1), end)));
    } else if (start && !end && lead?.currentEvent === i + 2) {
      durations.push("In progress");
    } else {
      durations.push(null);
    }
  }
  return durations;
}

const leadDocCategories = ["lead_mail", "lead_mom", "lead_discussion", "lead_customer_doc"] as const;

const categoryLabelsShort: Record<LeadDocumentCategory, string> = {
  lead_mail: "Mail",
  lead_mom: "Minutes of Meeting",
  lead_discussion: "Discussion Notes",
  lead_pre_qual_form: "Pre-Qualification Form",
  lead_due_diligence: "Due Diligence Document",
  lead_final_deck: "Final Pitch Deck",
  lead_proposal: "Proposal Document",
  lead_customer_doc: "Customer Document (RFP / Requirement Summary)",
};

const receivedViaOptions = [
  { value: "email", label: "Email / Mail" },
  { value: "meeting", label: "Meeting" },
  { value: "other", label: "Other" },
];

const eventLabels = LEAD_EVENT_LABELS;

/** Events 5-7 all embed the same existing Proposal review workflow (proposal/delivery/customer cycles). */
const REVIEW_EVENT_START = 5;

/** Which cycle card each review event should show — Event 5 = Proposal, 6 = Delivery. */
const REVIEW_EVENT_CYCLE: Record<number, ReviewCycleType> = {
  5: "proposal",
  6: "delivery",
};

/** Event 7 — customer pitch & feedback, captured as its own lead-level form. */
const PITCH_EVENT = 7;

/** Event 8 — lead-level retrospective closing out the whole cycle. */
const RETRO_EVENT = 8;

type PitchMode = "onsite" | "remote" | "hybrid";
type PitchResponse = "awaiting" | "accepted" | "revision_requested" | "declined";

const pitchModeOptions: { value: PitchMode; label: string }[] = [
  { value: "onsite", label: "Onsite" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
];

const pitchResponseOptions: { value: PitchResponse; label: string }[] = [
  { value: "awaiting", label: "Awaiting Response" },
  { value: "accepted", label: "Accepted — moving forward" },
  { value: "revision_requested", label: "Revision Requested" },
  { value: "declined", label: "Declined" },
];

type RetroOutcome = "won" | "lost" | "on_hold";

const retroOutcomeOptions: { value: RetroOutcome; label: string; leadStatus: LeadStatus }[] = [
  { value: "won", label: "Won — customer accepted", leadStatus: "converted" },
  { value: "lost", label: "Lost — customer declined", leadStatus: "dropped" },
  { value: "on_hold", label: "On Hold — decision pending", leadStatus: "on_hold" },
];

const preQualOptions = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const preQualFormCategory = "lead_pre_qual_form" as const;
const dueDiligenceDocCategory = "lead_due_diligence" as const;

type DueDiligenceStatus = "in_progress" | "paused" | "completed" | "blocked";
type ProposalStatus = DueDiligenceStatus;

const dueDiligenceStatusLabels: Record<DueDiligenceStatus, string> = {
  in_progress: "In Progress",
  paused: "Paused",
  completed: "Completed",
  blocked: "Blocked",
};

const dueDiligenceStatusBadge: Record<DueDiligenceStatus, string> = {
  in_progress: "bg-status-info-bg text-status-info-text",
  paused: "bg-status-warning-bg text-status-warning-text",
  completed: "bg-status-success-bg text-status-success-text",
  blocked: "bg-status-danger-bg text-status-danger-text",
};

interface DueDiligenceItem {
  id: string;
  type: "meeting" | "analysis";
  title: string;
  startDate: string;
  endDate: string;
  status: DueDiligenceStatus;
  pauseReason: string;
  conductedBy: string;
  summary: string;
  attachments: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[];
}

interface RetroMeeting {
  id: string;
  title: string;
  date: string;
  conductedBy: string;
  summary: string;
}

type LeadFormProps = {
  lead?: Lead;
};

type LeadEventActivity = {
  id: string;
  action: "created" | "updated" | "paused" | "resumed";
  timestamp: string | Date;
  actor: string;
  changes?: string[];
};

const event1ActivityLabels: Array<[keyof Lead, string]> = [
  ["leadName", "Lead name"],
  ["clientName", "Customer / client"],
  ["kytesId", "Kytes ID"],
  ["receivedVia", "Received via"],
  ["hgStatus", "HG status"],
  ["date", "Date"],
  ["gtmName", "GTM owner"],
  ["gtmHead", "GTM head"],
  ["deliveryName", "Delivery name"],
  ["deliveryHead", "Delivery head"],
  ["sparcOwner", "SPARC owner"],
  ["vertical", "VD vertical"],
  ["leadType", "Lead type"],
  ["sparcMentor", "SPARC mentor"],
  ["proposalReviewer", "Proposal reviewer"],
  ["proposalRegion", "Proposal region"],
  ["requirementSummary", "Requirement summary"],
  ["status", "Status"],
];

function event1ChangeLabels(lead: Lead, payload: Record<string, unknown>): string[] {
  const changed = event1ActivityLabels
    .filter(([key]) => {
      const before = key === "date" && lead.date ? new Date(lead.date).toISOString().slice(0, 10) : lead[key];
      const after = key === "date" && payload[key] ? new Date(payload[key] as string | Date).toISOString().slice(0, 10) : payload[key];
      return JSON.stringify(before ?? "") !== JSON.stringify(after ?? "");
    })
    .map(([, label]) => label);

  const oldDocuments = JSON.stringify((lead.documents ?? []).map((doc) => `${doc.category}:${doc.name}:${doc.size}`));
  const newDocuments = JSON.stringify(((payload.documents as Lead["documents"]) ?? []).map((doc) => `${doc.category}:${doc.name}:${doc.size}`));
  if (oldDocuments !== newDocuments) changed.push("Attached documents");
  return changed;
}

function appendEventActivity(
  eventData: Record<string, unknown>,
  eventKey: string,
  actor: string,
  changes: string[],
): Record<string, unknown> {
  const current = (eventData[eventKey] ?? {}) as Record<string, unknown>;
  const previous = (current.activityLog ?? []) as LeadEventActivity[];
  const now = new Date();
  return {
    ...eventData,
    [eventKey]: {
      ...current,
      activityLog: [
        ...previous,
        {
          id: crypto.randomUUID(),
          action: previous.length ? "updated" : "created",
          timestamp: now,
          actor,
          changes,
        },
      ],
    },
  };
}

function EventActivityLog({ eventNumber, activityLog, activityTitle }: { eventNumber: number; activityLog?: LeadEventActivity[]; activityTitle?: string }) {
  const title = activityTitle ?? `Event ${eventNumber}`;
  return (
    <div className="border-t border-border pt-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{title} activity</h3>
          <p className="text-xs text-text-tertiary">Creation and changes saved for this event.</p>
        </div>
        <span className="rounded-full bg-surface-muted px-2 py-1 text-[11px] text-text-secondary">
          {activityLog?.length ?? 0} {activityLog?.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      {activityLog?.length ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="divide-y divide-border">
            {[...activityLog].reverse().map((activity) => (
              <div key={activity.id} className="flex flex-col gap-1 bg-surface px-4 py-3 text-sm sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-text-primary">
                    {activity.action === "created"
                      ? `${title} created`
                      : activity.action === "paused"
                        ? `${title} paused`
                        : activity.action === "resumed"
                          ? `${title} resumed`
                          : `${title} updated`}
                  </p>
                  {activity.changes?.length ? <p className="mt-0.5 text-xs text-text-secondary">Changed: {activity.changes.join(", ")}</p> : null}
                  <p className="mt-1 text-xs text-text-tertiary">By {activity.actor}</p>
                </div>
                <time className="shrink-0 text-xs text-text-tertiary" dateTime={new Date(activity.timestamp).toISOString()}>
                  {new Date(activity.timestamp).toLocaleString()}
                </time>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-text-tertiary">Activity will appear here after this event is saved.</p>
      )}
    </div>
  );
}

/**
 * One-shot prefill left by the Jarvis assistant's create_lead_draft tool.
 * Read (and cleared) only when creating a new lead.
 */
function consumeJarvisLeadDraft(): { leadName?: string; clientName?: string; requirementSummary?: string } {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem("jarvis:lead-draft");
    if (!raw) return {};
    window.sessionStorage.removeItem("jarvis:lead-draft");
    return JSON.parse(raw) as { leadName?: string; clientName?: string; requirementSummary?: string };
  } catch {
    return {};
  }
}

export function LeadForm({ lead }: LeadFormProps) {
  const router = useRouter();
  const { currentProfile } = useProfile();
  const isCreate = !lead;

  const pausedEvent = getActivePausedEvent(lead);
  const initialStep = pausedEvent ?? lead?.currentEvent ?? 1;
  const [step, setStep] = useState(initialStep);
  const [submitting, setSubmitting] = useState(false);
  const [clockNow, setClockNow] = useState(() => new Date());
  const [timingOverrides, setTimingOverrides] = useState<Record<number, EventPausePeriod[]>>({});
  const [activityOverrides, setActivityOverrides] = useState<Record<number, LeadEventActivity[]>>({});
  const [eventDataOverrides, setEventDataOverrides] = useState<Record<number, Record<string, unknown>>>({});
  const [draftItem, setDraftItem] = useState<DueDiligenceItem | null>(null);
  const [pauseTargetId, setPauseTargetId] = useState<string | null>(null);
  const [pauseReasonDraft, setPauseReasonDraft] = useState("");

  // Event 4 — AI-generated proposal deck (PPT) built from Events 1-3.
  const [generatingPpt, setGeneratingPpt] = useState(false);
  const [pptError, setPptError] = useState<string | null>(null);
  const [updatingSummary, setUpdatingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!lead || !pausedEvent || lead.currentEvent === pausedEvent) return;
    updateLead(lead.id, { currentEvent: pausedEvent });
  }, [lead, pausedEvent]);

  const pausePeriodsForEvent = (eventNumber: number): EventPausePeriod[] =>
    timingOverrides[eventNumber] ??
    ((eventDataOverrides[eventNumber]?.pausePeriods as EventPausePeriod[] | undefined) ?? getEventPausePeriods(lead, eventNumber));

  const eventTimestampForView = (eventNumber: number): Date | undefined => {
    const data = eventDataOverrides[eventNumber] ?? lead?.eventData?.[`event${eventNumber}`];
    const completedAt = (data as { completedAt?: string | number | Date } | undefined)?.completedAt;
    return completedAt ? new Date(completedAt) : undefined;
  };

  const syncSavedEventData = (savedLead: Lead, eventNumber: number) => {
    const savedEvent = savedLead.eventData?.[`event${eventNumber}`] as Record<string, unknown> | undefined;
    if (savedEvent) setEventDataOverrides((prev) => ({ ...prev, [eventNumber]: savedEvent }));
  };

  const setEventPaused = async (eventNumber: number, reason?: string) => {
    if (!lead) return;
    const existing = pausePeriodsForEvent(eventNumber);
    const active = existing.find((pause) => !pause.endedAt);
    const now = new Date();
    const pausePeriods = reason
      ? [...existing, { startedAt: now, reason }]
      : existing.map((pause) => (pause === active ? { ...pause, endedAt: now } : pause));
    const existingEvent = (lead.eventData?.[`event${eventNumber}`] ?? {}) as Record<string, unknown>;
    const existingActivity = (existingEvent.activityLog ?? []) as LeadEventActivity[];
    const activityLog = [
      ...existingActivity,
      {
        id: crypto.randomUUID(),
        action: reason ? "paused" as const : "resumed" as const,
        timestamp: now,
        actor: currentProfile?.name ?? "System",
        changes: reason ? [`Pause reason: ${reason}`] : ["Timing resumed"],
      },
    ];
    setTimingOverrides((prev) => ({ ...prev, [eventNumber]: pausePeriods }));
    setActivityOverrides((prev) => ({ ...prev, [eventNumber]: activityLog }));
    await updateLead(lead.id, {
      eventData: {
        ...(lead.eventData ?? {}),
        [`event${eventNumber}`]: {
          ...existingEvent,
          pausePeriods,
          activityLog,
        },
      },
    });
  };

  const mergeEventTiming = (eventData: Record<string, unknown>, eventNumber: number): Record<string, unknown> => ({
    ...eventData,
    [`event${eventNumber}`]: {
      ...((eventData[`event${eventNumber}`] ?? {}) as Record<string, unknown>),
      pausePeriods: pausePeriodsForEvent(eventNumber),
      ...(activityOverrides[eventNumber] ? { activityLog: activityOverrides[eventNumber] } : {}),
    },
  });

  // Event 5 — Proposal Review (SPARC), mapped to the existing Proposal review workflow.
  const [linkedProposal, setLinkedProposal] = useState<Proposal | null>(null);
  const [loadingProposal, setLoadingProposal] = useState(false);

  useEffect(() => {
    if (!lead?.proposalId) return;
    Promise.resolve().then(() => setLoadingProposal(true));
    getProposal(lead.proposalId)
      .then((p) => setLinkedProposal(p ?? null))
      .finally(() => setLoadingProposal(false));
  }, [lead?.proposalId]);

  const event2Data = (lead?.eventData?.event2 ?? {}) as Record<string, string> & { activityLog?: LeadEventActivity[] };
  const event1Data = (lead?.eventData?.event1 ?? {}) as { activityLog?: LeadEventActivity[]; completedAt?: Date };
  const event3Data = (lead?.eventData?.event3 ?? {}) as { items?: DueDiligenceItem[]; activityLog?: LeadEventActivity[] };
  const event4Data = (lead?.eventData?.event4 ?? {}) as {
    startDate?: string;
    endDate?: string;
    status?: ProposalStatus;
    pauseReason?: string;
    attachments?: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[];
    activityLog?: LeadEventActivity[];
  };
  const event7Data = (lead?.eventData?.event7 ?? {}) as {
    startDate?: string;
    endDate?: string;
    mode?: PitchMode;
    presentedBy?: string;
    attendees?: string;
    deckAttachments?: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[];
    meetingFeedback?: string;
    response?: PitchResponse;
    responseNotes?: string;
    nextSteps?: string;
    followUpDate?: string;
    completedAt?: Date;
    activityLog?: LeadEventActivity[];
  };
  const event8Data = (lead?.eventData?.event8 ?? {}) as {
    outcome?: RetroOutcome;
    wentWell?: string;
    improve?: string;
    learnings?: string;
    meetings?: RetroMeeting[];
    completedAt?: Date;
    activityLog?: LeadEventActivity[];
  };

  const [form, setForm] = useState({
    // Event 1
    leadName: lead?.leadName ?? "",
    receivedVia: lead?.receivedVia ?? "",
    hgStatus: lead?.hgStatus ?? "",
    date: lead?.date ? new Date(lead.date).toISOString().split("T")[0] : "",
    gtmName: lead?.gtmName ?? currentProfile?.name ?? "",
    gtmHead: lead?.gtmHead ?? "",
    deliveryName: lead?.deliveryName ?? "",
    deliveryHead: lead?.deliveryHead ?? "",
    sparcOwner: lead?.sparcOwner ?? "",
    vertical: lead?.vertical ?? "",
    leadType: lead?.leadType ?? "",
    kytesId: lead?.kytesId ?? "",
    requirementSummary: lead?.requirementSummary ?? "",
    clientName: lead?.clientName ?? "",
    sparcMentor: lead?.sparcMentor ?? "",
    proposalReviewer: lead?.proposalReviewer ?? "",
    proposalRegion: lead?.proposalRegion ?? "",
    status: lead?.status ?? "new",
    currentEvent: pausedEvent ?? lead?.currentEvent ?? 1,
    documents: {
      lead_mail: (lead?.documents ?? []).filter((d) => d.category === "lead_mail") as Omit<
        UploadedFile,
        "id" | "proposalId" | "uploadedAt"
      >[],
      lead_mom: (lead?.documents ?? []).filter((d) => d.category === "lead_mom") as Omit<
        UploadedFile,
        "id" | "proposalId" | "uploadedAt"
      >[],
      lead_discussion: (lead?.documents ?? []).filter((d) => d.category === "lead_discussion") as Omit<
        UploadedFile,
        "id" | "proposalId" | "uploadedAt"
      >[],
      lead_customer_doc: (lead?.documents ?? []).filter((d) => d.category === "lead_customer_doc") as Omit<
        UploadedFile,
        "id" | "proposalId" | "uploadedAt"
      >[],
      lead_pre_qual_form: (lead?.documents ?? []).filter((d) => d.category === "lead_pre_qual_form") as Omit<
        UploadedFile,
        "id" | "proposalId" | "uploadedAt"
      >[],
    },
    // Event 2
    preQualified: event2Data.preQualified ?? "",
    preQualComments: event2Data.comments ?? "",
    drbApproved: event2Data.drbApproved ?? "",
    drbApprovedDate: event2Data.drbApprovedDate ?? "",
    // Event 3
    dueDiligenceItems: (event3Data.items ?? []).map((item) => ({
      ...(item as DueDiligenceItem),
      startDate: item.startDate || (item as { date?: string }).date || "",
      status: (item.status as DueDiligenceStatus) || "in_progress",
      pauseReason: item.pauseReason || "",
    })),
    // Event 4
    proposalStartDate: event4Data.startDate || "",
    proposalEndDate: event4Data.endDate || "",
    proposalStatus: (event4Data.status as ProposalStatus) || "in_progress",
    proposalPauseReason: event4Data.pauseReason || "",
    proposalAttachments: (event4Data.attachments ?? []) as Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[],
    // Event 7 — Customer Pitch & Feedback
    pitchStartDate: event7Data.startDate ?? "",
    pitchEndDate: event7Data.endDate ?? "",
    pitchMode: (event7Data.mode ?? "") as PitchMode | "",
    pitchPresentedBy: event7Data.presentedBy ?? "",
    pitchAttendees: event7Data.attendees ?? "",
    pitchDeck: (event7Data.deckAttachments ?? []) as Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[],
    pitchMeetingFeedback: event7Data.meetingFeedback ?? "",
    pitchResponse: (event7Data.response ?? "") as PitchResponse | "",
    pitchResponseNotes: event7Data.responseNotes ?? "",
    pitchNextSteps: event7Data.nextSteps ?? "",
    pitchFollowUpDate: event7Data.followUpDate ?? "",
    // Event 8 — Proposal Retro & Wrap
    retroOutcome: (event8Data.outcome ?? "") as RetroOutcome | "",
    retroWentWell: event8Data.wentWell ?? "",
    retroImprove: event8Data.improve ?? "",
    retroLearnings: event8Data.learnings ?? "",
    retroMeetings: event8Data.meetings ?? [],
    retroMeetingTitle: "",
    retroMeetingDate: "",
    retroMeetingConductedBy: "",
    retroMeetingSummary: "",
  });

  // Applied post-mount (not in the initializer) to avoid a hydration mismatch.
  useEffect(() => {
    if (!isCreate) return;
    Promise.resolve().then(() => {
      const draft = consumeJarvisLeadDraft();
      if (!draft.leadName && !draft.clientName && !draft.requirementSummary) return;
      setForm((f) => ({
        ...f,
        leadName: draft.leadName || f.leadName,
        clientName: draft.clientName || f.clientName,
        requirementSummary: draft.requirementSummary || f.requirementSummary,
      }));
    });
  }, [isCreate]);

  const statuses = useMemo(() => getLeadStatuses(), []);
  const verticals = useMemo(() => getLeadVerticals(), []);
  const types = useMemo(() => getLeadTypes(), []);
  const proposalRegions = useMemo(() => getProposalRegions(), []);
  const sparcMentors = useMemo(() => {
    const teamMembers = getTeamMembers();
    return combineAssignableNames(getSparcMentors(), "sparc_mentor", teamMembers);
  }, []);
  const sparcOwners = useMemo(() => {
    const teamMembers = getTeamMembers();
    return combineAssignableNames(getSparcOwners(), "sparc_owner", teamMembers);
  }, []);
  const proposalReviewers = useMemo(() => {
    const teamMembers = getTeamMembers();
    return combineAssignableNames(getProposalReviewers(), "proposal_reviewer", teamMembers);
  }, []);
  const gtmOwners = useMemo(() => {
    const teamMembers = getTeamMembers();
    const combined = combineAssignableNames(getGtmOwners(), "gtm_owner", teamMembers);
    // Keep a previously saved name selectable even if it's no longer in the config.
    if (form.gtmName && !combined.some((o) => o.name === form.gtmName)) {
      return [{ name: form.gtmName, team: undefined }, ...combined];
    }
    return combined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const gtmHeads = useMemo(() => {
    const teamMembers = getTeamMembers();
    return combineAssignableNames(getGtmHeads(), "gtm_head", teamMembers);
  }, []);
  const deliveryOwners = useMemo(() => {
    const teamMembers = getTeamMembers();
    return combineAssignableNames(getDeliveryOwners(), "proposal_owner", teamMembers);
  }, []);
  const deliveryHeads = useMemo(() => {
    const teamMembers = getTeamMembers();
    return combineAssignableNames(getDeliveryHeads(), "proposal_owner", teamMembers);
  }, []);

  const updateDoc = (category: LeadDocumentCategory, files: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[]) => {
    setForm((prev) => ({ ...prev, documents: { ...prev.documents, [category]: files } }));
  };

  const addRetroMeeting = () => {
    if (!form.retroMeetingTitle.trim() || !form.retroMeetingDate) return;
    const meeting: RetroMeeting = {
      id: crypto.randomUUID(),
      title: form.retroMeetingTitle.trim(),
      date: form.retroMeetingDate,
      conductedBy: form.retroMeetingConductedBy.trim(),
      summary: form.retroMeetingSummary.trim(),
    };
    setForm((prev) => ({
      ...prev,
      retroMeetings: [...prev.retroMeetings, meeting],
      retroMeetingTitle: "",
      retroMeetingDate: "",
      retroMeetingConductedBy: "",
      retroMeetingSummary: "",
    }));
  };

  const removeRetroMeeting = (id: string) => {
    setForm((prev) => ({ ...prev, retroMeetings: prev.retroMeetings.filter((meeting) => meeting.id !== id) }));
  };

  const allDocuments = [
    ...form.documents.lead_mail,
    ...form.documents.lead_mom,
    ...form.documents.lead_discussion,
    ...form.documents.lead_customer_doc,
    ...form.documents.lead_pre_qual_form,
  ];

  const handleUpdateRequirementSummary = async () => {
    const documentsWithText = allDocuments.filter((doc) => doc.extractedText?.trim());
    if (documentsWithText.length === 0) {
      setSummaryError("Attach a document with readable text first.");
      return;
    }

    setUpdatingSummary(true);
    setSummaryError(null);
    try {
      const documentText = documentsWithText
        .map((doc) => `### ${doc.name}\n${doc.extractedText!.trim()}`)
        .join("\n\n")
        .slice(0, 12000);
      const result = await invokeLlm(
        `Create a concise, business-ready requirement summary from the attached customer documents below.\n\n` +
          `Capture the customer's goals, current situation, key needs, scope, constraints, and expected outcomes. ` +
          `Use only information present in the documents. Do not invent details. Return only the summary in plain text, ` +
          `using short paragraphs or bullets.\n\n${documentText}`,
        900,
        0.2,
      );
      setForm((prev) => ({ ...prev, requirementSummary: result.trim() }));
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Could not update the requirement summary.");
    } finally {
      setUpdatingSummary(false);
    }
  };

  const canProceed = (() => {
    if (step === 1) {
      return (
        form.leadName.trim() !== "" &&
        form.kytesId.trim() !== "" &&
        form.receivedVia.trim() !== "" &&
        form.leadType.trim() !== "" &&
        form.clientName.trim() !== ""
      );
    }
    if (step === 2) {
      return form.preQualified.trim() !== "" &&
        form.drbApproved.trim() !== "" &&
        (form.drbApproved !== "yes" || form.drbApprovedDate.trim() !== "");
    }
    if (step === 3) {
      return true;
    }
    if (step === 4) {
      return true;
    }
    if (step >= REVIEW_EVENT_START) {
      return true;
    }
    return false;
  })();

  const buildEvent1Payload = () => ({
    leadName: form.leadName.trim(),
    kytesId: form.kytesId.trim(),
    receivedVia: form.receivedVia as "email" | "meeting" | "other",
    hgStatus: form.hgStatus,
    date: form.date ? new Date(form.date) : undefined,
    gtmName: form.gtmName,
    gtmHead: form.gtmHead || undefined,
    deliveryName: form.deliveryName || undefined,
    deliveryHead: form.deliveryHead || undefined,
    sparcOwner: form.sparcOwner || undefined,
    vertical: form.vertical,
    leadType: form.leadType,
    requirementSummary: form.requirementSummary,
    clientName: form.clientName.trim(),
    sparcMentor: form.sparcMentor || undefined,
    proposalReviewer: form.proposalReviewer || undefined,
    proposalRegion: form.proposalRegion || undefined,
    status: form.status as LeadStatus,
    documents: allDocuments.map((doc) => ({
      category: doc.category as LeadDocumentCategory,
      name: doc.name,
      size: doc.size,
      mimeType: doc.mimeType,
      content: doc.content,
      extractedText: doc.extractedText,
    })),
  });

  const buildEvent2Payload = (completedAt?: Date) => ({
    eventData: {
      ...(lead?.eventData ?? {}),
      event2: {
        preQualified: form.preQualified as "yes" | "no",
        comments: form.preQualComments.trim(),
        drbApproved: form.drbApproved as "yes" | "no" | "na",
        drbApprovedDate: form.drbApproved === "yes" ? form.drbApprovedDate : "",
        completedAt,
      },
    },
  });

  const saveCurrentStep = async (advance = false): Promise<Lead | undefined> => {
    if (!canProceed) return undefined;

    if (isCreate && step === 1) {
      const now = new Date();
      return addLead({
        ...buildEvent1Payload(),
        currentEvent: advance ? 2 : 1,
        eventData: {
          event1: {
            completedAt: advance ? now : undefined,
            activityLog: [{
              id: crypto.randomUUID(),
              action: "created",
              timestamp: now,
              actor: currentProfile?.name ?? "System",
              changes: ["Lead Initiation created"],
            }],
          },
        },
      });
    }

    if (!lead) return undefined;

    const now = new Date();
    const eventPaused = pausePeriodsForEvent(step).some((pause) => !pause.endedAt);
    const nextEvent = advance && !eventPaused
      ? Math.min(eventLabels.length, Math.max(form.currentEvent, step + 1))
      : Math.max(form.currentEvent, step);
    if (step === 1) {
      const event1Payload = buildEvent1Payload();
      const changes = event1ChangeLabels(lead, event1Payload);
      const activityLog = changes.length > 0
        ? [
            ...(event1Data.activityLog ?? []),
            {
              id: crypto.randomUUID(),
              action: "updated" as const,
              timestamp: now,
              actor: currentProfile?.name ?? "System",
              changes,
            },
          ]
        : event1Data.activityLog ?? [];
      return updateLead(lead.id, {
        ...event1Payload,
        currentEvent: nextEvent,
        eventData: {
          ...(lead.eventData ?? {}),
          event1: { ...(lead.eventData?.event1 ?? {}), completedAt: advance && !eventPaused ? now : undefined, activityLog: activityOverrides[1] ?? activityLog, pausePeriods: pausePeriodsForEvent(1) },
        },
      });
    }
    if (step === 2) {
      const eventData = buildEvent2Payload(advance && !eventPaused ? now : undefined).eventData;
      return updateLead(lead.id, {
        currentEvent: nextEvent,
        ...buildEvent1Payload(),
        eventData: mergeEventTiming(appendEventActivity(eventData, "event2", currentProfile?.name ?? "System", ["Pre-qualification outcome", "DRB approval", "DRB approval date", "Comments", "Attached documents"]), 2),
      });
    }
    if (step === 3) {
      return updateLead(lead.id, {
        currentEvent: nextEvent,
        ...buildEvent1Payload(),
        eventData: mergeEventTiming(appendEventActivity({
          ...(lead.eventData ?? {}),
          event3: { items: form.dueDiligenceItems, completedAt: advance && !eventPaused ? now : undefined },
        }, "event3", currentProfile?.name ?? "System", ["Due diligence entries"]), 3),
      });
    }
    if (step === 4) {
      return updateLead(lead.id, {
        currentEvent: nextEvent,
        ...buildEvent1Payload(),
        eventData: mergeEventTiming(appendEventActivity({
          ...(lead.eventData ?? {}),
          event4: {
            startDate: form.proposalStartDate,
            endDate: form.proposalEndDate,
            status: form.proposalStatus,
            pauseReason: form.proposalPauseReason.trim(),
            attachments: form.proposalAttachments,
            completedAt: advance && !eventPaused ? now : undefined,
          },
        }, "event4", currentProfile?.name ?? "System", ["Proposal dates", "Proposal status", "Pause / block reason", "Attached documents"]), 4),
      });
    }
    return undefined;
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const result = await saveCurrentStep(false);
      if (result) {
        syncSavedEventData(result, step);
        setForm((prev) => ({ ...prev, currentEvent: result.currentEvent }));
        if (isCreate) {
          router.push(`/leads/${result.id}`);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (!canProceed) return;
    setSubmitting(true);
    try {
      const result = await saveCurrentStep(true);
      if (result) {
        syncSavedEventData(result, step);
        const nextStep = result.currentEvent > step ? Math.min(step + 1, eventLabels.length) : step;
        setStep(nextStep);
        setForm((prev) => ({ ...prev, currentEvent: result.currentEvent }));
        if (isCreate) {
          router.push(`/leads/${result.id}`);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleStepClick = (targetStep: number) => {
    if (targetStep <= form.currentEvent) {
      setStep(targetStep);
    }
  };

  // One-click sample fill for Events 1-3 (mirrors "Load sample proposal" on
  // the proposal form). Only sets form state — walk through Next to save each
  // event as usual.
  const loadSampleLeadData = () => {
    setForm((prev) => ({
      ...prev,
      // Event 1 — Lead Initiation
      leadName: sampleLeadBasics.leadName,
      clientName: sampleLeadBasics.clientName,
      kytesId: sampleLeadBasics.kytesId,
      receivedVia: sampleLeadBasics.receivedVia,
      hgStatus: sampleLeadBasics.hgStatus,
      vertical: sampleLeadBasics.vertical,
      leadType: sampleLeadBasics.leadType,
      date: sampleLeadBasics.date,
      requirementSummary: sampleLeadBasics.requirementSummary,
      documents: {
        lead_mail: sampleLeadDocuments.filter((d) => d.category === "lead_mail"),
        lead_mom: sampleLeadDocuments.filter((d) => d.category === "lead_mom"),
        lead_discussion: sampleLeadDocuments.filter((d) => d.category === "lead_discussion"),
        lead_customer_doc: sampleLeadDocuments.filter((d) => d.category === "lead_customer_doc"),
        lead_pre_qual_form: sampleLeadDocuments.filter((d) => d.category === "lead_pre_qual_form"),
      },
      // Event 2 — Pre-Qualification
      preQualified: sampleLeadPreQual.preQualified,
      preQualComments: sampleLeadPreQual.comments,
      // Event 3 — Due Diligence
      dueDiligenceItems: buildSampleDueDiligenceItems(),
    }));
  };

  // Consolidate the customer expectations captured in Events 1-3 and have the
  // AI produce a proposal deck (.pptx). Downloads the file and attaches it to
  // the Event 4 proposal attachments so it's saved with the lead.
  const handleGenerateProposalPpt = async () => {
    setGeneratingPpt(true);
    setPptError(null);
    try {
      const { blob, base64 } = await generateProposalDeck({
        leadName: form.leadName,
        clientName: form.clientName,
        kytesId: form.kytesId,
        vertical: form.vertical,
        leadType: form.leadType,
        gtmName: form.gtmName,
        requirementSummary: form.requirementSummary,
        documents: allDocuments.map((doc) => ({
          name: doc.name,
          category: doc.category as string,
          extractedText: doc.extractedText,
        })),
        preQualified: form.preQualified,
        preQualComments: form.preQualComments,
        dueDiligenceItems: form.dueDiligenceItems.map((item) => ({
          type: item.type,
          title: item.title,
          startDate: item.startDate,
          endDate: item.endDate,
          status: item.status,
          conductedBy: item.conductedBy,
          summary: item.summary,
        })),
        proposalStartDate: form.proposalStartDate,
        proposalEndDate: form.proposalEndDate,
      });

      const mimeType =
        "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      const niceName = `${form.clientName || form.leadName || "Proposal"} Proposal.pptx`;
      downloadBlob(blob, niceName);

      setForm((prev) => ({
        ...prev,
        proposalAttachments: [
          ...prev.proposalAttachments,
          {
            category: "lead_proposal" as DocumentCategory,
            name: niceName,
            size: blob.size,
            mimeType,
            content: base64,
            extractedText: "AI-generated proposal presentation created from Events 1-3.",
          },
        ],
      }));
    } catch (err) {
      setPptError(err instanceof Error ? err.message : "Proposal generation failed");
    } finally {
      setGeneratingPpt(false);
    }
  };

  const proposalInitialValues = {
    title: form.leadName || (form.kytesId ? `${form.kytesId} Proposal` : ""),
    clientName: form.clientName,
    description: form.requirementSummary,
    technology: form.vertical,
    projectType: form.leadType,
    gtmOwner: form.gtmName,
    sparcOwner: form.sparcOwner,
    sparcMentor: form.sparcMentor,
    proposalReviewer: form.proposalReviewer,
    proposalRegion: form.proposalRegion,
    initiationDate: form.proposalStartDate,
    dueDate: form.proposalEndDate,
  };

  const proposalInitialDocuments: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[] = [
    ...form.proposalAttachments.map((doc) => ({ ...doc, category: "final_proposal" as DocumentCategory })),
    ...form.documents.lead_customer_doc.map((doc) => ({ ...doc, category: "customer_doc" as DocumentCategory })),
  ];

  const handleProposalCreated = async (created: Proposal) => {
    if (!lead) return;
    // Due diligence and proposal creation were already covered by this lead's
    // Event 3 / Event 4 — fast-forward straight into the review stage using
    // the existing workflow engine rather than re-asking for those steps.
    await applyWorkflowAction(created.id, { type: "start_due_diligence" });
    await applyWorkflowAction(created.id, { type: "start_proposal_creation" });
    const reviewReady = await applyWorkflowAction(created.id, { type: "submit_for_review" });

    await updateLead(lead.id, {
      proposalId: created.id,
      currentEvent: Math.max(form.currentEvent, REVIEW_EVENT_START),
      eventData: appendEventActivity(lead.eventData ?? {}, "event5", currentProfile?.name ?? "System", ["Proposal review started"]),
    });
    setLinkedProposal(reviewReady);
    setForm((prev) => ({ ...prev, currentEvent: Math.max(prev.currentEvent, REVIEW_EVENT_START) }));
  };

  const handleLinkedProposalChange = async (proposal: Proposal) => {
    setLinkedProposal(proposal);
    if (!lead) return;
    const cycleType = proposal.workflowStage ? getCycleType(proposal.workflowStage) : null;
    const eventNumber = cycleType === "delivery" ? 6 : cycleType === "proposal" ? 5 : null;
    if (!eventNumber) return;
    const updated = await updateLead(lead.id, {
      eventData: appendEventActivity(lead.eventData ?? {}, `event${eventNumber}`, currentProfile?.name ?? "System", ["Proposal workflow changed"]),
    });
    if (updated) setForm((prev) => ({ ...prev, currentEvent: Math.max(prev.currentEvent, updated.currentEvent) }));
  };

  // Event 7 — Customer Pitch & Feedback: capture the pitch details and unlock
  // the retro event once saved.
  const savePitch = async () => {
    if (!lead || !form.pitchStartDate) return;
    setSubmitting(true);
    try {
      const eventPaused = pausePeriodsForEvent(PITCH_EVENT).some((pause) => !pause.endedAt);
      const updated = await updateLead(lead.id, {
        currentEvent: eventPaused ? PITCH_EVENT : Math.max(form.currentEvent, RETRO_EVENT),
        eventData: mergeEventTiming(appendEventActivity({
          ...(lead.eventData ?? {}),
          event7: {
            startDate: form.pitchStartDate,
            endDate: form.pitchEndDate,
            mode: form.pitchMode || undefined,
            presentedBy: form.pitchPresentedBy.trim(),
            attendees: form.pitchAttendees.trim(),
            deckAttachments: form.pitchDeck,
            meetingFeedback: form.pitchMeetingFeedback.trim(),
            response: form.pitchResponse || undefined,
            responseNotes: form.pitchResponseNotes.trim(),
            nextSteps: form.pitchNextSteps.trim(),
            followUpDate: form.pitchFollowUpDate,
            completedAt: eventPaused ? undefined : event7Data.completedAt ?? new Date(),
          },
        }, "event7", currentProfile?.name ?? "System", ["Pitch details", "Meeting feedback", "Customer response", "Next steps", "Attached pitch deck"]), 7),
      });
      if (updated) {
        setForm((prev) => ({ ...prev, currentEvent: updated.currentEvent }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Event 8 — Proposal Retro & Wrap: record the outcome + retrospective and set
  // the lead's final status from the outcome.
  const saveRetro = async () => {
    if (!lead || !form.retroOutcome) return;
    setSubmitting(true);
    try {
      const eventPaused = pausePeriodsForEvent(RETRO_EVENT).some((pause) => !pause.endedAt);
      const outcome = retroOutcomeOptions.find((o) => o.value === form.retroOutcome);
      const updated = await updateLead(lead.id, {
        status: outcome?.leadStatus ?? lead.status,
        currentEvent: RETRO_EVENT,
        eventData: mergeEventTiming(appendEventActivity({
          ...(lead.eventData ?? {}),
          event8: {
            outcome: form.retroOutcome,
            meetings: form.retroMeetings,
            wentWell: form.retroWentWell.trim(),
            improve: form.retroImprove.trim(),
            learnings: form.retroLearnings.trim(),
            completedAt: eventPaused ? undefined : event8Data.completedAt ?? new Date(),
          },
        }, "event8", currentProfile?.name ?? "System", ["Final outcome", "Meeting events", "What went well", "What could be improved", "Key learnings"]), 8),
      });
      if (updated) {
        syncSavedEventData(updated, RETRO_EVENT);
        setForm((prev) => ({ ...prev, status: updated.status, currentEvent: updated.currentEvent }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // As the linked proposal progresses past its Proposal cycle into Delivery / Customer
  // review, unlock the corresponding Event 6 / Event 7 header steps to match.
  useEffect(() => {
    if (!lead || !linkedProposal) return;
    const stage = linkedProposal.workflowStage;
    const cycleType = stage ? getCycleType(stage) : null;
    const isFinal = stage === "approved" || stage === "rejected";
    const target = isFinal
      ? RETRO_EVENT
      : cycleType === "customer"
        ? REVIEW_EVENT_START + 2
        : cycleType === "delivery"
          ? REVIEW_EVENT_START + 1
          : REVIEW_EVENT_START;
    if (target <= form.currentEvent) return;
    updateLead(lead.id, { currentEvent: target }).then(() => {
      setForm((prev) => ({ ...prev, currentEvent: Math.max(prev.currentEvent, target) }));
    });
  }, [lead, linkedProposal, form.currentEvent]);

  const togglePause = (id: string) => {
    const item = form.dueDiligenceItems.find((i) => i.id === id);
    if (!item) return;
    if (item.status === "paused" || item.status === "blocked") {
      setForm((prev) => ({
        ...prev,
        dueDiligenceItems: prev.dueDiligenceItems.map((i) =>
          i.id === id ? { ...i, status: "in_progress" as DueDiligenceStatus, pauseReason: "" } : i
        ),
      }));
      return;
    }
    // Pausing needs a reason — collect it in a dialog instead of window.prompt.
    setPauseTargetId(id);
    setPauseReasonDraft("");
  };

  const confirmPause = () => {
    if (!pauseTargetId) return;
    const reason = pauseReasonDraft.trim();
    setForm((prev) => ({
      ...prev,
      dueDiligenceItems: prev.dueDiligenceItems.map((i) =>
        i.id === pauseTargetId ? { ...i, status: "paused" as DueDiligenceStatus, pauseReason: reason } : i
      ),
    }));
    setPauseTargetId(null);
    setPauseReasonDraft("");
  };

  const openAddItem = () => {
    const today = new Date().toISOString().split("T")[0];
    setDraftItem({
      id: crypto.randomUUID(),
      type: "meeting",
      title: "",
      startDate: today,
      endDate: "",
      status: "in_progress",
      pauseReason: "",
      conductedBy: currentProfile?.name ?? "",
      summary: "",
      attachments: [],
    });
  };

  const openEditItem = (item: DueDiligenceItem) => {
    setDraftItem({ ...item });
  };

  const closeItemDialog = () => setDraftItem(null);

  const saveDraftItem = () => {
    if (!draftItem || !draftItem.title.trim() || !draftItem.type) return;
    setForm((prev) => {
      const exists = prev.dueDiligenceItems.find((i) => i.id === draftItem.id);
      if (exists) {
        return {
          ...prev,
          dueDiligenceItems: prev.dueDiligenceItems.map((i) => (i.id === draftItem.id ? draftItem : i)),
        };
      }
      return { ...prev, dueDiligenceItems: [...prev.dueDiligenceItems, draftItem] };
    });
    setDraftItem(null);
  };

  const deleteItem = (id: string) => {
    if (!confirm("Remove this entry?")) return;
    setForm((prev) => ({ ...prev, dueDiligenceItems: prev.dueDiligenceItems.filter((i) => i.id !== id) }));
  };

  const segmentDurations = useMemo(() => getSegmentDurations(lead), [lead]);

  // Stage hero card data for the event currently being viewed. Events 5-7 show
  // the workflow roadmap's own card once a proposal is linked; before that (and
  // for Events 1-4) this lead-level card fills the same role.
  const showEventHero =
    step < REVIEW_EVENT_START ||
    step === PITCH_EVENT ||
    step === RETRO_EVENT ||
    (!loadingProposal && !linkedProposal);
  const eventHeroNow = clockNow;
  // Events 5-6 don't write completedAt into eventData (they're proposal-driven),
  // so the pitch and retro events fall back to the relevant cycle's completion time.
  const cycleCompletedAt = (cycleType: ReviewCycleType): Date | undefined =>
    linkedProposal?.workflowCycles
      .filter((c) => c.cycleType === cycleType && c.completedAt)
      .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime())[0]?.completedAt;
  const eventHeroStart =
    step <= 1
      ? lead
        ? new Date(lead.createdAt)
        : eventHeroNow
      : (eventTimestampForView(step - 1) ??
        (step === PITCH_EVENT
          ? cycleCompletedAt("delivery")
          : step === RETRO_EVENT
            ? cycleCompletedAt("customer")
            : undefined));
  const eventHeroPauses = pausePeriodsForEvent(step);
  const activeEventPause = eventHeroPauses.find((pause) => !pause.endedAt);
  const eventHeroEnd = activeEventPause ? undefined : eventTimestampForView(step);
  const eventHeroStatus = eventHeroEnd
    ? "Completed"
    : activeEventPause
      ? "Paused"
    : step === form.currentEvent
      ? "In progress"
      : step < form.currentEvent
        ? "Completed"
        : "Not started";
  const eventPausedMs = totalPauseDurationMs(eventHeroPauses, eventHeroNow);
  const eventHeroTimeIn = eventHeroStart
    ? formatDurationMs(effectiveEventDurationMs(eventHeroStart, eventHeroEnd ?? eventHeroNow, eventHeroPauses, eventHeroNow))
    : "0s";
  const leadCompletedAt = eventTimestampForView(RETRO_EVENT);
  const eventHeroTotal = lead
    ? formatDuration(new Date(lead.createdAt), leadCompletedAt ?? eventHeroNow)
    : "0s";
  const eventTimingControlsEnabled = Boolean(lead && eventHeroStart && !eventHeroEnd && step === form.currentEvent);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">
            {isCreate ? "New Lead" : lead.leadName || lead.kytesId}
          </h1>
          <p className="text-text-secondary">
            {isCreate
              ? "Start the SPARC lead intake roadmap."
              : `${lead.kytesId} · Continue the lead intake roadmap from the last saved event.`}
          </p>
        </div>
        {step < REVIEW_EVENT_START && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadSampleLeadData}
            disabled={submitting}
          >
            Load Sample (Events 1&ndash;3)
          </Button>
        )}
      </div>

      {/* Roadmap stepper — wraps to the next row instead of overlapping when it doesn't fit in one line */}
      <div className="relative flex flex-wrap items-center gap-y-8 pt-6">
        {eventLabels.map((label, index) => {
          const stepNumber = index + 1;
          const active = step === stepNumber;
          const unlocked = stepNumber <= form.currentEvent;
          const completed = stepNumber < step || (stepNumber < form.currentEvent && !active);
          return (
            <div key={label} className="flex items-center">
              <button
                type="button"
                disabled={!unlocked}
                onClick={() => handleStepClick(stepNumber)}
                className="flex items-center gap-3 text-left disabled:cursor-default"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 font-semibold shadow-md transition-all",
                    active
                      ? "border-amber-400 bg-amber-400 text-primary-900 ring-4 ring-amber-100"
                      : completed
                        ? "border-transparent bg-primary-600 text-white"
                        : unlocked
                          ? "border-border bg-surface text-text-secondary hover:border-primary-300"
                          : "border-border bg-surface-muted text-text-muted"
                  )}
                >
                  {stepNumber}
                </div>
                <span
                  className={cn(
                    "hidden whitespace-nowrap text-sm font-medium md:block",
                    unlocked ? "text-text-primary" : "text-text-muted"
                  )}
                >
                  {label}
                </span>
              </button>
              {stepNumber !== eventLabels.length && (
                <div className="relative mx-4 w-10 shrink-0 sm:w-16">
                  {segmentDurations[index] && (
                    <span
                      className={cn(
                        "absolute left-1/2 top-[-1.25rem] -translate-x-1/2 whitespace-nowrap text-[10px] font-medium",
                        index + 2 === step && activeEventPause ? "text-amber-600" : "text-text-tertiary"
                      )}
                    >
                      {index + 2 === step && activeEventPause ? "Paused" : segmentDurations[index]}
                    </span>
                  )}
                  <div
                    className={cn(
                      "h-0.5 w-full transition-colors",
                      stepNumber < form.currentEvent ? "bg-primary-600" : "bg-border"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showEventHero && (
        <StageHeroCard
          title={eventLabels[step - 1]}
          badge={eventHeroStatus}
          metrics={[
            { label: "Time in event", value: eventHeroTimeIn },
            { label: "Paused time", value: formatDurationMs(eventPausedMs) },
            { label: "Total lead time", value: eventHeroTotal },
            { label: "Event", value: `${step} of ${eventLabels.length}` },
          ]}
          timingPaused={Boolean(activeEventPause)}
          pauseReason={activeEventPause?.reason}
          onPause={eventTimingControlsEnabled ? (reason) => void setEventPaused(step, reason) : undefined}
          onResume={eventTimingControlsEnabled ? () => void setEventPaused(step) : undefined}
        />
      )}

      {step === RETRO_EVENT ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" size="sm" onClick={() => setStep(RETRO_EVENT - 1)}>
              <ChevronLeft size={16} className="mr-1" /> Back
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => router.push("/leads")}>
              <X size={16} className="mr-1" /> Close
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                Event {RETRO_EVENT} — {eventLabels[RETRO_EVENT - 1]}
              </CardTitle>
              <CardDescription>
                Close out the cycle: record the final outcome and capture the retrospective for this lead.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 rounded-xl border border-border bg-surface-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Meeting events</h3>
                    <p className="text-xs text-text-tertiary">Record meetings held during the final wrap-up, like Due Diligence entries.</p>
                  </div>
                  <Button type="button" size="sm" onClick={addRetroMeeting} disabled={!form.retroMeetingTitle.trim() || !form.retroMeetingDate}>
                    <Plus size={16} className="mr-1" /> Add Meeting
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="retroMeetingTitle">Meeting Title</Label>
                    <Input
                      id="retroMeetingTitle"
                      value={form.retroMeetingTitle}
                      onChange={(e) => setForm({ ...form, retroMeetingTitle: e.target.value })}
                      placeholder="e.g. Final customer review"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retroMeetingDate">Meeting Date</Label>
                    <Input
                      id="retroMeetingDate"
                      type="date"
                      value={form.retroMeetingDate}
                      onChange={(e) => setForm({ ...form, retroMeetingDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retroMeetingConductedBy">Conducted By</Label>
                    <Input
                      id="retroMeetingConductedBy"
                      value={form.retroMeetingConductedBy}
                      onChange={(e) => setForm({ ...form, retroMeetingConductedBy: e.target.value })}
                      placeholder="Team member"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retroMeetingSummary">Meeting Summary</Label>
                    <Input
                      id="retroMeetingSummary"
                      value={form.retroMeetingSummary}
                      onChange={(e) => setForm({ ...form, retroMeetingSummary: e.target.value })}
                      placeholder="Key discussion points"
                    />
                  </div>
                </div>

                {form.retroMeetings.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-surface-muted text-text-secondary">
                        <tr>
                          <th className="px-4 py-3 font-medium">Meeting</th>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium">Conducted By</th>
                          <th className="px-4 py-3 font-medium">Summary</th>
                          <th className="px-4 py-3 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {form.retroMeetings.map((meeting) => (
                          <tr key={meeting.id} className="bg-surface">
                            <td className="px-4 py-3 font-medium text-text-primary">{meeting.title}</td>
                            <td className="px-4 py-3 text-text-secondary">{meeting.date}</td>
                            <td className="px-4 py-3 text-text-secondary">{meeting.conductedBy || "—"}</td>
                            <td className="px-4 py-3 text-text-secondary">{meeting.summary || "—"}</td>
                            <td className="px-4 py-3 text-right">
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeRetroMeeting(meeting.id)}>
                                <Trash2 size={15} className="text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-text-tertiary">
                    No meeting events added yet.
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="retroOutcome">
                    Final Outcome <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    id="retroOutcome"
                    value={form.retroOutcome}
                    onChange={(e) => setForm({ ...form, retroOutcome: e.target.value as RetroOutcome | "" })}
                  >
                    <option value="">Select outcome...</option>
                    {retroOutcomeOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="retroWentWell">What went well</Label>
                  <Textarea
                    id="retroWentWell"
                    rows={4}
                    value={form.retroWentWell}
                    onChange={(e) => setForm({ ...form, retroWentWell: e.target.value })}
                    placeholder="Wins worth repeating — strong sections, smooth handoffs, good estimates..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retroImprove">What could be improved</Label>
                  <Textarea
                    id="retroImprove"
                    rows={4}
                    value={form.retroImprove}
                    onChange={(e) => setForm({ ...form, retroImprove: e.target.value })}
                    placeholder="Bottlenecks, rework causes, missing inputs..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="retroLearnings">Key learnings & wrap-up notes</Label>
                <Textarea
                  id="retroLearnings"
                  rows={4}
                  value={form.retroLearnings}
                  onChange={(e) => setForm({ ...form, retroLearnings: e.target.value })}
                  placeholder="Takeaways to carry into the next proposal cycle..."
                />
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between">
              <p className="text-xs text-text-tertiary">
                {event8Data.completedAt
                  ? "Retro completed — you can still update it."
                  : "Completing the retro sets the lead's final status from the outcome."}
              </p>
              <Button type="button" onClick={saveRetro} disabled={submitting || !form.retroOutcome}>
                {submitting ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <Check size={16} className="mr-2" />
                )}
                {event8Data.completedAt ? "Update Retro" : "Complete Retro & Wrap"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      ) : step === PITCH_EVENT ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" size="sm" onClick={() => setStep(PITCH_EVENT - 1)}>
              <ChevronLeft size={16} className="mr-1" /> Back
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => router.push("/leads")}>
              <X size={16} className="mr-1" /> Close
            </Button>
          </div>

          {linkedProposal && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/30 p-4">
              <div>
                <p className="text-sm font-semibold text-text-primary">{linkedProposal.title}</p>
                <p className="text-xs text-text-tertiary">{linkedProposal.clientName}</p>
              </div>
              <Link href={`/proposals/${linkedProposal.id}`}>
                <Button type="button" variant="outline" size="sm">
                  Open full proposal <ExternalLink size={14} className="ml-1.5" />
                </Button>
              </Link>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                Event {PITCH_EVENT} — {eventLabels[PITCH_EVENT - 1]}
              </CardTitle>
              <CardDescription>
                Present the final proposal to the customer, attach the deck, and capture the meeting
                feedback and customer response.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="pitchStartDate">
                    Pitch Start Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="pitchStartDate"
                    type="date"
                    value={form.pitchStartDate}
                    onChange={(e) => setForm({ ...form, pitchStartDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pitchEndDate">Pitch End Date</Label>
                  <Input
                    id="pitchEndDate"
                    type="date"
                    value={form.pitchEndDate}
                    min={form.pitchStartDate || undefined}
                    onChange={(e) => setForm({ ...form, pitchEndDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pitchMode">Pitch Mode</Label>
                  <Select
                    id="pitchMode"
                    value={form.pitchMode}
                    onChange={(e) => setForm({ ...form, pitchMode: e.target.value as PitchMode | "" })}
                  >
                    <option value="">Select mode...</option>
                    {pitchModeOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pitchPresentedBy">Presented By</Label>
                  <Input
                    id="pitchPresentedBy"
                    value={form.pitchPresentedBy}
                    onChange={(e) => setForm({ ...form, pitchPresentedBy: e.target.value })}
                    placeholder="Team members who presented"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pitchAttendees">Customer Attendees</Label>
                  <Input
                    id="pitchAttendees"
                    value={form.pitchAttendees}
                    onChange={(e) => setForm({ ...form, pitchAttendees: e.target.value })}
                    placeholder="Names / roles on the customer side"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Final Pitch Deck</Label>
                <FileUpload
                  category="lead_final_deck"
                  files={form.pitchDeck}
                  onChange={(files) => setForm({ ...form, pitchDeck: files })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pitchMeetingFeedback">Meeting Feedback</Label>
                <Textarea
                  id="pitchMeetingFeedback"
                  rows={4}
                  value={form.pitchMeetingFeedback}
                  onChange={(e) => setForm({ ...form, pitchMeetingFeedback: e.target.value })}
                  placeholder="How the pitch went — questions raised, objections, overall room read..."
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pitchResponse">Customer Response</Label>
                  <Select
                    id="pitchResponse"
                    value={form.pitchResponse}
                    onChange={(e) => setForm({ ...form, pitchResponse: e.target.value as PitchResponse | "" })}
                  >
                    <option value="">Select response...</option>
                    {pitchResponseOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pitchFollowUpDate">Follow-up Date</Label>
                  <Input
                    id="pitchFollowUpDate"
                    type="date"
                    value={form.pitchFollowUpDate}
                    onChange={(e) => setForm({ ...form, pitchFollowUpDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pitchResponseNotes">Customer Response Notes</Label>
                <Textarea
                  id="pitchResponseNotes"
                  rows={3}
                  value={form.pitchResponseNotes}
                  onChange={(e) => setForm({ ...form, pitchResponseNotes: e.target.value })}
                  placeholder="What the customer said — conditions, requested changes, decision timeline..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pitchNextSteps">Next Steps</Label>
                <Textarea
                  id="pitchNextSteps"
                  rows={3}
                  value={form.pitchNextSteps}
                  onChange={(e) => setForm({ ...form, pitchNextSteps: e.target.value })}
                  placeholder="Agreed follow-ups, revised deck, contract draft, reference calls..."
                />
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between">
              <p className="text-xs text-text-tertiary">
                {event7Data.completedAt
                  ? "Pitch recorded — you can still update it."
                  : "Saving the pitch unlocks the Proposal Retro & Wrap event."}
              </p>
              <Button type="button" onClick={savePitch} disabled={submitting || !form.pitchStartDate}>
                {submitting ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <Save size={16} className="mr-2" />
                )}
                {event7Data.completedAt ? "Update Customer Pitch" : "Save Customer Pitch"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      ) : step >= REVIEW_EVENT_START ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep(step > REVIEW_EVENT_START ? step - 1 : 4)}
            >
              <ChevronLeft size={16} className="mr-1" />
              {step > REVIEW_EVENT_START ? "Back" : "Back to Proposal Creation"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => router.push("/leads")}>
              <X size={16} className="mr-1" /> Close
            </Button>
          </div>

          {loadingProposal ? (
            <Card>
              <CardContent className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
              </CardContent>
            </Card>
          ) : linkedProposal ? (
            <>
              <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/30 p-4">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{linkedProposal.title}</p>
                  <p className="text-xs text-text-tertiary">{linkedProposal.clientName}</p>
                </div>
                <Link href={`/proposals/${linkedProposal.id}`}>
                  <Button type="button" variant="outline" size="sm">
                    Open full proposal <ExternalLink size={14} className="ml-1.5" />
                  </Button>
                </Link>
              </div>
              <WorkflowRoadmap
                proposal={linkedProposal}
                onChange={handleLinkedProposalChange}
                hideCreationPhase
                visibleCycles={[REVIEW_EVENT_CYCLE[step] ?? "proposal"]}
              />
            </>
          ) : (
            <>
              <p className="text-sm text-text-secondary">
                Basic Info, Supporting Docs, and the Final Proposal are already covered by Events 1-4 —
                review the details below and create the proposal to hand this lead off for SPARC review.
              </p>
              <ProposalForm
                initialValues={proposalInitialValues}
                initialDocuments={proposalInitialDocuments}
                onCreated={handleProposalCreated}
                stepLabelPrefix="5."
                steps={[4]}
                submitLabel="Start Proposal Review"
              />
            </>
          )}
        </div>
      ) : (
      <Card>
        <CardHeader>
          <CardTitle>
            Event {step} — {eventLabels[step - 1]}
          </CardTitle>
          <CardDescription>
            {step === 1 && "Capture how the lead was received and the initial details."}
            {step === 2 && "Record the pre-qualification outcome, comments, and upload the form."}
            {step === 3 && "Start due diligence by adding meetings and analysis entries."}
            {step === 4 && "Create the proposal, set the timeline, pause if needed, and upload the proposal document."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {step === 1 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="receivedVia">
                    Lead Received by SPARC <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    id="receivedVia"
                    value={form.receivedVia}
                    onChange={(e) => setForm({ ...form, receivedVia: e.target.value })}
                  >
                    <option value="">Select source...</option>
                    {receivedViaOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hgStatus">HG Status</Label>
                  <Select
                    id="hgStatus"
                    value={form.hgStatus}
                    onChange={(e) => setForm({ ...form, hgStatus: e.target.value })}
                  >
                    <option value="">Select status...</option>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leadType">
                    Lead Type <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    id="leadType"
                    value={form.leadType}
                    onChange={(e) => setForm({ ...form, leadType: e.target.value })}
                  >
                    <option value="">Select type...</option>
                    {types.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="leadName">
                    Lead Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="leadName"
                    value={form.leadName}
                    onChange={(e) => setForm({ ...form, leadName: e.target.value })}
                    placeholder="e.g. Acme Corp — CRM Modernization"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientName">
                    Customer / Client Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="clientName"
                    value={form.clientName}
                    onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                    placeholder="e.g. Acme Corporation"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="kytesId">
                  Kytes ID <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="kytesId"
                  value={form.kytesId}
                  onChange={(e) => setForm({ ...form, kytesId: e.target.value })}
                  placeholder="e.g. KYT-2026-0001"
                />
              </div>

              <div className="space-y-4 rounded-xl border border-border bg-surface-muted/30 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">SPARC details</h3>
                  <p className="mt-0.5 text-xs text-text-tertiary">Assign the SPARC team responsible for this lead.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="sparcOwner">SPARC Owner</Label>
                    <Select
                      id="sparcOwner"
                      value={form.sparcOwner}
                      onChange={(e) => setForm({ ...form, sparcOwner: e.target.value })}
                    >
                      <option value="">Select SPARC owner...</option>
                      {sparcOwners.map(({ name, team }) => (
                        <option key={name} value={name}>
                          {team ? `${name} (${team})` : name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="proposalReviewer">SPARC Reviewer</Label>
                    <Select
                      id="proposalReviewer"
                      value={form.proposalReviewer}
                      onChange={(e) => setForm({ ...form, proposalReviewer: e.target.value })}
                    >
                      <option value="">Select SPARC reviewer...</option>
                      {proposalReviewers.map(({ name, team }) => (
                        <option key={name} value={name}>
                          {team ? `${name} (${team})` : name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sparcMentor">SPARC Mentor</Label>
                    <Select
                      id="sparcMentor"
                      value={form.sparcMentor}
                      onChange={(e) => setForm({ ...form, sparcMentor: e.target.value })}
                    >
                      <option value="">Select SPARC mentor...</option>
                      {sparcMentors.map(({ name, team }) => (
                        <option key={name} value={name}>
                          {team ? `${name} (${team})` : name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-border bg-surface-muted/30 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">GTM details</h3>
                  <p className="mt-0.5 text-xs text-text-tertiary">Assign the GTM ownership and vertical for this lead.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="gtmName">GTM Name</Label>
                    <Select
                      id="gtmName"
                      value={form.gtmName}
                      onChange={(e) => setForm({ ...form, gtmName: e.target.value })}
                    >
                      <option value="">Select GTM name...</option>
                      {gtmOwners.map(({ name, team }) => (
                        <option key={name} value={name}>
                          {team ? `${name} (${team})` : name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vertical">VD Vertical</Label>
                    <Select
                      id="vertical"
                      value={form.vertical}
                      onChange={(e) => setForm({ ...form, vertical: e.target.value })}
                    >
                      <option value="">Select VD vertical...</option>
                      {verticals.map((vertical) => (
                        <option key={vertical} value={vertical}>
                          {vertical}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gtmHead">GTM Head</Label>
                    <Select
                      id="gtmHead"
                      value={form.gtmHead}
                      onChange={(e) => setForm({ ...form, gtmHead: e.target.value })}
                    >
                      <option value="">Select GTM head...</option>
                      {gtmHeads.map(({ name, team }) => (
                        <option key={name} value={name}>
                          {team ? `${name} (${team})` : name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-border bg-surface-muted/30 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Delivery details</h3>
                  <p className="mt-0.5 text-xs text-text-tertiary">Assign the Delivery ownership and vertical for this lead.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="deliveryName">Delivery Name</Label>
                    <Select
                      id="deliveryName"
                      value={form.deliveryName}
                      onChange={(e) => setForm({ ...form, deliveryName: e.target.value })}
                    >
                      <option value="">Select Delivery name...</option>
                      {deliveryOwners.map(({ name, team }) => (
                        <option key={name} value={name}>
                          {team ? `${name} (${team})` : name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deliveryVertical">Delivery Vertical</Label>
                    <Select
                      id="deliveryVertical"
                      value={form.vertical}
                      onChange={(e) => setForm({ ...form, vertical: e.target.value })}
                    >
                      <option value="">Select Delivery vertical...</option>
                      {verticals.map((vertical) => (
                        <option key={vertical} value={vertical}>
                          {vertical}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deliveryHead">Delivery Head</Label>
                    <Select
                      id="deliveryHead"
                      value={form.deliveryHead}
                      onChange={(e) => setForm({ ...form, deliveryHead: e.target.value })}
                    >
                      <option value="">Select Delivery head...</option>
                      {deliveryHeads.map(({ name, team }) => (
                        <option key={name} value={name}>
                          {team ? `${name} (${team})` : name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proposalRegion">Proposal Region</Label>
                <Select
                  id="proposalRegion"
                  value={form.proposalRegion}
                  onChange={(e) => setForm({ ...form, proposalRegion: e.target.value })}
                >
                  <option value="">Select region...</option>
                  {proposalRegions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="requirementSummary">Requirement Summary</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUpdateRequirementSummary}
                    disabled={updatingSummary || allDocuments.every((doc) => !doc.extractedText?.trim())}
                    title="Use AI to summarize the attached documents"
                  >
                    {updatingSummary ? (
                      <Loader2 size={14} className="mr-1.5 animate-spin" />
                    ) : (
                      <Sparkles size={14} className="mr-1.5" />
                    )}
                    {updatingSummary ? "Updating..." : "Update using AI"}
                  </Button>
                </div>
                <Textarea
                  id="requirementSummary"
                  value={form.requirementSummary}
                  onChange={(e) => setForm({ ...form, requirementSummary: e.target.value })}
                  placeholder="Brief summary of the customer requirement..."
                  rows={4}
                />
                {summaryError && <p className="text-xs text-red-500">{summaryError}</p>}
                <p className="text-xs text-text-tertiary">The AI uses readable text extracted from the attached documents and replaces the current summary.</p>
              </div>

              <div className="space-y-3">
                <Label>Doc Attached</Label>
                <div className="grid gap-6 md:grid-cols-3">
                  {leadDocCategories.map((category) => (
                    <div key={category} className="space-y-2">
                      <p className="text-xs font-medium text-text-secondary">{categoryLabelsShort[category]}</p>
                      <FileUpload
                        category={category as DocumentCategory}
                        files={form.documents[category]}
                        onChange={(files) => updateDoc(category, files)}
                      />
                    </div>
                  ))}
                </div>
              </div>

            </>
          )}

          {step === 2 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="preQualified">
                    Pre-Qualification Outcome <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    id="preQualified"
                    value={form.preQualified}
                    onChange={(e) => setForm({ ...form, preQualified: e.target.value })}
                  >
                    <option value="">Select outcome...</option>
                    {preQualOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preQualForm">Pre-Qualification Form</Label>
                  <FileUpload
                    category={preQualFormCategory as DocumentCategory}
                    files={form.documents[preQualFormCategory]}
                    onChange={(files) => updateDoc(preQualFormCategory, files)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="drbApproved">DRB Approved</Label>
                  <Select
                    id="drbApproved"
                    value={form.drbApproved}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        drbApproved: e.target.value,
                        drbApprovedDate: e.target.value === "yes" ? form.drbApprovedDate : "",
                      })
                    }
                  >
                    <option value="">Select status...</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="na">NA</option>
                  </Select>
                  {form.drbApproved === "yes" && (
                    <div className="space-y-2 pt-2">
                    <Label htmlFor="drbApprovedDate">
                      DRB Approval Date <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="drbApprovedDate"
                      type="date"
                      value={form.drbApprovedDate}
                      onChange={(e) => setForm({ ...form, drbApprovedDate: e.target.value })}
                      required
                    />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preQualComments">Comments</Label>
                <Textarea
                  id="preQualComments"
                  value={form.preQualComments}
                  onChange={(e) => setForm({ ...form, preQualComments: e.target.value })}
                  placeholder="Add comments / reasoning for the pre-qualification outcome..."
                  rows={4}
                />
              </div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-secondary">
                  Add meetings and analysis performed during due diligence.
                </p>
                <Button type="button" size="sm" onClick={openAddItem}>
                  <Plus size={16} className="mr-1" /> Add Entry
                </Button>
              </div>

              {form.dueDiligenceItems.length === 0 ? (
                <div className="rounded-xl border border-border bg-surface-muted/50 p-8 text-center">
                  <p className="text-text-secondary">No meetings or analysis added yet.</p>
                  <p className="text-sm text-text-muted">Click “Add Entry” to record one.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-muted text-text-secondary">
                      <tr>
                        <th className="px-4 py-3 font-medium">Type</th>
                        <th className="px-4 py-3 font-medium">Title</th>
                        <th className="px-4 py-3 font-medium">Start Date</th>
                        <th className="px-4 py-3 font-medium">End Date</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Conducted By</th>
                        <th className="px-4 py-3 font-medium">Summary</th>
                        <th className="px-4 py-3 font-medium">Attachments</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {form.dueDiligenceItems.map((item) => (
                        <tr key={item.id} className="bg-surface">
                          <td className="px-4 py-3 capitalize text-text-primary">{item.type}</td>
                          <td className="px-4 py-3 text-text-primary">{item.title}</td>
                          <td className="px-4 py-3 text-text-secondary">{item.startDate || "—"}</td>
                          <td className="px-4 py-3 text-text-secondary">{item.endDate || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", dueDiligenceStatusBadge[item.status])}>
                              {dueDiligenceStatusLabels[item.status]}
                            </span>
                            {item.pauseReason && (
                              <p className="mt-1 max-w-[12rem] truncate text-[10px] text-text-muted" title={item.pauseReason}>
                                {item.pauseReason}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-text-secondary">{item.conductedBy || "—"}</td>
                          <td className="max-w-xs px-4 py-3 text-text-secondary">
                            <p className="truncate">{item.summary || "—"}</p>
                          </td>
                          <td className="px-4 py-3 text-text-secondary">{item.attachments.length}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => togglePause(item.id)}
                                title={item.status === "paused" || item.status === "blocked" ? "Resume" : "Pause / Block"}
                              >
                                {item.status === "paused" || item.status === "blocked" ? "Resume" : "Pause"}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => openEditItem(item)}>
                                <Pencil size={15} />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteItem(item.id)}>
                                <Trash2 size={15} className="text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">AI Generated Proposal</p>
                  <p className="text-xs text-text-secondary">
                    Consolidates the customer expectations captured in Events 1&ndash;3 (initiation,
                    pre-qualification, due diligence) and creates a proposal deck (PPT). The file
                    downloads and is attached to this event.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={handleGenerateProposalPpt}
                  disabled={generatingPpt}
                  className="shrink-0"
                >
                  {generatingPpt ? (
                    <Loader2 size={16} className="mr-2 animate-spin" />
                  ) : (
                    <Sparkles size={16} className="mr-2" />
                  )}
                  {generatingPpt ? "Generating deck..." : "AI Generated Proposal"}
                </Button>
              </div>
              {generatingPpt && (
                <p className="text-xs text-text-tertiary">
                  Building the presentation with the connected AI — this usually takes under a minute.
                </p>
              )}
              {pptError && <p className="text-sm text-red-500">{pptError}</p>}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="proposalStartDate">Proposal Start Date</Label>
                  <Input
                    id="proposalStartDate"
                    type="date"
                    value={form.proposalStartDate}
                    onChange={(e) => setForm({ ...form, proposalStartDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proposalEndDate">Proposal End Date</Label>
                  <Input
                    id="proposalEndDate"
                    type="date"
                    value={form.proposalEndDate}
                    onChange={(e) => setForm({ ...form, proposalEndDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="proposalAttachment">Proposal Attachment</Label>
                  <FileUpload
                    category="lead_proposal"
                    files={form.proposalAttachments}
                    onChange={(files) => setForm({ ...form, proposalAttachments: files })}
                  />
                </div>
              </div>
            </div>
          )}

        </CardContent>

        <CardFooter className="justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/leads")} disabled={submitting}>
            <X size={16} className="mr-1" /> Cancel
          </Button>
          {step > 1 && (
            <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(s - 1, 1))} disabled={submitting}>
              <ChevronLeft size={16} className="mr-1" /> Back
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={handleSave}
            disabled={!canProceed || submitting}
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save size={16} className="mr-2" />}
            Save
          </Button>
          <Button type="button" onClick={handleNext} disabled={!canProceed || submitting || Boolean(activeEventPause)}>
            Next <ChevronRight size={16} className="ml-1" />
          </Button>
        </CardFooter>
      </Card>
      )}

      {step >= 1 && (
        <EventActivityLog
          eventNumber={step}
          activityTitle={step === 1 ? "Lead Initiation" : undefined}
          activityLog={activityOverrides[step] ?? ((lead?.eventData?.[`event${step}`] ?? {}) as { activityLog?: LeadEventActivity[] }).activityLog}
        />
      )}

      {draftItem && (
        <Dialog open onClose={closeItemDialog} className="max-w-xl">
          <div className="space-y-4">
            <div>
              <DialogTitle>{draftItem.title ? "Edit Entry" : "Add Due Diligence Entry"}</DialogTitle>
              <DialogDesc>Record a meeting or analysis performed during due diligence.</DialogDesc>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="itemType">
                  Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  id="itemType"
                  value={draftItem.type}
                  onChange={(e) => setDraftItem({ ...draftItem, type: e.target.value as "meeting" | "analysis" })}
                >
                  <option value="meeting">Meeting</option>
                  <option value="analysis">Analysis</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="itemTitle">
                  Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="itemTitle"
                  value={draftItem.title}
                  onChange={(e) => setDraftItem({ ...draftItem, title: e.target.value })}
                  placeholder="e.g. Discovery call with CTO"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="itemStartDate">Start Date</Label>
                <Input
                  id="itemStartDate"
                  type="date"
                  value={draftItem.startDate}
                  onChange={(e) => setDraftItem({ ...draftItem, startDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="itemEndDate">End Date</Label>
                <Input
                  id="itemEndDate"
                  type="date"
                  value={draftItem.endDate}
                  onChange={(e) => setDraftItem({ ...draftItem, endDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="itemStatus">Status</Label>
                <Select
                  id="itemStatus"
                  value={draftItem.status}
                  onChange={(e) => setDraftItem({ ...draftItem, status: e.target.value as DueDiligenceStatus })}
                >
                  <option value="in_progress">In Progress</option>
                  <option value="paused">Paused</option>
                  <option value="blocked">Blocked</option>
                  <option value="completed">Completed</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="itemConductedBy">Conducted By</Label>
                <Input
                  id="itemConductedBy"
                  value={draftItem.conductedBy}
                  onChange={(e) => setDraftItem({ ...draftItem, conductedBy: e.target.value })}
                />
              </div>
            </div>

            {(draftItem.status === "paused" || draftItem.status === "blocked") && (
              <div className="space-y-2">
                <Label htmlFor="itemPauseReason">Pause / Block Reason</Label>
                <Textarea
                  id="itemPauseReason"
                  value={draftItem.pauseReason}
                  onChange={(e) => setDraftItem({ ...draftItem, pauseReason: e.target.value })}
                  placeholder="e.g. Waiting for customer input / dependent on another team"
                  rows={3}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="itemSummary">Summary</Label>
              <Textarea
                id="itemSummary"
                value={draftItem.summary}
                onChange={(e) => setDraftItem({ ...draftItem, summary: e.target.value })}
                placeholder="Key takeaways, questions, risks..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Attachments</Label>
              <FileUpload
                category={dueDiligenceDocCategory as DocumentCategory}
                files={draftItem.attachments as Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[]}
                onChange={(files) => setDraftItem({ ...draftItem, attachments: files as DueDiligenceItem["attachments"] })}
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-border-subtle pt-4">
              <Button type="button" variant="outline" onClick={closeItemDialog}>
                Cancel
              </Button>
              <Button type="button" onClick={saveDraftItem} disabled={!draftItem.title.trim()}>
                Save Entry
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {pauseTargetId && (
        <Dialog open onClose={() => setPauseTargetId(null)} className="max-w-md">
          <div className="space-y-4">
            <div>
              <DialogTitle>Pause Entry</DialogTitle>
              <DialogDesc>Why is this due diligence entry being paused or blocked?</DialogDesc>
            </div>
            <Textarea
              autoFocus
              value={pauseReasonDraft}
              onChange={(e) => setPauseReasonDraft(e.target.value)}
              placeholder="e.g. Waiting on customer security questionnaire..."
              rows={3}
            />
            <div className="flex justify-end gap-3 border-t border-border-subtle pt-4">
              <Button type="button" variant="outline" onClick={() => setPauseTargetId(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={confirmPause}>
                Pause Entry
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
