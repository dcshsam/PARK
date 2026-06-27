import type { Proposal, UploadedFile, Comment, WorkflowCycle, WorkflowEvent } from "./types";

const now = new Date();

function doc(
  proposalId: string,
  category: UploadedFile["category"],
  name: string,
  content: string,
  mimeType: string = "text/plain"
): UploadedFile {
  return {
    id: crypto.randomUUID(),
    proposalId,
    category,
    name,
    size: new Blob([content]).size,
    mimeType,
    content: btoa(unescape(encodeURIComponent(content))),
    extractedText: content,
    uploadedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24),
  };
}

function comment(proposalId: string, author: string, text: string): Comment {
  return {
    id: crypto.randomUUID(),
    proposalId,
    author,
    text,
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 12),
  };
}

function workflowCycle(
  proposalId: string,
  cycleType: WorkflowCycle["cycleType"],
  stage: WorkflowCycle["stage"],
  startedAt: Date,
  completedAt?: Date,
  iteration = 1
): WorkflowCycle {
  return {
    id: crypto.randomUUID(),
    proposalId,
    cycleType,
    iteration,
    stage,
    startedAt,
    completedAt,
    status: completedAt ? "completed" : "active",
  };
}

function workflowEvent(
  proposalId: string,
  cycleId: string,
  type: WorkflowEvent["type"],
  toStage: WorkflowEvent["toStage"],
  createdAt: Date,
  note?: string
): WorkflowEvent {
  return {
    id: crypto.randomUUID(),
    proposalId,
    cycleId,
    type,
    toStage,
    actor: "System",
    note,
    createdAt,
  };
}

