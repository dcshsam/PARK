import type { Ruleset } from "./types";

export function getDefaultSapRuleset(): Ruleset {
  const now = new Date();
  return {
    id: "sap-default-ruleset",
    name: "SAP Proposal Review",
    description:
      "Default ruleset for reviewing SAP implementation, upgrade, and extension proposals. Evaluates business fit, SAP modules coverage, architecture, delivery approach, commercials, and risk.",
    isDefault: true,
    isSystem: true,
    createdAt: now,
    updatedAt: now,
    sections: [
      {
        id: "executive-summary",
        title: "Executive Summary & Understanding",
        description: "How well does the proposal understand the customer's business context and objectives?",
        weight: 0.1,
        subsections: [
          {
            id: "business-context",
            title: "Business Context",
            description: "Demonstrated understanding of the customer's industry, challenges, and strategic drivers.",
            weight: 0.6,
            criteria: [
              {
                id: "customer-understanding",
                title: "Customer Understanding",
                description: "Clear articulation of customer's current state, pain points, and desired outcomes.",
                type: "error",
                weight: 0.5,
                prompt:
                  "Rate how well the proposal demonstrates understanding of the customer's business, industry, and strategic objectives. Look for specific references to the customer's current challenges and goals.",
              },
              {
                id: "scope-clarity",
                title: "Scope Clarity",
                description: "Well-defined in-scope and out-of-scope boundaries.",
                type: "error",
                weight: 0.5,
                prompt:
                  "Evaluate whether the proposal clearly defines what is in scope and out of scope. Look for ambiguity, missing boundaries, or vague language.",
              },
            ],
          },
          {
            id: "value-proposition",
            title: "Value Proposition",
            description: "Articulated business value, ROI, and expected benefits.",
            weight: 0.4,
            criteria: [
              {
                id: "benefits-articulation",
                title: "Benefits Articulation",
                description: "Quantified or clearly described business benefits and outcomes.",
                type: "error",
                weight: 1,
                prompt:
                  "Rate the clarity and credibility of the proposed business benefits, ROI, and value realization approach.",
              },
            ],
          },
        ],
      },
      {
        id: "sap-modules",
        title: "SAP Modules & Functional Fit",
        description: "Coverage and depth of SAP functional modules and processes proposed.",
        weight: 0.2,
        subsections: [
          {
            id: "module-coverage",
            title: "Module Coverage",
            description: "Relevant SAP modules (FI, CO, MM, SD, PP, PM, QM, HR, etc.) are addressed.",
            weight: 0.5,
            criteria: [
              {
                id: "modules-addressed",
                title: "Modules Addressed",
                description: "Specific SAP modules and capabilities covered in the proposal.",
                type: "error",
                weight: 0.6,
                prompt:
                  "Evaluate whether the proposal explicitly addresses the SAP modules required by the RFP (e.g., FI, CO, MM, SD, PP, PM, QM, HCM). Note any missing modules.",
              },
              {
                id: "process-coverage",
                title: "Process Coverage",
                description: "Key business processes mapped to SAP capabilities.",
                type: "error",
                weight: 0.4,
                prompt:
                  "Rate how well the proposal maps customer business processes to SAP functionality (e.g., Order-to-Cash, Procure-to-Pay, Hire-to-Retire).",
              },
            ],
          },
          {
            id: "fit-gap",
            title: "Fit-to-Standard vs Customization",
            description: "Balance between standard SAP functionality and necessary customizations.",
            weight: 0.3,
            criteria: [
              {
                id: "clean-core-alignment",
                title: "Clean Core Alignment",
                description: "Proposal favors fit-to-standard and clean-core compliant extensions.",
                type: "error",
                weight: 1,
                prompt:
                  "Rate the proposal's alignment with SAP Clean Core principles. Does it favor fit-to-standard, released APIs, and side-by-side extensions over heavy modifications?",
              },
            ],
          },
          {
            id: "s4hana-readiness",
            title: "S/4HANA Readiness",
            description: "Relevance to SAP S/4HANA capabilities and migration considerations.",
            weight: 0.2,
            criteria: [
              {
                id: "s4hana-fit",
                title: "S/4HANA Fit",
                description: "Proposal addresses S/4HANA-specific features and migration path.",
                type: "error",
                weight: 1,
                prompt:
                  "Evaluate how well the proposal addresses SAP S/4HANA specific features, conversion considerations, or cloud deployment options.",
              },
            ],
          },
        ],
      },
      {
        id: "technical-architecture",
        title: "Technical Architecture & Integration",
        description: "Solution architecture, integration strategy, and technology choices.",
        weight: 0.2,
        subsections: [
          {
            id: "architecture",
            title: "Solution Architecture",
            description: "Clarity and soundness of the proposed SAP architecture.",
            weight: 0.5,
            criteria: [
              {
                id: "architecture-clarity",
                title: "Architecture Clarity",
                description: "Architecture diagrams, components, and deployment model are clear.",
                type: "error",
                weight: 0.5,
                prompt:
                  "Rate the clarity and completeness of the proposed SAP architecture including deployment model, environments, and core components.",
              },
              {
                id: "technology-choices",
                title: "Technology Choices",
                description: "Appropriate use of SAP BTP, RAP, CAP, Fiori, HANA, etc.",
                type: "error",
                weight: 0.5,
                prompt:
                  "Evaluate whether the proposed technology stack (SAP BTP, RAP, CAP, Fiori, HANA, Integration Suite, etc.) is appropriate and justified.",
              },
            ],
          },
          {
            id: "integration",
            title: "Integration Strategy",
            description: "Integration with existing SAP and non-SAP systems.",
            weight: 0.3,
            criteria: [
              {
                id: "integration-approach",
                title: "Integration Approach",
                description: "Clear integration patterns, middleware, APIs, and data flow.",
                type: "error",
                weight: 0.6,
                prompt:
                  "Rate the integration strategy. Are integration patterns, middleware (e.g., SAP Integration Suite), APIs, and data flows clearly described?",
              },
              {
                id: "legacy-considerations",
                title: "Legacy Considerations",
                description: "Handling of legacy system retirement, coexistence, or data migration.",
                type: "error",
                weight: 0.4,
                prompt:
                  "Evaluate how well the proposal addresses legacy system coexistence, retirement, and data migration.",
              },
            ],
          },
          {
            id: "security-compliance",
            title: "Security & Compliance",
            description: "Security, authorization, data privacy, and regulatory compliance.",
            weight: 0.2,
            criteria: [
              {
                id: "security-privacy",
                title: "Security & Privacy",
                description: "Security model, roles, authorizations, and data privacy.",
                type: "error",
                weight: 0.6,
                prompt:
                  "Rate the security and data privacy approach including roles, authorizations, encryption, and compliance with regulations like GDPR.",
              },
              {
                id: "sap-security-best-practices",
                title: "SAP Security Best Practices",
                description: "Alignment with SAP authorization and security recommendations.",
                type: "error",
                weight: 0.4,
                prompt:
                  "Evaluate alignment with SAP security best practices such as role-based access control, segregation of duties, and audit logging.",
              },
            ],
          },
        ],
      },
      {
        id: "delivery-approach",
        title: "Implementation Approach & Methodology",
        description: "Delivery methodology, governance, change management, and quality assurance.",
        weight: 0.15,
        subsections: [
          {
            id: "methodology",
            title: "Methodology",
            description: "SAP Activate, Agile, or hybrid methodology with clear phases.",
            weight: 0.4,
            criteria: [
              {
                id: "methodology-clarity",
                title: "Methodology Clarity",
                description: "Clear delivery methodology, phases, and deliverables.",
                type: "error",
                weight: 1,
                prompt:
                  "Rate the clarity of the implementation methodology (e.g., SAP Activate, Agile, hybrid) including phases, deliverables, and governance.",
              },
            ],
          },
          {
            id: "team-resources",
            title: "Team & Resources",
            description: "Proposed team structure, skills, and SAP expertise.",
            weight: 0.35,
            criteria: [
              {
                id: "team-structure",
                title: "Team Structure",
                description: "Roles, experience levels, and SAP certifications.",
                type: "error",
                weight: 0.6,
                prompt:
                  "Evaluate the proposed team structure, roles, SAP expertise, and certifications. Is the team appropriately sized and skilled?",
              },
              {
                id: "resource-continuity",
                title: "Resource Continuity",
                description: "Key personnel commitment and contingency planning.",
                type: "error",
                weight: 0.4,
                prompt:
                  "Rate the proposal's approach to resource continuity, key personnel commitment, and backup planning.",
              },
            ],
          },
          {
            id: "change-management",
            title: "Change & Training",
            description: "Change management, training, and adoption strategy.",
            weight: 0.25,
            criteria: [
              {
                id: "change-management-approach",
                title: "Change Management",
                description: "Communication, stakeholder engagement, and adoption plan.",
                type: "error",
                weight: 0.6,
                prompt:
                  "Rate the change management approach including stakeholder engagement, communication plan, and adoption strategy.",
              },
              {
                id: "training-enablement",
                title: "Training & Enablement",
                description: "Training plan, materials, and knowledge transfer.",
                type: "error",
                weight: 0.4,
                prompt:
                  "Evaluate the training and knowledge transfer plan for end users and the customer's IT team.",
              },
            ],
          },
        ],
      },
      {
        id: "timeline-milestones",
        title: "Timeline & Milestones",
        description: "Project schedule, phasing, and critical path.",
        weight: 0.1,
        subsections: [
          {
            id: "schedule",
            title: "Project Schedule",
            description: "Realistic timeline with clear milestones and dependencies.",
            weight: 1,
            criteria: [
              {
                id: "timeline-realism",
                title: "Timeline Realism",
                description: "Schedule is realistic and aligned with scope.",
                type: "error",
                weight: 0.5,
                prompt:
                  "Rate whether the proposed timeline is realistic given the scope, complexity, and SAP project norms.",
              },
              {
                id: "milestones-dependencies",
                title: "Milestones & Dependencies",
                description: "Clear milestones, dependencies, and go-live criteria.",
                type: "error",
                weight: 0.5,
                prompt:
                  "Evaluate the clarity of milestones, critical path, dependencies, and go-live readiness criteria.",
              },
            ],
          },
        ],
      },
      {
        id: "cost-commercial",
        title: "Cost & Commercial Terms",
        description: "Pricing structure, assumptions, and commercial clarity.",
        weight: 0.1,
        subsections: [
          {
            id: "pricing",
            title: "Pricing Structure",
            description: "Transparent and complete pricing breakdown.",
            weight: 0.6,
            criteria: [
              {
                id: "cost-breakdown",
                title: "Cost Breakdown",
                description: "Clear breakdown of licenses, implementation, hardware/cloud, and support costs.",
                type: "error",
                weight: 0.6,
                prompt:
                  "Rate the transparency and completeness of the cost breakdown including licenses, implementation services, infrastructure, and ongoing support.",
              },
              {
                id: "assumptions-exclusions",
                title: "Assumptions & Exclusions",
                description: "Clear assumptions, exclusions, and pricing caveats.",
                type: "error",
                weight: 0.4,
                prompt:
                  "Evaluate whether assumptions, exclusions, and caveats are clearly stated to avoid later disputes.",
              },
            ],
          },
          {
            id: "commercial-terms",
            title: "Commercial Terms",
            description: "Payment terms, liability, IP, and contract terms.",
            weight: 0.4,
            criteria: [
              {
                id: "contract-clarity",
                title: "Contract Clarity",
                description: "Clear payment terms, SLAs, and risk allocation.",
                type: "error",
                weight: 1,
                prompt:
                  "Rate the clarity and fairness of commercial terms including payment schedule, SLAs, IP ownership, and liability.",
              },
            ],
          },
        ],
      },
      {
        id: "risk-quality",
        title: "Risk, Quality & Support",
        description: "Risk management, quality assurance, and post-go-live support.",
        weight: 0.15,
        subsections: [
          {
            id: "risk-management",
            title: "Risk Management",
            description: "Identification, mitigation, and ownership of risks.",
            weight: 0.4,
            criteria: [
              {
                id: "risk-identification",
                title: "Risk Identification",
                description: "Key project and SAP-specific risks identified.",
                type: "error",
                weight: 0.5,
                prompt:
                  "Rate the identification of project risks, especially SAP-specific risks such as data migration, change management, and integration complexity.",
              },
              {
                id: "mitigation-plan",
                title: "Mitigation Plan",
                description: "Realistic mitigation strategies and ownership.",
                type: "error",
                weight: 0.5,
                prompt:
                  "Evaluate the quality of mitigation strategies, contingency plans, and risk ownership.",
              },
            ],
          },
          {
            id: "quality-assurance",
            title: "Quality Assurance",
            description: "Testing strategy, cutover, and data migration quality.",
            weight: 0.35,
            criteria: [
              {
                id: "testing-strategy",
                title: "Testing Strategy",
                description: "Unit, integration, UAT, performance, and regression testing.",
                type: "error",
                weight: 0.6,
                prompt:
                  "Rate the comprehensiveness of the testing strategy including unit, integration, UAT, performance, and regression testing.",
              },
              {
                id: "data-migration-cutover",
                title: "Data Migration & Cutover",
                description: "Data migration approach and cutover planning.",
                type: "error",
                weight: 0.4,
                prompt:
                  "Evaluate the data migration and cutover approach for SAP go-live readiness.",
              },
            ],
          },
          {
            id: "support",
            title: "Post-Go-Live Support",
            description: "Hypercare, support model, and knowledge transfer.",
            weight: 0.25,
            criteria: [
              {
                id: "support-model",
                title: "Support Model",
                description: "Hypercare, AMS, and ongoing support structure.",
                type: "error",
                weight: 1,
                prompt:
                  "Rate the post-go-live support model including hypercare, application management services (AMS), and knowledge transfer.",
              },
            ],
          },
        ],
      },
    ],
  };
}
