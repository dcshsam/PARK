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

export interface ScoreCard {
  compliance?: number;
  clarity?: number;
  feasibility?: number;
  value?: number;
  overall?: number;
}

export type ValidationType = "error" | "warning" | "suggestion";

export const validationTypeLabels: Record<ValidationType, string> = {
  error: "Error",
  warning: "Warning",
  suggestion: "Suggestion",
};

export type RequirementCoverageStatus = "covered" | "partial" | "missing";

export const requirementStatusLabels: Record<RequirementCoverageStatus, string> = {
  covered: "Covered",
  partial: "Partial",
  missing: "Missing",
};

export type RequirementPriority = "must" | "should" | "nice";

export interface DynamicRequirement {
  id: string;
  text: string; // the requirement statement
  source: DocumentCategory; // rfp | transcript | customer_doc
  category?: string; // functional / technical / commercial (LLM grouping)
  priority?: RequirementPriority;
  status: RequirementCoverageStatus;
  score: number; // 0-10
  evidence?: string; // quote/section from the final proposal
  feedback?: string; // why this status
  recommendation?: string; // how to close the gap
}

export interface DynamicReview {
  score: number; // 0-10 weighted coverage score
  total: number;
  coveredCount: number;
  partialCount: number;
  missingCount: number;
  requirements: DynamicRequirement[];
  generatedAt: Date;
}

export interface RulesetCriterion {
  id: string;
  title: string;
  description?: string;
  type: ValidationType;
  weight: number; // 0-1 relative within subsection
  prompt?: string; // LLM-specific evaluation prompt
}

export interface RulesetSubsection {
  id: string;
  title: string;
  description?: string;
  weight: number; // 0-1 relative within section
  criteria: RulesetCriterion[];
}

export interface RulesetSection {
  id: string;
  title: string;
  description?: string;
  weight: number; // 0-1 relative within ruleset
  subsections: RulesetSubsection[];
}

export interface Ruleset {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  isSystem: boolean;
  sections: RulesetSection[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewRating {
  criterionId: string;
  subsectionId: string;
  sectionId: string;
  score: number; // 0-10
  type: ValidationType;
  feedback?: string;
  evidence?: string;
  issue?: string; // what is wrong / missing
  recommendation?: string; // what should be changed or improved
}

export interface AiReviewResult {
  id: string;
  proposalId: string;
  rulesetId: string;
  ratings: ReviewRating[];
  overallScore: number; // 0-10 weighted
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  generatedAt: Date;
  modelUsed?: string;
  dynamicReview?: DynamicReview; // RFP/transcript-derived requirements coverage
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
  rulesetId?: string;
  createdAt: Date;
  updatedAt: Date;
  documents: UploadedFile[];
  summary?: string;
  score?: ScoreCard; // legacy field kept for migration/compatibility
  aiReview?: AiReviewResult;
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
