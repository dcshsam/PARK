# SAP Skill

Use this skill when working on SAP-related projects, ABAP code, SAP BTP extensions, SAP S/4HANA customizations, Fiori/UI5 apps, RAP/CAP services, or integrating with SAP systems.

## SAP Project Landscape

SAP projects generally fall into these categories:

| Project Type | Stack | Typical Work |
|--------------|-------|--------------|
| **SAP S/4HANA On-Premise Extension** | ABAP, CDS, RAP, Fiori | Custom reports, enhancements, OData services, side-by-side extensions |
| **SAP S/4HANA Cloud Extension** | ABAP Cloud, RAP, BTP | Clean-core compliant extensions, released APIs, custom business objects |
| **SAP BTP ABAP Environment** | ABAP Cloud, RAP, CDS | Cloud-native ABAP apps, RAP business services, Fiori apps |
| **SAP BTP CAP Application** | Node.js/Java, CAP, CDS, HANA | Cloud-native services, extensions, multi-tenant SaaS apps |
| **SAP Fiori/UI5 Frontend** | SAPUI5, Fiori Elements, TypeScript/JavaScript | Responsive web apps, launchpad tiles, custom UIs |
| **SAP Integration** | CPI/Integration Suite, OData, RFC, IDoc | System-to-system integration, APIs, event mesh |
| **SAP Analytics Cloud / Datasphere** | SAC, Datasphere, BW/4HANA | Reporting, planning, data modeling |

## Core SAP Concepts

### Modules (Functional Areas)

SAP is organized into modules that map to business processes:

- **FI** – Financial Accounting (GL, AP, AR, asset accounting)
- **CO** – Controlling (cost center, profit center, internal orders, product costing)
- **MM** – Materials Management (procurement, inventory, invoice verification)
- **SD** – Sales and Distribution (quotes, orders, delivery, billing)
- **PP** – Production Planning (BOMs, routings, work centers, MRP)
- **PM** – Plant Maintenance (equipment, work orders, notifications)
- **QM** – Quality Management (inspection lots, results recording)
- **HR/HCM** – Human Capital Management (payroll, time, org management)
- **PS** – Project System (WBS, networks, project costing)
- **WM/EWM** – Warehouse Management / Extended WM
- **TM/LE/TRA** – Transportation, Logistics Execution
- **SuccessFactors / Ariba / Concur** – Cloud line-of-business solutions

When analyzing a requirement, identify which module(s) it touches and the core tables involved (e.g., `VBAK/VBAP` for SD, `EKPO/EKKO` for MM, `BSEG/BKPF` for FI).

### ABAP

- **ABAP** is SAP’s primary server-side language.
- Modern ABAP is **ABAP Cloud** (clean-core compliant, object-oriented, RESTful).
- Development happens in **Eclipse ADT** (ABAP Development Tools), not SE80 for cloud/rap.
- Key artifacts: programs, classes, interfaces, function modules, CDS views, BDEFs, SRVDs, SRVBs, tables, structures.

### RAP vs CAP

| Aspect | RAP (ABAP RESTful Application Programming Model) | CAP (Cloud Application Programming Model) |
|--------|--------------------------------------------------|-------------------------------------------|
| Language | ABAP | Node.js / Java / TypeScript |
| Runtime | ABAP environment (S/4HANA, BTP ABAP) | BTP Cloud Foundry / Kyma |
| Best for | Deep SAP integration, S/4HANA extensions | Cloud-native apps, side-by-side extensions, multi-tenant SaaS |
| Data model | ABAP CDS | CAP CDS |
| UI | Fiori Elements / SAPUI5 | Fiori Elements / SAPUI5 |
| APIs | OData V4, Web APIs | OData V4, REST, GraphQL |

### CDS (Core Data Services)

- Declarative data model layer.
- In ABAP: **ABAP CDS** (`.cds` artifacts defining views, tables, projections).
- In CAP: **CAP CDS** (domain model + service definitions).
- Enables automatic UI generation via Fiori Elements and OData exposure.

### Fiori / SAPUI5

- **SAP Fiori** is the design system/UX paradigm.
- **SAPUI5** is the HTML5 framework for building Fiori apps.
- **Fiori Elements** generates UIs from CDS annotations + OData metadata.
- Apps run in the **Fiori Launchpad** or SAP Build Work Zone.

### Clean Core

- SAP’s guidance to keep S/4HANA core stable and upgradable.
- Avoid direct modifications to SAP standard code.
- Use **released APIs**, **extension points**, **BTP side-by-side extensions**, and **ABAP Cloud**.
- Custom code should be **upgrade-stable** and follow SAP’s extensibility guidelines.

## Common SAP Development Patterns

1. **Report / ALV** – Classical ABAP list/report using `CL_SALV_TABLE` or ALV Grid.
2. **Enhancement / User-Exit / BAdI** – Extend SAP standard behavior without modification.
3. **RFC Function Module** – Remote-enabled function for external system calls.
4. **OData Service (RAP/CAP)** – REST API consumed by Fiori apps or external clients.
5. **Background Job** – Scheduled processing via `SUBMIT` + SM36/SM37.
6. **IDoc / ALE** – Asynchronous EDI-style integration between SAP systems.
7. **BAPI** – Business API, stable wrapper for business processes.
8. **Workflow** – Human/approval workflows using SAP Business Workflow or BTP Workflow.

## Code & Data Access Guidance

- Use **released objects and APIs** when available.
- Prefer `SELECT ... UP TO 1 ROWS` or `SELECT SINGLE` with complete key fields.
- Avoid `SELECT *` on large tables; specify fields.
- Use `WHERE` clauses to limit data retrieval.
- Transport changes via **transport requests** (TR) in development systems.
- Use `SE11` for dictionary objects, `SE16N`/`SE16H` for data browsing, `SE37` for function modules, `SE38` for programs, `SE80` for object navigator, `SE93` for transactions.

## MCP Integration

See `proposal-review-app/.kimi/mcp.json` for SAP MCP server configuration. Available options include:

- **ABAP ADT MCP Server** – Read/write/activate/search ABAP objects via ADT REST API.
- **ABAP Syntax Check MCP** – Validate ABAP code via RFC.
- **ABAP MCP (AI-assisted)** – AI coding assistance for ABAP development.

These require valid SAP credentials and network access to an SAP system.

## Resources

- [SAP BTP Developer’s Guide](https://help.sap.com/docs/btp)
- [ABAP RESTful Application Programming Model](https://help.sap.com/docs/abap-cloud-development)
- [SAP CAP Documentation](https://cap.cloud.sap/docs/)
- [SAP Fiori Design Guidelines](https://experience.sap.com/fiori-design-web/)
- [ABAP Flight Reference Scenario (GitHub)](https://github.com/SAP-samples/abap-platform-refscen-flight)
