"use client";

import { useEffect, useMemo, useState } from "react";
import { addDocument, getDeepReview } from "@/lib/db";
import type { DeepReview } from "@/lib/deep-review/types";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  applyWorkflowAction,
  getActionLabel,
  getAvailableActions,
  type WorkflowAction,
} from "@/lib/workflow-engine";
import {
  cycleTheme,
  stageLabels,
  cycleTypeLabels,
  getCycleType,
} from "@/lib/workflow-config";
import {
  formatDurationShort,
  getCreationDuration,
  getCycleSummary,
  getStageDurations,
  getTotalProposalDuration,
} from "@/lib/workflow-utils";
import type {
  Proposal,
  UploadedFile,
  WorkflowStage,
  WorkflowEvent,
  WorkflowCycle,
  ReviewCycleType,
} from "@/lib/types";
import { useProfile } from "@/components/profile-provider";
import { StageHeroCard } from "@/components/stage-hero-card";
import {
  Check,
  Clock,
  Loader2,
  RotateCcw,
  MessageSquare,
  XCircle,
  ArrowRight,
  FileText,
  Truck,
  Users,
  AlertCircle,
  Send,
  RefreshCw,
  FilePlus2,
  Search,
  PencilLine,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { differenceInBusinessDays } from "date-fns";

interface WorkflowRoadmapProps {
  proposal: Proposal;
  onChange: (proposal: Proposal) => void;
  /** Hide the "Proposal Creation" phase section — used when embedded from a flow (e.g. Lead intake) that already tracks that phase itself. */
  hideCreationPhase?: boolean;
  /** Which cycle cards to render (defaults to all three) — used to scope the view to one cycle at a time (e.g. per Lead event). */
  visibleCycles?: ReviewCycleType[];
  /** Rendered between the roadmap and the Activity History card, so history always stays last on the page. */
  beforeHistory?: React.ReactNode;
}

const CYCLE_ORDER: ReviewCycleType[] = ["proposal", "delivery", "customer"];
const CYCLE_ICON: Record<ReviewCycleType, React.ElementType> = {
  proposal: FileText,
  delivery: Truck,
  customer: Users,
};

// The actual happy-path per cycle is Review → Completed.
// Feedback/Rework is a side-loop surfaced separately, not a sequential step.
type MilestoneKey = "review" | "completed";
const MILESTONES: { key: MilestoneKey; label: string; icon: React.ElementType }[] = [
  { key: "review", label: "Review", icon: FileText },
  { key: "completed", label: "Completed", icon: Check },
];

type MilestoneStatus = "completed" | "active" | "pending";

interface CycleProgress {
  started: boolean;
  isCompleted: boolean;
  isCurrent: boolean;
  milestones: { key: MilestoneKey; label: string; icon: React.ElementType; status: MilestoneStatus }[];
  inFeedback: boolean;
  inRework: boolean;
  iteration: number;
}

function getCycleProgress(
  cycleType: ReviewCycleType,
  currentStage: WorkflowStage | undefined,
  cycle: WorkflowCycle | undefined
): CycleProgress {
  // Scope progress to the selected cycle only. A proposal can have several
  // cycles of the same type (e.g. after an uploaded new version), so reading
  // global events would let an older completed cycle mask the active one.
  const feedbackS = `${cycleType}_feedback` as WorkflowStage;
  const reworkS = `${cycleType}_rework` as WorkflowStage;

  const isCompleted = Boolean(cycle?.completedAt);
  const isCurrent =
    Boolean(cycle) &&
    !isCompleted &&
    Boolean(currentStage) &&
    getCycleType(currentStage as WorkflowStage) === cycleType;
  const started = Boolean(cycle);

  const statusFor = (key: MilestoneKey): MilestoneStatus => {
    if (isCompleted) return "completed";
    if (!isCurrent) return "pending";
    if (key === "review") return "active";
    return "pending";
  };

  return {
    started,
    isCompleted,
    isCurrent,
    milestones: MILESTONES.map((m) => ({ ...m, status: statusFor(m.key) })),
    inFeedback: isCurrent && currentStage === feedbackS,
    inRework: isCurrent && currentStage === reworkS,
    iteration: cycle?.iteration ?? 0,
  };
}

function getStageTheme(stage: WorkflowStage, cycleType: ReviewCycleType | null) {
  if (stage === "approved") {
    return {
      color: "text-green-700 dark:text-green-400",
      bg: "bg-green-600",
      border: "border-green-200 dark:border-green-500/30",
      lightBg: "bg-green-50 dark:bg-green-500/10",
      iconColor: "text-green-600 dark:text-green-400",
    };
  }
  if (stage === "rejected") {
    return {
      color: "text-red-700 dark:text-red-400",
      bg: "bg-red-600",
      border: "border-red-200 dark:border-red-500/30",
      lightBg: "bg-red-50 dark:bg-red-500/10",
      iconColor: "text-red-600 dark:text-red-400",
    };
  }
  if (stage === "intake") {
    return {
      color: "text-text-secondary",
      bg: "bg-text-secondary",
      border: "border-border",
      lightBg: "bg-surface-muted",
      iconColor: "text-text-secondary",
    };
  }
  return cycleType ? cycleTheme[cycleType] : cycleTheme.proposal;
}

// Date each milestone (Review → Completed) was reached within a cycle.
function getMilestoneDates(
  cycleType: ReviewCycleType,
  cycle: WorkflowCycle | undefined,
  events: WorkflowEvent[]
): { review?: Date; final?: Date; completed?: Date } {
  if (!cycle) return {};
  const completedS = `${cycleType}_completed` as WorkflowStage;
  const inCycle = (toStage: WorkflowStage) =>
    events.find((e) => e.cycleId === cycle.id && e.toStage === toStage)?.createdAt;
  return {
    review: cycle.startedAt,
    completed: cycle.completedAt ?? inCycle(completedS),
  };
}

// Working (business) days between two milestones. If the end isn't reached yet,
// counts up to now and flags it as ongoing.
function workingDaysLabel(start?: Date, end?: Date): string | null {
  if (!start) return null;
  const ongoing = !end;
  const days = Math.max(0, differenceInBusinessDays(end ?? new Date(), start));
  return `${days} working day${days === 1 ? "" : "s"}${ongoing ? " so far" : ""}`;
}

export function WorkflowRoadmap({
  proposal,
  onChange,
  hideCreationPhase,
  visibleCycles = CYCLE_ORDER,
  beforeHistory,
}: WorkflowRoadmapProps) {
  const { can } = useProfile();
  const [loading, setLoading] = useState<WorkflowAction["type"] | null>(null);
  const [note, setNote] = useState("");

  const [reworkDocs, setReworkDocs] = useState<Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[]>([]);

  // A review stage can't be actioned until the AI Enabled Review has been run —
  // the panel dispatches "deep-review-saved" so an inline run unlocks it live.
  const [deepReview, setDeepReview] = useState<DeepReview | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getDeepReview(proposal.id).then((r) => {
        if (!cancelled) setDeepReview(r ?? null);
      });
    load();
    window.addEventListener("deep-review-saved", load);
    return () => {
      cancelled = true;
      window.removeEventListener("deep-review-saved", load);
    };
  }, [proposal.id]);

  const currentStage = proposal.workflowStage;
  const currentCycleType = currentStage ? getCycleType(currentStage) : null;
  const events = proposal.workflowEvents;
  const cycles = proposal.workflowCycles;
  const isFinalized = currentStage === "approved" || currentStage === "rejected";
  const isRework = Boolean(currentStage?.endsWith("_rework"));

  // A review only counts for the review stage it was run in: each cycle (SPARC,
  // Delivery) and each resubmitted version demands a fresh AI review run.
  const lastResubmittedAt = events
    .filter((e) => e.type === "changes_submitted")
    .reduce<Date | null>((latest, e) => (!latest || e.createdAt > latest ? e.createdAt : latest), null);
  const activeCycle = cycles.find((c) => c.id === proposal.currentCycleId);
  const reviewStaleAfter = [activeCycle?.startedAt, lastResubmittedAt]
    .filter((d): d is Date => Boolean(d))
    .reduce<Date | null>((latest, d) => (!latest || d > latest ? d : latest), null);
  const deepReviewIsCurrent =
    Boolean(deepReview) &&
    (!reviewStaleAfter || new Date(deepReview!.analyzed_at) > reviewStaleAfter);
  const awaitingDeepReview = Boolean(currentStage?.endsWith("_review")) && !deepReviewIsCurrent;
  const availableActions = awaitingDeepReview ? [] : getAvailableActions(proposal);

  const stageDurations = useMemo(() => getStageDurations(events), [events]);
  const currentStageDuration = stageDurations[stageDurations.length - 1]?.durationMs ?? 0;
  const totalDuration = useMemo(() => getTotalProposalDuration(proposal), [proposal]);
  const creationDuration = useMemo(() => getCreationDuration(proposal), [proposal]);

  // Scope the hero card to whichever single cycle is being viewed (e.g. one Lead
  // event tab) instead of always reflecting the proposal's overall current
  // stage — so Event 6/7's card shows Delivery/Customer progress, not whatever
  // cycle the proposal actually happens to be in.
  const focusCycleType = visibleCycles.length === 1 ? visibleCycles[0] : null;
  const focusCycle = focusCycleType
    ? cycles.filter((c) => c.cycleType === focusCycleType).sort((a, b) => b.iteration - a.iteration)[0]
    : undefined;
  const focusIsLive = Boolean(focusCycle) && proposal.currentCycleId === focusCycle?.id && !focusCycle?.completedAt;
  const focusSummary = focusCycle ? getCycleSummary(focusCycle, events) : null;

  const heroCycleType = focusCycleType ?? currentCycleType;
  const heroStage: WorkflowStage | undefined = focusCycleType
    ? focusIsLive
      ? currentStage
      : focusCycle?.completedAt
        ? (`${focusCycleType}_completed` as WorkflowStage)
        : undefined
    : currentStage;
  const heroTheme = getStageTheme(heroStage ?? "intake", heroCycleType);
  const heroTimeInStage = focusCycleType
    ? focusIsLive
      ? currentStageDuration
      : (focusSummary?.durationMs ?? 0)
    : currentStageDuration;
  const heroTotalTime = focusCycleType ? (focusSummary?.durationMs ?? 0) : totalDuration;
  const heroIteration = focusCycleType
    ? (focusCycle?.iteration ?? 0)
    : (cycles.find((c) => c.id === proposal.currentCycleId)?.iteration ?? 0);
  const inCreation = currentStage === "intake";
  const creationDone = Boolean(currentStage) && currentStage !== "intake";
  const ddAt = proposal.dueDiligenceStartedAt;
  const pcAt = proposal.proposalCreationStartedAt;
  // The checkpoint currently awaiting action while still in the creation phase.
  const ddActive = inCreation && !ddAt;
  const pcActive = inCreation && Boolean(ddAt) && !pcAt;
  // Working days on each creation connector segment.
  const segInitToDd = ddAt
    ? workingDaysLabel(proposal.createdAt, ddAt)
    : ddActive
      ? workingDaysLabel(proposal.createdAt, undefined)
      : null;
  const segDdToPc = pcAt
    ? workingDaysLabel(ddAt, pcAt)
    : pcActive
      ? workingDaysLabel(ddAt, undefined)
      : null;
  const creationSteps = [
    {
      key: "initiated",
      label: "Initiated",
      Icon: FilePlus2,
      status: "completed" as MilestoneStatus,
      date: proposal.createdAt as Date | undefined,
      placeholder: "—",
    },
    {
      key: "dd",
      label: "Start of Due Diligence",
      Icon: Search,
      status: (ddAt ? "completed" : ddActive ? "active" : "pending") as MilestoneStatus,
      date: ddAt,
      placeholder: ddActive ? "Awaiting" : "—",
    },
    {
      key: "pc",
      label: "Start of Proposal Creation",
      Icon: PencilLine,
      status: (pcAt ? "completed" : pcActive ? "active" : "pending") as MilestoneStatus,
      date: pcAt,
      placeholder: pcActive ? "Awaiting" : "—",
    },
  ];

  const handleAction = async (actionType: WorkflowAction["type"]) => {
    setLoading(actionType);
    try {
      // The revised proposal has to land on the record before the cycle goes back
      // to review, otherwise the reviewer re-reviews the old version.
      if (actionType === "submit_changes") {
        for (const doc of reworkDocs) {
          await addDocument(proposal.id, doc, { cycleId: proposal.currentCycleId });
        }
      }
      // reject_to_sparc already stores its note as the cycle's feedback summary.
      const action: WorkflowAction =
        actionType === "request_changes"
          ? { type: actionType, note, feedbackSummary: note }
          : { type: actionType, note };
      const updated = await applyWorkflowAction(proposal.id, action);
      onChange(updated);
      setNote("");
      setReworkDocs([]);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Status Hero */}
      <StageHeroCard
        title={heroStage ? stageLabels[heroStage] : "Not started"}
        badge={heroCycleType ? `${cycleTypeLabels[heroCycleType]} Cycle` : undefined}
        theme={heroTheme}
        metrics={[
          { label: "Time in stage", value: formatDurationShort(heroTimeInStage) },
          { label: "Total time", value: formatDurationShort(heroTotalTime) },
          { label: "Iteration", value: String(heroIteration) },
        ]}
      />

      {/* Action Panel */}
      {currentStage && !isFinalized && can("workflow_action") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Take Action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {awaitingDeepReview && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
                Run the AI Enabled Review on this proposal before approving or rejecting it.
              </p>
            )}
            {isRework && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-text-primary">Updated proposal</p>
                <p className="text-xs text-text-secondary">
                  Upload the revised proposal addressing the reviewer&apos;s feedback, then submit it to
                  start iteration {heroIteration} of this review.
                </p>
                <FileUpload category="final_proposal" files={reworkDocs} onChange={setReworkDocs} />
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {availableActions.map((action) => (
                <Button
                  key={action}
                  onClick={() => handleAction(action)}
                  disabled={
                    loading !== null ||
                    // Rejecting back for rework must carry feedback the owner can act on.
                    (action === "reject_to_sparc" && !note.trim()) ||
                    // Resubmitting means there is a new version to review.
                    (action === "submit_changes" && reworkDocs.length === 0)
                  }
                  variant={
                    action === "approve" ||
                    action === "submit_for_review" ||
                    action === "start_due_diligence" ||
                    action === "start_proposal_creation"
                      ? "primary"
                      : action === "reject" || action === "reject_to_sparc"
                        ? "danger"
                        : "outline"
                  }
                  size="sm"
                >
                  {loading === action ? (
                    <Loader2 size={16} className="mr-2 animate-spin" />
                  ) : action === "approve" ? (
                    <Check size={16} className="mr-2" />
                  ) : action === "reject" || action === "reject_to_sparc" ? (
                    <XCircle size={16} className="mr-2" />
                  ) : action === "add_feedback" ? (
                    <MessageSquare size={16} className="mr-2" />
                  ) : action === "start_due_diligence" ? (
                    <Search size={16} className="mr-2" />
                  ) : action === "start_proposal_creation" ? (
                    <PencilLine size={16} className="mr-2" />
                  ) : action === "submit_for_review" || action === "submit_changes" ? (
                    <Send size={16} className="mr-2" />
                  ) : (
                    <RotateCcw size={16} className="mr-2" />
                  )}
                  {getActionLabel(action)}
                </Button>
              ))}
            </div>

            {(availableActions.includes("add_feedback") ||
              availableActions.includes("request_changes") ||
              availableActions.includes("reject_to_sparc") ||
              availableActions.includes("submit_changes")) && (
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  isRework
                    ? "What changed in this version? (optional)"
                    : "Reviewer feedback — required to send the proposal back for rework"
                }
                rows={3}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Roadmap Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Roadmap</CardTitle>
          <CardDescription>
            Each cycle runs linearly: Review → Completed → Next event. Approving advances the workflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Proposal Creation phase */}
          {!hideCreationPhase && (
          <div className="relative">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-muted">
                  <FilePlus2
                    size={20}
                    className={inCreation || creationDone ? "text-text-secondary" : "text-text-muted"}
                  />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-text-secondary">Proposal Creation</h3>
                  <p className="text-xs text-text-tertiary">
                    {creationDone ? "Completed" : inCreation ? "In progress" : "Not started"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-text-tertiary">
                <Clock size={14} />
                {formatDurationShort(creationDuration)}
              </div>
            </div>

            {/* Creation milestone stepper — same round-node style as the cycles */}
            <div className="relative px-2">
              {/* Connector line, inset to align with first/last node centers */}
              <div className="absolute top-6 h-0.5 bg-border" style={{ left: "16.666%", right: "16.666%" }} />

              {/* Working days between the creation checkpoints */}
              {segInitToDd && (
                <span
                  className="absolute top-6 z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-text-tertiary"
                  style={{ left: "33.333%" }}
                >
                  {segInitToDd}
                </span>
              )}
              {segDdToPc && (
                <span
                  className="absolute top-6 z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-text-tertiary"
                  style={{ left: "66.666%" }}
                >
                  {segDdToPc}
                </span>
              )}

              <div className="grid grid-cols-3 gap-4">
                {creationSteps.map((s) => {
                  const Icon = s.Icon;
                  return (
                    <div key={s.key} className="relative flex flex-col items-center text-center">
                      <div
                        className={cn(
                          "relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all",
                          s.status === "completed"
                            ? "border-transparent bg-text-secondary text-white"
                            : s.status === "active"
                              ? "border-border bg-surface text-text-secondary ring-4 ring-surface-muted"
                              : "border-border bg-surface text-text-muted"
                        )}
                      >
                        <Icon size={20} />
                      </div>
                      <p
                        className={cn(
                          "mt-3 text-xs font-semibold",
                          s.status === "pending" ? "text-text-muted" : "text-text-primary"
                        )}
                      >
                        {s.label}
                      </p>
                      {s.status === "completed" && (
                        <p className="text-[11px] font-medium text-text-tertiary">Done</p>
                      )}
                      {s.status === "active" && (
                        <p className="text-[11px] font-medium text-text-secondary">Awaiting</p>
                      )}
                      <p className="mt-0.5 text-[10px] text-text-tertiary">
                        {s.date ? formatDate(s.date) : s.placeholder}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          )}

          {CYCLE_ORDER.filter((cycleType) => visibleCycles.includes(cycleType)).map((cycleType) => {
            const theme = cycleTheme[cycleType];
            const cycle = cycles
              .filter((c) => c.cycleType === cycleType)
              .sort((a, b) => b.iteration - a.iteration)[0];
            const summary = cycle ? getCycleSummary(cycle, events) : null;
            const prog = getCycleProgress(cycleType, currentStage, cycle);
            const CycleIcon = CYCLE_ICON[cycleType];
            const inset = `${50 / MILESTONES.length}%`;
            const mDates = getMilestoneDates(cycleType, cycle, events);
            // Working days spent on each connector segment (Review→Final, Final→Completed).
            const segReviewToCompleted = prog.isCurrent || prog.isCompleted
              ? workingDaysLabel(mDates.review, mDates.completed)
              : null;

            return (
              <div key={cycleType} className="relative">
                {/* Cycle header */}
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl",
                        prog.started ? theme.lightBg : "bg-surface-muted"
                      )}
                    >
                      <CycleIcon size={20} className={prog.started ? theme.iconColor : "text-text-muted"} />
                    </div>
                    <div>
                      <h3 className={cn("text-base font-semibold", prog.started ? theme.color : "text-text-tertiary")}>
                        {theme.label}
                      </h3>
                      <p className="text-xs text-text-tertiary">
                        {prog.isCompleted ? "Completed" : prog.isCurrent ? "In progress" : "Not started"}
                        {prog.started && summary ? ` · ${summary.iterations} iteration(s)` : ""}
                      </p>
                    </div>
                  </div>
                  {prog.started && summary && (
                    <div className="flex items-center gap-1 text-xs font-medium text-text-tertiary">
                      <Clock size={14} />
                      {formatDurationShort(summary.durationMs)}
                    </div>
                  )}
                </div>

                {/* Milestone stepper */}
                <div className="relative px-2">
                  {/* Connector line, inset to align with first/last node centers */}
                  <div className="absolute top-6 h-0.5 bg-border" style={{ left: inset, right: inset }} />

                  {/* Working-day counts on each connector segment */}
                  {segReviewToCompleted && (
                    <span
                      className="absolute top-6 z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-text-tertiary"
                      style={{ left: "50%" }}
                    >
                      {segReviewToCompleted}
                    </span>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {prog.milestones.map((m) => {
                      const Icon = m.icon;
                      const reachedAt =
                        m.key === "review"
                          ? mDates.review
                          : mDates.completed;
                      return (
                        <div key={m.key} className="relative flex flex-col items-center text-center">
                          <div
                            className={cn(
                              "relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all",
                              m.status === "completed"
                                ? cn("text-white", theme.bg, "border-transparent")
                                : m.status === "active"
                                  ? cn("bg-surface ring-4", theme.border, theme.iconColor, theme.lightBg)
                                  : "border-border bg-surface text-text-muted"
                            )}
                          >
                            <Icon size={20} />
                          </div>
                          <p
                            className={cn(
                              "mt-3 text-xs font-semibold",
                              m.status === "pending" ? "text-text-muted" : "text-text-primary"
                            )}
                          >
                            {m.label}
                          </p>
                          {m.status === "active" && (
                            <p className={cn("text-[11px] font-medium", theme.iconColor)}>In progress</p>
                          )}
                          {m.status === "completed" && (
                            <p className="text-[11px] font-medium text-text-tertiary">Done</p>
                          )}
                          {reachedAt && (
                            <p className="mt-0.5 text-[10px] text-text-tertiary">{formatDate(reachedAt)}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Rework-loop indicator */}
                {(prog.inFeedback || prog.inRework || prog.iteration > 0) && (
                  <div
                    className={cn(
                      "mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                      theme.border,
                      theme.lightBg
                    )}
                  >
                    <RefreshCw size={14} className={theme.iconColor} />
                    <span className={cn("font-medium", theme.color)}>
                      {prog.inFeedback
                        ? "Feedback being collected — changes loop pending"
                        : prog.inRework
                          ? "Changes in rework — will return to Review"
                          : "Revised after requested changes"}
                    </span>
                    {prog.iteration > 0 && (
                      <span className={cn("ml-auto rounded-full px-2 py-0.5 font-semibold text-white", theme.bg)}>
                        Iteration {prog.iteration}
                      </span>
                    )}
                  </div>
                )}

                {/* Feedback summary */}
                {cycle?.feedbackSummary && (
                  <div className={cn("mt-4 rounded-xl border p-3 text-sm", theme.border, theme.lightBg)}>
                    <div className="flex items-center gap-2">
                      <AlertCircle size={14} className={theme.iconColor} />
                      <span className={cn("font-medium", theme.color)}>Latest feedback</span>
                    </div>
                    <p className="mt-1 text-text-secondary">{cycle.feedbackSummary}</p>
                  </div>
                )}
              </div>
            );
          })}

          {/* Final outcome */}
          <div className="flex items-center justify-center">
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-6 py-4",
                currentStage === "approved"
                  ? "border-green-200 bg-green-50 dark:border-green-500/30 dark:bg-green-500/10"
                  : currentStage === "rejected"
                    ? "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
                    : "border-border bg-surface-muted"
              )}
            >
              {currentStage === "approved" ? (
                <Check size={24} className="text-green-600 dark:text-green-400" />
              ) : currentStage === "rejected" ? (
                <XCircle size={24} className="text-red-600 dark:text-red-400" />
              ) : (
                <ArrowRight size={24} className="text-text-muted" />
              )}
              <div>
                <p className="font-semibold text-text-primary">
                  {currentStage === "approved"
                    ? "Approved & Ready"
                    : currentStage === "rejected"
                      ? "Rejected"
                      : "Awaiting Final Approval"}
                </p>
                <p className="text-xs text-text-tertiary">Total lead time: {formatDurationShort(totalDuration)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {beforeHistory}

      {/* Activity History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-0">
            <div className="absolute bottom-2 left-2 top-2 w-0.5 bg-border" />
            {events
              .slice()
              .reverse()
              .map((event) => {
                const cycleType = event.toStage ? getCycleType(event.toStage) : null;
                const theme = cycleType ? cycleTheme[cycleType] : cycleTheme.proposal;

                return (
                  <div key={event.id} className="relative flex gap-4 py-3 pl-1">
                    <div
                      className={cn(
                        "relative z-10 mt-1.5 h-3 w-3 rounded-full border-2 border-surface",
                        theme.bg
                      )}
                    />
                    <div className="flex-1">
                      <p className="text-sm text-text-primary">
                        <span className="font-medium">{event.actor}</span>{" "}
                        {event.type === "cycle_started" && "started"}
                        {event.type === "due_diligence_started" && "started due diligence"}
                        {event.type === "proposal_creation_started" && "started proposal creation"}
                        {event.type === "cycle_completed" && "completed"}
                        {event.type === "stage_changed" && "moved to"}
                        {event.type === "feedback_added" && "added feedback on"}
                        {event.type === "changes_submitted" && "submitted changes for"}
                        {event.type === "rejected" && "rejected proposal"}
                        {event.type === "document_uploaded" && "uploaded document version"}
                        {event.toStage &&
                          event.type !== "due_diligence_started" &&
                          event.type !== "proposal_creation_started" && (
                            <span className="font-medium text-text-primary"> {stageLabels[event.toStage]}</span>
                          )}
                      </p>
                      {event.note && <p className="text-xs text-text-tertiary">{event.note}</p>}
                      <p className="text-xs text-text-muted">{event.createdAt.toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
