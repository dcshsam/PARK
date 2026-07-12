"use client";

// Jarvis tool registry — client-side executors over the existing Dexie data
// layer and workflow engine. All data lives in IndexedDB, so every tool runs
// in the browser; the LLM only decides which tool to call.

import {
  getProposals,
  getProposal,
  getLeads,
  getLead,
  getTeamActivities,
  getDeepReviewMap,
  getSearchableDocuments,
  getActiveProfile,
  getActiveDeepRules,
  addComment,
  saveDeepReview,
} from "@/lib/db";
import { applyWorkflowAction, type WorkflowAction } from "@/lib/workflow-engine";
import { statusLabels, leadStatusLabels, type Proposal, type Lead } from "@/lib/types";
import type { ToolDefinition, ToolResult, ToolContext } from "./types";

/** sessionStorage key the lead form reads to prefill a Jarvis-drafted lead. */
export const LEAD_DRAFT_STORAGE_KEY = "jarvis:lead-draft";

const PAGES: Record<string, string> = {
  dashboard: "/dashboard",
  proposals: "/proposals",
  leads: "/leads",
  analytics: "/analytics",
  settings: "/settings",
  "team-activity": "/team-activity",
  rules: "/rules",
  profiles: "/profiles",
};

function str(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  return typeof value === "string" ? value.trim() : "";
}

function num(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return undefined;
}

/**
 * Resolve a proposal by id or (partial) title / client name. Returns an error
 * result when nothing or too many things match, so the LLM can ask the user.
 */
async function resolveProposal(idOrTitle: string): Promise<
  { proposal: Proposal } | { error: string }
> {
  if (!idOrTitle) return { error: "Missing proposal id or title" };
  const proposals = await getProposals();
  const byId = proposals.find((p) => p.id === idOrTitle);
  if (byId) return { proposal: byId };

  const q = idOrTitle.toLowerCase();
  const exact = proposals.filter((p) => p.title.toLowerCase() === q);
  if (exact.length === 1) return { proposal: exact[0] };

  const partial = proposals.filter(
    (p) => p.title.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q)
  );
  if (partial.length === 1) return { proposal: partial[0] };
  if (partial.length > 1) {
    return {
      error: `Multiple proposals match "${idOrTitle}": ${partial
        .slice(0, 5)
        .map((p) => `"${p.title}" (${p.clientName})`)
        .join(", ")}. Ask the user which one they mean.`,
    };
  }
  return { error: `No proposal found matching "${idOrTitle}"` };
}

async function resolveLead(idOrName: string): Promise<{ lead: Lead } | { error: string }> {
  if (!idOrName) return { error: "Missing lead id or name" };
  const leads = await getLeads();
  const byId = leads.find((l) => l.id === idOrName || l.kytesId === idOrName);
  if (byId) return { lead: byId };

  const q = idOrName.toLowerCase();
  const matches = leads.filter(
    (l) => l.leadName.toLowerCase().includes(q) || l.clientName.toLowerCase().includes(q)
  );
  if (matches.length === 1) return { lead: matches[0] };
  if (matches.length > 1) {
    return {
      error: `Multiple leads match "${idOrName}": ${matches
        .slice(0, 5)
        .map((l) => `"${l.leadName}" (${l.clientName})`)
        .join(", ")}. Ask the user which one they mean.`,
    };
  }
  return { error: `No lead found matching "${idOrName}"` };
}

function proposalSummary(p: Proposal) {
  return {
    id: p.id,
    title: p.title,
    client: p.clientName,
    status: statusLabels[p.status],
    stage: p.workflowStage?.replace(/_/g, " ") ?? "not started",
    dueDate: p.dueDate ? new Date(p.dueDate).toISOString().slice(0, 10) : undefined,
    updatedAt: new Date(p.updatedAt).toISOString().slice(0, 10),
  };
}

// The proposal currently open in the app, if the user is on a proposal page —
// lets "approve it" / "add a comment" work without naming the proposal.
function currentProposalId(ctx: ToolContext): string | null {
  const match = ctx.pathname.match(/^\/proposals\/([^/]+)/);
  if (!match || match[1] === "new") return null;
  return match[1];
}

function currentLeadId(ctx: ToolContext): string | null {
  const match = ctx.pathname.match(/^\/leads\/([^/]+)/);
  if (!match || match[1] === "new") return null;
  return match[1];
}

