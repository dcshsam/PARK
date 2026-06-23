"use client";

import {
  addWorkflowCycle,
  addWorkflowEvent,
  getProposal,
  updateProposal,
  updateWorkflowCycle,
} from "./db";
import {
  cycleTypeLabels,
  getCycleType,
  getNextStage,
  isCompletedStage,
  isFinalReviewStage,
  isReworkStage,
} from "./workflow-config";
import type { Proposal, ReviewCycleType, WorkflowStage } from "./types";

export interface WorkflowTransition {
  proposal: Proposal;
  event: { type: string; toStage: WorkflowStage };
}

export type WorkflowAction =
  | { type: "add_feedback"; note?: string }
  | { type: "request_changes"; note?: string; feedbackSummary?: string }
  | { type: "submit_changes"; note?: string }
  | { type: "approve"; note?: string }
  | { type: "reject"; note?: string };

function getCurrentActor(): string {
  return "John Doe"; // placeholder until auth is added
}

function getCycleTypeForStage(stage: WorkflowStage): ReviewCycleType {
  const cycleType = getCycleType(stage);
  if (!cycleType) throw new Error(`Stage ${stage} does not belong to a review cycle`);
  return cycleType;
}

function getCompletionStageForCycle(cycleType: ReviewCycleType): WorkflowStage {
  return `${cycleType}_completed` as WorkflowStage;
}

export async function applyWorkflowAction(
  proposalId: string,
  action: WorkflowAction
): Promise<Proposal> {
  const proposal = await getProposal(proposalId);
  if (!proposal) throw new Error("Proposal not found");

  const stage = proposal.workflowStage ?? "intake";
  const actor = getCurrentActor();

  switch (action.type) {
    case "add_feedback":
      return handleAddFeedback(proposal, stage, actor, action.note);
    case "request_changes":
      return handleRequestChanges(proposal, stage, actor, action.note, action.feedbackSummary);
    case "submit_changes":
      return handleSubmitChanges(proposal, stage, actor, action.note);
    case "approve":
      return handleApprove(proposal, stage, actor, action.note);
    case "reject":
      return handleReject(proposal, stage, actor, action.note);
    default:
      throw new Error("Unknown workflow action");
  }
}

async function handleAddFeedback(
  proposal: Proposal,
  stage: WorkflowStage,
  actor: string,
  note?: string
): Promise<Proposal> {
  if (!stage.endsWith("_review")) {
    throw new Error("Feedback can only be added during a review stage");
  }

  const cycleType = getCycleTypeForStage(stage);
  const feedbackStage = `${cycleType}_feedback` as WorkflowStage;

  return transitionStage(proposal, stage, feedbackStage, "feedback_added", actor, note);
}

async function handleRequestChanges(
  proposal: Proposal,
  stage: WorkflowStage,
  actor: string,
  note?: string,
  feedbackSummary?: string
): Promise<Proposal> {
  if (!stage.endsWith("_feedback")) {
    throw new Error("Changes can only be requested from a feedback stage");
  }

  const cycleType = getCycleTypeForStage(stage);
  const reworkStage = `${cycleType}_rework` as WorkflowStage;
  const currentCycle = proposal.workflowCycles.find((c) => c.id === proposal.currentCycleId);

  if (currentCycle) {
    await updateWorkflowCycle(currentCycle.id, {
      status: "rework",
      iteration: currentCycle.iteration + 1,
      feedbackSummary: feedbackSummary ?? currentCycle.feedbackSummary,
      stage: reworkStage,
    });
  }

  return transitionStage(proposal, stage, reworkStage, "stage_changed", actor, note);
}

async function handleSubmitChanges(
  proposal: Proposal,
  stage: WorkflowStage,
  actor: string,
  note?: string
): Promise<Proposal> {
  if (!stage.endsWith("_rework")) {
    throw new Error("Changes can only be submitted from a rework stage");
  }

  const cycleType = getCycleTypeForStage(stage);
  const reviewStage = `${cycleType}_review` as WorkflowStage;

  return transitionStage(proposal, stage, reviewStage, "changes_submitted", actor, note);
}

