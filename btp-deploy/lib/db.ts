"use client";

import Dexie, { type EntityTable } from "dexie";
import type {
  Proposal,
  UploadedFile,
  Comment,
  WorkflowCycle,
  WorkflowEvent,
  TeamActivity,
  Lead,
} from "./types";
import { seedDemoData } from "./demo-data";
import { deriveLeadStatus } from "./lead-events";
import type { DeepReview } from "./deep-review/types";
import { BUILTIN_RULE_DEFAULTS, type DeepRule } from "./deep-review/builtin-rules";
import { getActiveProfileId, type Profile } from "./profiles/types";
import type { JarvisMessageRecord } from "./jarvis/types";

type ProposalRecord = Omit<
  Proposal,
  "documents" | "comments" | "workflowCycles" | "workflowEvents"
>;

class ProposalDatabase extends Dexie {
  proposals!: EntityTable<ProposalRecord, "id">;
  documents!: EntityTable<UploadedFile, "id">;
  comments!: EntityTable<Comment, "id">;
  workflowCycles!: EntityTable<WorkflowCycle, "id">;
  workflowEvents!: EntityTable<WorkflowEvent, "id">;
  deepReviews!: EntityTable<DeepReview, "id">;
  deepRules!: EntityTable<DeepRule, "id">;
  profiles!: EntityTable<Profile, "id">;
  teamActivities!: EntityTable<TeamActivity, "id">;
  leads!: EntityTable<Lead, "id">;
  jarvisMessages!: EntityTable<JarvisMessageRecord, "id">;

  constructor() {
    super("ProposalReviewDB");
    this.version(4).stores({
      proposals: "++id, title, clientName, status, workflowStage, createdAt, updatedAt",
      documents: "++id, proposalId, category, uploadedAt, cycleId",
      comments: "++id, proposalId, createdAt",
      workflowCycles: "++id, proposalId, cycleType, iteration, startedAt, [proposalId+cycleType]",
      workflowEvents: "++id, proposalId, cycleId, type, createdAt",
      rulesets: "++id, name, isDefault, createdAt, updatedAt",
      aiReviews: "++id, proposalId, rulesetId, generatedAt",
    });
    // v5: AI Enabled (deep) reviews — the SPR-style multi-section deep review.
    this.version(5).stores({
      deepReviews: "++id, proposalId, analyzed_at",
    });
    // v6: the legacy ruleset-based review was removed — drop its stores.
    this.version(6).stores({
      rulesets: null,
      aiReviews: null,
    });
    // v7: configurable rules for the AI Enabled Review's rule engine.
    // Primary key is the caller-provided string id (stable for built-ins).
    this.version(7).stores({
      deepRules: "id, is_builtin",
    });
    // v8: user profiles / roles (client-side RBAC).
    this.version(8).stores({
      profiles: "id, role",
    });
    // v9: team activities for the Team Activity Dashboard.
    this.version(9).stores({
      teamActivities: "++id, memberName, category, [memberName+startDate]",
    });
    // v10: lead management (SPARC lead intake roadmap).
    this.version(10).stores({
      leads: "++id, kytesId, status, createdAt, updatedAt",
    });
    // v11: Jarvis assistant conversation log.
    this.version(11).stores({
      jarvisMessages: "++id, createdAt",
    });
    this.version(12)
      .stores({
        workflowCycles: "++id, proposalId, cycleType, iteration, startedAt, [proposalId+cycleType]",
      })
      .upgrade((transaction) =>
        transaction.table("workflowCycles").toCollection().modify((cycle) => {
          cycle.iteration = Math.max(0, Number(cycle.iteration ?? 1) - 1);
        })
      );
  }
}

let dbInstance: ProposalDatabase | null = null;

function getDb(): ProposalDatabase {
  if (typeof window === "undefined") {
    throw new Error("Database is only available in the browser");
  }
  if (!dbInstance) {
    dbInstance = new ProposalDatabase();
  }
  return dbInstance;
}

