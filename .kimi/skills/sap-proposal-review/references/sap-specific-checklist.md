# SAP-Specific Proposal Review Checklist

Use this checklist when reviewing SAP implementation, migration, BTP, or RISE proposals.

## 1. Clean Core & Extensibility

- [ ] Does the proposal explain how custom code and modifications will be minimized or retired?
- [ ] Is there a clear disposition for existing custom objects (remediate / replace with standard / retire / move to BTP)?
- [ ] Are extensions planned on SAP BTP using CAP, RAP, or low-code/no-code tools rather than core modifications?
- [ ] Is there a plan for handling SPAU/SPDD and custom-code adaptation during upgrades?

## 2. Deployment Model

- [ ] Is the target deployment explicit (S/4HANA Cloud Public Edition, Private Edition, on-premise, hybrid, RISE with SAP)?
- [ ] Does the proposal address release cadence, update strategy, and downtime windows?
- [ ] Is the landscape strategy documented (DEV, QA, PRE-PROD, PROD, sandbox)?
- [ ] Are sizing and infrastructure requirements stated?

## 3. Migration Approach

- [ ] Is the migration path clear (greenfield, brownfield, selective data transition, landscape transformation)?
- [ ] Does it include a readiness assessment, custom-code analysis, and simplification-item review?
- [ ] Are data-migration tools specified (LTMC, LSMW, S/4HANA DMIS, SAP Data Migration Cockpit, third-party)?
- [ ] Is there a cutover and rollback plan with mock cutover testing?

## 4. Integration Architecture

- [ ] Are all inbound/outbound interfaces and systems inventoried?
- [ ] Does the proposal use SAP Integration Suite, CPI, API Management, or event-driven architecture?
- [ ] Are OData/REST APIs, IDocs, RFCs, and BAPIs described with ownership?
- [ ] Is there a plan for third-party and non-SAP integrations?

## 5. Licensing & Commercial

- [ ] Are SAP licenses, RISE subscription, and BTP credits clearly itemized?
- [ ] Does the proposal address indirect access / digital access licensing risk?
- [ ] Are professional services, training, support, and infrastructure costs separated?
- [ ] Is there clarity on what is fixed vs. variable cost?

## 6. Security & Compliance

- [ ] Are identity and access management (IAS/IPS), SSO, and role design covered?
- [ ] Is segregation of duties (SoD) and GRC considered?
- [ ] Does the proposal address GDPR, SOX, HIPAA, or other relevant regulations?
- [ ] Are audit logging and transport governance included?

## 7. Testing & Quality Assurance

- [ ] Is there a test strategy covering unit, integration, regression, data-migration, performance, security, and UAT?
- [ ] Are tools and responsibilities defined (SAP Solution Manager, Tricentis, CBTA, manual)?
- [ ] Is there a defect-management and sign-off process?

## 8. Change Management & Adoption

- [ ] Is there a stakeholder-engagement and communications plan?
- [ ] Are role-based training, Fiori adoption support, and hypercare defined?
- [ ] Is there a plan for business-process redesign and standardization?

## 9. AI & Innovation

- [ ] Does the proposal leverage SAP Joule, SAP AI Core, or other AI/GenAI capabilities where relevant?
- [ ] Are automation opportunities (Build Process Automation, Workflow Management) identified?
- [ ] Is there a roadmap for analytics, SAC, or Datasphere integration?

## 10. Delivery Governance

- [ ] Are project phases, milestones, and deliverables clearly defined?
- [ ] Is there a RACI, steering committee, and escalation path?
- [ ] Are key assumptions, dependencies, and constraints documented?
- [ ] Is there a plan for reference visits and checkpoint demos?