export function seedDemoData(): Proposal[] {
  const p1Id = crypto.randomUUID();
  const p2Id = crypto.randomUUID();
  const p3Id = crypto.randomUUID();
  const p4Id = crypto.randomUUID();

  const p1Cycle = workflowCycle(
    p1Id,
    "proposal",
    "proposal_review",
    new Date(now.getTime() - 1000 * 60 * 60 * 24 * 4)
  );

  const p3Cycle1 = workflowCycle(
    p3Id,
    "proposal",
    "proposal_completed",
    new Date(now.getTime() - 1000 * 60 * 60 * 24 * 9),
    new Date(now.getTime() - 1000 * 60 * 60 * 24 * 6)
  );
  const p3Cycle2 = workflowCycle(
    p3Id,
    "delivery",
    "delivery_completed",
    new Date(now.getTime() - 1000 * 60 * 60 * 24 * 6),
    new Date(now.getTime() - 1000 * 60 * 60 * 24 * 4)
  );
  const p3Cycle3 = workflowCycle(
    p3Id,
    "customer",
    "customer_completed",
    new Date(now.getTime() - 1000 * 60 * 60 * 24 * 4),
    new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2)
  );

  return [
    {
      id: p1Id,
      title: "Enterprise CRM Modernization RFP",
      clientName: "Acme Corporation",
      description:
        "Modernize customer relationship management platform with AI-driven insights and omnichannel support.",
      status: "under_review",
      workflowStage: "proposal_review",
      currentCycleId: p1Cycle.id,
      dueDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14),
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 5),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 2),
      documents: [
        doc(
          p1Id,
          "rfp",
          "Acme_CRM_RFP_2026.pdf",
          "RFP: Seeking a cloud-native CRM solution with AI analytics, mobile app, and 99.9% SLA."
        ),
        doc(
          p1Id,
          "transcript",
          "Acme_Kickoff_Call.txt",
          "Attendees: John (Acme), Sarah (Vendor). Discussed timeline, budget, and integration requirements."
        ),
        doc(
          p1Id,
          "customer_doc",
          "Acme_Technical_Architecture.docx",
          "Current on-premise Salesforce integration and middleware stack overview."
        ),
      ],
      summary: "Strong enterprise fit. Need clarification on data residency requirements.",
      score: { compliance: 4, clarity: 5, feasibility: 4, value: 3, overall: 4 },
      comments: [
        comment(p1Id, "Reviewer A", "Compliance section is thorough but missing GDPR specifics."),
        comment(p1Id, "Reviewer B", "Pricing is competitive; validate implementation timeline."),
      ],
      workflowCycles: [p1Cycle],
      workflowEvents: [
        workflowEvent(
          p1Id,
          p1Cycle.id,
          "cycle_started",
          "proposal_review",
          p1Cycle.startedAt,
          "Proposal created and submitted for review"
        ),
      ],
    },
    {
      id: p2Id,
      title: "Cloud Infrastructure Managed Services",
      clientName: "Globex Industries",
      description: "Managed cloud services for production workloads across AWS and Azure with 24/7 support.",
      status: "submitted",
      workflowStage: "proposal_review",
      dueDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 21),
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 1),
      documents: [
        doc(
          p2Id,
          "rfp",
          "Globex_Cloud_RFP.pdf",
          "Request for managed Kubernetes, cost optimization, and security operations center."
        ),
      ],
      summary: "Awaiting preliminary review.",
      score: {},
      comments: [],
      workflowCycles: [],
      workflowEvents: [],
    },
    {
      id: p3Id,
      title: "Cybersecurity Assessment Proposal",
      clientName: "Stark Enterprises",
      description: "Comprehensive security posture assessment including penetration testing and compliance audit.",
      status: "approved",
      workflowStage: "approved",
      dueDate: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2),
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 6),
      documents: [
        doc(p3Id, "rfp", "Stark_Security_RFP.pdf", "Penetration testing, vulnerability management, and incident response retainer."),
        doc(p3Id, "customer_doc", "Stark_Compliance_Requirements.docx", "SOC 2 Type II, ISO 27001, and NIST alignment requirements."),
      ],
      summary: "Approved by security committee. Proceed to contract negotiation.",
      score: { compliance: 5, clarity: 5, feasibility: 5, value: 4, overall: 5 },
      comments: [comment(p3Id, "CISO", "Meets all critical security criteria. Approved.")],
      workflowCycles: [p3Cycle1, p3Cycle2, p3Cycle3],
      workflowEvents: [
        workflowEvent(p3Id, p3Cycle1.id, "cycle_started", "proposal_review", p3Cycle1.startedAt),
        workflowEvent(p3Id, p3Cycle1.id, "stage_changed", "proposal_final_review", new Date(p3Cycle1.startedAt.getTime() + 86400000 * 2)),
        workflowEvent(
          p3Id,
          p3Cycle1.id,
          "cycle_completed",
          "proposal_completed",
          p3Cycle1.completedAt!,
          "Proposal review completed"
        ),
        workflowEvent(p3Id, p3Cycle2.id, "cycle_started", "delivery_review", p3Cycle2.startedAt),
        workflowEvent(p3Id, p3Cycle2.id, "stage_changed", "delivery_final_review", new Date(p3Cycle2.startedAt.getTime() + 86400000)),
        workflowEvent(
          p3Id,
          p3Cycle2.id,
          "cycle_completed",
          "delivery_completed",
          p3Cycle2.completedAt!,
          "Delivery review completed"
        ),
        workflowEvent(p3Id, p3Cycle3.id, "cycle_started", "customer_review", p3Cycle3.startedAt),
        workflowEvent(p3Id, p3Cycle3.id, "stage_changed", "customer_final_review", new Date(p3Cycle3.startedAt.getTime() + 86400000)),
        workflowEvent(
          p3Id,
          p3Cycle3.id,
          "cycle_completed",
          "customer_completed",
          p3Cycle3.completedAt!,
          "Customer review completed"
        ),
      ],
    },
    {
      id: p4Id,
      title: "Digital Banking Platform RFP",
      clientName: "Wayne Financial",
      description: "Next-generation digital banking platform with mobile-first experience and open banking APIs.",
      status: "draft",
      workflowStage: "intake",
      dueDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30),
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 12),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 6),
      documents: [],
      summary: "",
      score: {},
      comments: [],
      workflowCycles: [],
      workflowEvents: [],
    },
  ];
}
