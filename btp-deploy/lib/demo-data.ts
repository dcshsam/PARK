import type { Proposal, UploadedFile, Comment, WorkflowCycle, WorkflowEvent, TeamActivity, Lead } from "./types";

const now = new Date();
const DAY = 86400000;

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
  iteration = 0
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

function teamActivity(
  memberName: string,
  title: string,
  category: TeamActivity["category"],
  startDayOffset: number,
  endDayOffset: number,
  notes?: string
): TeamActivity {
  return {
    id: crypto.randomUUID(),
    memberName,
    title,
    category,
    startDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * startDayOffset),
    endDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * endDayOffset),
    notes,
  };
}

// ── Sample leads (Proposal Master) ──────────────────────────────────────────

interface SampleLeadOpts {
  name: string;
  kytesId: string;
  client: string;
  gtm: string;
  vertical: string;
  type: string;
  region: string;
  mentor?: string;
  reviewer?: string;
  hg: "Hot" | "Warm" | "Cold";
  receivedVia?: Lead["receivedVia"];
  status: Lead["status"];
  /** Current event (1-8) the lead has reached. */
  event: number;
  createdDaysAgo: number;
  summary: string;
  pitchResponse?: "awaiting" | "accepted" | "revision_requested" | "declined";
  retroOutcome?: "won" | "lost" | "on_hold";
}

function sampleLead(opts: SampleLeadOpts): Lead {
  const createdAt = new Date(now.getTime() - opts.createdDaysAgo * DAY);
  // Space the completed-event checkpoints evenly across the lead's lifetime.
  const step = Math.max(1, Math.floor(opts.createdDaysAgo / (opts.event + 1)));
  const eventDate = (n: number) => new Date(createdAt.getTime() + n * step * DAY);

  const eventData: Record<string, unknown> = {};
  // Events 1-4 record completedAt checkpoints as they are passed.
  for (let n = 1; n <= Math.min(opts.event - 1, 4); n++) {
    eventData[`event${n}`] = { completedAt: eventDate(n) };
  }
  // Event 7 — Customer Pitch & Feedback (recorded once the lead reaches Event 8).
  if (opts.event >= 8) {
    const pitchDate = eventDate(6);
    eventData.event7 = {
      startDate: pitchDate.toISOString().split("T")[0],
      endDate: new Date(pitchDate.getTime() + DAY).toISOString().split("T")[0],
      mode: "hybrid",
      presentedBy: opts.mentor ?? opts.gtm,
      attendees: "CIO, Head of Procurement",
      meetingFeedback: "Pitch went well; pricing and timeline questions dominated the discussion.",
      response: opts.pitchResponse ?? "awaiting",
      responseNotes: "Customer to confirm after internal budget review.",
      nextSteps: "Share revised commercial annexure and reference case studies.",
      completedAt: eventDate(7),
    };
  }
  // Event 8 — Proposal Retro & Wrap for decided leads.
  if (opts.retroOutcome) {
    eventData.event8 = {
      outcome: opts.retroOutcome,
      wentWell: "Strong discovery notes and quick review turnarounds.",
      improve: "Start numerical validation earlier in the cycle.",
      learnings: "Reusable estimation template captured for the next pursuit.",
      completedAt: eventDate(8),
    };
  }

  return {
    id: crypto.randomUUID(),
    leadName: opts.name,
    kytesId: opts.kytesId,
    receivedVia: opts.receivedVia ?? "email",
    hgStatus: opts.hg,
    date: createdAt,
    gtmName: opts.gtm,
    vertical: opts.vertical,
    leadType: opts.type,
    requirementSummary: opts.summary,
    clientName: opts.client,
    sparcMentor: opts.mentor,
    proposalReviewer: opts.reviewer,
    proposalRegion: opts.region,
    documents: [],
    status: opts.status,
    currentEvent: opts.event,
    eventData,
    createdAt,
    updatedAt: new Date(now.getTime() - Math.min(opts.createdDaysAgo, 3) * DAY + 3600000),
  };
}

