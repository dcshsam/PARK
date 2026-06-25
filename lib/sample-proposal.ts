import type { DocumentCategory, UploadedFile } from "./types";

export const sampleProposal = {
  title: "Enterprise CRM Modernization",
  clientName: "Acme Corporation",
  description:
    "Acme wants to replace its legacy on-premise CRM with a cloud-native SAP solution to improve sales productivity, customer visibility, and reporting.",
  technology: "SAP Sales Cloud",
  projectType: "Implementation",
  proposalRegion: "North America",
};

const sampleRfpText = `REQUEST FOR PROPOSAL
Enterprise CRM Modernization
Client: Acme Corporation

1. Background
Acme Corporation is a leading industrial equipment manufacturer with 2,500 employees across 12 countries. Our current CRM is a 10-year-old on-premise system that is difficult to maintain and does not support mobile access.

2. Objectives
- Improve sales productivity by 25% within 12 months of go-live.
- Provide a single, 360-degree view of customers across sales, service, and marketing.
- Enable real-time dashboards and forecasting for leadership.
- Replace manual quote processes with automated workflows.

3. Scope
- SAP Sales Cloud implementation.
- Integration with SAP ERP, Microsoft Outlook, and LinkedIn Sales Navigator.
- Data migration from legacy CRM.
- User training and change management.
- Post-go-live support for 12 months.

4. Timeline
Project must be completed within 6 months of contract signing.

5. Compliance
- Vendor must have at least 5 years of SAP Sales Cloud experience.
- Solution must be GDPR and SOC 2 compliant.
- All deliverables must include documentation and knowledge transfer.`;

const sampleTranscriptText = `Meeting Transcript – Acme Corp CRM Discovery
Attendees: John Smith (Acme CIO), Sarah Lee (Acme Sales Director), Vendor Account Team

John: We are looking for a partner who can move fast and has done this before.
Sarah: My team spends too much time re-entering data. We need automation and mobile access.
John: Budget is approved for a 6-month implementation. We need go-live before the next fiscal year.
Sarah: Reporting is critical. Leadership wants to see pipeline health every Monday morning.
John: We will evaluate proposals on experience, timeline confidence, and total cost of ownership.
Sarah: Please include references from similar manufacturing clients.`;

const sampleCustomerDocText = `Acme Corporation – Customer Context Document

Industry: Industrial Equipment Manufacturing
Employees: 2,500
Countries: 12
Current CRM: Legacy on-premise, 10 years old
Key Pain Points:
- No mobile access for field sales
- Manual quote creation causing delays
- Poor visibility into pipeline and forecasts
- Duplicate customer records across systems

Decision Criteria:
1. Proven SAP Sales Cloud expertise
2. Realistic 6-month implementation plan
3. Strong integration capabilities
4. Comprehensive training program
5. Competitive total cost of ownership

Compliance Requirements:
- GDPR compliant data handling
- SOC 2 Type II certification
- Role-based access control
- Audit logging for all customer data changes`;

const sampleFinalProposalText = `Customer Final Proposal
Enterprise CRM Modernization for Acme Corporation

Executive Summary
We propose implementing SAP Sales Cloud to modernize Acme's CRM landscape. Our team has delivered 20+ SAP Sales Cloud projects for manufacturing clients, including two Fortune 500 industrial equipment companies.

Our Approach
- Phase 1: Discovery and design (4 weeks)
- Phase 2: Configuration and integration (12 weeks)
- Phase 3: Data migration and testing (6 weeks)
- Phase 4: Training and go-live (4 weeks)
- Phase 5: Hypercare and support (12 weeks)

Key Deliverables
- SAP Sales Cloud configured for Acme's sales processes
- Integration with SAP ERP for customer master and order data
- Outlook and LinkedIn Sales Navigator integration
- Real-time dashboards for pipeline, forecast, and activity
- Automated quote generation workflow
- Data migration from legacy CRM
- End-user training and admin certification

Team
- 1 SAP Sales Cloud Solution Architect
- 2 Functional Consultants
- 1 Integration Developer
- 1 Data Migration Specialist
- 1 Change Management Lead

Timeline
Total project duration: 6 months from contract signature.

Compliance
Our solution is GDPR and SOC 2 compliant. We provide role-based access control, audit logging, and encrypted data at rest and in transit.

Investment
Total cost of ownership for the implementation is competitive and includes software licensing, implementation services, training, and 12 months of support.

Next Steps
Upon acceptance, we will kick off the project within two weeks and finalize the detailed project plan.`;

