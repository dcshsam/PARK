import { intervalToDuration, formatDuration } from "date-fns";
import type { Proposal, WorkflowCycle, WorkflowEvent, WorkflowStage } from "./types";
import { cycleStages, stageLabels } from "./workflow-config";

export interface StageDuration {
  stage: WorkflowStage;
  label: string;
  enteredAt: Date;
  exitedAt?: Date;
  durationMs: number;
}

export interface CycleSummary {
  cycle: WorkflowCycle;
  durationMs: number;
  iterations: number;
}

export function formatDurationShort(ms: number): string {
  if (ms <= 0) return "0s";
  const duration = intervalToDuration({ start: 0, end: ms });
  const parts: string[] = [];
  if (duration.days) parts.push(`${duration.days}d`);
  if (duration.hours) parts.push(`${duration.hours}h`);
  if (duration.minutes && parts.length < 2) parts.push(`${duration.minutes}m`);
  if (parts.length === 0) parts.push("< 1m");
  return parts.slice(0, 2).join(" ");
}

export function formatDurationLong(ms: number): string {
  if (ms <= 0) return "less than a minute";
  return (
    formatDuration(intervalToDuration({ start: 0, end: ms }), {
      format: ["days", "hours", "minutes"],
    }) || "less than a minute"
  );
}

export function getStageDurations(events: WorkflowEvent[]): StageDuration[] {
  const stageChanges = events.filter((e) => e.toStage && e.type === "stage_changed");
  const durations: StageDuration[] = [];

  for (let i = 0; i < stageChanges.length; i++) {
    const event = stageChanges[i];
    const nextEvent = stageChanges[i + 1];
    const enteredAt = event.createdAt;
    const exitedAt = nextEvent?.createdAt;
    const durationMs = exitedAt ? exitedAt.getTime() - enteredAt.getTime() : Date.now() - enteredAt.getTime();

    durations.push({
      stage: event.toStage!,
      label: stageLabels[event.toStage!],
      enteredAt,
      exitedAt,
      durationMs,
    });
  }

  // Also include current stage from cycle_started if no stage_changed yet
  const cycleStart = events.find((e) => e.type === "cycle_started" && e.toStage);
  if (cycleStart && !stageChanges.some((e) => e.toStage === cycleStart.toStage)) {
    durations.push({
      stage: cycleStart.toStage!,
      label: stageLabels[cycleStart.toStage!],
      enteredAt: cycleStart.createdAt,
      durationMs: Date.now() - cycleStart.createdAt.getTime(),
    });
  }

  return durations;
}

export function getCycleSummary(cycle: WorkflowCycle, events: WorkflowEvent[]): CycleSummary {
  const cycleEvents = events.filter((e) => e.cycleId === cycle.id);
  const endTime = cycle.completedAt?.getTime() ?? Date.now();
  const durationMs = endTime - cycle.startedAt.getTime();

  const reworkCount = cycleEvents.filter(
    (e) => e.type === "stage_changed" && e.toStage?.endsWith("_rework")
  ).length;

  return {
    cycle,
    durationMs,
    // cycle.iteration is the authoritative count (bumped on rework and on
    // new-version cycles); fall back to counting rework events.
    iterations: Math.max(cycle.iteration ?? 0, reworkCount),
  };
}

/**
 * Duration of the "Proposal creation" phase: from the proposal initiation date
 * (createdAt) to the moment it was submitted for review. If it hasn't been
 * submitted yet, measures elapsed time up to now.
 */
export function getCreationDuration(proposal: Proposal): number {
  const start = proposal.createdAt.getTime();
  const end = proposal.submittedForReviewAt
    ? proposal.submittedForReviewAt.getTime()
    : proposal.workflowStage === "intake"
      ? Date.now()
      : // Submitted before this field existed — fall back to the first review event.
        proposal.workflowEvents.find((e) => e.toStage === "proposal_review")?.createdAt.getTime() ??
        Date.now();
  return Math.max(0, end - start);
}

export function getTotalProposalDuration(proposal: Proposal): number {
  const endTime =
    proposal.workflowStage === "approved" || proposal.workflowStage === "rejected"
      ? proposal.workflowEvents[proposal.workflowEvents.length - 1]?.createdAt.getTime() ??
        proposal.updatedAt.getTime()
      : Date.now();
  return endTime - proposal.createdAt.getTime();
}

export function getCurrentStageDuration(proposal: Proposal): number {
  const durations = getStageDurations(proposal.workflowEvents);
  const current = durations[durations.length - 1];
  return current?.durationMs ?? 0;
}

export function getStageStatus(
  stage: WorkflowStage,
  currentStage: WorkflowStage | undefined,
  events: WorkflowEvent[]
): "pending" | "active" | "completed" {
  const reached = events.some((e) => e.toStage === stage);
  if (reached) return "completed";
  if (stage === currentStage) return "active";
  return "pending";
}

export function groupStagesByCycle(): {
  cycleType: "proposal" | "delivery" | "customer";
  label: string;
  stages: WorkflowStage[];
}[] {
  return [
    { cycleType: "proposal" as const, label: "Proposal Review", stages: cycleStages.proposal },
    { cycleType: "delivery" as const, label: "Delivery Review", stages: cycleStages.delivery },
    { cycleType: "customer" as const, label: "Customer Review", stages: cycleStages.customer },
  ];
}