function seedDemoLeads(): Lead[] {
  return [
    sampleLead({ name: "S/4HANA Greenfield Rollout", kytesId: "KYT-1001", client: "Acme Corporation", gtm: "Mark Liu", vertical: "SAP", type: "Solution", region: "North America", mentor: "Jane Doe", reviewer: "Sumit Kumar", hg: "Hot", status: "converted", event: 8, createdDaysAgo: 90, summary: "Full greenfield S/4HANA implementation across three plants.", pitchResponse: "accepted", retroOutcome: "won" }),
    sampleLead({ name: "Managed Cloud Ops Retainer", kytesId: "KYT-1002", client: "Globex Industries", gtm: "Priya Nair", vertical: "Cloud", type: "Consulting", region: "Europe", mentor: "Carlos Rivera", reviewer: "Pratyush Raul", hg: "Hot", status: "converted", event: 8, createdDaysAgo: 75, summary: "24/7 managed operations for AWS and Azure production workloads.", pitchResponse: "accepted", retroOutcome: "won" }),
    sampleLead({ name: "Legacy CRM Replacement", kytesId: "KYT-1003", client: "Initech LLC", gtm: "Tom Nguyen", vertical: "Non-SAP", type: "Proposal", region: "North America", mentor: "Lisa Chen", hg: "Warm", status: "dropped", event: 8, createdDaysAgo: 60, summary: "Replace on-premise CRM with a composable cloud suite.", pitchResponse: "declined", retroOutcome: "lost" }),
    sampleLead({ name: "Retail Analytics Platform", kytesId: "KYT-1004", client: "Duff Retail Group", gtm: "Sofia Marquez", vertical: "Data & AI", type: "Solution", region: "Latin America", mentor: "Aisha Patel", reviewer: "Sumit Kumar", hg: "Hot", status: "converted", event: 8, createdDaysAgo: 55, summary: "Customer-360 analytics with demand forecasting models.", pitchResponse: "accepted", retroOutcome: "won" }),
    sampleLead({ name: "BTP Integration Suite Pilot", kytesId: "KYT-1005", client: "Stark Enterprises", gtm: "Mark Liu", vertical: "SAP", type: "Capability showcase", region: "Asia Pacific", mentor: "Jane Doe", reviewer: "Pratyush Raul", hg: "Hot", status: "proposal", event: 7, createdDaysAgo: 40, summary: "Integration suite pilot connecting SuccessFactors and S/4.", pitchResponse: "awaiting" }),
    sampleLead({ name: "Digital Banking Experience", kytesId: "KYT-1006", client: "Wayne Financial", gtm: "Ahmed Hassan", vertical: "Digital", type: "Solution", region: "Middle East & Africa", mentor: "Lisa Chen", reviewer: "Sumit Kumar", hg: "Hot", status: "proposal", event: 7, createdDaysAgo: 45, summary: "Mobile-first digital banking with open banking APIs." }),
    sampleLead({ name: "SAP AMS Transition", kytesId: "KYT-1007", client: "Umbrella Health", gtm: "Priya Nair", vertical: "SAP", type: "Consulting", region: "Europe", mentor: "Carlos Rivera", hg: "Warm", status: "proposal", event: 6, createdDaysAgo: 35, summary: "AMS transition covering ECC, BW and Fiori landscapes." }),
    sampleLead({ name: "Warehouse Automation Assessment", kytesId: "KYT-1008", client: "Nakatomi Trading", gtm: "Tom Nguyen", vertical: "SAP", type: "Assessment", region: "Asia Pacific", mentor: "Aisha Patel", reviewer: "Pratyush Raul", hg: "Warm", status: "proposal", event: 6, createdDaysAgo: 30, summary: "EWM fit-gap assessment for two distribution centers." }),
    sampleLead({ name: "GenAI Contract Intelligence", kytesId: "KYT-1009", client: "Vandelay Industries", gtm: "Sofia Marquez", vertical: "Data & AI", type: "Capability showcase", region: "North America", mentor: "Jane Doe", hg: "Hot", status: "proposal", event: 5, createdDaysAgo: 25, summary: "LLM-based contract clause extraction and risk scoring demo." }),
    sampleLead({ name: "Hybrid Cloud Landing Zone", kytesId: "KYT-1010", client: "Cyberdyne Systems", gtm: "Mark Liu", vertical: "Cloud", type: "Solution", region: "North America", mentor: "Carlos Rivera", reviewer: "Sumit Kumar", hg: "Hot", status: "proposal", event: 5, createdDaysAgo: 28, summary: "Secure landing zone with policy-as-code guardrails." }),
    sampleLead({ name: "Field Service Mobility", kytesId: "KYT-1011", client: "Aperture Utilities", gtm: "Ahmed Hassan", vertical: "Digital", type: "Solution", region: "Middle East & Africa", mentor: "Lisa Chen", hg: "Warm", status: "proposal", event: 5, createdDaysAgo: 22, summary: "Offline-capable field service app for 800 technicians." }),
    sampleLead({ name: "Finance Process Mining", kytesId: "KYT-1012", client: "Gringotts Capital", gtm: "Priya Nair", vertical: "Data & AI", type: "Assessment", region: "Europe", mentor: "Aisha Patel", hg: "Warm", status: "proposal", event: 4, createdDaysAgo: 18, summary: "P2P and O2C process mining with remediation roadmap." }),
    sampleLead({ name: "Sustainability Reporting (CSRD)", kytesId: "KYT-1013", client: "Wonka Foods", gtm: "Sofia Marquez", vertical: "SAP", type: "Consulting", region: "Europe", mentor: "Jane Doe", reviewer: "Pratyush Raul", hg: "Warm", status: "qualified", event: 4, createdDaysAgo: 15, summary: "CSRD-aligned sustainability reporting on SAP Sustainability Control Tower." }),
    sampleLead({ name: "Supply Chain Control Tower", kytesId: "KYT-1014", client: "Tyrell Logistics", gtm: "Tom Nguyen", vertical: "SAP", type: "Solution", region: "Asia Pacific", mentor: "Carlos Rivera", hg: "Hot", status: "qualified", event: 3, createdDaysAgo: 12, summary: "Real-time supply chain visibility across 14 markets." }),
    sampleLead({ name: "Customer Data Platform PoC", kytesId: "KYT-1015", client: "Hooli Media", gtm: "Mark Liu", vertical: "Digital", type: "Capability showcase", region: "North America", mentor: "Lisa Chen", hg: "Warm", status: "qualified", event: 3, createdDaysAgo: 10, summary: "CDP proof of concept unifying web, app and CRM signals.", receivedVia: "meeting" }),
    sampleLead({ name: "ERP Health Check", kytesId: "KYT-1016", client: "Soylent Foods", gtm: "Priya Nair", vertical: "SAP", type: "Assessment", region: "Latin America", mentor: "Aisha Patel", hg: "Cold", status: "qualified", event: 2, createdDaysAgo: 8, summary: "Performance and custom-code health check for ECC 6.0." }),
    sampleLead({ name: "Data Lakehouse Modernization", kytesId: "KYT-1017", client: "Massive Dynamic", gtm: "Sofia Marquez", vertical: "Data & AI", type: "Solution", region: "North America", mentor: "Jane Doe", hg: "Warm", status: "new", event: 2, createdDaysAgo: 6, summary: "Migrate Hadoop estate to a governed lakehouse architecture.", receivedVia: "meeting" }),
    sampleLead({ name: "Commerce Replatforming", kytesId: "KYT-1018", client: "Pied Piper Retail", gtm: "Ahmed Hassan", vertical: "Digital", type: "Proposal", region: "Middle East & Africa", hg: "Cold", status: "new", event: 1, createdDaysAgo: 4, summary: "Headless commerce replatform with composable storefront." }),
    sampleLead({ name: "HR Cloud Transformation", kytesId: "KYT-1019", client: "Oscorp Industries", gtm: "Tom Nguyen", vertical: "SAP", type: "Solution", region: "Asia Pacific", hg: "Warm", status: "new", event: 1, createdDaysAgo: 2, summary: "SuccessFactors suite rollout for 12,000 employees.", receivedVia: "other" }),
    sampleLead({ name: "Predictive Maintenance AI", kytesId: "KYT-1020", client: "Sirius Cybernetics", gtm: "Mark Liu", vertical: "Data & AI", type: "Capability showcase", region: "Europe", mentor: "Carlos Rivera", hg: "Warm", status: "on_hold", event: 8, createdDaysAgo: 50, summary: "IoT-driven predictive maintenance for turbine fleet.", pitchResponse: "revision_requested", retroOutcome: "on_hold" }),
    sampleLead({ name: "Procurement Spend Analytics", kytesId: "KYT-1021", client: "Initrode Global", gtm: "Priya Nair", vertical: "Data & AI", type: "Assessment", region: "Europe", mentor: "Aisha Patel", hg: "Cold", status: "on_hold", event: 4, createdDaysAgo: 20, summary: "Ariba spend classification and savings opportunity analysis." }),
    sampleLead({ name: "Plant Maintenance Mobile Rollout", kytesId: "KYT-1022", client: "Buy n Large Mfg", gtm: "Sofia Marquez", vertical: "SAP", type: "Solution", region: "Latin America", hg: "Cold", status: "dropped", event: 3, createdDaysAgo: 26, summary: "Asset Manager rollout paused after budget freeze." }),
  ];
}

