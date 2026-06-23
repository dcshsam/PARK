"use client";

import Dexie, { type EntityTable } from "dexie";
import type {
  Proposal,
  UploadedFile,
  Comment,
  WorkflowCycle,
  WorkflowEvent,
  Ruleset,
  AiReviewResult,
} from "./types";
import { seedDemoData } from "./demo-data";
import { getDefaultSapRuleset } from "./default-ruleset";

type ProposalRecord = Omit<
  Proposal,
  "documents" | "comments" | "workflowCycles" | "workflowEvents" | "aiReview"
>;

class ProposalDatabase extends Dexie {
  proposals!: EntityTable<ProposalRecord, "id">;
  documents!: EntityTable<UploadedFile, "id">;
  comments!: EntityTable<Comment, "id">;
  workflowCycles!: EntityTable<WorkflowCycle, "id">;
  workflowEvents!: EntityTable<WorkflowEvent, "id">;
  rulesets!: EntityTable<Ruleset, "id">;
  aiReviews!: EntityTable<AiReviewResult, "id">;

  constructor() {
    super("ProposalReviewDB");
    this.version(3).stores({
      proposals: "++id, title, clientName, status, workflowStage, createdAt, updatedAt",
      documents: "++id, proposalId, category, uploadedAt",
      comments: "++id, proposalId, createdAt",
      workflowCycles: "++id, proposalId, cycleType, iteration, startedAt, [proposalId+cycleType]",
      workflowEvents: "++id, proposalId, cycleId, type, createdAt",
      rulesets: "++id, name, isDefault, createdAt, updatedAt",
      aiReviews: "++id, proposalId, rulesetId, generatedAt",
    });
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

async function hydrateProposal(record: ProposalRecord): Promise<Proposal> {
  const db = getDb();
  const documents = await db.documents.where("proposalId").equals(record.id).sortBy("uploadedAt");
  const comments = await db.comments.where("proposalId").equals(record.id).sortBy("createdAt");
  const workflowCycles = await db.workflowCycles
    .where("proposalId")
    .equals(record.id)
    .sortBy("startedAt");
  const workflowEvents = await db.workflowEvents
    .where("proposalId")
    .equals(record.id)
    .sortBy("createdAt");
  const aiReview = await db.aiReviews.where("proposalId").equals(record.id).first();
  return {
    ...record,
    documents: documents.map((d) => ({
      ...d,
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
    aiReview: aiReview
      ? {
          ...aiReview,
          generatedAt: new Date(aiReview.generatedAt),
        }
      : undefined,
  } as Proposal;
}

async function seedDefaultRuleset(): Promise<Ruleset> {
  const db = getDb();
  const all = await db.rulesets.toArray();
  const existing = all.find((r) => r.isSystem);
  if (existing) return existing as Ruleset;

  const ruleset = getDefaultSapRuleset();
  await db.rulesets.add(ruleset);
  return ruleset;
}

async function assignDefaultRulesetToProposals(rulesetId: string): Promise<void> {
  const db = getDb();
  const proposalsWithoutRuleset = await db.proposals.filter((p) => !p.rulesetId).toArray();
  for (const proposal of proposalsWithoutRuleset) {
    await db.proposals.update(proposal.id, { rulesetId });
  }
}

export async function seedIfEmpty(): Promise<void> {
  const db = getDb();
  const count = await db.proposals.count();
  if (count === 0) {
    const ruleset = await seedDefaultRuleset();
    const proposals = seedDemoData();
    for (const proposal of proposals) {
      const { documents, comments, workflowCycles, workflowEvents, aiReview, ...record } = proposal;
      const recordWithRuleset = { ...record, rulesetId: ruleset.id } as ProposalRecord;
      await db.proposals.add(recordWithRuleset);
      if (documents?.length) await db.documents.bulkAdd(documents as UploadedFile[]);
      if (comments?.length) await db.comments.bulkAdd(comments as Comment[]);
      if (workflowCycles?.length) await db.workflowCycles.bulkAdd(workflowCycles as WorkflowCycle[]);
      if (workflowEvents?.length) await db.workflowEvents.bulkAdd(workflowEvents as WorkflowEvent[]);
      if (aiReview) await db.aiReviews.add(aiReview as AiReviewResult);
    }
  } else {
    // Ensure default ruleset exists and backfill proposals created before rulesets.
    const ruleset = await seedDefaultRuleset();
    await assignDefaultRulesetToProposals(ruleset.id);
  }
}

export async function getProposals(): Promise<Proposal[]> {
  const db = getDb();
  await seedIfEmpty();
  const records = await db.proposals.orderBy("updatedAt").reverse().toArray();
  return Promise.all(records.map(hydrateProposal));
}

export async function getProposal(id: string): Promise<Proposal | undefined> {
  const db = getDb();
  await seedIfEmpty();
  const record = await db.proposals.get(id);
  if (!record) return undefined;

  // Backfill workflow data for proposals created before the workflow feature.
  const existingCycles = await db.workflowCycles.where("proposalId").equals(id).count();
  if (existingCycles === 0) {
    const now = new Date();
    const stage = deriveInitialWorkflowStage(record.status);
    const cycleType =
      stage === "approved" || stage === "rejected" || stage === "intake"
        ? "proposal"
        : deriveCycleType(stage);
    const cycle: WorkflowCycle = {
      id: crypto.randomUUID(),
      proposalId: id,
      cycleType,
      iteration: 1,
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
    "id" | "createdAt" | "updatedAt" | "documents" | "comments" | "workflowCycles" | "workflowEvents" | "aiReview"
  > & {
    documents: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[];
  }
): Promise<Proposal> {
  const db = getDb();
  const now = new Date();

  let rulesetId = input.rulesetId;
  if (!rulesetId) {
    const defaultRuleset = await getDefaultRuleset();
    rulesetId = defaultRuleset?.id;
  }

  const record: ProposalRecord = {
    ...input,
    rulesetId,
    workflowStage: input.workflowStage ?? "proposal_review",
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  } as ProposalRecord;

  await db.proposals.add(record);

  const documents: UploadedFile[] = input.documents.map((doc) => ({
    ...doc,
    id: crypto.randomUUID(),
    proposalId: record.id,
    uploadedAt: now,
  }));

  if (documents.length) await db.documents.bulkAdd(documents);

  const cycle: WorkflowCycle = {
    id: crypto.randomUUID(),
    proposalId: record.id,
    cycleType: "proposal",
    iteration: 1,
    stage: "proposal_review",
    startedAt: now,
    status: "active",
  };
  await db.workflowCycles.add(cycle);

  const event: WorkflowEvent = {
    id: crypto.randomUUID(),
    proposalId: record.id,
    cycleId: cycle.id,
    type: "cycle_started",
    toStage: "proposal_review",
    actor: "System",
    note: "Proposal created and submitted for review",
    createdAt: now,
  };
  await db.workflowEvents.add(event);

  await db.proposals.update(record.id, { currentCycleId: cycle.id });
  record.currentCycleId = cycle.id;

  return hydrateProposal(record);
}

export async function updateProposal(
  id: string,
  changes: Partial<
    Omit<
      Proposal,
      "id" | "createdAt" | "updatedAt" | "documents" | "comments" | "workflowCycles" | "workflowEvents" | "aiReview"
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
    db.aiReviews,
  ], async () => {
    await db.aiReviews.where("proposalId").equals(id).delete();
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
  doc: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">
): Promise<UploadedFile> {
  const db = getDb();
  const document: UploadedFile = {
    ...doc,
    id: crypto.randomUUID(),
    proposalId,
    uploadedAt: new Date(),
  };
  await db.documents.add(document);
  await db.proposals.update(proposalId, { updatedAt: new Date() });
  return document;
}

export async function deleteDocument(id: string): Promise<void> {
  const db = getDb();
  const doc = await db.documents.get(id);
  if (doc) {
    await db.documents.delete(id);
    await db.proposals.update(doc.proposalId, { updatedAt: new Date() });
  }
}

// Ruleset CRUD
export async function getRulesets(): Promise<Ruleset[]> {
  const db = getDb();
  await seedDefaultRuleset();
  const records = await db.rulesets.orderBy("updatedAt").reverse().toArray();
  return records.map((r) => ({
    ...r,
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
  })) as Ruleset[];
}

export async function getRuleset(id: string): Promise<Ruleset | undefined> {
  const db = getDb();
  const record = await db.rulesets.get(id);
  if (!record) return undefined;
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  } as Ruleset;
}

export async function getDefaultRuleset(): Promise<Ruleset | undefined> {
  const db = getDb();
  await seedDefaultRuleset();
  const record = await db.rulesets.where("isDefault").equals(1).first();
  if (!record) return undefined;
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  } as Ruleset;
}

export async function addRuleset(
  input: Omit<Ruleset, "id" | "createdAt" | "updatedAt">
): Promise<Ruleset> {
  const db = getDb();
  const now = new Date();
  const record: Ruleset = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await db.rulesets.add(record);
  return record;
}

export async function updateRuleset(
  id: string,
  changes: Partial<Omit<Ruleset, "id" | "createdAt" | "updatedAt">>
): Promise<Ruleset | undefined> {
  const db = getDb();
  await db.rulesets.update(id, { ...changes, updatedAt: new Date() });
  return getRuleset(id);
}

export async function deleteRuleset(id: string): Promise<void> {
  const db = getDb();
  const ruleset = await db.rulesets.get(id);
  if (ruleset?.isSystem) {
    throw new Error("System rulesets cannot be deleted");
  }
  await db.rulesets.delete(id);
}

export async function setDefaultRuleset(id: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.rulesets, async () => {
    await db.rulesets.toCollection().modify((r) => {
      r.isDefault = r.id === id;
    });
  });
}

// AI Review
export async function saveAiReview(
  aiReview: Omit<AiReviewResult, "id">
): Promise<AiReviewResult> {
  const db = getDb();
  const now = new Date();
  const existing = await db.aiReviews.where("proposalId").equals(aiReview.proposalId).first();

  if (existing) {
    await db.aiReviews.update(existing.id, {
      ...aiReview,
      generatedAt: now,
    });
    const updated = await db.aiReviews.get(existing.id);
    if (!updated) throw new Error("Failed to save AI review");
    await db.proposals.update(aiReview.proposalId, { updatedAt: now });
    return { ...updated, generatedAt: new Date(updated.generatedAt) } as AiReviewResult;
  }

  const record: AiReviewResult = {
    ...aiReview,
    id: crypto.randomUUID(),
    generatedAt: now,
  };
  await db.aiReviews.add(record);
  await db.proposals.update(aiReview.proposalId, { updatedAt: now });
  return record;
}

export async function deleteAiReview(proposalId: string): Promise<void> {
  const db = getDb();
  await db.aiReviews.where("proposalId").equals(proposalId).delete();
  await db.proposals.update(proposalId, { updatedAt: new Date() });
}

export async function exportAll(): Promise<Record<string, unknown[]>> {
  const db = getDb();
  return {
    proposals: await db.proposals.toArray(),
    documents: await db.documents.toArray(),
    comments: await db.comments.toArray(),
    workflowCycles: await db.workflowCycles.toArray(),
    workflowEvents: await db.workflowEvents.toArray(),
    rulesets: await db.rulesets.toArray(),
    aiReviews: await db.aiReviews.toArray(),
  };
}

export async function clearAll(): Promise<void> {
  const db = getDb();
  await db.transaction("rw", [
    db.proposals,
    db.documents,
    db.comments,
    db.workflowCycles,
    db.workflowEvents,
    db.rulesets,
    db.aiReviews,
  ], async () => {
    await db.aiReviews.clear();
    await db.workflowEvents.clear();
    await db.workflowCycles.clear();
    await db.comments.clear();
    await db.documents.clear();
    await db.rulesets.clear();
    await db.proposals.clear();
  });
}