async function hydrateProposal(
  record: ProposalRecord,
  opts: { lightDocuments?: boolean } = {}
): Promise<Proposal> {
  const db = getDb();
  const documents = (await db.documents.where("proposalId").equals(record.id).sortBy("uploadedAt")).reverse();
  const comments = await db.comments.where("proposalId").equals(record.id).sortBy("createdAt");
  const workflowCycles = await db.workflowCycles
    .where("proposalId")
    .equals(record.id)
    .sortBy("startedAt");
  const workflowEvents = await db.workflowEvents
    .where("proposalId")
    .equals(record.id)
    .sortBy("createdAt");
  return {
    ...record,
    documents: documents.map((d) => ({
      ...d,
      // List views only need document metadata — dropping the base64 payload
      // and extracted text keeps multi-proposal pages fast.
      ...(opts.lightDocuments ? { content: undefined, extractedText: undefined } : {}),
      uploadedAt: new Date(d.uploadedAt),
    })),
    comments: comments.map((c) => ({
      ...c,
      createdAt: new Date(c.createdAt),
    })),
    workflowCycles: workflowCycles.map((c) => ({
      ...c,
      startedAt: new Date(c.startedAt),
      completedAt: c.completedAt ? new Date(c.completedAt) : undefined,
      dueDate: c.dueDate ? new Date(c.dueDate) : undefined,
    })),
    workflowEvents: workflowEvents.map((e) => ({
      ...e,
      createdAt: new Date(e.createdAt),
    })),
  } as Proposal;
}

// Memoized so the (fairly expensive) empty-check + seed runs once per session,
// not on every single db read.
let seedIfEmptyPromise: Promise<void> | null = null;

export function seedIfEmpty(): Promise<void> {
  if (!seedIfEmptyPromise) {
    seedIfEmptyPromise = doSeedIfEmpty().catch((err) => {
      seedIfEmptyPromise = null; // allow a retry on the next call
      throw err;
    });
  }
  return seedIfEmptyPromise;
}

async function doSeedIfEmpty(): Promise<void> {
  const db = getDb();
  const proposalCount = await db.proposals.count();
  const { proposals, teamActivities, leads } = seedDemoData();

  if (proposalCount === 0) {
    for (const proposal of proposals) {
      const { documents, comments, workflowCycles, workflowEvents, ...record } = proposal;
      await db.proposals.add(record as ProposalRecord);
      if (documents?.length) await db.documents.bulkAdd(documents as UploadedFile[]);
      if (comments?.length) await db.comments.bulkAdd(comments as Comment[]);
      if (workflowCycles?.length) await db.workflowCycles.bulkAdd(workflowCycles as WorkflowCycle[]);
      if (workflowEvents?.length) await db.workflowEvents.bulkAdd(workflowEvents as WorkflowEvent[]);
    }
  }

  // Seed demo team activities independently so the dashboard is populated even
  // for existing workspaces that already have proposals.
  const activityCount = await db.teamActivities.count();
  if (activityCount === 0 && teamActivities?.length) {
    await db.teamActivities.bulkAdd(teamActivities as TeamActivity[]);
  }

  // Seed sample Proposal Master leads independently for the same reason.
  const leadCount = await db.leads.count();
  if (leadCount === 0 && leads?.length) {
    await db.leads.bulkAdd(leads);
  }
}

/**
 * All proposals with document *metadata* only (no base64 content / extracted
 * text) — used by list, dashboard and analytics views. Use getProposal(id)
 * when the full document payload is needed.
 */
export async function getProposals(): Promise<Proposal[]> {
  const db = getDb();
  await seedIfEmpty();
  const records = await db.proposals.orderBy("updatedAt").reverse().toArray();
  return Promise.all(records.map((r) => hydrateProposal(r, { lightDocuments: true })));
}

