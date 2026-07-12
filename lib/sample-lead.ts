// Sample data for the Lead Master intake roadmap — fills Events 1-3 (Lead
// Initiation, Pre-Qualification, Due Diligence) in one click, mirroring the
// "Load sample proposal" helper in lib/sample-proposal.ts. Uses the same Acme
// Corporation story so the sample proposal and sample lead line up.

import type { LeadDocumentCategory, UploadedFile } from "./types";

const DAY = 86400000;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString().split("T")[0];
}

// ── Event 1 — Lead Initiation ────────────────────────────────────────────────

export const sampleLeadBasics = {
  leadName: "Acme Corp — CRM Modernization",
  clientName: "Acme Corporation",
  kytesId: "KYT-2026-0042",
  receivedVia: "email" as const,
  hgStatus: "Hot",
  vertical: "SAP",
  leadType: "Proposal",
  date: isoDaysAgo(14),
  requirementSummary:
    "Acme Corporation wants to replace its 10-year-old on-premise CRM with a cloud-native SAP Sales Cloud solution. Key expectations: 25% sales productivity improvement within 12 months, a 360-degree customer view across sales/service/marketing, real-time leadership dashboards, automated quote workflows, and a 6-month implementation completed before their next fiscal year. Compliance requirements include GDPR and SOC 2.",
};

const sampleMailText = `From: john.smith@acmecorp.com
To: sales@ourcompany.com
Subject: RFP — Enterprise CRM Modernization

Hi team,

Following our call last week, please find attached our RFP for the CRM modernization initiative. A quick summary of what we are looking for:

- Replace our legacy on-premise CRM (10 years old, no mobile access) with SAP Sales Cloud.
- Go-live within 6 months of contract signing — this must land before our next fiscal year.
- Integration with SAP ERP, Microsoft Outlook, and LinkedIn Sales Navigator.
- Data migration from the legacy CRM, including deduplication of customer records.
- Real-time pipeline dashboards for our leadership team — they want pipeline health every Monday morning.

We will evaluate proposals on SAP Sales Cloud experience (minimum 5 years), timeline confidence, and total cost of ownership. Please include references from similar manufacturing clients.

Best regards,
John Smith
CIO, Acme Corporation`;

const sampleMomText = `Minutes of Meeting — Acme Corp CRM Discovery Call
Date: ${isoDaysAgo(12)}
Attendees: John Smith (Acme CIO), Sarah Lee (Acme Sales Director), GTM & Presales team

Key points discussed:
1. Current CRM is a 10-year-old on-premise system; field sales has no mobile access.
2. Sarah's team loses significant time re-entering data — automation is a top expectation.
3. Budget is approved for a 6-month implementation; go-live must precede the next fiscal year.
4. Leadership expects real-time reporting: pipeline health review every Monday morning.
5. Evaluation criteria: proven SAP Sales Cloud experience, timeline confidence, TCO.
6. Acme requests references from similar industrial manufacturing clients.

Actions:
- Our side: prepare pre-qualification assessment and due diligence plan.
- Acme: share customer context document and integration landscape details.`;

const sampleDiscussionText = `Internal Discussion Notes — Acme CRM Opportunity
Date: ${isoDaysAgo(11)}

- Strong fit with our SAP Sales Cloud practice (20+ implementations, 2 Fortune 500 manufacturers).
- 6-month timeline is aggressive but achievable with a phased approach and early data-migration start.
- Integration scope (SAP ERP, Outlook, LinkedIn Sales Navigator) is well within our delivery experience.
- Risks: legacy data quality (duplicate customer records), change management for 2,500 users across 12 countries.
- Decision: pursue. Assign due diligence — discovery call with CTO, landscape analysis, integration workshop.`;

const sampleCustomerDocText = `Acme Corporation — Customer Context Document

Industry: Industrial Equipment Manufacturing
Employees: 2,500
Countries: 12
Current CRM: Legacy on-premise, 10 years old

Key Pain Points:
- No mobile access for field sales
- Manual quote creation causing delays
- Poor visibility into pipeline and forecasts
- Duplicate customer records across systems

Customer Expectations:
1. 25% sales productivity improvement within 12 months of go-live
2. Single 360-degree customer view across sales, service, and marketing
3. Real-time dashboards and forecasting for leadership
4. Automated quote workflows replacing manual processes
5. Go-live within 6 months of contract signing

Decision Criteria:
1. Proven SAP Sales Cloud expertise (5+ years)
2. Realistic 6-month implementation plan
3. Strong integration capabilities (SAP ERP, Outlook, LinkedIn Sales Navigator)
4. Comprehensive training program
5. Competitive total cost of ownership

Compliance Requirements:
- GDPR compliant data handling
- SOC 2 Type II certification
- Role-based access control
- Audit logging for all customer data changes`;

