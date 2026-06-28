export type ProposalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected";

export type DocumentCategory = "rfp" | "transcript" | "customer_doc" | "final_proposal";

export type ReviewCycleType = "proposal" | "delivery" | "customer";

export type WorkflowStage =
  | "intake"
  | "proposal_review"
  | "proposal_feedback"
  | "proposal_rework"
  | "proposal_final_review"
  | "proposal_completed"
  | "delivery_review"
  | "delivery_feedback"
  | "delivery_rework"
  | "delivery_final_review"
  | "delivery_completed"
  | "customer_review"
  | "customer_feedback"
  | "customer_rework"
  | "customer_final_review"
  | "customer_completed"
  | "approved"
  | "rejected";

export interface WorkflowCycle {
  id: string;
  proposalId: string;
  cycleType: ReviewCycleType;
  iteration: number;
  stage: WorkflowStage;
  startedAt: Date;
  completedAt?: Date;
  dueDate?: Date;
  status: "active" | "rework" | "completed" | "skipped";
  feedbackSummary?: string;
}

export interface WorkflowEvent {
  id: string;
  proposalId: string;
  cycleId: string;
  type:
    | "cycle_started"
    | "stage_changed"
    | "feedback_added"
    | "changes_submitted"
    | "cycle_completed"
    | "rejected"
    | "document_uploaded";
  fromStage?: WorkflowStage;
  toStage?: WorkflowStage;
  actor: string;
  note?: string;
  createdAt: Date;
}

export interface UploadedFile {
  id: string;
  proposalId: string;
  cycleId?: string; // workflow cycle this document version belongs to
  version?: number; // version number within the cycle/category
  category: DocumentCategory;
  name: string;
  size: number;
  mimeType: string;
  content?: string; // text or base64 preview content
  extractedText?: string;
  uploadedAt: Date;
}

export interface Comment {
  id: string;
  proposalId: string;
  author: string;
  text: string;
  createdAt: Date;
}

export interface Proposal {
  id: string;
  title: string;
  clientName: string;
  description: string;
  status: ProposalStatus;
  dueDate?: Date;
  technology?: string;
  projectType?: string;
  sparcOwner?: string;
  sparcMentor?: string;
  gtmOwner?: string;
  proposalReviewer?: string;
  proposalRegion?: string;
  workflowStage?: WorkflowStage;
  currentCycleId?: string;
  createdAt: Date;
  updatedAt: Date;
  documents: UploadedFile[];
  summary?: string;
  comments: Comment[];
  workflowCycles: WorkflowCycle[];
  workflowEvents: WorkflowEvent[];
}

export interface ProposalInput {
  title: string;
  clientName: string;
  description: string;
  dueDate?: string;
  technology?: string;
  projectType?: string;
  sparcOwner?: string;
  sparcMentor?: string;
  gtmOwner?: string;
  proposalReviewer?: string;
  proposalRegion?: string;
  documents: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[];
}

export const statusLabels: Record<ProposalStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
};

export const categoryLabels: Record<DocumentCategory, string> = {
  rfp: "RFP Document",
  transcript: "Meeting Transcript",
  customer_doc: "Customer Document",
  final_proposal: "Customer Final Proposal",
};