export async function getProposal(id: string): Promise<Proposal | undefined> {
  const db = getDb();
  await seedIfEmpty();
  const record = await db.proposals.get(id);
  if (!record) return undefined;

  // Backfill workflow data for proposals created before the workflow feature.
  const existingCycles = await db.workflowCycles.where("proposalId").equals(id).count();
  const existingEvents = await db.workflowEvents.where("proposalId").equals(id).count();
  if (existingCycles === 0 && existingEvents === 0) {
    const now = new Date();
    const stage = deriveInitialWorkflowStage(record.status);

    // The creation phase ("intake") has no review cycle — record only a marker
    // event so the proposal sits in creation until it is submitted for review.
    if (stage === "intake") {
      await db.workflowEvents.add({
        id: crypto.randomUUID(),
        proposalId: id,
        cycleId: id,
        type: "cycle_started",
        toStage: "intake",
        actor: "System",
        note: "Proposal creation started",
        createdAt: record.createdAt ? new Date(record.createdAt) : now,
      });
      await db.proposals.update(id, { workflowStage: "intake" });
      const refreshedIntake = await db.proposals.get(id);
      return refreshedIntake ? hydrateProposal(refreshedIntake) : undefined;
    }

    const cycleType =
      stage === "approved" || stage === "rejected"
        ? "proposal"
        : deriveCycleType(stage);
    const cycle: WorkflowCycle = {
      id: crypto.randomUUID(),
      proposalId: id,
      cycleType,
      iteration: 0,
      stage,
      startedAt: record.createdAt ? new Date(record.createdAt) : now,
      completedAt: stage === "approved" || stage === "rejected" ? now : undefined,
      status: stage === "approved" || stage === "rejected" ? "completed" : "active",
    };
    await db.workflowCycles.add(cycle);
    await db.workflowEvents.add({
      id: crypto.randomUUID(),
      proposalId: id,
      cycleId: cycle.id,
      type: "cycle_started",
      toStage: stage,
      actor: "System",
      note: "Workflow initialized from existing proposal",
      createdAt: cycle.startedAt,
    });
    await db.proposals.update(id, { workflowStage: stage, currentCycleId: cycle.id });
  }

  const refreshed = await db.proposals.get(id);
  if (!refreshed) return undefined;
  return hydrateProposal(refreshed);
}

function deriveInitialWorkflowStage(status: Proposal["status"]): import("./types").WorkflowStage {
  switch (status) {
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "draft":
    case "submitted":
      return "intake";
    case "under_review":
    default:
      return "proposal_review";
  }
}

function deriveCycleType(stage: import("./types").WorkflowStage): import("./types").ReviewCycleType {
  if (stage.startsWith("delivery_")) return "delivery";
  if (stage.startsWith("customer_")) return "customer";
  return "proposal";
}

export async function addProposal(
  input: Omit<
    Proposal,
    "id" | "createdAt" | "updatedAt" | "documents" | "comments" | "workflowCycles" | "workflowEvents"
  > & {
    documents: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[];
  }
): Promise<Proposal> {
  const db = getDb();
  const now = new Date();

  // New proposals start in the creation phase ("intake"). No review cycle is
  // created until the proposal is explicitly submitted for review.
  const record: ProposalRecord = {
    ...input,
    workflowStage: input.workflowStage ?? "intake",
    status: "draft",
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  } as ProposalRecord;

  await db.proposals.add(record);

  // Documents uploaded during creation aren't tied to a review cycle yet.
  const documents: UploadedFile[] = input.documents.map((doc) => ({
    ...doc,
    id: crypto.randomUUID(),
    proposalId: record.id,
    version: 1,
    uploadedAt: now,
  }));

  if (documents.length) await db.documents.bulkAdd(documents);

  // Creation-phase marker event. The proposal initiation date is the creation
  // timestamp and serves as the creation phase start.
  const event: WorkflowEvent = {
    id: crypto.randomUUID(),
    proposalId: record.id,
    cycleId: record.id,
    type: "cycle_started",
    toStage: "intake",
    actor: "System",
    note: "Proposal creation started",
    createdAt: now,
  };
  await db.workflowEvents.add(event);

  return hydrateProposal(record);
}