async function resolveLeadWithContext(
  idOrName: string,
  ctx: ToolContext
): Promise<{ lead: Lead } | { error: string }> {
  if (!idOrName || /^(it|this|current|this one)$/i.test(idOrName)) {
    const currentId = currentLeadId(ctx);
    if (currentId) {
      const lead = await getLead(currentId);
      if (lead) return { lead };
    }
    if (!idOrName) return { error: "Missing lead id or name, and no lead page is open" };
  }
  return resolveLead(idOrName);
}

/** Truncate long text for TOOL_RESULT payloads (LLM context is limited). */
function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

async function resolveProposalWithContext(
  idOrTitle: string,
  ctx: ToolContext
): Promise<{ proposal: Proposal } | { error: string }> {
  if (!idOrTitle || /^(it|this|current|this one)$/i.test(idOrTitle)) {
    const currentId = currentProposalId(ctx);
    if (currentId) {
      const proposal = await getProposal(currentId);
      if (proposal) return { proposal };
    }
    if (!idOrTitle) return { error: "Missing proposal id or title, and no proposal page is open" };
  }
  return resolveProposal(idOrTitle);
}

export const JARVIS_TOOLS: ToolDefinition[] = [
  // ── Read-only (auto-execute) ──────────────────────────────────────────────
  {
    name: "get_proposal_stats",
    description: "Counts of proposals by status (draft, submitted, under review, approved, rejected) plus total.",
    argsSchema: "{} — no arguments",
    mutating: false,
    execute: async () => {
      const proposals = await getProposals();
      const byStatus: Record<string, number> = {};
      for (const p of proposals) {
        const label = statusLabels[p.status];
        byStatus[label] = (byStatus[label] ?? 0) + 1;
      }
      return { ok: true, data: { total: proposals.length, byStatus } };
    },
  },
  {
    name: "search_proposals",
    description:
      "Search/list proposals with conditions: text query, status, due-date window, and sorting.",
    argsSchema:
      '{ "query"?: string, "status"?: "draft" | "submitted" | "under_review" | "approved" | "rejected", "dueAfter"?: "YYYY-MM-DD", "dueBefore"?: "YYYY-MM-DD", "sortBy"?: "dueDate" | "updatedAt" | "title", "limit"?: number }',
    mutating: false,
    execute: async (args) => {
      const query = str(args, "query").toLowerCase();
      const status = str(args, "status");
      const dueAfter = str(args, "dueAfter");
      const dueBefore = str(args, "dueBefore");
      const sortBy = str(args, "sortBy");
      const limit = num(args, "limit") ?? 10;
      let proposals = await getProposals();
      if (status) proposals = proposals.filter((p) => p.status === status);
      if (query) {
        proposals = proposals.filter(
          (p) =>
            p.title.toLowerCase().includes(query) || p.clientName.toLowerCase().includes(query)
        );
      }
      if (dueAfter) {
        const t = new Date(dueAfter).getTime();
        proposals = proposals.filter((p) => p.dueDate && new Date(p.dueDate).getTime() >= t);
      }
      if (dueBefore) {
        const t = new Date(dueBefore).getTime();
        proposals = proposals.filter((p) => p.dueDate && new Date(p.dueDate).getTime() <= t);
      }
      if (sortBy === "dueDate") {
        proposals.sort(
          (a, b) =>
            new Date(a.dueDate ?? 8640000000000000).getTime() -
            new Date(b.dueDate ?? 8640000000000000).getTime()
        );
      } else if (sortBy === "title") {
        proposals.sort((a, b) => a.title.localeCompare(b.title));
      }
      return {
        ok: true,
        data: { count: proposals.length, proposals: proposals.slice(0, limit).map(proposalSummary) },
      };
    },
  },
  {
    name: "get_proposal_context",
    description:
      "Full context of one proposal for summarizing it or drafting an email/comment about it: details, team, recent comments, workflow timeline, and document excerpts.",
    argsSchema: '{ "idOrTitle": string } — use "it" for the currently open proposal',
    mutating: false,
    execute: async (args, ctx) => {
      const resolved = await resolveProposalWithContext(str(args, "idOrTitle"), ctx);
      if ("error" in resolved) return { ok: false, error: resolved.error };
      // Re-fetch fully hydrated — list views drop document text payloads.
      const p = (await getProposal(resolved.proposal.id)) ?? resolved.proposal;
      const reviewMap = await getDeepReviewMap();
      const review = reviewMap.get(p.id);
      return {
        ok: true,
        data: {
          ...proposalSummary(p),
          description: p.description,
          technology: p.technology,
          projectType: p.projectType,
          sparcOwner: p.sparcOwner,
          sparcMentor: p.sparcMentor,
          gtmOwner: p.gtmOwner,
          reviewer: p.proposalReviewer,
          region: p.proposalRegion,
          aiReview: review
            ? { overallScore: review.overall_score, verdict: review.verdict, summary: review.summary }
            : undefined,
          recentComments: p.comments.slice(-8).map((c) => ({
            author: c.author,
            date: new Date(c.createdAt).toISOString().slice(0, 10),
            text: clip(c.text, 300),
          })),
          workflowTimeline: p.workflowEvents.slice(-10).map((e) => ({
            date: new Date(e.createdAt).toISOString().slice(0, 10),
            event: e.type,
            stage: e.toStage,
            actor: e.actor,
            note: e.note ? clip(e.note, 120) : undefined,
          })),
          documents: p.documents.map((d) => ({
            name: d.name,
            category: d.category,
            excerpt: clip(d.extractedText ?? d.content ?? "", 1200) || undefined,
          })),
        },
      };
    },
  },
  {
    name: "get_lead_details",
    description:
      "Full context of one lead for summarizing it or drafting a follow-up email: details, status, event progress, requirement summary, and document names.",
    argsSchema: '{ "idOrTitle": string } — lead id, Kytes ID, or name; use "it" for the currently open lead',
    mutating: false,
    execute: async (args, ctx) => {
      const resolved = await resolveLeadWithContext(str(args, "idOrTitle"), ctx);
      if ("error" in resolved) return { ok: false, error: resolved.error };
      const l = resolved.lead;
      return {
        ok: true,
        data: {
          id: l.id,
          name: l.leadName,
          kytesId: l.kytesId,
          client: l.clientName,
          status: leadStatusLabels[l.status],
          receivedVia: l.receivedVia,
          gtmOwner: l.gtmName,
          vertical: l.vertical,
          leadType: l.leadType,
          requirementSummary: clip(l.requirementSummary ?? "", 1200),
          currentEvent: l.currentEvent,
          linkedProposalId: l.proposalId,
          documents: l.documents.map((d) => ({ name: d.name, category: d.category })),
          createdAt: new Date(l.createdAt).toISOString().slice(0, 10),
        },
      };
    },
  },
  {
    name: "ask_documents",
    description:
      "Search inside the text of uploaded documents (RFPs, transcripts, proposals) and return the most relevant passages. Use to answer questions about document contents.",
    argsSchema:
      '{ "query": string, "proposalIdOrTitle"?: string } — scope to one proposal (or "it"), otherwise searches all documents',
    mutating: false,
    execute: async (args, ctx) => {
      const query = str(args, "query");
      if (!query) return { ok: false, error: "Missing search query" };

      let proposalId: string | undefined;
      const scope = str(args, "proposalIdOrTitle");
      if (scope || currentProposalId(ctx)) {
        const resolved = await resolveProposalWithContext(scope, ctx);
        if (!("error" in resolved)) proposalId = resolved.proposal.id;
        else if (scope) return { ok: false, error: resolved.error };
      }

      const docs = await getSearchableDocuments(proposalId);
      if (docs.length === 0) {
        return { ok: false, error: "No documents with extracted text found in that scope." };
      }

      const proposals = await getProposals();
      const titleById = new Map(proposals.map((p) => [p.id, p.title]));
      const terms = query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 2);

      // Simple client-side retrieval: chunk each document, score by term hits.
      const scored: { doc: string; proposal?: string; chunk: string; score: number }[] = [];
      for (const doc of docs) {
        const text = doc.extractedText ?? doc.content ?? "";
        for (let i = 0; i < text.length && i < 200_000; i += 900) {
          const chunk = text.slice(i, i + 1100);
          const lower = chunk.toLowerCase();
          let score = 0;
          for (const term of terms) {
            let idx = lower.indexOf(term);
            while (idx !== -1) {
              score++;
              idx = lower.indexOf(term, idx + term.length);
            }
          }
          if (score > 0) {
            scored.push({
              doc: doc.name,
              proposal: titleById.get(doc.proposalId),
              chunk: clip(chunk, 700),
              score,
            });
          }
        }
      }
      scored.sort((a, b) => b.score - a.score);
      if (scored.length === 0) {
        return {
          ok: true,
          data: { found: false, note: `No passages matched "${query}" in ${docs.length} document(s).` },
        };
      }
      return { ok: true, data: { found: true, passages: scored.slice(0, 4) } };
    },
  },
  {
    name: "get_analytics",
    description:
      "Computed workspace metrics: proposal counts, approval rate, average review cycle time, AI review scores, monthly volume, and lead pipeline.",
    argsSchema: "{} — no arguments",
    mutating: false,
    execute: async () => {
      const [proposals, leads, reviewMap] = await Promise.all([
        getProposals(),
        getLeads(),
        getDeepReviewMap(),
      ]);

      const byStatus: Record<string, number> = {};
      for (const p of proposals) {
        byStatus[statusLabels[p.status]] = (byStatus[statusLabels[p.status]] ?? 0) + 1;
      }
      const approved = proposals.filter((p) => p.status === "approved").length;
      const rejected = proposals.filter((p) => p.status === "rejected").length;
      const finalized = approved + rejected;

      // Cycle time: creation → the workflow event that finalized the proposal.
      const cycleDays: number[] = [];
      for (const p of proposals) {
        const finalEvent = p.workflowEvents.find(
          (e) => e.toStage === "approved" || e.toStage === "rejected"
        );
        if (finalEvent) {
          const days =
            (new Date(finalEvent.createdAt).getTime() - new Date(p.createdAt).getTime()) /
            86_400_000;
          if (days >= 0) cycleDays.push(days);
        }
      }

      const monthly: Record<string, number> = {};
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      for (const p of proposals) {
        const d = new Date(p.createdAt);
        if (d >= sixMonthsAgo) {
          const key = d.toISOString().slice(0, 7);
          monthly[key] = (monthly[key] ?? 0) + 1;
        }
      }

      const scores = [...reviewMap.values()].map((r) => r.overall_score);
      const leadsByStatus: Record<string, number> = {};
      for (const l of leads) {
        leadsByStatus[leadStatusLabels[l.status]] = (leadsByStatus[leadStatusLabels[l.status]] ?? 0) + 1;
      }

      return {
        ok: true,
        data: {
          proposals: { total: proposals.length, byStatus },
          approvalRatePercent: finalized ? Math.round((approved / finalized) * 100) : null,
          avgReviewCycleDays: cycleDays.length
            ? Math.round((cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length) * 10) / 10
            : null,
          aiReviews: scores.length
            ? {
                count: scores.length,
                avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
              }
            : null,
          proposalsCreatedByMonth: monthly,
          leads: { total: leads.length, byStatus: leadsByStatus },
        },
      };
    },
  },
  {
    name: "get_proposal_details",
    description:
      "Full summary of one proposal: status, workflow stage, review score, team, and latest comments.",
    argsSchema: '{ "idOrTitle": string } — proposal id or (partial) title; use "it" for the currently open proposal',
    mutating: false,
    execute: async (args, ctx) => {
      const resolved = await resolveProposalWithContext(str(args, "idOrTitle"), ctx);
      if ("error" in resolved) return { ok: false, error: resolved.error };
      const p = resolved.proposal;
      const reviewMap = await getDeepReviewMap();
      const review = reviewMap.get(p.id);
      return {
        ok: true,
        data: {
          ...proposalSummary(p),
          description: p.description,
          technology: p.technology,
          sparcOwner: p.sparcOwner,
          reviewer: p.proposalReviewer,
          documents: p.documents.length,
          aiReview: review
            ? { overallScore: review.overall_score, verdict: review.verdict, summary: review.summary }
            : undefined,
          latestComments: p.comments
            .slice(-3)
            .map((c) => ({ author: c.author, text: c.text })),
        },
      };
    },
  },
  {
    name: "search_leads",
    description: "Search leads (Proposal Master) by name or client, optionally by status or recency.",
    argsSchema:
      '{ "query"?: string, "status"?: "new" | "qualified" | "proposal" | "converted" | "on_hold" | "dropped", "sinceDays"?: number }',
    mutating: false,
    execute: async (args) => {
      const query = str(args, "query").toLowerCase();
      const status = str(args, "status");
      const sinceDays = num(args, "sinceDays");
      let leads = await getLeads();
      if (status) leads = leads.filter((l) => l.status === status);
      if (sinceDays !== undefined) {
        const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
        leads = leads.filter((l) => new Date(l.createdAt).getTime() >= cutoff);
      }
      if (query) {
        leads = leads.filter(
          (l) =>
            l.leadName.toLowerCase().includes(query) ||
            l.clientName.toLowerCase().includes(query) ||
            l.gtmName.toLowerCase().includes(query)
        );
      }
      return {
        ok: true,
        data: {
          count: leads.length,
          leads: leads.slice(0, 10).map((l) => ({
            id: l.id,
            name: l.leadName,
            client: l.clientName,
            status: leadStatusLabels[l.status],
            gtmOwner: l.gtmName,
            vertical: l.vertical,
            createdAt: new Date(l.createdAt).toISOString().slice(0, 10),
          })),
        },
      };
    },
  },
  {
    name: "get_recent_activity",
    description: "Latest team activities (who is working on what, and when).",
    argsSchema: '{ "limit"?: number } — default 5',
    mutating: false,
    execute: async (args) => {
      const limit = num(args, "limit") ?? 5;
      const activities = await getTeamActivities();
      const sorted = [...activities].sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
      return {
        ok: true,
        data: sorted.slice(0, limit).map((a) => ({
          member: a.memberName,
          title: a.title,
          category: a.category,
          from: new Date(a.startDate).toISOString().slice(0, 10),
          to: new Date(a.endDate).toISOString().slice(0, 10),
        })),
      };
    },
  },

  // ── Navigation (auto-execute) ─────────────────────────────────────────────
  {
    name: "navigate",
    description: "Go to an app page.",
    argsSchema:
      '{ "page": "dashboard" | "proposals" | "leads" | "analytics" | "settings" | "team-activity" | "rules" | "profiles" }',
    mutating: false,
    execute: async (args, ctx) => {
      const page = str(args, "page").toLowerCase();
      const path = PAGES[page];
      if (!path) {
        return { ok: false, error: `Unknown page "${page}". Valid pages: ${Object.keys(PAGES).join(", ")}` };
      }
      ctx.navigate(path);
      return { ok: true, data: { navigatedTo: path } };
    },
  },
  {
    name: "open_proposal",
    description: "Open a specific proposal's detail page.",
    argsSchema: '{ "idOrTitle": string }',
    mutating: false,
    execute: async (args, ctx) => {
      const resolved = await resolveProposal(str(args, "idOrTitle"));
      if ("error" in resolved) return { ok: false, error: resolved.error };
      ctx.navigate(`/proposals/${resolved.proposal.id}`);
      return { ok: true, data: { opened: proposalSummary(resolved.proposal) } };
    },
  },
  {
    name: "open_lead",
    description: "Open a specific lead's detail page.",
    argsSchema: '{ "idOrTitle": string } — lead id, Kytes ID, or (partial) lead/client name',
    mutating: false,
    execute: async (args, ctx) => {
      const resolved = await resolveLead(str(args, "idOrTitle"));
      if ("error" in resolved) return { ok: false, error: resolved.error };
      ctx.navigate(`/leads/${resolved.lead.id}`);
      return {
        ok: true,
        data: { opened: { id: resolved.lead.id, name: resolved.lead.leadName, client: resolved.lead.clientName } },
      };
    },
  },

  // ── Mutating (ALWAYS confirmed by the user first) ─────────────────────────
  {
    name: "add_comment",
    description: "Add a comment to a proposal (as the active profile).",
    argsSchema: '{ "proposalIdOrTitle": string, "comment": string }',
    mutating: true,
    describeCall: (args) =>
      `Add comment to proposal "${str(args, "proposalIdOrTitle") || "(current)"}": “${str(args, "comment")}”`,
    execute: async (args, ctx) => {
      const comment = str(args, "comment");
      if (!comment) return { ok: false, error: "Comment text is empty" };
      const resolved = await resolveProposalWithContext(str(args, "proposalIdOrTitle"), ctx);
      if ("error" in resolved) return { ok: false, error: resolved.error };
      const profile = await getActiveProfile();
      await addComment(resolved.proposal.id, profile?.name ?? "Jarvis user", comment);
      return {
        ok: true,
        data: { commentAddedTo: resolved.proposal.title },
      };
    },
  },
  {
    name: "set_proposal_action",
    description:
      "Apply a workflow decision to a proposal: approve, reject, or request changes. Only valid from the matching review/feedback stage — errors report why.",
    argsSchema:
      '{ "proposalIdOrTitle": string, "action": "approve" | "reject" | "request-changes", "note"?: string }',
    mutating: true,
    describeCall: (args) => {
      const action = str(args, "action").replace(/-/g, " ");
      return `${action.charAt(0).toUpperCase() + action.slice(1)} proposal "${str(args, "proposalIdOrTitle") || "(current)"}"`;
    },
    execute: async (args, ctx) => {
      const actionArg = str(args, "action").toLowerCase();
      const actionType: WorkflowAction["type"] | null =
        actionArg === "approve"
          ? "approve"
          : actionArg === "reject"
            ? "reject"
            : actionArg === "request-changes" || actionArg === "request_changes"
              ? "request_changes"
              : null;
      if (!actionType) {
        return { ok: false, error: `Unknown action "${actionArg}". Use approve, reject, or request-changes.` };
      }
      const resolved = await resolveProposalWithContext(str(args, "proposalIdOrTitle"), ctx);
      if ("error" in resolved) return { ok: false, error: resolved.error };
      const note = str(args, "note") || undefined;
      // Same code path as the proposal detail page buttons — no duplicated rules.
      const updated = await applyWorkflowAction(resolved.proposal.id, { type: actionType, note });
      return {
        ok: true,
        data: {
          proposal: updated.title,
          newStatus: statusLabels[updated.status],
          newStage: updated.workflowStage?.replace(/_/g, " "),
        },
      };
    },
  },
  {
    name: "run_ai_review",
    description:
      "Run the AI deep review on a proposal's documents (takes a minute, uses the configured LLM, replaces any saved review), then open the report.",
    argsSchema: '{ "proposalIdOrTitle": string } — use "it" for the currently open proposal',
    mutating: true,
    describeCall: (args) =>
      `Run the AI deep review on proposal "${str(args, "proposalIdOrTitle") || "(current)"}" — this calls your configured LLM and replaces any previously saved review`,
    execute: async (args, ctx) => {
      const resolved = await resolveProposalWithContext(str(args, "proposalIdOrTitle"), ctx);
      if ("error" in resolved) return { ok: false, error: resolved.error };
      // Full hydration — the review needs document text, which list views drop.
      const proposal = await getProposal(resolved.proposal.id);
      if (!proposal) return { ok: false, error: "Proposal not found" };

      // Same flow as app/proposals/[id]/ai-review — no duplicated engine logic.
      const { extractFinalProposalAndContext, getLatestDocsForCategory } = await import("@/lib/deep-review/extract");
      const { runDeepReview } = await import("@/lib/deep-review/engine");
      const { getDefaultStrictness } = await import("@/lib/deep-review/settings");

      const { finalProposalText, contextText } = extractFinalProposalAndContext(proposal);
      const proposalText =
        finalProposalText.trim() ||
        proposal.documents.map((d) => d.extractedText || "").join("\n\n").trim();
      if (!proposalText) {
        return {
          ok: false,
          error:
            "No readable document text on this proposal. Upload a final proposal document (PDF, DOCX, or TXT) first.",
        };
      }

      const finalDoc = getLatestDocsForCategory(proposal, "final_proposal")[0];
      const rules = await getActiveDeepRules();
      const result = await runDeepReview({
        proposalId: proposal.id,
        fileName: finalDoc?.name || `${proposal.title}.txt`,
        proposalText,
        contextText,
        strictness: getDefaultStrictness(),
        rules,
      });
      await saveDeepReview(result);
      ctx.navigate(`/proposals/${proposal.id}/ai-review`);
      return {
        ok: true,
        data: {
          proposal: proposal.title,
          overallScore: result.overall_score,
          verdict: result.verdict,
          summary: clip(result.summary, 400),
          criteriaPassed: `${result.criteria_passed}/${result.criteria_total}`,
          reportOpened: true,
        },
      };
    },
  },
  {
    name: "create_lead_draft",
    description:
      "Start a new lead draft: opens the New Lead form prefilled with the given details (nothing is saved until the user submits).",
    argsSchema: '{ "name": string, "company"?: string, "notes"?: string }',
    mutating: true,
    describeCall: (args) =>
      `Open a new lead draft for "${str(args, "name")}"${str(args, "company") ? ` (${str(args, "company")})` : ""}`,
    execute: async (args, ctx) => {
      const name = str(args, "name");
      if (!name) return { ok: false, error: "Lead name is required" };
      window.sessionStorage.setItem(
        LEAD_DRAFT_STORAGE_KEY,
        JSON.stringify({
          leadName: name,
          clientName: str(args, "company"),
          requirementSummary: str(args, "notes"),
        })
      );
      ctx.navigate("/leads/new");
      return { ok: true, data: { draftOpenedFor: name } };
    },
  },
];

export function getTool(name: string): ToolDefinition | undefined {
  return JARVIS_TOOLS.find((t) => t.name === name);
}

/** Execute a tool with honest error surfaces — exceptions become ToolResult errors. */
export async function executeTool(
  tool: ToolDefinition,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    return await tool.execute(args, ctx);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