export const sampleFinalProposalV2Text = `Customer Final Proposal – Version 2
Enterprise CRM Modernization for Acme Corporation

Executive Summary
Acme Corporation seeks to replace its legacy, on-premise CRM with a cloud-native SAP Sales Cloud solution. This proposal addresses Acme's specific requirements: improving sales productivity by 25%, delivering a 360-degree customer view, enabling real-time leadership dashboards, and automating quote generation. Our team brings 20+ SAP Sales Cloud implementations for industrial manufacturing clients, including two Fortune 500 equipment manufacturers, and will deliver the project within Acme's 6-month deadline.

Business Context & Understanding
Acme operates in 12 countries with 2,500 employees. Current pain points include lack of mobile CRM access, manual quote processes, poor pipeline visibility, and duplicate customer records. This proposal directly addresses each pain point with specific SAP capabilities.

Scope of Work
In-scope:
- SAP Sales Cloud implementation and configuration
- Integration with SAP ERP (customer master, order data)
- Microsoft Outlook and LinkedIn Sales Navigator integration
- Legacy CRM data migration, deduplication, and cleansing
- Role-based security and audit logging
- End-user training and administrator certification
- 12 months post-go-live support

Out-of-scope:
- SAP ERP core module changes
- Third-party marketing automation platform implementation
- Hardware procurement

Approach & Timeline
- Phase 1: Discovery and design (Weeks 1-4)
- Phase 2: Configuration and integration (Weeks 5-16)
- Phase 3: Data migration and testing (Weeks 17-22)
- Phase 4: Training and go-live (Weeks 23-26)
- Phase 5: Hypercare and support (Weeks 27-38)

Total project duration: 6 months from contract signature, with go-live before the next fiscal year.

SAP Modules & Functional Fit
- SAP Sales Cloud (primary)
- SAP ERP integration via released APIs (Clean Core aligned)
- SAP Analytics Cloud for leadership dashboards
- Side-by-side extensions using SAP BTP for custom quote workflows

Team & Governance
- 1 SAP Sales Cloud Solution Architect
- 2 Functional Consultants (Sales, Service)
- 1 Integration Developer
- 1 Data Migration Specialist
- 1 Change Management Lead
- Bi-weekly steering committee reviews with Acme leadership

Compliance & Security
- GDPR compliant data handling and retention policies
- SOC 2 Type II certified hosting
- Role-based access control (RBAC)
- Full audit logging for all customer data access and changes
- End-to-end encryption at rest and in transit

Value Proposition & ROI
- 25% improvement in sales productivity within 12 months
- 30% reduction in quote creation time through automation
- Improved forecast accuracy via real-time pipeline dashboards
- Reduced IT maintenance cost by moving from on-premise to cloud

Investment
Total cost of ownership includes SAP Sales Cloud licensing, implementation services, data migration, training, and 12 months of support. Detailed cost breakdown is available in Appendix A.

Risks & Mitigation
- Data quality risk: Mitigated through dedicated data migration phase with validation checkpoints.
- Adoption risk: Mitigated through comprehensive change management and training program.
- Timeline risk: Mitigated via agile sprint planning and dedicated project governance.

References
- Similar manufacturing client A: 6-month SAP Sales Cloud rollout, 20% productivity gain.
- Similar manufacturing client B: Global rollout across 15 countries.

Next Steps
Upon acceptance, we will kick off the project within two weeks, finalize the detailed project plan, and schedule the discovery workshops.`;

function createSampleDoc(
  category: DocumentCategory,
  fileName: string,
  text: string
): Omit<UploadedFile, "id" | "proposalId" | "uploadedAt"> {
  return {
    category,
    name: fileName,
    size: new Blob([text]).size,
    mimeType: "text/plain",
    content: btoa(unescape(encodeURIComponent(text))),
    extractedText: text,
  };
}

export const sampleDocuments: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[] = [
  createSampleDoc("rfp", "Sample_RFP_Document.pdf", sampleRfpText),
  createSampleDoc("transcript", "Sample_Meeting_Transcript.pdf", sampleTranscriptText),
  createSampleDoc("customer_doc", "Sample_Customer_Context.pdf", sampleCustomerDocText),
  createSampleDoc("final_proposal", "Sample_Customer_Final_Proposal.pdf", sampleFinalProposalText),
];