export async function updateProposal(
  id: string,
  changes: Partial<
    Omit<
      Proposal,
      "id" | "createdAt" | "updatedAt" | "documents" | "comments" | "workflowCycles" | "workflowEvents"
    >
  >
): Promise<Proposal | undefined> {
  const db = getDb();
  await db.proposals.update(id, { ...changes, updatedAt: new Date() });
  return getProposal(id);
}

export async function addWorkflowCycle(cycle: Omit<WorkflowCycle, "id">): Promise<WorkflowCycle> {
  const db = getDb();
  const record: WorkflowCycle = { ...cycle, id: crypto.randomUUID() };
  await db.workflowCycles.add(record);
  return record;
}

export async function updateWorkflowCycle(
  id: string,
  changes: Partial<Omit<WorkflowCycle, "id">>
): Promise<WorkflowCycle | undefined> {
  const db = getDb();
  await db.workflowCycles.update(id, changes);
  return db.workflowCycles.get(id);
}

export async function addWorkflowEvent(
  event: Omit<WorkflowEvent, "id">
): Promise<WorkflowEvent> {
  const db = getDb();
  const record: WorkflowEvent = { ...event, id: crypto.randomUUID() };
  await db.workflowEvents.add(record);
  await db.proposals.update(event.proposalId, { updatedAt: new Date() });
  return record;
}

export async function deleteProposal(id: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", [
    db.proposals,
    db.documents,
    db.comments,
    db.workflowCycles,
    db.workflowEvents,
    db.deepReviews,
  ], async () => {
    await db.deepReviews.where("proposalId").equals(id).delete();
    await db.workflowEvents.where("proposalId").equals(id).delete();
    await db.workflowCycles.where("proposalId").equals(id).delete();
    await db.comments.where("proposalId").equals(id).delete();
    await db.documents.where("proposalId").equals(id).delete();
    await db.proposals.delete(id);
  });
}

export async function addComment(proposalId: string, author: string, text: string): Promise<Comment> {
  const db = getDb();
  const comment: Comment = {
    id: crypto.randomUUID(),
    proposalId,
    author,
    text,
    createdAt: new Date(),
  };
  await db.comments.add(comment);
  await db.proposals.update(proposalId, { updatedAt: new Date() });
  return comment;
}

export async function addDocument(
  proposalId: string,
  doc: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">,
  options?: { cycleId?: string; version?: number }
): Promise<UploadedFile> {
  const db = getDb();
  const document: UploadedFile = {
    ...doc,
    id: crypto.randomUUID(),
    proposalId,
    cycleId: options?.cycleId,
    version: options?.version,
    uploadedAt: new Date(),
  };
  await db.documents.add(document);
  await db.proposals.update(proposalId, { updatedAt: new Date() });
  return document;
}

export async function getNextDocumentVersion(
  proposalId: string,
  category: UploadedFile["category"],
  cycleId?: string
): Promise<number> {
  const db = getDb();
  const docs = (await db.documents.where("proposalId").equals(proposalId).toArray()).filter(
    (d) => d.category === category && (!cycleId || d.cycleId === cycleId)
  );
  const maxVersion = docs.reduce((max, d) => Math.max(max, d.version ?? 1), 0);
  return maxVersion + 1;
}

export async function deleteDocument(id: string): Promise<void> {
  const db = getDb();
  const doc = await db.documents.get(id);
  if (doc) {
    await db.documents.delete(id);
    await db.proposals.update(doc.proposalId, { updatedAt: new Date() });
  }
}

// AI Enabled (deep) Review — SPR-style multi-section deep review.
export async function saveDeepReview(deepReview: DeepReview): Promise<DeepReview> {
  const db = getDb();
  // One saved report per proposal — replace any prior one.
  await db.deepReviews.where("proposalId").equals(deepReview.proposalId).delete();
  await db.deepReviews.add(deepReview);
  await db.proposals.update(deepReview.proposalId, { updatedAt: new Date() });
  return deepReview;
}

