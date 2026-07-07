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
import { Loader2, Save, X, Check, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, ExternalLink } from "lucide-react";

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

function getSegmentDurations(lead: Lead | undefined): (string | null)[] {
  const labelsCount = eventLabels.length;
  const durations: (string | null)[] = [];
  for (let i = 0; i < labelsCount - 1; i++) {
    const start = getEventTimestamp(lead, i + 1);
    const end = getEventTimestamp(lead, i + 2);
    if (start && end) {
      durations.push(formatDuration(start, end));
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

const proposalStatusLabels: Record<ProposalStatus, string> = { ...dueDiligenceStatusLabels };

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

type LeadFormProps = {
  lead?: Lead;
};

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

  const initialStep = lead?.currentEvent ?? 1;
  const [step, setStep] = useState(initialStep);
  const [submitting, setSubmitting] = useState(false);
  const [draftItem, setDraftItem] = useState<DueDiligenceItem | null>(null);
  const [pauseTargetId, setPauseTargetId] = useState<string | null>(null);
  const [pauseReasonDraft, setPauseReasonDraft] = useState("");

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

  const event2Data = (lead?.eventData?.event2 ?? {}) as Record<string, string>;
  const event3Data = (lead?.eventData?.event3 ?? {}) as { items?: DueDiligenceItem[] };
  const event4Data = (lead?.eventData?.event4 ?? {}) as {
    startDate?: string;
    endDate?: string;
    status?: ProposalStatus;
    pauseReason?: string;
    attachments?: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[];
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
  };
  const event8Data = (lead?.eventData?.event8 ?? {}) as {
    outcome?: RetroOutcome;
    wentWell?: string;
    improve?: string;
    learnings?: string;
    completedAt?: Date;
  };

  const [form, setForm] = useState({
    // Event 1
    leadName: lead?.leadName ?? "",
    receivedVia: lead?.receivedVia ?? "",
    hgStatus: lead?.hgStatus ?? "",
    date: lead?.date ? new Date(lead.date).toISOString().split("T")[0] : "",
    gtmName: lead?.gtmName ?? currentProfile?.name ?? "",
    vertical: lead?.vertical ?? "",
    leadType: lead?.leadType ?? "",
    kytesId: lead?.kytesId ?? "",
    requirementSummary: lead?.requirementSummary ?? "",
    clientName: lead?.clientName ?? "",
    sparcMentor: lead?.sparcMentor ?? "",
    proposalReviewer: lead?.proposalReviewer ?? "",
    proposalRegion: lead?.proposalRegion ?? "",
    status: lead?.status ?? "new",
    currentEvent: lead?.currentEvent ?? 1,
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

  const updateDoc = (category: LeadDocumentCategory, files: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[]) => {
    setForm((prev) => ({ ...prev, documents: { ...prev.documents, [category]: files } }));
  };

  const allDocuments = [
    ...form.documents.lead_mail,
    ...form.documents.lead_mom,
    ...form.documents.lead_discussion,
    ...form.documents.lead_customer_doc,
    ...form.documents.lead_pre_qual_form,
  ];

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
      return form.preQualified.trim() !== "";
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

  const buildEvent2Payload = (completedAt: Date) => ({
    eventData: {
      ...(lead?.eventData ?? {}),
      event2: {
        preQualified: form.preQualified as "yes" | "no",
        comments: form.preQualComments.trim(),
        completedAt,
      },
    },
  });

  const saveCurrentStep = async (): Promise<Lead | undefined> => {
    if (!canProceed) return undefined;

    if (isCreate && step === 1) {
      const now = new Date();
      return addLead({
        ...buildEvent1Payload(),
        currentEvent: 2,
        eventData: {
          event1: { completedAt: now },
        },
      });
    }

    if (!lead) return undefined;

    const nextEvent = Math.min(eventLabels.length, Math.max(form.currentEvent, step + 1));
    const now = new Date();
    if (step === 1) {
      return updateLead(lead.id, {
        ...buildEvent1Payload(),
        currentEvent: nextEvent,
        eventData: {
          ...(lead.eventData ?? {}),
          event1: { ...(lead.eventData?.event1 ?? {}), completedAt: now },
        },
      });
    }
    if (step === 2) {
      return updateLead(lead.id, {
        currentEvent: nextEvent,
        ...buildEvent1Payload(),
        ...buildEvent2Payload(now),
      });
    }
    if (step === 3) {
      return updateLead(lead.id, {
        currentEvent: nextEvent,
        ...buildEvent1Payload(),
        eventData: {
          ...(lead.eventData ?? {}),
          event3: { items: form.dueDiligenceItems, completedAt: now },
        },
      });
    }
    if (step === 4) {
      return updateLead(lead.id, {
        currentEvent: nextEvent,
        ...buildEvent1Payload(),
        eventData: {
          ...(lead.eventData ?? {}),
          event4: {
            startDate: form.proposalStartDate,
            endDate: form.proposalEndDate,
            status: form.proposalStatus,
            pauseReason: form.proposalPauseReason.trim(),
            attachments: form.proposalAttachments,
            completedAt: now,
          },
        },
      });
    }
    return undefined;
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const result = await saveCurrentStep();
      if (result) {
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
      const result = await saveCurrentStep();
      if (result) {
        const nextStep = Math.min(step + 1, eventLabels.length);
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

  const proposalInitialValues = {
    title: form.leadName || (form.kytesId ? `${form.kytesId} Proposal` : ""),
    clientName: form.clientName,
    description: form.requirementSummary,
    technology: form.vertical,
    projectType: form.leadType,
    gtmOwner: form.gtmName,
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

    await updateLead(lead.id, { proposalId: created.id, currentEvent: Math.max(form.currentEvent, REVIEW_EVENT_START) });
    setLinkedProposal(reviewReady);
    setForm((prev) => ({ ...prev, currentEvent: Math.max(prev.currentEvent, REVIEW_EVENT_START) }));
  };

  // Event 7 — Customer Pitch & Feedback: capture the pitch details and unlock
  // the retro event once saved.
  const savePitch = async () => {
    if (!lead || !form.pitchStartDate) return;
    setSubmitting(true);
    try {
      const updated = await updateLead(lead.id, {
        currentEvent: Math.max(form.currentEvent, RETRO_EVENT),
        eventData: {
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
            completedAt: event7Data.completedAt ?? new Date(),
          },
        },
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
      const outcome = retroOutcomeOptions.find((o) => o.value === form.retroOutcome);
      const updated = await updateLead(lead.id, {
        status: outcome?.leadStatus ?? lead.status,
        currentEvent: RETRO_EVENT,
        eventData: {
          ...(lead.eventData ?? {}),
          event8: {
            outcome: form.retroOutcome,
            wentWell: form.retroWentWell.trim(),
            improve: form.retroImprove.trim(),
            learnings: form.retroLearnings.trim(),
            completedAt: event8Data.completedAt ?? new Date(),
          },
        },
      });
      if (updated) {
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
  const eventHeroNow = new Date();
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
      : (getEventTimestamp(lead, step - 1) ??
        (step === PITCH_EVENT
          ? cycleCompletedAt("delivery")
          : step === RETRO_EVENT
            ? cycleCompletedAt("customer")
            : undefined));
  const eventHeroEnd = getEventTimestamp(lead, step);
  const eventHeroStatus = eventHeroEnd
    ? "Completed"
    : step === form.currentEvent
      ? "In progress"
      : step < form.currentEvent
        ? "Completed"
        : "Not started";
  const eventHeroTimeIn = eventHeroStart
    ? formatDuration(eventHeroStart, eventHeroEnd ?? eventHeroNow)
    : "0s";
  const eventHeroTotal = lead ? formatDuration(new Date(lead.createdAt), eventHeroNow) : "0s";

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
                    <span className="absolute left-1/2 top-[-1.25rem] -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-text-tertiary">
                      {segmentDurations[index]}
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
            { label: "Total lead time", value: eventHeroTotal },
            { label: "Event", value: `${step} of ${eventLabels.length}` },
          ]}
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
                onChange={setLinkedProposal}
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
                  <Label htmlFor="gtmName">GTM Name</Label>
                  <Select
                    id="gtmName"
                    value={form.gtmName}
                    onChange={(e) => setForm({ ...form, gtmName: e.target.value })}
                  >
                    <option value="">Select GTM owner...</option>
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
                    <option value="">Select vertical...</option>
                    {verticals.map((vertical) => (
                      <option key={vertical} value={vertical}>
                        {vertical}
                      </option>
                    ))}
                  </Select>
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

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="sparcMentor">Sparc Mentor</Label>
                  <Select
                    id="sparcMentor"
                    value={form.sparcMentor}
                    onChange={(e) => setForm({ ...form, sparcMentor: e.target.value })}
                  >
                    <option value="">Select Sparc mentor...</option>
                    {sparcMentors.map(({ name, team }) => (
                      <option key={name} value={name}>
                        {team ? `${name} (${team})` : name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="proposalReviewer">Proposal Reviewer</Label>
                  <Select
                    id="proposalReviewer"
                    value={form.proposalReviewer}
                    onChange={(e) => setForm({ ...form, proposalReviewer: e.target.value })}
                  >
                    <option value="">Select reviewer...</option>
                    {proposalReviewers.map(({ name, team }) => (
                      <option key={name} value={name}>
                        {team ? `${name} (${team})` : name}
                      </option>
                    ))}
                  </Select>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="requirementSummary">Requirement Summary</Label>
                <Textarea
                  id="requirementSummary"
                  value={form.requirementSummary}
                  onChange={(e) => setForm({ ...form, requirementSummary: e.target.value })}
                  placeholder="Brief summary of the customer requirement..."
                  rows={4}
                />
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
              <div className="grid gap-4 sm:grid-cols-2">
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
                  <Label htmlFor="proposalStatus">Proposal Status</Label>
                  <Select
                    id="proposalStatus"
                    value={form.proposalStatus}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        proposalStatus: e.target.value as ProposalStatus,
                        proposalPauseReason: "",
                      })
                    }
                  >
                    {Object.entries(proposalStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="proposalAttachment">Proposal Attachment</Label>
                  <FileUpload
                    category="lead_proposal"
                    files={form.proposalAttachments}
                    onChange={(files) => setForm({ ...form, proposalAttachments: files })}
                  />
                </div>
              </div>

              {(form.proposalStatus === "paused" || form.proposalStatus === "blocked") && (
                <div className="space-y-2">
                  <Label htmlFor="proposalPauseReason">
                    Pause / Block Reason <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="proposalPauseReason"
                    value={form.proposalPauseReason}
                    onChange={(e) => setForm({ ...form, proposalPauseReason: e.target.value })}
                    placeholder="Why is the proposal paused or blocked?"
                    rows={3}
                  />
                </div>
              )}
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
          <Button type="button" onClick={handleNext} disabled={!canProceed || submitting}>
            Next <ChevronRight size={16} className="ml-1" />
          </Button>
        </CardFooter>
      </Card>
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