async function handleApprove(
  proposal: Proposal,
  stage: WorkflowStage,
  actor: string,
  note?: string
): Promise<Proposal> {
  if (stage === "approved" || stage === "rejected") {
    throw new Error("Proposal is already finalized");
  }

  const nextStage = getNextStage(stage);
  if (!nextStage) {
    throw new Error("Cannot approve from current stage");
  }

  const currentCycle = proposal.workflowCycles.find((c) => c.id === proposal.currentCycleId);

  if (isFinalReviewStage(stage) && currentCycle) {
    // Complete current cycle and move to next stage
    const now = new Date();
    await updateWorkflowCycle(currentCycle.id, {
      status: "completed",
      completedAt: now,
      stage: getCompletionStageForCycle(currentCycle.cycleType),
    });
    await addWorkflowEvent({
      proposalId: proposal.id,
      cycleId: currentCycle.id,
      type: "cycle_completed",
      fromStage: stage,
      toStage: getCompletionStageForCycle(currentCycle.cycleType),
      actor,
      note: note ?? `${cycleTypeLabels[currentCycle.cycleType]} cycle completed`,
      createdAt: now,
    });
  }

  if (isCompletedStage(nextStage)) {
    // Start next cycle if there is one
    const currentCycleType = getCycleTypeForStage(nextStage);
    const nextCycleType = getNextCycleType(currentCycleType);

    if (nextCycleType) {
      const now = new Date();
      const nextCycleStartStage = `${nextCycleType}_review` as WorkflowStage;
      const newCycle = await addWorkflowCycle({
        proposalId: proposal.id,
        cycleType: nextCycleType,
        iteration: 1,
        stage: nextCycleStartStage,
        startedAt: now,
        status: "active",
      });
      await addWorkflowEvent({
        proposalId: proposal.id,
        cycleId: newCycle.id,
        type: "cycle_started",
        fromStage: nextStage,
        toStage: nextCycleStartStage,
        actor,
        note: `${cycleTypeLabels[nextCycleType]} cycle started`,
        createdAt: now,
      });
      await updateProposal(proposal.id, {
        workflowStage: nextCycleStartStage,
        currentCycleId: newCycle.id,
        status: deriveStatus(nextCycleStartStage),
      });
      return getProposal(proposal.id) as Promise<Proposal>;
    }
  }

  return transitionStage(proposal, stage, nextStage, "stage_changed", actor, note);
}

async function handleReject(
  proposal: Proposal,
  stage: WorkflowStage,
  actor: string,
  note?: string
): Promise<Proposal> {
  const currentCycle = proposal.workflowCycles.find((c) => c.id === proposal.currentCycleId);
  const now = new Date();

  if (currentCycle) {
    await updateWorkflowCycle(currentCycle.id, {
      status: "completed",
      completedAt: now,
    });
  }

  await addWorkflowEvent({
    proposalId: proposal.id,
    cycleId: currentCycle?.id ?? proposal.id,
    type: "rejected",
    fromStage: stage,
    toStage: "rejected",
    actor,
    note: note ?? "Proposal rejected",
    createdAt: now,
  });

  await updateProposal(proposal.id, {
    workflowStage: "rejected",
    status: "rejected",
  });

  return getProposal(proposal.id) as Promise<Proposal>;
}

async function transitionStage(
  proposal: Proposal,
  fromStage: WorkflowStage,
  toStage: WorkflowStage,
  eventType: "stage_changed" | "feedback_added" | "changes_submitted",
  actor: string,
  note?: string
): Promise<Proposal> {
  const currentCycle = proposal.workflowCycles.find((c) => c.id === proposal.currentCycleId);

  if (currentCycle && !isReworkStage(toStage) && !isCompletedStage(toStage)) {
    await updateWorkflowCycle(currentCycle.id, { stage: toStage });
  }

  await addWorkflowEvent({
    proposalId: proposal.id,
    cycleId: currentCycle?.id ?? proposal.id,
    type: eventType,
    fromStage,
    toStage,
    actor,
    note,
    createdAt: new Date(),
  });

  await updateProposal(proposal.id, {
    workflowStage: toStage,
    status: deriveStatus(toStage),
  });

  return getProposal(proposal.id) as Promise<Proposal>;
}

function deriveStatus(stage: WorkflowStage): Proposal["status"] {
  if (stage === "approved") return "approved";
  if (stage === "rejected") return "rejected";
  if (stage === "intake") return "draft";
  return "under_review";
}

function getNextCycleType(cycleType: ReviewCycleType): ReviewCycleType | null {
  const order: ReviewCycleType[] = ["proposal", "delivery", "customer"];
  const idx = order.indexOf(cycleType);
  return order[idx + 1] ?? null;
}

export function getAvailableActions(stage: WorkflowStage | undefined): WorkflowAction["type"][] {
  if (!stage || stage === "approved" || stage === "rejected") return [];
  if (stage.endsWith("_review")) return ["add_feedback", "approve"];
  if (stage.endsWith("_feedback")) return ["request_changes"];
  if (stage.endsWith("_rework")) return ["submit_changes"];
  return [];
}

export function getActionLabel(action: WorkflowAction["type"]): string {
  const labels: Record<WorkflowAction["type"], string> = {
    add_feedback: "Add Feedback",
    request_changes: "Request Changes",
    submit_changes: "Submit Changes",
    approve: "Approve & Move Forward",
    reject: "Reject",
  };
  return labels[action];
}