export async function getDeepReview(proposalId: string): Promise<DeepReview | undefined> {
  const db = getDb();
  return db.deepReviews.where("proposalId").equals(proposalId).first();
}

export async function deleteDeepReview(proposalId: string): Promise<void> {
  const db = getDb();
  await db.deepReviews.where("proposalId").equals(proposalId).delete();
  await db.proposals.update(proposalId, { updatedAt: new Date() });
}

// AI Enabled Review — rule engine configuration (built-in + custom rules).

/**
 * Seed the factory-default built-in rules into the table. Idempotent: only
 * inserts built-ins whose ids don't already exist, so user edits/deletes are
 * preserved across reloads (mirrors the SPR `seed_builtin_rules(force=False)`).
 *
 * Memoized so React Strict Mode's double-invoked effects (dev) don't run two
 * concurrent seeds that race on the same ids. `bulkAdd` additionally tolerates
 * keys inserted by another tab/session by swallowing the ConstraintError.
 */
let seedDeepRulesPromise: Promise<void> | null = null;

export function seedBuiltinDeepRules(): Promise<void> {
  if (!seedDeepRulesPromise) {
    seedDeepRulesPromise = (async () => {
      const db = getDb();
      const existingIds = new Set(
        (await db.deepRules.toCollection().primaryKeys()) as string[]
      );
      const missing = BUILTIN_RULE_DEFAULTS.filter((r) => !existingIds.has(r.id));
      if (missing.length === 0) return;
      try {
        await db.deepRules.bulkAdd(missing.map((r) => ({ ...r })));
      } catch (err) {
        // A concurrent seed may have inserted some of these already — that's fine.
        const name = (err as { name?: string })?.name;
        if (name !== "BulkError" && name !== "ConstraintError") throw err;
      }
    })().catch((err) => {
      // Don't cache a rejected promise — allow a later retry.
      seedDeepRulesPromise = null;
      throw err;
    });
  }
  return seedDeepRulesPromise;
}

export async function getDeepRules(): Promise<DeepRule[]> {
  const db = getDb();
  await seedBuiltinDeepRules();
  const all = await db.deepRules.toArray();
  // Built-ins first, then custom rules, each in insertion order.
  return all.sort((a, b) => Number(b.is_builtin) - Number(a.is_builtin));
}

/** Active rules only — used by the review engine. */
export async function getActiveDeepRules(): Promise<DeepRule[]> {
  const rules = await getDeepRules();
  return rules.filter((r) => r.is_active);
}

export async function saveDeepRule(rule: DeepRule): Promise<DeepRule> {
  const db = getDb();
  await db.deepRules.put(rule);
  return rule;
}

export async function deleteDeepRule(id: string): Promise<void> {
  const db = getDb();
  await db.deepRules.delete(id);
}

/** Re-seed every built-in default, reverting edits/deletions (custom rules untouched). */
export async function restoreDefaultDeepRules(): Promise<void> {
  const db = getDb();
  for (const rule of BUILTIN_RULE_DEFAULTS) {
    await db.deepRules.put({ ...rule });
  }
}

// ── User profiles / roles (client-side RBAC) ────────────────────────────────

export const DEFAULT_ADMIN_PROFILE_ID = "profile-admin-default";

/** Ensure at least one Admin profile exists. Idempotent. */
let seedProfilesPromise: Promise<void> | null = null;
export function seedDefaultProfiles(): Promise<void> {
  if (!seedProfilesPromise) {
    seedProfilesPromise = (async () => {
      const db = getDb();
      const count = await db.profiles.count();
      if (count === 0) {
        await db.profiles.add({
          id: DEFAULT_ADMIN_PROFILE_ID,
          name: "Administrator",
          email: "",
          role: "admin",
          createdAt: new Date(),
        });
      }
    })().catch((err) => {
      seedProfilesPromise = null;
      throw err;
    });
  }
  return seedProfilesPromise;
}

