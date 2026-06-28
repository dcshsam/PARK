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
import type { Proposal, ReviewCycleType, WorkflowStage, WorkflowCycle } from "./types";

export interface WorkflowTransition {
  proposal: Proposal;
  event: { type: string; toStage: WorkflowStage };
}

export type WorkflowAction =
  | { type: "start_due_diligence"; note?: string }
  | { type: "start_proposal_creation"; note?: string }
  | { type: "submit_for_review"; note?: string }
  | { type: "add_feedback"; note?: string }
  | { type: "request_changes"; note?: string; feedbackSummary?: string }
  | { type: "submit_changes"; note?: string }
  | { type: "approve"; note?: string }
  | { type: "reject"; note?: string }
  | { type: "reject_to_sparc"; note?: string };

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
    case "start_due_diligence":
      return handleStartDueDiligence(proposal, stage, actor, action.note);
    case "start_proposal_creation":
      return handleStartProposalCreation(proposal, stage, actor, action.note);
    case "submit_for_review":
      return handleSubmitForReview(proposal, stage, actor, action.note);
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
    case "reject_to_sparc":
      return handleRejectToSparcOwner(proposal, stage, actor, action.note);
    default:
      throw new Error("Unknown workflow action");
  }
}

async function handleStartDueDiligence(
  proposal: Proposal,
  stage: WorkflowStage,
  actor: string,
  note?: string
): Promise<Proposal> {
  if (stage !== "intake") {
    throw new Error("Due diligence can only start during the creation phase");
  }
  if (proposal.dueDiligenceStartedAt) {
    throw new Error("Due diligence has already started");
  }

  const now = new Date();
  await addWorkflowEvent({
    proposalId: proposal.id,
    cycleId: proposal.id,
    type: "due_diligence_started",
    fromStage: stage,
    toStage: stage,
    actor,
    note: note ?? "Due diligence started",
    createdAt: now,
  });
  await updateProposal(proposal.id, { dueDiligenceStartedAt: now });
  return getProposal(proposal.id) as Promise<Proposal>;
}

async function handleStartProposalCreation(
  proposal: Proposal,
  stage: WorkflowStage,
  actor: string,
  note?: string
): Promise<Proposal> {
  if (stage !== "intake") {
    throw new Error("Proposal creation can only start during the creation phase");
  }
  if (!proposal.dueDiligenceStartedAt) {
    throw new Error("Due diligence must start before proposal creation");
  }
  if (proposal.proposalCreationStartedAt) {
    throw new Error("Proposal creation has already started");
  }

  const now = new Date();
  await addWorkflowEvent({
    proposalId: proposal.id,
    cycleId: proposal.id,
    type: "proposal_creation_started",
    fromStage: stage,
    toStage: stage,
    actor,
    note: note ?? "Proposal creation started",
    createdAt: now,
  });
  await updateProposal(proposal.id, { proposalCreationStartedAt: now });
  return getProposal(proposal.id) as Promise<Proposal>;
}