export function seedDemoData(): { proposals: Proposal[]; teamActivities: TeamActivity[]; leads: Lead[] } {
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

  const activities: TeamActivity[] = [
    teamActivity("Pratyush Raul", "Customer - VWG", "customer", 0, 18, "Customer engagement and weekly sync"),
    teamActivity("Pratyush Raul", "Capability Showcase", "capability", 5, 25, "Internal capability demo preparation"),
    teamActivity("Pratyush Raul", "Customer Demo - Stark", "customer", 7, 25, "Customer demonstration and follow-up"),
    teamActivity("Sumit Kumar", "Betnley - SAP Assessment", "assessment", 5, 39, "SAP assessment and recommendation"),
    teamActivity("Sumit Kumar", "Idea - Code remediation", "idea", 0, 11, "Refactor and remediation initiative"),
    teamActivity("Sumit Kumar", "Acme CRM Solution Design", "capability", 2, 12, "Solution design for CRM modernization"),
    teamActivity("Sumit Kumar", "Globex Cloud Cost Review", "assessment", -3, 8, "Cost optimization and workload review"),
    teamActivity("Sumit Kumar", "Wayne Financial Architecture Workshop", "idea", 8, 22, "Architecture workshop for digital banking"),
    teamActivity("Sumit Kumar", "Internal Sprint Planning", "internal", -1, 4, "Sprint planning and backlog grooming"),
    teamActivity("Sumit Kumar", "Stark Security Remediation", "customer", 12, 28, "Security remediation and validation"),
    teamActivity("Sumit Kumar", "Customer Workshop - Acme", "customer", -7, 2, "Customer workshop and requirement gathering"),
    teamActivity("Sumit Kumar", "BTP Integration Review", "assessment", 14, 30, "BTP integration feasibility review"),
    teamActivity("Sumit Kumar", "Capability Demo - Fiori", "capability", 20, 35, "Fiori capability demonstration"),
    teamActivity("Sumit Kumar", "Post-Sales Support Planning", "internal", 25, 40, "Post-sales support and handover planning"),
    teamActivity("Aisha Patel", "Stark Security Review", "assessment", -5, 14, "Security posture review"),
    teamActivity("Aisha Patel", "Wayne Financial Compliance Review", "assessment", 1, 15, "Compliance gap analysis"),
    teamActivity("Carlos Rivera", "Globex Cloud Migration", "customer", 10, 45, "Cloud managed services delivery"),
    teamActivity("Carlos Rivera", "Globex Migration Kickoff", "customer", 3, 20, "Migration kickoff and stakeholder alignment"),
    teamActivity("Lisa Chen", "Wayne Financial POC", "idea", 15, 40, "Digital banking proof of concept"),
    teamActivity("Lisa Chen", "Digital Banking API Design", "idea", 5, 18, "API design for open banking platform"),
  ];

  return {
    proposals: [
      {
        id: p1Id,
        title: "Enterprise CRM Modernization RFP",
      clientName: "Acme Corporation",
      description:
        "Modernize customer relationship management platform with AI-driven insights and omnichannel support.",
      status: "under_review",
      workflowStage: "proposal_review",
      currentCycleId: p1Cycle.id,
      technology: "SAP CX",
      sparcOwner: "Jane Doe",
      gtmOwner: "Mark Liu",
      proposalRegion: "NA",
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
      technology: "BTP / AWS",
      sparcOwner: "Carlos Rivera",
      gtmOwner: "Priya Nair",
      proposalRegion: "EMEA",
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
      technology: "SAP GRC",
      sparcOwner: "Aisha Patel",
      gtmOwner: "Tom Nguyen",
      proposalRegion: "APJ",
      dueDate: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2),
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 6),
      documents: [
        doc(p3Id, "rfp", "Stark_Security_RFP.pdf", "Penetration testing, vulnerability management, and incident response retainer."),
        doc(p3Id, "customer_doc", "Stark_Compliance_Requirements.docx", "SOC 2 Type II, ISO 27001, and NIST alignment requirements."),
      ],
      summary: "Approved by security committee. Proceed to contract negotiation.",
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
      technology: "SAP Fioneer",
      sparcOwner: "Lisa Chen",
      gtmOwner: "Ahmed Hassan",
      proposalRegion: "MEA",
      dueDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30),
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 12),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 6),
      documents: [],
      summary: "",
      comments: [],
      workflowCycles: [],
      workflowEvents: [],
    },
    ],
    teamActivities: activities,
    leads: seedDemoLeads(),
  };
}