export async function getProfiles(): Promise<Profile[]> {
  const db = getDb();
  await seedDefaultProfiles();
  const all = await db.profiles.toArray();
  return all
    .map((p) => ({ ...p, createdAt: new Date(p.createdAt) }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/** The profile currently selected in the profile switcher (persisted in localStorage). */
export async function getActiveProfile(): Promise<Profile | undefined> {
  const db = getDb();
  await seedDefaultProfiles();
  const id = getActiveProfileId();
  if (!id) return undefined;
  return db.profiles.get(id);
}

export async function addProfile(input: Omit<Profile, "id" | "createdAt">): Promise<Profile> {
  const db = getDb();
  const profile: Profile = { ...input, id: crypto.randomUUID(), createdAt: new Date() };
  await db.profiles.add(profile);
  return profile;
}

export async function updateProfileRecord(
  id: string,
  changes: Partial<Omit<Profile, "id" | "createdAt">>
): Promise<void> {
  const db = getDb();
  await db.profiles.update(id, changes);
}

export async function deleteProfile(id: string): Promise<void> {
  const db = getDb();
  await db.profiles.delete(id);
}

/** Map of proposalId → latest saved deep review, for list/dashboard/analytics views. */
// ── Leads ───────────────────────────────────────────────────────────────────

/** Single normalizer for every lead read: dates, currentEvent default, and the
 * status derived from the event actually reached (see deriveLeadStatus). */
function toLead(record: Lead): Lead {
  const currentEvent = record.currentEvent ?? 1;
  return {
    ...record,
    currentEvent,
    status: deriveLeadStatus({ ...record, currentEvent }),
    date: record.date ? new Date(record.date) : undefined,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

export async function getLeads(): Promise<Lead[]> {
  const db = getDb();
  await seedIfEmpty();
  const records = await db.leads.orderBy("updatedAt").reverse().toArray();
  return records.map(toLead);
}

export async function getLead(id: string): Promise<Lead | undefined> {
  const db = getDb();
  const record = await db.leads.get(id);
  if (!record) return undefined;
  return toLead(record);
}

/**
 * Add the bundled sample leads to the workspace on demand, skipping any whose
 * Kytes ID already exists. Returns how many were added.
 */
export async function seedSampleLeads(): Promise<number> {
  const db = getDb();
  const { leads } = seedDemoData();
  const existing = new Set((await db.leads.toArray()).map((l) => l.kytesId));
  const toAdd = leads.filter((l) => !existing.has(l.kytesId));
  if (toAdd.length > 0) {
    await db.leads.bulkAdd(toAdd);
  }
  return toAdd.length;
}

export async function getLeadByProposalId(proposalId: string): Promise<Lead | undefined> {
  const db = getDb();
  const record = await db.leads.filter((lead) => lead.proposalId === proposalId).first();
  if (!record) return undefined;
  return toLead(record);
}

export async function addLead(
  input: Omit<Lead, "id" | "createdAt" | "updatedAt" | "currentEvent"> & {
    currentEvent?: number;
  }
): Promise<Lead> {
  const db = getDb();
  const now = new Date();
  const lead: Lead = {
    ...input,
    status: input.status ?? "new",
    currentEvent: input.currentEvent ?? 2,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await db.leads.add(lead);
  return lead;
}

export async function updateLead(
  id: string,
  changes: Partial<Omit<Lead, "id" | "createdAt" | "updatedAt">>
): Promise<Lead | undefined> {
  const db = getDb();
  await db.leads.update(id, { ...changes, updatedAt: new Date() });
  return getLead(id);
}

export async function deleteLead(id: string): Promise<void> {
  const db = getDb();
  await db.leads.delete(id);
}

export async function getTeamActivities(): Promise<TeamActivity[]> {
  const db = getDb();
  await seedIfEmpty();
  const records = await db.teamActivities.orderBy("memberName").toArray();
  return records.map((a) => ({
    ...a,
    startDate: new Date(a.startDate),
    endDate: new Date(a.endDate),
  }));
}

export async function addTeamActivity(input: Omit<TeamActivity, "id">): Promise<TeamActivity> {
  const db = getDb();
  const record: TeamActivity = {
    ...input,
    id: crypto.randomUUID(),
  };
  await db.teamActivities.add(record as TeamActivity);
  return {
    ...record,
    startDate: new Date(record.startDate),
    endDate: new Date(record.endDate),
  };
}

export async function updateTeamActivity(
  id: string,
  changes: Partial<Omit<TeamActivity, "id">>
): Promise<TeamActivity | undefined> {
  const db = getDb();
  await db.teamActivities.update(id, changes);
  const record = await db.teamActivities.get(id);
  if (!record) return undefined;
  return {
    ...record,
    startDate: new Date(record.startDate),
    endDate: new Date(record.endDate),
  } as TeamActivity;
}

export async function deleteTeamActivity(id: string): Promise<void> {
  const db = getDb();
  await db.teamActivities.delete(id);
}

export async function getDeepReviewMap(): Promise<Map<string, DeepReview>> {
  const db = getDb();
  const all = await db.deepReviews.toArray();
  const map = new Map<string, DeepReview>();
  for (const dr of all) {
    const existing = map.get(dr.proposalId);
    if (!existing || new Date(dr.analyzed_at) > new Date(existing.analyzed_at)) {
      map.set(dr.proposalId, dr);
    }
  }
  return map;
}

/**
 * All documents that have extracted text, for client-side document Q&A
 * (Jarvis ask_documents). Optionally scoped to one proposal.
 */
export async function getSearchableDocuments(proposalId?: string): Promise<UploadedFile[]> {
  const db = getDb();
  await seedIfEmpty();
  const docs = proposalId
    ? await db.documents.where("proposalId").equals(proposalId).toArray()
    : await db.documents.toArray();
  return docs.filter((d) => (d.extractedText ?? d.content ?? "").trim().length > 0);
}

// ── Jarvis conversation log ─────────────────────────────────────────────────

export async function getJarvisMessages(limit = 50): Promise<JarvisMessageRecord[]> {
  const db = getDb();
  const records = await db.jarvisMessages.orderBy("createdAt").reverse().limit(limit).toArray();
  return records.reverse().map((m) => ({ ...m, createdAt: new Date(m.createdAt) }));
}

export async function addJarvisMessage(
  message: Omit<JarvisMessageRecord, "id">
): Promise<JarvisMessageRecord> {
  const db = getDb();
  const id = (await db.jarvisMessages.add({ ...message })) as number;
  return { ...message, id };
}

export async function clearJarvisMessages(): Promise<void> {
  const db = getDb();
  await db.jarvisMessages.clear();
}

export async function exportAll(): Promise<Record<string, unknown[]>> {
  const db = getDb();
  return {
    proposals: await db.proposals.toArray(),
    leads: await db.leads.toArray(),
    documents: await db.documents.toArray(),
    comments: await db.comments.toArray(),
    workflowCycles: await db.workflowCycles.toArray(),
    workflowEvents: await db.workflowEvents.toArray(),
    deepReviews: await db.deepReviews.toArray(),
    teamActivities: await db.teamActivities.toArray(),
  };
}

export async function clearAll(): Promise<void> {
  const db = getDb();
  await db.transaction("rw", [
    db.proposals,
    db.leads,
    db.documents,
    db.comments,
    db.workflowCycles,
    db.workflowEvents,
    db.deepReviews,
    db.deepRules,
    db.teamActivities,
  ], async () => {
    await db.deepRules.clear();
    await db.deepReviews.clear();
    await db.workflowEvents.clear();
    await db.workflowCycles.clear();
    await db.comments.clear();
    await db.documents.clear();
    await db.teamActivities.clear();
    await db.leads.clear();
    await db.proposals.clear();
  });
}
