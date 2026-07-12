export type ProposalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected";

export type ProposalDocumentCategory = "rfp" | "transcript" | "customer_doc" | "final_proposal";
export type LeadDocumentCategory =
  | "lead_mail"
  | "lead_mom"
  | "lead_discussion"
  | "lead_pre_qual_form"
  | "lead_due_diligence"
  | "lead_proposal"
  | "lead_customer_doc"
  | "lead_final_deck";
export type DocumentCategory = ProposalDocumentCategory | LeadDocumentCategory;

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
    | "document_uploaded"
    | "due_diligence_started"
    | "proposal_creation_started";
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
  initiationDate?: Date;
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
  /** Creation-phase checkpoints (all occur while in the "intake" stage). */
  dueDiligenceStartedAt?: Date;
  proposalCreationStartedAt?: Date;
  /** Timestamp the proposal was submitted from the creation phase into proposal review. */
  submittedForReviewAt?: Date;
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
  initiationDate?: string;
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
  lead_mail: "Mail",
  lead_mom: "Minutes of Meeting",
  lead_discussion: "Discussion Notes",
  lead_pre_qual_form: "Pre-Qualification Form",
  lead_due_diligence: "Due Diligence Document",
  lead_proposal: "Proposal Document",
  lead_customer_doc: "Customer Document (RFP / Requirement Summary)",
  lead_final_deck: "Final Pitch Deck",
};

// ── Lead Management ────────────────────────────────────────────────────────

export type LeadStatus =
  | "new"
  | "in_progress"
  | "qualified"
  | "proposal"
  | "customer_pitch"
  | "converted"
  | "on_hold"
  | "dropped";

export interface Lead {
  id: string;
  leadName: string;
  kytesId: string;
  receivedVia: "email" | "meeting" | "other";
  hgStatus: string;
  date?: Date;
  gtmName: string;
  gtmHead?: string;
  deliveryName?: string;
  deliveryHead?: string;
  vertical: string;
  leadType: string;
  requirementSummary: string;
  /** Customer / client name — carried over to the linked proposal at Event 5. */
  clientName: string;
  /** Optional Proposal Basic Info fields captured early so Event 5 doesn't re-ask for them. */
  sparcOwner?: string;
  sparcMentor?: string;
  proposalReviewer?: string;
  proposalRegion?: string;
  documents: LeadDocument[];
  status: LeadStatus;
  /** The next event the user can fill (1-5). After Event 1 is saved this becomes 2, etc. */
  currentEvent: number;
  /** Flexible per-event data (event2, event3, event4). */
  eventData?: Record<string, unknown>;
  /** Proposal created for Event 5 (Proposal Review - SPARC), once linked. */
  proposalId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadDocument {
  category: LeadDocumentCategory;
  name: string;
  size: number;
  mimeType: string;
  content?: string;
  extractedText?: string;
}

export const leadStatusLabels: Record<LeadStatus, string> = {
  new: "New",
  in_progress: "In Progress",
  qualified: "Qualified",
  proposal: "Proposal",
  customer_pitch: "Customer Pitch",
  converted: "Converted",
  on_hold: "On Hold",
  dropped: "Dropped",
};

// ── Team Activity Dashboard ────────────────────────────────────────────────

export type TeamActivityCategory =
  | "customer"
  | "capability"
  | "assessment"
  | "idea"
  | "internal"
  | "other";

export interface TeamActivity {
  id: string;
  memberName: string;
  title: string;
  startDate: Date;
  endDate: Date;
  category: TeamActivityCategory;
  proposalId?: string;
  notes?: string;
}
