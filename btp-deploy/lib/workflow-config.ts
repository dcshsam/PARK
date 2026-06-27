import { type ReviewCycleType, type WorkflowStage } from "./types";

export const stageLabels: Record<WorkflowStage, string> = {
  intake: "Proposal Created",
  proposal_review: "Proposal Review",
  proposal_feedback: "Proposal Feedback",
  proposal_rework: "Sent for Changes",
  proposal_final_review: "Final Proposal Review",
  proposal_completed: "Proposal Review Completed",
  delivery_review: "Delivery Review",
  delivery_feedback: "Delivery Feedback",
  delivery_rework: "Delivery Changes Requested",
  delivery_final_review: "Final Delivery Review",
  delivery_completed: "Delivery Review Completed",
  customer_review: "Customer Review",
  customer_feedback: "Customer Feedback",
  customer_rework: "Customer Changes Requested",
  customer_final_review: "Final Customer Review",
  customer_completed: "Customer Review Completed",
  approved: "Approved & Ready",
  rejected: "Rejected",
};

export const stageShortLabels: Record<WorkflowStage, string> = {
  intake: "Created",
  proposal_review: "Review",
  proposal_feedback: "Feedback",
  proposal_rework: "Rework",
  proposal_final_review: "Final Review",
  proposal_completed: "Completed",
  delivery_review: "Review",
  delivery_feedback: "Feedback",
  delivery_rework: "Rework",
  delivery_final_review: "Final Review",
  delivery_completed: "Completed",
  customer_review: "Review",
  customer_feedback: "Feedback",
  customer_rework: "Rework",
  customer_final_review: "Final Review",
  customer_completed: "Completed",
  approved: "Approved",
  rejected: "Rejected",
};

export const cycleTypeLabels: Record<ReviewCycleType, string> = {
  proposal: "Proposal Review",
  delivery: "Delivery Review",
  customer: "Customer Review",
};

export const cycleTheme: Record<
  ReviewCycleType,
  { label: string; color: string; bg: string; border: string; lightBg: string; iconColor: string }
> = {
  proposal: {
    label: "Proposal Review",
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-600",
    border: "border-blue-200 dark:border-blue-500/30",
    lightBg: "bg-blue-50 dark:bg-blue-500/10",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  delivery: {
    label: "Delivery Review",
    color: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-600",
    border: "border-purple-200 dark:border-purple-500/30",
    lightBg: "bg-purple-50 dark:bg-purple-500/10",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  customer: {
    label: "Customer Review",
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-500",
    border: "border-amber-200 dark:border-amber-500/30",
    lightBg: "bg-amber-50 dark:bg-amber-500/10",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
};

export const cycleStages: Record<ReviewCycleType, WorkflowStage[]> = {
  proposal: [
    "proposal_review",
    "proposal_feedback",
    "proposal_rework",
    "proposal_final_review",
    "proposal_completed",
  ],
  delivery: [
    "delivery_review",
    "delivery_feedback",
    "delivery_rework",
    "delivery_final_review",
    "delivery_completed",
  ],
  customer: [
    "customer_review",
    "customer_feedback",
    "customer_rework",
    "customer_final_review",
    "customer_completed",
  ],
};

export function getCycleType(stage: WorkflowStage): ReviewCycleType | null {
  if (stage.startsWith("proposal_")) return "proposal";
  if (stage.startsWith("delivery_")) return "delivery";
  if (stage.startsWith("customer_")) return "customer";
  return null;
}

export function isReworkStage(stage: WorkflowStage): boolean {
  return stage.endsWith("_rework");
}

export function isFeedbackStage(stage: WorkflowStage): boolean {
  return stage.endsWith("_feedback");
}

export function isFinalReviewStage(stage: WorkflowStage): boolean {
  return stage.endsWith("_final_review");
}

export function isCompletedStage(stage: WorkflowStage): boolean {
  return stage.endsWith("_completed");
}

export function isReviewStage(stage: WorkflowStage): boolean {
  return stage.endsWith("_review") && !stage.endsWith("_final_review");
}

export function getNextStage(stage: WorkflowStage): WorkflowStage | null {
  const transitions: Record<WorkflowStage, WorkflowStage | null> = {
    intake: "proposal_review",
    proposal_review: "proposal_final_review",
    proposal_feedback: "proposal_rework",
    proposal_rework: "proposal_review",
    proposal_final_review: "proposal_completed",
    proposal_completed: "delivery_review",
    delivery_review: "delivery_final_review",
    delivery_feedback: "delivery_rework",
    delivery_rework: "delivery_review",
    delivery_final_review: "delivery_completed",
    delivery_completed: "customer_review",
    customer_review: "customer_final_review",
    customer_feedback: "customer_rework",
    customer_rework: "customer_review",
    customer_final_review: "customer_completed",
    customer_completed: "approved",
    approved: null,
    rejected: null,
  };
  return transitions[stage] ?? null;
}