async function handleSubmitForReview(
  proposal: Proposal,
  stage: WorkflowStage,
  actor: string,
  note?: string
): Promise<Proposal> {
  if (stage !== "intake") {
    throw new Error("Proposal can only be submitted for review from the creation phase");
  }
  if (!proposal.proposalCreationStartedAt) {
    throw new Error("Proposal creation must start before submitting for review");
  }

  const now = new Date();
  const reviewStage = "proposal_review" as WorkflowStage;

  // The creation phase has no review cycle — start the proposal review cycle now.
  const cycle = await addWorkflowCycle({
    proposalId: proposal.id,
    cycleType: "proposal",
    iteration: 1,
    stage: reviewStage,
    startedAt: now,
    status: "active",
  });

  await addWorkflowEvent({
    proposalId: proposal.id,
    cycleId: cycle.id,
    type: "cycle_started",
    fromStage: stage,
    toStage: reviewStage,
    actor,
    note: note ?? "Submitted for review — proposal review cycle started",
    createdAt: now,
  });

  await updateProposal(proposal.id, {
    workflowStage: reviewStage,
    currentCycleId: cycle.id,
    submittedForReviewAt: now,
    status: deriveStatus(reviewStage),
  });

  return getProposal(proposal.id) as Promise<Proposal>;
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

async function handleRejectToSparcOwner(
  proposal: Proposal,
  stage: WorkflowStage,
  actor: string,
  note?: string
): Promise<Proposal> {
  if (!stage.endsWith("_review")) {
    throw new Error("Can only reject to SPARC owner from a review stage");
  }

  const cycleType = getCycleTypeForStage(stage);
  const reworkStage = `${cycleType}_rework` as WorkflowStage;
  const currentCycle = proposal.workflowCycles.find((c) => c.id === proposal.currentCycleId);
  const feedbackSummary = note ?? "Rejected and sent to SPARC Owner";

  if (currentCycle) {
    await updateWorkflowCycle(currentCycle.id, {
      status: "rework",
      iteration: currentCycle.iteration + 1,
      feedbackSummary,
      stage: reworkStage,
    });
  }

  return transitionStage(proposal, stage, reworkStage, "stage_changed", actor, feedbackSummary);
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

export function getAvailableActions(proposal: Proposal | undefined): WorkflowAction["type"][] {
  const stage = proposal?.workflowStage;
  if (!stage || stage === "approved" || stage === "rejected") return [];
  if (stage === "intake") {
    // Creation phase advances through sequential checkpoints, one action at a time.
    if (!proposal?.dueDiligenceStartedAt) return ["start_due_diligence"];
    if (!proposal?.proposalCreationStartedAt) return ["start_proposal_creation"];
    return ["submit_for_review"];
  }
  if (stage.endsWith("_review")) return ["add_feedback", "approve", "reject_to_sparc"];
  if (stage.endsWith("_feedback")) return ["request_changes"];
  if (stage.endsWith("_rework")) return ["submit_changes"];
  return [];
}

export function getActionLabel(action: WorkflowAction["type"]): string {
  const labels: Record<WorkflowAction["type"], string> = {
    start_due_diligence: "Start Due Diligence",
    start_proposal_creation: "Start Proposal Creation",
    submit_for_review: "Submit for Review",
    add_feedback: "Add Feedback",
    request_changes: "Request Changes",
    submit_changes: "Submit Changes",
    approve: "Approve & Move Forward",
    reject: "Reject",
    reject_to_sparc: "Reject & Send to SPARC Owner",
  };
  return labels[action];
}

export async function startNewVersionCycle(
  proposalId: string,
  note?: string
): Promise<{ cycle: WorkflowCycle; previousCycleId?: string }> {
  const proposal = await getProposal(proposalId);
  if (!proposal) throw new Error("Proposal not found");

  const currentCycle = proposal.workflowCycles.find((c) => c.id === proposal.currentCycleId);
  const isFinalized = proposal.workflowStage === "approved" || proposal.workflowStage === "rejected";

  // If the proposal is finalized, restart from the proposal cycle. Otherwise continue
  // the current review cycle type so the new version is reviewed in the same context.
  const cycleType: ReviewCycleType = isFinalized ? "proposal" : currentCycle?.cycleType ?? "proposal";
  const now = new Date();
  const reviewStage = `${cycleType}_review` as WorkflowStage;
  const completedStage = `${cycleType}_completed` as WorkflowStage;

  // Complete the current cycle only if it is the same type and still active.
  if (currentCycle && currentCycle.cycleType === cycleType && !currentCycle.completedAt) {
    await updateWorkflowCycle(currentCycle.id, {
      status: "completed",
      completedAt: now,
      stage: completedStage,
    });
    await addWorkflowEvent({
      proposalId,
      cycleId: currentCycle.id,
      type: "cycle_completed",
      fromStage: proposal.workflowStage,
      toStage: completedStage,
      actor: getCurrentActor(),
      note: note ?? "Completed for new version upload",
      createdAt: now,
    });
  }

  const existingCyclesOfType = proposal.workflowCycles.filter((c) => c.cycleType === cycleType);
  const iteration =
    existingCyclesOfType.length > 0
      ? Math.max(...existingCyclesOfType.map((c) => c.iteration)) + 1
      : 1;

  const newCycle = await addWorkflowCycle({
    proposalId,
    cycleType,
    iteration,
    stage: reviewStage,
    startedAt: now,
    status: "active",
  });

  await addWorkflowEvent({
    proposalId,
    cycleId: newCycle.id,
    type: "cycle_started",
    fromStage: proposal.workflowStage,
    toStage: reviewStage,
    actor: getCurrentActor(),
    note: note ?? `New version cycle started (${cycleTypeLabels[cycleType]} iteration ${iteration})`,
    createdAt: now,
  });

  await updateProposal(proposalId, {
    workflowStage: reviewStage,
    currentCycleId: newCycle.id,
    status: "under_review",
  });

  return { cycle: newCycle, previousCycleId: currentCycle?.id };
}