const samplePreQualFormText = `Pre-Qualification Assessment — Acme Corp CRM Modernization
Date: ${isoDaysAgo(10)}

1. Budget confirmed? YES — approved for a 6-month implementation.
2. Decision timeline clear? YES — vendor selection within 4 weeks, go-live before next fiscal year.
3. Access to decision makers? YES — CIO (John Smith) and Sales Director (Sarah Lee) engaged directly.
4. Technical fit? STRONG — SAP Sales Cloud is our core practice; all integrations previously delivered.
5. Competitive position? FAVORABLE — references from manufacturing clients available; incumbent has no SAP practice.
6. Compliance feasibility? YES — GDPR / SOC 2 supported by our standard delivery framework.

Recommendation: QUALIFIED — proceed to due diligence.`;

function createLeadDoc(
  category: LeadDocumentCategory,
  name: string,
  text: string
): Omit<UploadedFile, "id" | "proposalId" | "uploadedAt"> {
  return {
    category,
    name,
    size: new Blob([text]).size,
    mimeType: "text/plain",
    content: btoa(unescape(encodeURIComponent(text))),
    extractedText: text,
  };
}

export const sampleLeadDocuments: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[] = [
  createLeadDoc("lead_mail", "Acme_RFP_Cover_Mail.txt", sampleMailText),
  createLeadDoc("lead_mom", "Acme_Discovery_Call_MoM.txt", sampleMomText),
  createLeadDoc("lead_discussion", "Acme_Internal_Discussion_Notes.txt", sampleDiscussionText),
  createLeadDoc("lead_customer_doc", "Acme_Customer_Context.txt", sampleCustomerDocText),
  createLeadDoc("lead_pre_qual_form", "Acme_PreQualification_Form.txt", samplePreQualFormText),
];

// ── Event 2 — Pre-Qualification ─────────────────────────────────────────────

export const sampleLeadPreQual = {
  preQualified: "yes",
  comments:
    "Qualified: budget approved, decision makers engaged, strong technical fit with our SAP Sales Cloud practice, and a favorable competitive position. Aggressive 6-month timeline flagged as the main risk — mitigated by a phased approach starting data migration early.",
};

// ── Event 3 — Due Diligence ─────────────────────────────────────────────────

/** Fresh copies each call so edits to one loaded set don't leak into the next. */
export function buildSampleDueDiligenceItems() {
  return [
    {
      id: crypto.randomUUID(),
      type: "meeting" as const,
      title: "Discovery call with Acme CIO & Sales Director",
      startDate: isoDaysAgo(9),
      endDate: isoDaysAgo(9),
      status: "completed" as const,
      pauseReason: "",
      conductedBy: "GTM & Presales team",
      summary:
        "Confirmed pain points (no mobile access, manual quotes, poor pipeline visibility) and expectations: 25% productivity gain, Monday-morning pipeline dashboards, 6-month go-live. Leadership sponsorship is strong.",
      attachments: [],
    },
    {
      id: crypto.randomUUID(),
      type: "analysis" as const,
      title: "Legacy CRM landscape & data quality analysis",
      startDate: isoDaysAgo(8),
      endDate: isoDaysAgo(6),
      status: "completed" as const,
      pauseReason: "",
      conductedBy: "Solution Architecture",
      summary:
        "Reviewed the legacy CRM data model: ~40% duplicate customer records across 12 country instances. Data migration needs a dedicated deduplication and cleansing phase with validation checkpoints.",
      attachments: [],
    },
    {
      id: crypto.randomUUID(),
      type: "meeting" as const,
      title: "Integration workshop — SAP ERP, Outlook, LinkedIn",
      startDate: isoDaysAgo(5),
      endDate: isoDaysAgo(5),
      status: "completed" as const,
      pauseReason: "",
      conductedBy: "Integration Practice",
      summary:
        "Mapped integration touchpoints: customer master and order data from SAP ERP via released APIs (Clean Core aligned), Outlook calendar/mail sync, LinkedIn Sales Navigator embedded profiles. No blockers identified.",
      attachments: [],
    },
  ];
}
